/**
 * Orchestrator — Multi-Agent Coordination Engine
 * 
 * Implements the strict flow:
 *   analyze → fix → commit → push → check_ci → retry_if_failed
 * 
 * Coordinates: AnalysisAgent (external), FixAgent, CIAgent
 * Max 5 retries.
 */

export class Orchestrator {
    constructor({ fixAgent, ciAgent, branchManager, prCreator, branchName, defaultBranch, maxRetries = 5, onProgress }) {
        this.fixAgent = fixAgent;
        this.ciAgent = ciAgent;
        this.branchManager = branchManager;
        this.prCreator = prCreator;
        this.branchName = branchName;
        this.defaultBranch = defaultBranch;
        this.maxRetries = maxRetries;
        this.onProgress = onProgress || (() => {});

        // Track state
        this.fixes = [];
        this.ciTimeline = [];
        this.retryCount = 0;
    }

    /**
     * Run the orchestration pipeline
     * 
     * @param {Array} issues - Detected issues from AnalysisAgent
     * @returns {Object} - { fixesApplied, ciStatus, retryCount, prUrl, fixes, ciTimeline }
     */
    async run(issues) {
        this.onProgress({ message: `Orchestrator starting with ${issues.length} issues` });

        // PHASE 1: Apply initial fixes
        const fixResults = await this._applyFixes(issues);
        this.onProgress({ message: `Applied ${fixResults.length} fixes` });

        if (fixResults.length === 0) {
            return {
                fixesApplied: 0,
                ciStatus: 'SKIPPED',
                retryCount: 0,
                prUrl: null,
                fixes: this.fixes,
                ciTimeline: this.ciTimeline,
            };
        }

        // PHASE 2: Create PR
        this.onProgress({ message: 'Creating Pull Request...' });
        const { prUrl, prNumber } = await this.prCreator.createPR(
            this.branchName,
            this.defaultBranch,
            {
                issues,
                fixes: this.fixes,
                retryCount: this.retryCount,
                ciStatus: 'PENDING',
            }
        );

        // PHASE 3: CI monitoring + retry loop
        const ciResult = await this._ciRetryLoop(issues, prUrl, prNumber);

        return {
            fixesApplied: this.fixes.filter((f) => f.status === 'applied').length,
            ciStatus: ciResult.status,
            retryCount: this.retryCount,
            prUrl,
            fixes: this.fixes,
            ciTimeline: this.ciTimeline,
        };
    }

    /**
     * PHASE 1: Apply fixes for all issues
     */
    async _applyFixes(issues) {
        const appliedFixes = [];
        // Group issues by file for efficient processing
        const issuesByFile = {};
        for (const issue of issues) {
            if (!issuesByFile[issue.file]) {
                issuesByFile[issue.file] = [];
            }
            issuesByFile[issue.file].push(issue);
        }

        // Process each file
        for (const [filePath, fileIssues] of Object.entries(issuesByFile)) {
            this.onProgress({ message: `Fixing ${filePath} (${fileIssues.length} issues)...` });

            // Get current file content from the branch
            let content = await this.branchManager.getFileContent(filePath, this.branchName);
            if (!content) {
                this.onProgress({ message: `  Skipping ${filePath} — file not found` });
                for (const issue of fileIssues) {
                    this.fixes.push({
                        file: filePath,
                        line: issue.line,
                        bug_type: issue.bug_type,
                        commitMessage: '',
                        status: 'skipped',
                        explanation: 'File not found on branch',
                    });
                }
                continue;
            }

            // Apply fixes one by one (FixAgent processes one issue at a time)
            let currentContent = content;
            const fileFixMessages = [];

            for (const issue of fileIssues) {
                try {
                    const fix = await this.fixAgent.generateFix(issue, currentContent);

                    if (fix.success && fix.fixedCode !== currentContent) {
                        currentContent = fix.fixedCode;
                        fileFixMessages.push(fix.commitMessage);

                        this.fixes.push({
                            file: filePath,
                            line: issue.line,
                            bug_type: issue.bug_type,
                            commitMessage: fix.commitMessage,
                            status: 'applied',
                            explanation: fix.explanation,
                        });

                        appliedFixes.push({ filePath, issue, fix });
                        this.onProgress({ message: `  ✓ Fixed ${issue.bug_type} at line ${issue.line}` });
                    } else {
                        this.fixes.push({
                            file: filePath,
                            line: issue.line,
                            bug_type: issue.bug_type,
                            commitMessage: '',
                            status: 'unfixable',
                            explanation: fix.explanation || 'No fix available',
                        });
                        this.onProgress({ message: `  ✗ Could not fix ${issue.bug_type} at line ${issue.line}` });
                    }
                } catch (error) {
                    console.error(`[Orchestrator] Fix error for ${filePath}:${issue.line}:`, error.message);
                    this.fixes.push({
                        file: filePath,
                        line: issue.line,
                        bug_type: issue.bug_type,
                        commitMessage: '',
                        status: 'error',
                        explanation: error.message,
                    });
                }
            }

            // Commit the file if it was modified
            if (currentContent !== content && fileFixMessages.length > 0) {
                const commitMsg = fileFixMessages.length === 1
                    ? fileFixMessages[0]
                    : `[AI-AGENT] Fix ${fileFixMessages.length} issues in ${filePath}`;

                try {
                    await this.branchManager.commitFile(
                        this.branchName,
                        filePath,
                        currentContent,
                        commitMsg
                    );
                    this.onProgress({ message: `  📝 Committed ${filePath}` });
                } catch (error) {
                    console.error(`[Orchestrator] Commit error for ${filePath}:`, error.message);
                    // Mark fixes as failed
                    for (const fix of this.fixes) {
                        if (fix.file === filePath && fix.status === 'applied') {
                            fix.status = 'commit_failed';
                        }
                    }
                }
            }
        }

        return appliedFixes;
    }

    /**
     * PHASE 3: CI monitoring with retry loop (max 5 retries)
     */
    async _ciRetryLoop(issues, prUrl, prNumber) {
        // Check if CI is configured
        const hasCi = await this.ciAgent.hasCIConfigured(this.branchName);
        if (!hasCi) {
            this.onProgress({ message: 'No CI/CD configured — skipping CI monitoring' });
            this.ciTimeline.push({
                iteration: 0,
                timestamp: new Date().toISOString(),
                status: 'NO_CI',
                message: 'No CI/CD checks configured for this repository',
            });
            return { status: 'NO_CI' };
        }

        while (this.retryCount < this.maxRetries) {
            this.retryCount++;
            this.onProgress({ message: `CI check attempt ${this.retryCount}/${this.maxRetries}...` });

            // Get latest commit on the branch
            const commitSha = await this.branchManager.getLatestCommitSha(this.branchName);

            // Wait for CI checks
            const ciResult = await this.ciAgent.waitForChecks(commitSha, 300000);

            // Record in timeline
            this.ciTimeline.push({
                iteration: this.retryCount,
                timestamp: new Date().toISOString(),
                status: ciResult.status,
                checks: ciResult.checks,
                commitSha: commitSha.substring(0, 7),
            });

            if (ciResult.status === 'PASSED') {
                this.onProgress({ message: `✅ CI passed on attempt ${this.retryCount}!` });
                // Update PR body with final status
                await this.prCreator._updatePRBody(prNumber, {
                    issues,
                    fixes: this.fixes,
                    retryCount: this.retryCount,
                    ciStatus: 'PASSED',
                });
                return { status: 'PASSED' };
            }

            // CI FAILED — extract logs and try to fix
            this.onProgress({
                message: `❌ CI failed (attempt ${this.retryCount}/${this.maxRetries}). Analyzing failures...`,
            });

            if (this.retryCount >= this.maxRetries) {
                break;
            }

            // Convert CI failures to issues and try to fix them
            const ciIssues = ciResult.failureLogs.map((log) => ({
                file: log.file || 'unknown',
                line: log.line || 0,
                bug_type: this._classifyCIFailure(log),
                description: log.message,
                code_snippet: '',
                source: 'ci',
            }));

            if (ciIssues.length > 0) {
                this.onProgress({ message: `Attempting to fix ${ciIssues.length} CI failures...` });
                await this._applyFixes(ciIssues.filter((i) => i.file && i.file !== 'unknown'));
            }

            // Update PR
            await this.prCreator._updatePRBody(prNumber, {
                issues,
                fixes: this.fixes,
                retryCount: this.retryCount,
                ciStatus: 'RETRYING',
            });

            // Brief pause before next check
            await new Promise((resolve) => setTimeout(resolve, 5000));
        }

        // Max retries exhausted
        this.onProgress({ message: `⚠️ Max retries (${this.maxRetries}) exhausted. CI still failing.` });
        await this.prCreator._updatePRBody(prNumber, {
            issues,
            fixes: this.fixes,
            retryCount: this.retryCount,
            ciStatus: 'FAILED',
        });

        return { status: 'FAILED' };
    }

    /**
     * Classify CI failure into bug type
     */
    _classifyCIFailure(log) {
        const msg = (log.message || '').toLowerCase();
        if (msg.includes('syntax')) return 'SYNTAX';
        if (msg.includes('import') || msg.includes('module')) return 'IMPORT';
        if (msg.includes('type') || msg.includes('undefined')) return 'TYPE_ERROR';
        if (msg.includes('indent') || msg.includes('whitespace')) return 'INDENTATION';
        if (msg.includes('lint')) return 'LINTING';
        return 'LOGIC';
    }
}

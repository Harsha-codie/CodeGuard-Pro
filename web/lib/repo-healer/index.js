/**
 * RepoHealerEngine — Autonomous Repository Healing System
 * 
 * This is the main orchestrator for the "repo_heal" mode.
 * It clones a repo, discovers/runs tests, runs AST analysis,
 * applies AI-powered fixes, and creates a PR with the healing branch.
 * 
 * DOES NOT touch existing PR review workflow.
 */

import { RepoCloner } from './cloner';
import { TestRunner } from './test-runner';
import { RepoAnalyzer } from './analyzer';
import { FixAgent } from './agents/fix-agent';
import { CIAgent } from './agents/ci-agent';
import { Orchestrator } from './agents/orchestrator';
import { BranchManager } from './branch-manager';
import { PRCreator } from './pr-creator';

export class RepoHealerEngine {
    constructor({ repoUrl, teamName, leaderName }) {
        this.repoUrl = repoUrl;
        this.teamName = teamName;
        this.leaderName = leaderName;

        // Parse owner/repo from URL
        const parsed = this._parseRepoUrl(repoUrl);
        this.owner = parsed.owner;
        this.repo = parsed.repo;

        // Generate branch name: TEAMNAME_LEADERNAME_AI_Fix
        this.branchName = this._generateBranchName(teamName, leaderName);

        // State tracking
        this.startTime = null;
        this.results = {
            repo: repoUrl,
            branch_created: this.branchName,
            total_failures_detected: 0,
            total_fixes_applied: 0,
            final_ci_status: 'PENDING',
            retry_count: 0,
            execution_time: 0,
            pr_url: null,
            issues: [],
            fixes: [],
            ci_timeline: [],
        };

        // Module instances (initialized in run())
        this.cloner = null;
        this.testRunner = null;
        this.analyzer = null;
        this.fixAgent = null;
        this.ciAgent = null;
        this.orchestrator = null;
        this.branchManager = null;
        this.prCreator = null;

        // Event callbacks for real-time dashboard updates
        this._onProgress = null;
    }

    /**
     * Set progress callback for real-time updates
     */
    onProgress(callback) {
        this._onProgress = callback;
    }

    /**
     * Emit progress event
     */
    _emit(stage, data) {
        if (this._onProgress) {
            this._onProgress({ stage, timestamp: new Date().toISOString(), ...data });
        }
        console.log(`[RepoHealer] [${stage}]`, data?.message || '');
    }

    /**
     * Main execution pipeline — STRICT ORDER
     */
    async run() {
        this.startTime = Date.now();
        this._emit('start', { message: `Starting healing for ${this.owner}/${this.repo}` });

        try {
            // STEP 1 — Clone Repository
            this._emit('clone', { message: 'Cloning repository...' });
            this.cloner = new RepoCloner(this.owner, this.repo);
            const { localPath, defaultBranch, installationId } = await this.cloner.clone();
            this._emit('clone', { message: `Cloned to ${localPath}, branch: ${defaultBranch}` });

            // STEP 2 — Discover & Run Tests
            this._emit('test', { message: 'Discovering and running tests...' });
            this.testRunner = new TestRunner(localPath);
            const testResults = await this.testRunner.discoverAndRun();
            this._emit('test', {
                message: `Tests complete: ${testResults.failures.length} failures found`,
                failures: testResults.failures.length,
            });

            // STEP 3 — AST Static Analysis
            this._emit('analyze', { message: 'Running AST analysis on full repository...' });
            this.analyzer = new RepoAnalyzer(localPath);
            const astIssues = await this.analyzer.analyze();
            this._emit('analyze', {
                message: `AST analysis complete: ${astIssues.length} issues found`,
                issues: astIssues.length,
            });

            // Merge test failures + AST issues into unified issue list
            const allIssues = this._mergeIssues(testResults.failures, astIssues);
            this.results.total_failures_detected = allIssues.length;
            this.results.issues = allIssues;

            if (allIssues.length === 0) {
                this._emit('complete', { message: 'No issues found! Repository is clean.' });
                this.results.final_ci_status = 'PASSED';
                this.results.execution_time = Date.now() - this.startTime;
                return this.results;
            }

            // STEP 4 — Create AI Branch
            this._emit('branch', { message: `Creating branch: ${this.branchName}` });
            this.branchManager = new BranchManager(this.owner, this.repo, installationId);
            await this.branchManager.createBranch(this.branchName, defaultBranch);
            this._emit('branch', { message: `Branch ${this.branchName} created` });

            // STEP 5 — Multi-Agent Fix Loop (Orchestrator)
            this._emit('fix', { message: 'Starting multi-agent fix orchestration...' });
            this.fixAgent = new FixAgent();
            this.ciAgent = new CIAgent(this.owner, this.repo, installationId);
            this.prCreator = new PRCreator(this.owner, this.repo, installationId);

            this.orchestrator = new Orchestrator({
                fixAgent: this.fixAgent,
                ciAgent: this.ciAgent,
                branchManager: this.branchManager,
                prCreator: this.prCreator,
                branchName: this.branchName,
                defaultBranch,
                maxRetries: 5,
                onProgress: (data) => this._emit('orchestrator', data),
            });

            const orchestrationResult = await this.orchestrator.run(allIssues);

            // Update results
            this.results.total_fixes_applied = orchestrationResult.fixesApplied;
            this.results.final_ci_status = orchestrationResult.ciStatus;
            this.results.retry_count = orchestrationResult.retryCount;
            this.results.pr_url = orchestrationResult.prUrl;
            this.results.fixes = orchestrationResult.fixes;
            this.results.ci_timeline = orchestrationResult.ciTimeline;

            this.results.execution_time = Date.now() - this.startTime;

            this._emit('complete', {
                message: `Healing complete! ${this.results.total_fixes_applied} fixes applied. CI: ${this.results.final_ci_status}`,
                results: this.results,
            });

            return this.results;

        } catch (error) {
            this.results.execution_time = Date.now() - this.startTime;
            this.results.final_ci_status = 'FAILED';
            this._emit('error', { message: error.message, stack: error.stack });
            throw error;
        } finally {
            // Cleanup cloned repo
            if (this.cloner) {
                await this.cloner.cleanup();
            }
        }
    }

    /**
     * Parse GitHub repo URL into owner/repo
     */
    _parseRepoUrl(url) {
        // Handle formats:
        // https://github.com/owner/repo
        // https://github.com/owner/repo.git
        // git@github.com:owner/repo.git
        const httpsMatch = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
        const sshMatch = url.match(/github\.com:([^/]+)\/([^/.]+)/);
        const match = httpsMatch || sshMatch;

        if (!match) {
            throw new Error(`Invalid GitHub URL: ${url}`);
        }

        return { owner: match[1], repo: match[2] };
    }

    /**
     * Generate branch name: TEAMNAME_LEADERNAME_AI_Fix
     * ALL CAPS, spaces → underscores, no special chars
     */
    _generateBranchName(teamName, leaderName) {
        const clean = (str) =>
            str.toUpperCase().replace(/[^A-Z0-9\s]/g, '').replace(/\s+/g, '_').trim();
        return `${clean(teamName)}_${clean(leaderName)}_AI_Fix`;
    }

    /**
     * Merge test failures and AST issues into unified format
     */
    _mergeIssues(testFailures, astIssues) {
        const issues = [];

        // Convert test failures to standard issue format
        for (const failure of testFailures) {
            issues.push({
                file: failure.file || 'unknown',
                line: failure.line || 0,
                bug_type: this._classifyTestFailure(failure),
                description: failure.message,
                code_snippet: failure.snippet || '',
                source: 'test',
            });
        }

        // AST issues are already in correct format
        for (const issue of astIssues) {
            issues.push({
                file: issue.file,
                line: issue.line,
                bug_type: issue.bug_type,
                description: issue.description,
                code_snippet: issue.code_snippet || '',
                source: 'ast',
            });
        }

        return issues;
    }

    /**
     * Classify a test failure into bug type enum
     */
    _classifyTestFailure(failure) {
        const msg = (failure.message || '').toLowerCase();
        if (msg.includes('syntax') || msg.includes('unexpected token')) return 'SYNTAX';
        if (msg.includes('import') || msg.includes('module') || msg.includes('require')) return 'IMPORT';
        if (msg.includes('type') || msg.includes('undefined is not')) return 'TYPE_ERROR';
        if (msg.includes('indent') || msg.includes('whitespace')) return 'INDENTATION';
        if (msg.includes('lint')) return 'LINTING';
        return 'LOGIC';
    }
}

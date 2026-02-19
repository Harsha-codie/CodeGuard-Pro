/**
 * LangGraph-based Multi-Agent Orchestrator
 * 
 * Replaces the manual sequential orchestrator with a formal
 * LangGraph StateGraph that controls flow and retry logic.
 * 
 * Graph Flow:
 *   analyze_repo → generate_fixes → apply_commit → push_branch
 *   → monitor_ci → retry_decision → (generate_fixes | end)
 * 
 * All existing modules (FixAgent, CIAgent, BranchManager, PRCreator)
 * are wrapped as LangGraph node functions. Business logic is untouched.
 * 
 * Gemini remains the LLM inside FixAgent.
 * LangGraph controls flow, state, and retry edges.
 */

import { StateGraph, Annotation, START, END } from '@langchain/langgraph';

// ===========================================================
// 1. STATE DEFINITION
// ===========================================================

const HealingState = Annotation.Root({
    // Input
    repo_url: Annotation({ reducer: (_, v) => v, default: () => '' }),
    team_name: Annotation({ reducer: (_, v) => v, default: () => '' }),
    leader_name: Annotation({ reducer: (_, v) => v, default: () => '' }),

    // Repo context
    default_branch: Annotation({ reducer: (_, v) => v, default: () => '' }),
    ai_branch: Annotation({ reducer: (_, v) => v, default: () => '' }),
    installation_id: Annotation({ reducer: (_, v) => v, default: () => null }),

    // Analysis
    issues: Annotation({ reducer: (_, v) => v, default: () => [] }),

    // Fixes
    fixes_applied: Annotation({
        reducer: (existing, incoming) => [...existing, ...incoming],
        default: () => [],
    }),

    // CI tracking
    retry_count: Annotation({ reducer: (_, v) => v, default: () => 0 }),
    ci_status: Annotation({ reducer: (_, v) => v, default: () => 'PENDING' }),
    ci_timeline: Annotation({
        reducer: (existing, incoming) => [...existing, ...incoming],
        default: () => [],
    }),

    // PR
    pr_url: Annotation({ reducer: (_, v) => v, default: () => null }),
    pr_number: Annotation({ reducer: (_, v) => v, default: () => null }),

    // Logs
    logs: Annotation({
        reducer: (existing, incoming) => [...existing, ...incoming],
        default: () => [],
    }),

    // Internal — service references (not serialized)
    _services: Annotation({ reducer: (_, v) => v, default: () => ({}) }),
});

// ===========================================================
// 2. NODE FUNCTIONS (wrappers around existing modules)
// ===========================================================

/**
 * Node: analyze_repo
 * Uses TestRunner + RepoAnalyzer to produce issue list.
 * (Analysis already done before graph — issues passed in as input)
 */
async function analyzeRepo(state) {
    const log = `[analyze_repo] Processing ${state.issues.length} issues from analysis phase`;
    console.log(log);

    // Issues are pre-populated by RepoHealerEngine (clone + test + AST happen before graph)
    // This node validates and logs the analysis results
    if (state.issues.length === 0) {
        return {
            ci_status: 'PASSED',
            logs: [{ stage: 'analyze_repo', message: 'No issues found — repo is clean', timestamp: new Date().toISOString() }],
        };
    }

    const byType = {};
    for (const issue of state.issues) {
        byType[issue.bug_type] = (byType[issue.bug_type] || 0) + 1;
    }

    const summary = Object.entries(byType).map(([t, c]) => `${t}: ${c}`).join(', ');

    return {
        logs: [{
            stage: 'analyze_repo',
            message: `Found ${state.issues.length} issues — ${summary}`,
            timestamp: new Date().toISOString(),
        }],
    };
}

/**
 * Node: generate_fixes
 * Uses FixAgent (Gemini-powered) to fix issues one at a time.
 */
async function generateFixes(state) {
    const { _services: svc } = state;
    const { fixAgent, branchManager, onProgress } = svc;
    const fixes = [];

    // Determine which issues to fix
    // On first run: all issues. On retry: CI failure issues from last round
    const issuesToFix = state.retry_count > 0
        ? state.issues.filter((i) => i.source === 'ci')
        : state.issues;

    onProgress?.({ stage: 'generate_fixes', message: `Generating fixes for ${issuesToFix.length} issues...` });

    // Group by file
    const issuesByFile = {};
    for (const issue of issuesToFix) {
        if (!issuesByFile[issue.file]) issuesByFile[issue.file] = [];
        issuesByFile[issue.file].push(issue);
    }

    for (const [filePath, fileIssues] of Object.entries(issuesByFile)) {
        let content = await branchManager.getFileContent(filePath, state.ai_branch);
        if (!content) {
            for (const issue of fileIssues) {
                fixes.push({
                    file: filePath, line: issue.line, bug_type: issue.bug_type,
                    commitMessage: '', status: 'skipped', explanation: 'File not found',
                });
            }
            continue;
        }

        let currentContent = content;
        const fileFixMessages = [];

        for (const issue of fileIssues) {
            try {
                const fix = await fixAgent.generateFix(issue, currentContent);
                if (fix.success && fix.fixedCode !== currentContent) {
                    currentContent = fix.fixedCode;
                    fileFixMessages.push(fix.commitMessage);
                    fixes.push({
                        file: filePath, line: issue.line, bug_type: issue.bug_type,
                        commitMessage: fix.commitMessage, status: 'applied', explanation: fix.explanation,
                    });
                    onProgress?.({ stage: 'generate_fixes', message: `  ✓ Fixed ${issue.bug_type} at ${filePath}:${issue.line}` });
                } else {
                    fixes.push({
                        file: filePath, line: issue.line, bug_type: issue.bug_type,
                        commitMessage: '', status: 'unfixable', explanation: fix.explanation || 'No fix available',
                    });
                }
            } catch (error) {
                fixes.push({
                    file: filePath, line: issue.line, bug_type: issue.bug_type,
                    commitMessage: '', status: 'error', explanation: error.message,
                });
            }
        }

        // Stash modified content for apply_commit
        if (currentContent !== content && fileFixMessages.length > 0) {
            // Store pending commit data on the fix entries
            const lastFix = fixes.filter((f) => f.file === filePath && f.status === 'applied').pop();
            if (lastFix) {
                lastFix._pendingCommit = {
                    filePath,
                    content: currentContent,
                    message: fileFixMessages.length === 1
                        ? fileFixMessages[0]
                        : `[AI-AGENT] Fix ${fileFixMessages.length} issues in ${filePath}`,
                };
            }
        }
    }

    return {
        fixes_applied: fixes,
        logs: [{
            stage: 'generate_fixes',
            message: `Generated ${fixes.filter((f) => f.status === 'applied').length} fixes`,
            timestamp: new Date().toISOString(),
        }],
    };
}

/**
 * Node: apply_commit
 * Uses BranchManager to commit fixed files to the AI branch.
 */
async function applyCommit(state) {
    const { _services: svc } = state;
    const { branchManager, onProgress } = svc;

    // Find fixes with pending commits
    const pendingCommits = state.fixes_applied
        .filter((f) => f._pendingCommit)
        .map((f) => f._pendingCommit);

    if (pendingCommits.length === 0) {
        return {
            logs: [{ stage: 'apply_commit', message: 'No commits to apply', timestamp: new Date().toISOString() }],
        };
    }

    onProgress?.({ stage: 'apply_commit', message: `Committing ${pendingCommits.length} files...` });

    for (const commit of pendingCommits) {
        try {
            await branchManager.commitFile(
                state.ai_branch,
                commit.filePath,
                commit.content,
                commit.message,
            );
            onProgress?.({ stage: 'apply_commit', message: `  📝 Committed ${commit.filePath}` });
        } catch (error) {
            console.error(`[apply_commit] Commit error for ${commit.filePath}:`, error.message);
        }
    }

    return {
        logs: [{
            stage: 'apply_commit',
            message: `Committed ${pendingCommits.length} files to ${state.ai_branch}`,
            timestamp: new Date().toISOString(),
        }],
    };
}

/**
 * Node: push_branch
 * Creates the PR (branch is already pushed via GitHub API commits).
 */
async function pushBranch(state) {
    const { _services: svc } = state;
    const { prCreator, onProgress } = svc;

    const appliedCount = state.fixes_applied.filter((f) => f.status === 'applied').length;
    if (appliedCount === 0) {
        return {
            ci_status: 'SKIPPED',
            logs: [{ stage: 'push_branch', message: 'No fixes to push', timestamp: new Date().toISOString() }],
        };
    }

    onProgress?.({ stage: 'push_branch', message: 'Creating Pull Request...' });

    const { prUrl, prNumber } = await prCreator.createPR(
        state.ai_branch,
        state.default_branch,
        {
            issues: state.issues,
            fixes: state.fixes_applied,
            retryCount: state.retry_count,
            ciStatus: 'PENDING',
        },
    );

    onProgress?.({ stage: 'push_branch', message: `PR created: ${prUrl}` });

    return {
        pr_url: prUrl,
        pr_number: prNumber,
        logs: [{ stage: 'push_branch', message: `PR #${prNumber} created`, timestamp: new Date().toISOString() }],
    };
}

/**
 * Node: monitor_ci
 * Uses CIAgent to poll GitHub Checks API.
 */
async function monitorCI(state) {
    const { _services: svc } = state;
    const { ciAgent, branchManager, onProgress } = svc;

    // Check if CI is configured
    const hasCi = await ciAgent.hasCIConfigured(state.ai_branch);
    if (!hasCi) {
        onProgress?.({ stage: 'monitor_ci', message: 'No CI/CD configured — skipping' });
        return {
            ci_status: 'NO_CI',
            ci_timeline: [{
                iteration: state.retry_count,
                timestamp: new Date().toISOString(),
                status: 'NO_CI',
                message: 'No CI checks configured',
            }],
            logs: [{ stage: 'monitor_ci', message: 'No CI configured', timestamp: new Date().toISOString() }],
        };
    }

    const newRetry = state.retry_count + 1;
    onProgress?.({ stage: 'monitor_ci', message: `CI check attempt ${newRetry}/5...` });

    const commitSha = await branchManager.getLatestCommitSha(state.ai_branch);
    const ciResult = await ciAgent.waitForChecks(commitSha, 300000);

    const timeline = [{
        iteration: newRetry,
        timestamp: new Date().toISOString(),
        status: ciResult.status,
        checks: ciResult.checks,
        commitSha: commitSha.substring(0, 7),
    }];

    // If CI failed, convert failure logs to new issues for retry
    let newIssues = state.issues;
    if (ciResult.status === 'FAILED' && ciResult.failureLogs?.length > 0) {
        const ciIssues = ciResult.failureLogs
            .filter((log) => log.file && log.file !== 'unknown')
            .map((log) => ({
                file: log.file, line: log.line || 0,
                bug_type: classifyCIFailure(log),
                description: log.message, code_snippet: '', source: 'ci',
            }));
        newIssues = ciIssues.length > 0 ? ciIssues : state.issues;
    }

    onProgress?.({
        stage: 'monitor_ci',
        message: ciResult.status === 'PASSED'
            ? `✅ CI passed on attempt ${newRetry}!`
            : `❌ CI failed (attempt ${newRetry}/5)`,
    });

    return {
        retry_count: newRetry,
        ci_status: ciResult.status,
        ci_timeline: timeline,
        issues: newIssues,
        logs: [{
            stage: 'monitor_ci',
            message: `CI ${ciResult.status} (attempt ${newRetry})`,
            timestamp: new Date().toISOString(),
        }],
    };
}

/**
 * Node: update_pr
 * Updates PR body with final status after completion.
 */
async function updatePR(state) {
    const { _services: svc } = state;
    const { prCreator } = svc;

    if (state.pr_number) {
        await prCreator._updatePRBody(state.pr_number, {
            issues: state.issues,
            fixes: state.fixes_applied,
            retryCount: state.retry_count,
            ciStatus: state.ci_status,
        });
    }

    return {
        logs: [{
            stage: 'end',
            message: `Healing complete — CI: ${state.ci_status}, Retries: ${state.retry_count}`,
            timestamp: new Date().toISOString(),
        }],
    };
}

// ===========================================================
// 3. CONDITIONAL EDGE — retry_decision
// ===========================================================

function retryDecision(state) {
    // If no CI or CI passed → end
    if (state.ci_status === 'PASSED' || state.ci_status === 'NO_CI' || state.ci_status === 'SKIPPED') {
        return 'update_pr';
    }

    // If CI failed and retries remain → go back to generate_fixes
    if (state.ci_status === 'FAILED' && state.retry_count < 5) {
        return 'generate_fixes';
    }

    // Max retries exhausted → end
    return 'update_pr';
}

// ===========================================================
// 4. GRAPH CONSTRUCTION
// ===========================================================

/**
 * Build the LangGraph StateGraph for healing orchestration.
 * Returns a compiled graph ready to .invoke()
 */
export function buildHealingGraph() {
    const graph = new StateGraph(HealingState)
        // Add all nodes
        .addNode('analyze_repo', analyzeRepo)
        .addNode('generate_fixes', generateFixes)
        .addNode('apply_commit', applyCommit)
        .addNode('push_branch', pushBranch)
        .addNode('monitor_ci', monitorCI)
        .addNode('update_pr', updatePR)

        // Define edges — strict linear flow with retry loop
        .addEdge(START, 'analyze_repo')
        .addEdge('analyze_repo', 'generate_fixes')
        .addEdge('generate_fixes', 'apply_commit')
        .addEdge('apply_commit', 'push_branch')
        .addEdge('push_branch', 'monitor_ci')

        // Conditional edge: retry or end
        .addConditionalEdges('monitor_ci', retryDecision, {
            generate_fixes: 'generate_fixes',
            update_pr: 'update_pr',
        })

        .addEdge('update_pr', END);

    return graph.compile();
}

// ===========================================================
// HELPER
// ===========================================================

function classifyCIFailure(log) {
    const msg = (log.message || '').toLowerCase();
    if (msg.includes('syntax')) return 'SYNTAX';
    if (msg.includes('import') || msg.includes('module')) return 'IMPORT';
    if (msg.includes('type') || msg.includes('undefined')) return 'TYPE_ERROR';
    if (msg.includes('indent') || msg.includes('whitespace')) return 'INDENTATION';
    if (msg.includes('lint')) return 'LINTING';
    return 'LOGIC';
}

/**
 * CIAgent — Monitors GitHub Check Runs / CI Status
 * 
 * Polls GitHub Checks API to track CI/CD pipeline status.
 * Extracts failure logs for retry cycles.
 */

import { getInstallationOctokit } from '../../github-app';

export class CIAgent {
    constructor(owner, repo, installationId) {
        this.owner = owner;
        this.repo = repo;
        this.installationId = installationId;
        this.octokit = null;
    }

    async _getOctokit() {
        if (!this.octokit) {
            this.octokit = await getInstallationOctokit(this.installationId);
        }
        return this.octokit;
    }

    /**
     * Wait for CI checks to complete on a commit
     * 
     * @param {string} commitSha - The commit SHA to monitor
     * @param {number} timeoutMs - Max time to wait (default 5 min)
     * @returns {Object} - { status: 'PASSED'|'FAILED', checks, failureLogs }
     */
    async waitForChecks(commitSha, timeoutMs = 300000) {
        const octokit = await this._getOctokit();
        const startTime = Date.now();
        const pollInterval = 15000; // 15 seconds

        console.log(`[CIAgent] Monitoring checks for commit ${commitSha.substring(0, 7)}...`);

        while (Date.now() - startTime < timeoutMs) {
            try {
                // Get check runs for the commit
                const { data: checkRuns } = await octokit.rest.checks.listForRef({
                    owner: this.owner,
                    repo: this.repo,
                    ref: commitSha,
                });

                // Also check commit status (some CI use status API)
                const { data: statusData } = await octokit.rest.repos.getCombinedStatusForRef({
                    owner: this.owner,
                    repo: this.repo,
                    ref: commitSha,
                });

                const checks = checkRuns.check_runs || [];
                const statuses = statusData.statuses || [];

                // If no checks or statuses, wait and retry
                if (checks.length === 0 && statuses.length === 0) {
                    console.log(`[CIAgent] No checks found yet, waiting...`);
                    await this._sleep(pollInterval);
                    continue;
                }

                // Check if all checks are complete
                const pendingChecks = checks.filter((c) => c.status !== 'completed');
                const pendingStatuses = statuses.filter((s) => s.state === 'pending');

                if (pendingChecks.length > 0 || pendingStatuses.length > 0) {
                    console.log(`[CIAgent] ${pendingChecks.length} checks + ${pendingStatuses.length} statuses still pending...`);
                    await this._sleep(pollInterval);
                    continue;
                }

                // All complete — determine result
                const failedChecks = checks.filter((c) =>
                    c.conclusion === 'failure' || c.conclusion === 'timed_out' || c.conclusion === 'cancelled'
                );
                const failedStatuses = statuses.filter((s) => s.state === 'failure' || s.state === 'error');

                if (failedChecks.length > 0 || failedStatuses.length > 0) {
                    // Extract failure logs
                    const failureLogs = await this._extractFailureLogs(failedChecks, failedStatuses);

                    return {
                        status: 'FAILED',
                        checks: this._summarizeChecks(checks, statuses),
                        failureLogs,
                    };
                }

                // All passed
                return {
                    status: 'PASSED',
                    checks: this._summarizeChecks(checks, statuses),
                    failureLogs: [],
                };

            } catch (error) {
                console.warn(`[CIAgent] Error polling checks: ${error.message}`);
                await this._sleep(pollInterval);
            }
        }

        // Timeout
        console.log('[CIAgent] Timed out waiting for checks');
        return {
            status: 'FAILED',
            checks: [],
            failureLogs: [{ message: 'CI check timed out', source: 'timeout' }],
        };
    }

    /**
     * Quick check if any checks exist for a repo (to know if CI is configured)
     */
    async hasCIConfigured(branchName) {
        try {
            const octokit = await this._getOctokit();
            const { data } = await octokit.rest.checks.listForRef({
                owner: this.owner,
                repo: this.repo,
                ref: branchName,
            });
            return (data.check_runs || []).length > 0;
        } catch (error) {
            return false;
        }
    }

    /**
     * Extract failure logs from failed check runs
     */
    async _extractFailureLogs(failedChecks, failedStatuses) {
        const logs = [];
        const octokit = await this._getOctokit();

        for (const check of failedChecks) {
            // Get annotations (detailed failure info)
            try {
                const { data } = await octokit.rest.checks.listAnnotations({
                    owner: this.owner,
                    repo: this.repo,
                    check_run_id: check.id,
                });

                if (data.length > 0) {
                    for (const annotation of data) {
                        logs.push({
                            source: check.name,
                            file: annotation.path,
                            line: annotation.start_line,
                            message: annotation.message,
                            level: annotation.annotation_level,
                        });
                    }
                } else {
                    // Use check output text
                    logs.push({
                        source: check.name,
                        message: check.output?.text || check.output?.summary || 'Check failed (no details)',
                        level: 'failure',
                    });
                }
            } catch (error) {
                logs.push({
                    source: check.name,
                    message: `Check failed: ${check.conclusion}`,
                    level: 'failure',
                });
            }
        }

        for (const status of failedStatuses) {
            logs.push({
                source: status.context,
                message: status.description || 'Status check failed',
                level: 'failure',
                url: status.target_url,
            });
        }

        return logs;
    }

    /**
     * Summarize check results
     */
    _summarizeChecks(checks, statuses) {
        const summary = [];

        for (const check of checks) {
            summary.push({
                name: check.name,
                status: check.conclusion || check.status,
                url: check.html_url,
            });
        }

        for (const status of statuses) {
            summary.push({
                name: status.context,
                status: status.state,
                url: status.target_url,
            });
        }

        return summary;
    }

    _sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}

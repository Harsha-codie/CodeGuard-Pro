/**
 * JIRA Integration for CodeGuard Pro
 * Auto-creates tickets for CRITICAL violations found during PR analysis.
 * 
 * Required env vars:
 *   JIRA_HOST        - e.g., https://myorg.atlassian.net
 *   JIRA_EMAIL       - JIRA account email
 *   JIRA_API_TOKEN   - JIRA API token
 *   JIRA_PROJECT_KEY - Default project key (e.g., "CG")
 */

/**
 * Create a JIRA ticket for critical violations.
 * Groups all critical violations from a single PR into one ticket.
 * 
 * @param {Object} options
 * @param {string} options.repoOwner - Repository owner
 * @param {string} options.repoName - Repository name
 * @param {number} options.prNumber - Pull request number
 * @param {string} options.headSha - Commit SHA
 * @param {Array} options.violations - Array of violation objects with severity=CRITICAL
 * @returns {Object|null} Created ticket info or null
 */
export async function createJiraTicket({ repoOwner, repoName, prNumber, headSha, violations }) {
    const jiraHost = process.env.JIRA_HOST;
    const jiraEmail = process.env.JIRA_EMAIL;
    const jiraToken = process.env.JIRA_API_TOKEN;
    const projectKey = process.env.JIRA_PROJECT_KEY || 'CG';

    if (!jiraHost || !jiraEmail || !jiraToken) {
        return null; // JIRA not configured
    }

    // Only create tickets for CRITICAL violations
    const criticalViolations = violations.filter(v => v.severity === 'CRITICAL');
    if (criticalViolations.length === 0) return null;

    const summary = `[CodeGuard] ${criticalViolations.length} critical violation(s) in ${repoOwner}/${repoName} PR #${prNumber}`;
    
    const description = {
        type: 'doc',
        version: 1,
        content: [
            {
                type: 'heading',
                attrs: { level: 2 },
                content: [{ type: 'text', text: `Security Violations - PR #${prNumber}` }]
            },
            {
                type: 'paragraph',
                content: [
                    { type: 'text', text: `Repository: ${repoOwner}/${repoName}` },
                    { type: 'hardBreak' },
                    { type: 'text', text: `Commit: ${headSha.slice(0, 7)}` },
                    { type: 'hardBreak' },
                    { type: 'text', text: `PR: ` },
                    { type: 'text', text: `#${prNumber}`, marks: [{ type: 'link', attrs: { href: `https://github.com/${repoOwner}/${repoName}/pull/${prNumber}` } }] },
                ]
            },
            {
                type: 'heading',
                attrs: { level: 3 },
                content: [{ type: 'text', text: 'Violations' }]
            },
            {
                type: 'bulletList',
                content: criticalViolations.slice(0, 10).map(v => ({
                    type: 'listItem',
                    content: [{
                        type: 'paragraph',
                        content: [
                            { type: 'text', text: `${v.filePath}:${v.line}`, marks: [{ type: 'code' }] },
                            { type: 'text', text: ` — ${v.ruleName || v.message}` },
                        ]
                    }]
                }))
            },
            ...(criticalViolations.length > 10 ? [{
                type: 'paragraph',
                content: [{ type: 'text', text: `...and ${criticalViolations.length - 10} more violations`, marks: [{ type: 'em' }] }]
            }] : []),
        ]
    };

    try {
        const auth = Buffer.from(`${jiraEmail}:${jiraToken}`).toString('base64');
        
        const response = await fetch(`${jiraHost}/rest/api/3/issue`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                fields: {
                    project: { key: projectKey },
                    summary,
                    description,
                    issuetype: { name: 'Bug' },
                    priority: { name: 'High' },
                    labels: ['codeguard', 'security', 'automated'],
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[JIRA] Failed to create ticket: ${response.status} - ${errorText}`);
            return null;
        }

        const data = await response.json();
        console.log(`[JIRA] Created ticket: ${data.key} - ${summary}`);

        return {
            key: data.key,
            id: data.id,
            url: `${jiraHost}/browse/${data.key}`,
            summary,
        };
    } catch (error) {
        console.error(`[JIRA] Error creating ticket: ${error.message}`);
        return null;
    }
}

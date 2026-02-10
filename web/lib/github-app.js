import { createAppAuth } from '@octokit/auth-app';
import { Octokit } from 'octokit';

/**
 * Get an authenticated Octokit instance using GitHub App Installation Tokens.
 * Falls back to PAT (GITHUB_TOKEN) if App credentials aren't configured.
 * 
 * Installation tokens are:
 *  - Short-lived (1 hour expiry)
 *  - Scoped to specific repos
 *  - More secure than long-lived PATs
 */
export async function getInstallationOctokit(installationId) {
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

    // If we have App credentials + installation ID, use installation token
    if (appId && privateKey && installationId) {
        try {
            const auth = createAppAuth({
                appId,
                privateKey,
                installationId,
            });

            const { token } = await auth({ type: 'installation' });
            console.log(`[GitHubApp] Generated installation token for installation ${installationId}`);
            return new Octokit({ auth: token });
        } catch (error) {
            console.error('[GitHubApp] Failed to create installation token:', error.message);
            console.log('[GitHubApp] Falling back to PAT...');
        }
    }

    // Fallback: use PAT
    const pat = process.env.GITHUB_TOKEN;
    if (!pat) {
        throw new Error('No GitHub authentication configured. Set GITHUB_TOKEN or GITHUB_APP_PRIVATE_KEY.');
    }

    console.log('[GitHubApp] Using PAT for authentication');
    return new Octokit({ auth: pat });
}

/**
 * Get an Octokit instance authenticated as the GitHub App itself (not an installation).
 * Used for listing installations, etc.
 */
export async function getAppOctokit() {
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

    if (!appId || !privateKey) {
        return null;
    }

    const auth = createAppAuth({
        appId,
        privateKey,
    });

    const { token } = await auth({ type: 'app' });
    return new Octokit({ auth: token });
}

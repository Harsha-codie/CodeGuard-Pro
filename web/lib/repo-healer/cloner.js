/**
 * RepoCloner — Clones a GitHub repository using the GitHub App installation token
 * 
 * Uses GitHub API to:
 * 1. Find the installation for the repo
 * 2. Generate an installation access token
 * 3. Clone via HTTPS with token auth
 * 4. Detect and checkout default branch
 */

import { execSync, exec } from 'child_process';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { getInstallationOctokit, getAppOctokit } from '../github-app';
import { createAppAuth } from '@octokit/auth-app';

export class RepoCloner {
    constructor(owner, repo) {
        this.owner = owner;
        this.repo = repo;
        this.localPath = null;
        this.defaultBranch = null;
        this.installationId = null;
    }

    /**
     * Clone the repository and return local path + metadata
     */
    async clone() {
        // Step 1: Find installation for this repo
        this.installationId = await this._findInstallation();

        // Step 2: Get default branch via GitHub API
        const octokit = await getInstallationOctokit(this.installationId);
        const { data: repoData } = await octokit.rest.repos.get({
            owner: this.owner,
            repo: this.repo,
        });
        this.defaultBranch = repoData.default_branch;
        console.log(`[Cloner] Default branch: ${this.defaultBranch}`);

        // Step 3: Generate token for clone
        const token = await this._getInstallationToken();

        // Step 4: Create temp directory and clone
        this.localPath = mkdtempSync(join(tmpdir(), `codeguard-heal-`));
        const cloneUrl = `https://x-access-token:${token}@github.com/${this.owner}/${this.repo}.git`;

        console.log(`[Cloner] Cloning ${this.owner}/${this.repo} to ${this.localPath}...`);
        execSync(`git clone --depth 50 --single-branch "${cloneUrl}" "${this.localPath}"`, {
            stdio: 'pipe',
            timeout: 120000, // 2 min timeout
        });

        // Step 5: Checkout default branch
        execSync(`git checkout ${this.defaultBranch}`, {
            cwd: this.localPath,
            stdio: 'pipe',
        });

        console.log(`[Cloner] Clone complete. Path: ${this.localPath}`);

        return {
            localPath: this.localPath,
            defaultBranch: this.defaultBranch,
            installationId: this.installationId,
        };
    }

    /**
     * Find the GitHub App installation ID for this repo
     */
    async _findInstallation() {
        const appOctokit = await getAppOctokit();
        if (!appOctokit) {
            // Fallback: use GITHUB_TOKEN with no installation
            console.log('[Cloner] No App credentials, using PAT');
            return null;
        }

        try {
            const { data } = await appOctokit.rest.apps.getRepoInstallation({
                owner: this.owner,
                repo: this.repo,
            });
            console.log(`[Cloner] Found installation: ${data.id}`);
            return String(data.id);
        } catch (error) {
            console.error('[Cloner] Could not find installation:', error.message);
            // Try listing all installations
            try {
                const { data } = await appOctokit.rest.apps.listInstallations();
                if (data.length > 0) {
                    console.log(`[Cloner] Using first available installation: ${data[0].id}`);
                    return String(data[0].id);
                }
            } catch (e) {
                console.error('[Cloner] Failed to list installations:', e.message);
            }
            return null;
        }
    }

    /**
     * Get installation access token for git operations
     */
    async _getInstallationToken() {
        const appId = process.env.GITHUB_APP_ID;
        const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

        if (appId && privateKey && this.installationId) {
            try {
                const auth = createAppAuth({ appId, privateKey, installationId: this.installationId });
                const { token } = await auth({ type: 'installation' });
                return token;
            } catch (error) {
                console.error('[Cloner] Failed to get installation token:', error.message);
            }
        }

        // Fallback to PAT
        const pat = process.env.GITHUB_TOKEN;
        if (!pat) {
            throw new Error('No authentication available for cloning. Set GITHUB_TOKEN or configure GitHub App.');
        }
        return pat;
    }

    /**
     * Cleanup cloned repository
     */
    async cleanup() {
        if (this.localPath && existsSync(this.localPath)) {
            try {
                rmSync(this.localPath, { recursive: true, force: true });
                console.log(`[Cloner] Cleaned up ${this.localPath}`);
            } catch (error) {
                console.error(`[Cloner] Cleanup failed: ${error.message}`);
            }
        }
    }
}

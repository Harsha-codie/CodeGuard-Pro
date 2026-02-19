/**
 * BranchManager — Creates and manages the AI healing branch
 * 
 * Handles:
 * - Creating the AI_Fix branch from default branch
 * - Committing fixed files via GitHub API
 * - No direct git operations — all through GitHub API
 */

import { getInstallationOctokit } from '../github-app';

export class BranchManager {
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
     * Create the AI branch from the default branch
     */
    async createBranch(branchName, baseBranch) {
        const octokit = await this._getOctokit();

        // Get the SHA of the base branch
        const { data: refData } = await octokit.rest.git.getRef({
            owner: this.owner,
            repo: this.repo,
            ref: `heads/${baseBranch}`,
        });

        const baseSha = refData.object.sha;
        console.log(`[BranchManager] Base branch ${baseBranch} SHA: ${baseSha.substring(0, 7)}`);

        // Check if branch already exists
        try {
            await octokit.rest.git.getRef({
                owner: this.owner,
                repo: this.repo,
                ref: `heads/${branchName}`,
            });
            // Branch exists — delete it first for clean run
            console.log(`[BranchManager] Branch ${branchName} exists, deleting...`);
            await octokit.rest.git.deleteRef({
                owner: this.owner,
                repo: this.repo,
                ref: `heads/${branchName}`,
            });
        } catch (e) {
            // Branch doesn't exist — perfect
        }

        // Create the new branch
        await octokit.rest.git.createRef({
            owner: this.owner,
            repo: this.repo,
            ref: `refs/heads/${branchName}`,
            sha: baseSha,
        });

        console.log(`[BranchManager] Created branch: ${branchName}`);
        return baseSha;
    }

    /**
     * Commit a fixed file to the AI branch via GitHub API
     * 
     * @param {string} branchName - Branch to commit to
     * @param {string} filePath - Path of the file in the repo
     * @param {string} content - New file content
     * @param {string} commitMessage - Must start with "[AI-AGENT]"
     * @returns {string} - New commit SHA
     */
    async commitFile(branchName, filePath, content, commitMessage) {
        const octokit = await this._getOctokit();

        // Ensure commit message format
        if (!commitMessage.startsWith('[AI-AGENT]')) {
            commitMessage = `[AI-AGENT] ${commitMessage}`;
        }

        // Get current file SHA (needed for update)
        let fileSha = null;
        try {
            const { data } = await octokit.rest.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path: filePath,
                ref: branchName,
            });
            fileSha = data.sha;
        } catch (e) {
            // File doesn't exist yet — will be created
        }

        // Create or update file
        const params = {
            owner: this.owner,
            repo: this.repo,
            path: filePath,
            message: commitMessage,
            content: Buffer.from(content, 'utf-8').toString('base64'),
            branch: branchName,
        };

        if (fileSha) {
            params.sha = fileSha;
        }

        const { data } = await octokit.rest.repos.createOrUpdateFileContents(params);
        const newSha = data.commit.sha;

        console.log(`[BranchManager] Committed ${filePath} → ${newSha.substring(0, 7)}`);
        return newSha;
    }

    /**
     * Commit multiple files in a single commit using Git tree API
     * More efficient than individual file commits
     */
    async commitMultipleFiles(branchName, files, commitMessage) {
        const octokit = await this._getOctokit();

        if (!commitMessage.startsWith('[AI-AGENT]')) {
            commitMessage = `[AI-AGENT] ${commitMessage}`;
        }

        // Get the latest commit on the branch
        const { data: refData } = await octokit.rest.git.getRef({
            owner: this.owner,
            repo: this.repo,
            ref: `heads/${branchName}`,
        });
        const latestCommitSha = refData.object.sha;

        // Get the tree of the latest commit
        const { data: commitData } = await octokit.rest.git.getCommit({
            owner: this.owner,
            repo: this.repo,
            commit_sha: latestCommitSha,
        });
        const baseTreeSha = commitData.tree.sha;

        // Create blobs for each file
        const tree = [];
        for (const file of files) {
            const { data: blobData } = await octokit.rest.git.createBlob({
                owner: this.owner,
                repo: this.repo,
                content: Buffer.from(file.content, 'utf-8').toString('base64'),
                encoding: 'base64',
            });

            tree.push({
                path: file.path,
                mode: '100644',
                type: 'blob',
                sha: blobData.sha,
            });
        }

        // Create new tree
        const { data: newTree } = await octokit.rest.git.createTree({
            owner: this.owner,
            repo: this.repo,
            base_tree: baseTreeSha,
            tree,
        });

        // Create commit
        const { data: newCommit } = await octokit.rest.git.createCommit({
            owner: this.owner,
            repo: this.repo,
            message: commitMessage,
            tree: newTree.sha,
            parents: [latestCommitSha],
        });

        // Update branch ref
        await octokit.rest.git.updateRef({
            owner: this.owner,
            repo: this.repo,
            ref: `heads/${branchName}`,
            sha: newCommit.sha,
        });

        console.log(`[BranchManager] Batch committed ${files.length} files → ${newCommit.sha.substring(0, 7)}`);
        return newCommit.sha;
    }

    /**
     * Get the latest commit SHA on a branch
     */
    async getLatestCommitSha(branchName) {
        const octokit = await this._getOctokit();
        const { data } = await octokit.rest.git.getRef({
            owner: this.owner,
            repo: this.repo,
            ref: `heads/${branchName}`,
        });
        return data.object.sha;
    }

    /**
     * Get file content from a branch
     */
    async getFileContent(filePath, branchName) {
        const octokit = await this._getOctokit();
        try {
            const { data } = await octokit.rest.repos.getContent({
                owner: this.owner,
                repo: this.repo,
                path: filePath,
                ref: branchName,
            });
            return Buffer.from(data.content, 'base64').toString('utf-8');
        } catch (error) {
            console.error(`[BranchManager] Failed to get ${filePath}: ${error.message}`);
            return null;
        }
    }
}

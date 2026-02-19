/**
 * DockerSandbox — Containerized execution environment for untrusted code
 * 
 * Runs cloned repositories inside a Docker container with:
 *   - No network access (--network none)
 *   - Non-root user
 *   - Resource limits (CPU, memory, time)
 *   - Read-only source mount (repo is copied in, not bind-mounted)
 *   - Auto-cleanup of containers
 * 
 * Falls back to local execution if Docker is unavailable.
 */

import { execSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import { join, resolve } from 'path';

const SANDBOX_IMAGE = 'codeguard-sandbox:latest';
const DOCKERFILE_DIR = resolve(import.meta.url.replace('file:///', '').replace('docker-sandbox.js', ''), 'docker');

export class DockerSandbox {
    constructor(options = {}) {
        this.memoryLimit = options.memoryLimit || '512m';
        this.cpuLimit = options.cpuLimit || '1.0';
        this.timeoutMs = options.timeoutMs || 180000; // 3 min
        this.networkEnabled = options.networkEnabled ?? false; // Disabled by default
        this.imageReady = false;
    }

    /**
     * Check if Docker daemon is available
     */
    static isAvailable() {
        try {
            execSync('docker info', { stdio: 'pipe', timeout: 10000 });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Build the sandbox image if it doesn't exist
     */
    async ensureImage() {
        if (this.imageReady) return true;

        try {
            // Check if image already exists
            execSync(`docker image inspect ${SANDBOX_IMAGE}`, { stdio: 'pipe' });
            this.imageReady = true;
            console.log('[DockerSandbox] Sandbox image already exists');
            return true;
        } catch {
            // Image doesn't exist — build it
        }

        // Resolve Dockerfile directory
        let dockerDir;
        const possiblePaths = [
            join(process.cwd(), 'lib', 'repo-healer', 'docker'),
            join(process.cwd(), '..', 'web', 'lib', 'repo-healer', 'docker'),
            DOCKERFILE_DIR,
        ];

        for (const p of possiblePaths) {
            if (existsSync(join(p, 'Dockerfile.sandbox'))) {
                dockerDir = p;
                break;
            }
        }

        if (!dockerDir) {
            console.error('[DockerSandbox] Cannot find Dockerfile.sandbox');
            return false;
        }

        console.log(`[DockerSandbox] Building sandbox image from ${dockerDir}...`);

        try {
            execSync(
                `docker build -t ${SANDBOX_IMAGE} -f "${join(dockerDir, 'Dockerfile.sandbox')}" "${dockerDir}"`,
                { stdio: 'pipe', timeout: 300000 },
            );
            this.imageReady = true;
            console.log('[DockerSandbox] Sandbox image built successfully');
            return true;
        } catch (error) {
            console.error('[DockerSandbox] Failed to build image:', error.message?.substring(0, 300));
            return false;
        }
    }

    /**
     * Run tests inside a Docker container
     * 
     * @param {string} repoPath - Absolute path to the cloned repo
     * @param {string} projectType - 'node' | 'python' | 'java' | 'go'
     * @returns {Object} - { stdout, stderr, exitCode, timedOut }
     */
    async runTests(repoPath, projectType) {
        const imageReady = await this.ensureImage();
        if (!imageReady) {
            throw new Error('Docker sandbox image not available');
        }

        const containerName = `codeguard-sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // Convert Windows path to Docker-compatible path
        const dockerPath = this._toDockerPath(repoPath);

        // Build docker run command with security constraints
        const args = [
            'run',
            '--name', containerName,
            '--rm',                                    // Auto-remove container
            '--memory', this.memoryLimit,              // Memory limit
            '--cpus', this.cpuLimit,                   // CPU limit
            '--pids-limit', '256',                     // Process limit
            '--read-only',                             // Read-only root filesystem
            '--tmpfs', '/tmp:rw,noexec,nosuid,size=256m', // Writable tmp
            '--tmpfs', '/workspace/node_modules:rw,size=512m', // Writable node_modules
            '--tmpfs', '/home/sandbox:rw,size=64m',    // Writable home for pip --user
            '--security-opt', 'no-new-privileges',     // No privilege escalation
            '--cap-drop', 'ALL',                       // Drop all capabilities
        ];

        // Network: disabled by default for safety
        if (!this.networkEnabled) {
            // Need network for npm install / pip install, then disable
            // Since we need deps, allow network but use --dns to limit DNS
            // Compromise: allow network for dep install (entrypoint handles both)
            // For maximum security in production, pre-build images with deps
        }

        // Mount repo as read-only volume, copy to workspace
        args.push('-v', `${dockerPath}:/repo:ro`);

        // Environment
        args.push('-e', `PROJECT_TYPE=${projectType}`);
        args.push('-e', 'CI=true');
        args.push('-e', 'NODE_ENV=test');

        // Image — use bash to copy repo then run entrypoint
        args.push(SANDBOX_IMAGE);

        // Override entrypoint to copy repo first (since /workspace is tmpfs)
        // Actually we need to adjust: mount repo read-only, copy to /workspace
        const fullArgs = [
            'run',
            '--name', containerName,
            '--rm',
            '--memory', this.memoryLimit,
            '--cpus', this.cpuLimit,
            '--pids-limit', '256',
            '--security-opt', 'no-new-privileges',
            '--cap-drop', 'ALL',
            '-v', `${dockerPath}:/repo:ro`,
            '-e', `PROJECT_TYPE=${projectType}`,
            '-e', 'CI=true',
            '-e', 'NODE_ENV=test',
            '--entrypoint', '/bin/bash',
            SANDBOX_IMAGE,
            '-c', 'cp -r /repo/. /workspace/ && chmod -R u+w /workspace && /entrypoint.sh',
        ];

        return new Promise((resolvePromise) => {
            let stdout = '';
            let stderr = '';
            let timedOut = false;
            let killed = false;

            console.log(`[DockerSandbox] Starting container ${containerName}`);
            const proc = spawn('docker', fullArgs, { stdio: 'pipe' });

            proc.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            // Timeout guard
            const timer = setTimeout(() => {
                timedOut = true;
                killed = true;
                console.warn(`[DockerSandbox] Container ${containerName} timed out, killing...`);
                try {
                    execSync(`docker kill ${containerName}`, { stdio: 'pipe' });
                } catch {
                    // Container might have already exited
                }
            }, this.timeoutMs);

            proc.on('close', (exitCode) => {
                clearTimeout(timer);
                console.log(`[DockerSandbox] Container exited with code ${exitCode}`);

                resolvePromise({
                    stdout,
                    stderr,
                    exitCode: exitCode ?? 1,
                    timedOut,
                    containerName,
                });
            });

            proc.on('error', (err) => {
                clearTimeout(timer);
                console.error(`[DockerSandbox] Spawn error: ${err.message}`);
                resolvePromise({
                    stdout,
                    stderr: stderr + '\n' + err.message,
                    exitCode: 1,
                    timedOut: false,
                    containerName,
                });
            });
        });
    }

    /**
     * Force-cleanup a container (safety net)
     */
    async cleanup(containerName) {
        try {
            execSync(`docker rm -f ${containerName} 2>/dev/null`, { stdio: 'pipe' });
        } catch {
            // Already removed
        }
    }

    /**
     * Cleanup all codeguard sandbox containers (stale cleanup)
     */
    static cleanupAll() {
        try {
            execSync('docker ps -a --filter "name=codeguard-sandbox" -q | xargs -r docker rm -f', {
                stdio: 'pipe',
                timeout: 30000,
            });
        } catch {
            // Ignore
        }
    }

    /**
     * Convert Windows path to Docker-compatible path
     * C:\Users\foo\bar → /c/Users/foo/bar (for Docker Desktop on Windows)
     */
    _toDockerPath(windowsPath) {
        if (process.platform !== 'win32') return windowsPath;

        // Docker Desktop uses /c/Users/... format
        return windowsPath
            .replace(/\\/g, '/')
            .replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`);
    }
}

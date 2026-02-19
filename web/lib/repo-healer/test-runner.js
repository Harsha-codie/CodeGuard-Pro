/**
 * TestRunner — Discovers and runs tests in a cloned repository
 * 
 * Detects project type (Node.js, Python, etc.) and runs tests.
 * Uses Docker sandbox when available for safe execution of untrusted code.
 * Falls back to local execution if Docker is not running.
 * 
 * Captures structured failure logs for the FixAgent.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import { DockerSandbox } from './docker-sandbox';

export class TestRunner {
    constructor(repoPath, options = {}) {
        this.repoPath = repoPath;
        this.projectType = null;
        this.testFiles = [];
        this.useDocker = options.useDocker ?? true; // Docker by default
        this.sandbox = null;
    }

    /**
     * Discover project type, find test files, and run them
     */
    async discoverAndRun() {
        // Step 1: Detect project type
        this.projectType = this._detectProjectType();
        console.log(`[TestRunner] Detected project type: ${this.projectType}`);

        // Step 2: Discover test files
        this.testFiles = this._discoverTestFiles();
        console.log(`[TestRunner] Found ${this.testFiles.length} test files`);

        if (this.testFiles.length === 0) {
            console.log('[TestRunner] No test files found, skipping test execution');
            return { projectType: this.projectType, testFiles: [], totalTests: 0, passed: 0, failed: 0, failures: [], rawOutput: '' };
        }

        // Step 3: Try Docker sandbox first (safe), fall back to local
        if (this.useDocker && DockerSandbox.isAvailable()) {
            console.log('[TestRunner] Docker available — running tests in sandbox');
            return this._runTestsInDocker();
        }

        console.log('[TestRunner] Docker not available — running tests locally (⚠️ unsafe for untrusted repos)');

        // Step 3b: Install dependencies (local only)
        await this._installDependencies();

        // Step 4: Run tests locally
        const results = await this._runTests();
        return results;
    }

    /**
     * Run tests inside Docker sandbox
     */
    async _runTestsInDocker() {
        const result = {
            projectType: this.projectType,
            testFiles: this.testFiles,
            totalTests: 0,
            passed: 0,
            failed: 0,
            failures: [],
            rawOutput: '',
            sandboxed: true,
        };

        try {
            this.sandbox = new DockerSandbox({
                memoryLimit: '512m',
                cpuLimit: '1.0',
                timeoutMs: 180000,
            });

            const dockerResult = await this.sandbox.runTests(this.repoPath, this.projectType);

            result.rawOutput = dockerResult.stdout + '\n' + dockerResult.stderr;

            if (dockerResult.timedOut) {
                result.failures.push({
                    message: 'Test execution timed out in sandbox (3 min limit)',
                    file: '',
                    line: 0,
                    snippet: 'Container was killed after exceeding time limit',
                });
                result.failed = 1;
                return result;
            }

            // Parse failures from container output
            if (dockerResult.exitCode !== 0) {
                const allOutput = dockerResult.stdout + '\n' + dockerResult.stderr;
                const lines = allOutput.split('\n');
                result.failures = this._parseTestFailures(allOutput);
                result.failed = result.failures.length;
            }

            console.log(`[TestRunner] Docker sandbox: ${result.failures.length} failures detected`);
            return result;

        } catch (error) {
            console.warn(`[TestRunner] Docker sandbox failed: ${error.message}`);
            console.log('[TestRunner] Falling back to local execution');

            // Fallback to local
            await this._installDependencies();
            return this._runTests();
        }
    }

    /**
     * Detect project type by checking for config files
     */
    _detectProjectType() {
        const checks = [
            { file: 'package.json', type: 'node' },
            { file: 'requirements.txt', type: 'python' },
            { file: 'setup.py', type: 'python' },
            { file: 'pyproject.toml', type: 'python' },
            { file: 'Pipfile', type: 'python' },
            { file: 'pom.xml', type: 'java' },
            { file: 'build.gradle', type: 'java' },
            { file: 'go.mod', type: 'go' },
            { file: 'Cargo.toml', type: 'rust' },
            { file: 'Makefile', type: 'make' },
        ];

        for (const { file, type } of checks) {
            if (existsSync(join(this.repoPath, file))) {
                return type;
            }
        }

        return 'unknown';
    }

    /**
     * Discover test files based on project type
     */
    _discoverTestFiles() {
        const testFiles = [];
        const testPatterns = this._getTestPatterns();

        const walk = (dir, depth = 0) => {
            if (depth > 8) return; // Prevent deep recursion
            try {
                const entries = readdirSync(dir);
                for (const entry of entries) {
                    // Skip common non-test directories
                    if (['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv', 'venv', '.tox'].includes(entry)) continue;

                    const fullPath = join(dir, entry);
                    try {
                        const stat = statSync(fullPath);
                        if (stat.isDirectory()) {
                            walk(fullPath, depth + 1);
                        } else if (stat.isFile()) {
                            const relPath = relative(this.repoPath, fullPath);
                            if (testPatterns.some((p) => p.test(relPath))) {
                                testFiles.push(relPath);
                            }
                        }
                    } catch (e) {
                        // Skip permission errors
                    }
                }
            } catch (e) {
                // Skip unreadable directories
            }
        };

        walk(this.repoPath);
        return testFiles;
    }

    /**
     * Get test file patterns for the project type
     */
    _getTestPatterns() {
        switch (this.projectType) {
            case 'node':
                return [
                    /\.test\.(js|ts|jsx|tsx)$/,
                    /\.spec\.(js|ts|jsx|tsx)$/,
                    /test\.(js|ts)$/,
                    /__tests__\/.+\.(js|ts|jsx|tsx)$/,
                ];
            case 'python':
                return [
                    /test_.*\.py$/,
                    /.*_test\.py$/,
                    /tests\/.*\.py$/,
                    /test\/.*\.py$/,
                ];
            case 'java':
                return [
                    /Test\.java$/,
                    /Tests\.java$/,
                    /.*Test\.java$/,
                    /src\/test\/.*\.java$/,
                ];
            case 'go':
                return [
                    /_test\.go$/,
                ];
            default:
                return [
                    /test/i,
                ];
        }
    }

    /**
     * Install project dependencies
     */
    async _installDependencies() {
        try {
            switch (this.projectType) {
                case 'node':
                    console.log('[TestRunner] Installing Node.js dependencies...');
                    execSync('npm install --no-audit --no-fund 2>&1', {
                        cwd: this.repoPath,
                        stdio: 'pipe',
                        timeout: 120000,
                    });
                    break;

                case 'python':
                    console.log('[TestRunner] Installing Python dependencies...');
                    if (existsSync(join(this.repoPath, 'requirements.txt'))) {
                        execSync('pip install -r requirements.txt 2>&1', {
                            cwd: this.repoPath,
                            stdio: 'pipe',
                            timeout: 120000,
                        });
                    }
                    break;

                case 'java':
                    if (existsSync(join(this.repoPath, 'pom.xml'))) {
                        console.log('[TestRunner] Building Maven project...');
                        execSync('mvn compile -q 2>&1', {
                            cwd: this.repoPath,
                            stdio: 'pipe',
                            timeout: 180000,
                        });
                    }
                    break;

                default:
                    console.log('[TestRunner] Unknown project type, skipping dependency install');
            }
        } catch (error) {
            console.warn('[TestRunner] Dependency install warning:', error.message?.substring(0, 200));
            // Continue anyway — tests might still work
        }
    }

    /**
     * Run tests and parse failures
     */
    async _runTests() {
        const result = {
            projectType: this.projectType,
            testFiles: this.testFiles,
            totalTests: 0,
            passed: 0,
            failed: 0,
            failures: [],
            rawOutput: '',
        };

        if (this.testFiles.length === 0) {
            console.log('[TestRunner] No test files found, skipping test execution');
            return result;
        }

        try {
            const { command, env } = this._getTestCommand();
            console.log(`[TestRunner] Running: ${command}`);

            const output = execSync(command, {
                cwd: this.repoPath,
                stdio: 'pipe',
                timeout: 180000, // 3 min timeout
                env: { ...process.env, ...env },
                encoding: 'utf-8',
            });

            result.rawOutput = output;
            console.log('[TestRunner] Tests passed successfully');
            return result;

        } catch (error) {
            // Test failures cause non-zero exit code
            const output = error.stdout?.toString() || error.stderr?.toString() || error.message || '';
            result.rawOutput = output;

            // Parse failures from output
            result.failures = this._parseTestFailures(output);
            result.failed = result.failures.length;

            console.log(`[TestRunner] ${result.failures.length} test failures detected`);
            return result;
        }
    }

    /**
     * Get the test command for the project type
     */
    _getTestCommand() {
        switch (this.projectType) {
            case 'node': {
                // Check for test script in package.json
                try {
                    const pkg = JSON.parse(readFileSync(join(this.repoPath, 'package.json'), 'utf-8'));
                    if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
                        return { command: 'npm test 2>&1', env: { CI: 'true' } };
                    }
                } catch (e) { /* ignore */ }

                // Fallback: try common runners
                if (existsSync(join(this.repoPath, 'node_modules', '.bin', 'jest'))) {
                    return { command: 'npx jest --forceExit --no-coverage 2>&1', env: { CI: 'true' } };
                }
                if (existsSync(join(this.repoPath, 'node_modules', '.bin', 'mocha'))) {
                    return { command: 'npx mocha --recursive 2>&1', env: {} };
                }
                return { command: 'npm test 2>&1', env: { CI: 'true' } };
            }

            case 'python':
                // Try pytest first, fallback to unittest
                return {
                    command: 'python -m pytest -v --tb=short 2>&1 || python -m unittest discover -v 2>&1',
                    env: {},
                };

            case 'java':
                if (existsSync(join(this.repoPath, 'pom.xml'))) {
                    return { command: 'mvn test -q 2>&1', env: {} };
                }
                if (existsSync(join(this.repoPath, 'build.gradle'))) {
                    return { command: './gradlew test 2>&1', env: {} };
                }
                return { command: 'mvn test -q 2>&1', env: {} };

            case 'go':
                return { command: 'go test ./... -v 2>&1', env: {} };

            default:
                return { command: 'echo "No test runner configured" && exit 1', env: {} };
        }
    }

    /**
     * Parse test output into structured failures
     */
    _parseTestFailures(output) {
        const failures = [];
        const lines = output.split('\n');

        switch (this.projectType) {
            case 'node':
                return this._parseNodeFailures(lines);
            case 'python':
                return this._parsePythonFailures(lines);
            case 'java':
                return this._parseJavaFailures(lines);
            case 'go':
                return this._parseGoFailures(lines);
            default:
                return this._parseGenericFailures(lines);
        }
    }

    /**
     * Parse Node.js test failures (Jest/Mocha output)
     */
    _parseNodeFailures(lines) {
        const failures = [];
        let currentFailure = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Jest failure pattern: ● Test Name
            if (line.match(/^\s*●\s+/)) {
                if (currentFailure) failures.push(currentFailure);
                currentFailure = { message: line.trim(), file: '', line: 0, snippet: '' };
            }

            // File:line pattern in stack trace
            const fileMatch = line.match(/at\s+.*\((.+):(\d+):\d+\)/);
            if (fileMatch && currentFailure && !currentFailure.file) {
                currentFailure.file = fileMatch[1];
                currentFailure.line = parseInt(fileMatch[2]);
            }

            // FAIL pattern
            const failMatch = line.match(/FAIL\s+(.+)/);
            if (failMatch) {
                const file = failMatch[1].trim();
                if (currentFailure) currentFailure.file = file;
            }

            // Error message
            if (line.match(/^\s*(Expected|Received|Error|TypeError|ReferenceError|SyntaxError)/) && currentFailure) {
                currentFailure.snippet += line.trim() + '\n';
            }
        }

        if (currentFailure) failures.push(currentFailure);
        return failures;
    }

    /**
     * Parse Python test failures (pytest/unittest output)
     */
    _parsePythonFailures(lines) {
        const failures = [];
        let currentFailure = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // pytest FAILED pattern: FAILED test_file.py::test_name
            const failedMatch = line.match(/FAILED\s+(.+)::(.+)/);
            if (failedMatch) {
                if (currentFailure) failures.push(currentFailure);
                currentFailure = {
                    message: `FAILED: ${failedMatch[2]}`,
                    file: failedMatch[1],
                    line: 0,
                    snippet: '',
                };
            }

            // File:line in traceback
            const traceMatch = line.match(/File "(.+)", line (\d+)/);
            if (traceMatch && currentFailure) {
                currentFailure.file = traceMatch[1];
                currentFailure.line = parseInt(traceMatch[2]);
            }

            // Error messages
            if (line.match(/^(E\s+|AssertionError|TypeError|ValueError|ImportError|SyntaxError|IndentationError)/) && currentFailure) {
                currentFailure.snippet += line.trim() + '\n';
            }
        }

        if (currentFailure) failures.push(currentFailure);
        return failures;
    }

    /**
     * Parse Java test failures (Maven/JUnit output)
     */
    _parseJavaFailures(lines) {
        const failures = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // JUnit failure: Tests run: X, Failures: Y
            const failMatch = line.match(/Tests run: (\d+), Failures: (\d+)/);
            if (failMatch && parseInt(failMatch[2]) > 0) {
                // Look backwards for the test class
                for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
                    const classMatch = lines[j].match(/Running\s+(\S+)/);
                    if (classMatch) {
                        failures.push({
                            message: line.trim(),
                            file: classMatch[1].replace(/\./g, '/') + '.java',
                            line: 0,
                            snippet: lines.slice(Math.max(0, i - 5), i + 1).join('\n'),
                        });
                        break;
                    }
                }
            }
        }

        return failures;
    }

    /**
     * Parse Go test failures
     */
    _parseGoFailures(lines) {
        const failures = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Go failure: --- FAIL: TestName
            const failMatch = line.match(/--- FAIL:\s+(\S+)/);
            if (failMatch) {
                // Look for file:line in nearby lines
                let file = '';
                let lineNum = 0;
                for (let j = i + 1; j < Math.min(lines.length, i + 10); j++) {
                    const fl = lines[j].match(/\s+(\S+\.go):(\d+)/);
                    if (fl) {
                        file = fl[1];
                        lineNum = parseInt(fl[2]);
                        break;
                    }
                }

                failures.push({
                    message: `FAIL: ${failMatch[1]}`,
                    file,
                    line: lineNum,
                    snippet: lines.slice(i, Math.min(lines.length, i + 5)).join('\n'),
                });
            }
        }

        return failures;
    }

    /**
     * Generic failure parser
     */
    _parseGenericFailures(lines) {
        const failures = [];

        for (const line of lines) {
            if (line.match(/(error|fail|Error|FAIL)/i)) {
                const fileMatch = line.match(/([^\s:]+\.\w+):(\d+)/);
                failures.push({
                    message: line.trim(),
                    file: fileMatch ? fileMatch[1] : '',
                    line: fileMatch ? parseInt(fileMatch[2]) : 0,
                    snippet: line.trim(),
                });
            }
        }

        // Deduplicate by file+line
        const seen = new Set();
        return failures.filter((f) => {
            const key = `${f.file}:${f.line}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }
}

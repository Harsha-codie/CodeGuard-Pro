/**
 * RepoAnalyzer — Runs AST analysis on an entire repository
 * 
 * Uses the existing AST engine to scan all supported files
 * and classify issues into the required bug types:
 * LINTING, SYNTAX, LOGIC, TYPE_ERROR, IMPORT, INDENTATION
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, extname } from 'path';

// Supported file extensions mapped to languages
const EXTENSION_MAP = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.go': 'go',
    '.c': 'c',
    '.h': 'c',
};

// Directories to skip during analysis
const SKIP_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '__pycache__',
    '.venv', 'venv', '.tox', '.mypy_cache', '.pytest_cache',
    'coverage', '.next', '.nuxt', 'vendor', 'target', 'out',
    '.idea', '.vscode', '.gradle', 'bin', 'obj',
]);

export class RepoAnalyzer {
    constructor(repoPath) {
        this.repoPath = repoPath;
        this.astEngine = null;
    }

    /**
     * Analyze entire repository and return classified issues
     */
    async analyze() {
        // Lazy-load AST engine
        await this._initEngine();

        // Discover all source files
        const files = this._discoverFiles();
        console.log(`[Analyzer] Found ${files.length} source files to analyze`);

        const allIssues = [];

        for (const filePath of files) {
            try {
                const content = readFileSync(join(this.repoPath, filePath), 'utf-8');
                const ext = extname(filePath);
                const language = EXTENSION_MAP[ext];

                if (!language || !content.trim()) continue;

                // Run AST analysis
                const result = await this.astEngine.analyze(content, filePath, {
                    categories: ['security', 'best-practice', 'style', 'naming', 'performance'],
                });

                // If AST engine returned nothing (WASM failed), use regex fallback
                let violations = result.violations || [];
                if (violations.length === 0 && (result.astSupported === false || result.error)) {
                    violations = this._regexAnalysis(content, filePath);
                }

                if (violations.length > 0) {
                    for (const violation of violations) {
                        allIssues.push({
                            file: filePath,
                            line: violation.line || 0,
                            bug_type: this._classifyViolation(violation),
                            description: violation.message || violation.description || 'Issue detected',
                            code_snippet: violation.snippet || this._extractSnippet(content, violation.line),
                            severity: violation.severity || 'WARNING',
                            rule: violation.ruleName || violation.ruleId || 'unknown',
                        });
                    }
                }
            } catch (error) {
                console.warn(`[Analyzer] Error analyzing ${filePath}: ${error.message}`);
            }
        }

        console.log(`[Analyzer] Total issues found: ${allIssues.length}`);
        return allIssues;
    }

    /**
     * Initialize the AST engine (lazy load to avoid import issues)
     */
    async _initEngine() {
        if (this.astEngine) return;

        try {
            // Use dynamic import to load the AST engine
            const { analyzeWithAST } = await import('../ast-analyzer');
            // Create a wrapper that matches the expected API
            this.astEngine = {
                analyze: async (code, filename, options) => {
                    return analyzeWithAST(code, filename, options);
                },
            };
            console.log('[Analyzer] AST engine initialized');
        } catch (error) {
            console.warn('[Analyzer] Failed to load AST engine, using fallback:', error.message);
            // Fallback: regex-based analysis
            this.astEngine = {
                analyze: async (code, filename) => {
                    return { violations: this._regexAnalysis(code, filename) };
                },
            };
        }
    }

    /**
     * Discover all analyzable source files in the repo
     */
    _discoverFiles() {
        const files = [];

        const walk = (dir, depth = 0) => {
            if (depth > 10) return;
            try {
                const entries = readdirSync(dir);
                for (const entry of entries) {
                    if (SKIP_DIRS.has(entry)) continue;
                    if (entry.startsWith('.') && entry !== '.') continue;

                    const fullPath = join(dir, entry);
                    try {
                        const stat = statSync(fullPath);
                        if (stat.isDirectory()) {
                            walk(fullPath, depth + 1);
                        } else if (stat.isFile()) {
                            const ext = extname(entry);
                            if (EXTENSION_MAP[ext]) {
                                const relPath = relative(this.repoPath, fullPath);
                                // Skip test files — we analyze production code
                                if (!this._isTestFile(relPath)) {
                                    files.push(relPath);
                                }
                            }
                        }
                    } catch (e) { /* skip */ }
                }
            } catch (e) { /* skip */ }
        };

        walk(this.repoPath);
        return files;
    }

    /**
     * Check if a file is a test file (skip for static analysis)
     */
    _isTestFile(filePath) {
        const lower = filePath.toLowerCase();
        return (
            lower.includes('test') ||
            lower.includes('spec') ||
            lower.includes('__tests__') ||
            lower.includes('.test.') ||
            lower.includes('.spec.') ||
            lower.includes('_test.')
        );
    }

    /**
     * Classify a violation into the required bug type enum
     */
    _classifyViolation(violation) {
        // If category is already a valid bug_type from regex fallback, use it directly
        const validTypes = new Set(['SYNTAX', 'IMPORT', 'TYPE_ERROR', 'INDENTATION', 'LINTING', 'LOGIC']);
        const category = (violation.category || '').toUpperCase();
        if (validTypes.has(category)) {
            return category;
        }

        const msg = (violation.message || violation.description || '').toLowerCase();
        const rule = (violation.ruleName || violation.ruleId || '').toLowerCase();

        // SYNTAX errors
        if (msg.includes('syntax') || msg.includes('unexpected token') || msg.includes('parsing error')) {
            return 'SYNTAX';
        }

        // IMPORT issues
        if (msg.includes('import') || msg.includes('require') || msg.includes('module not found') ||
            rule.includes('import') || rule.includes('require')) {
            return 'IMPORT';
        }

        // TYPE_ERROR
        if (msg.includes('type') || msg.includes('undefined') || msg.includes('null reference') ||
            msg.includes('incompatible') || category.includes('type')) {
            return 'TYPE_ERROR';
        }

        // INDENTATION
        if (msg.includes('indent') || msg.includes('whitespace') || msg.includes('tab') ||
            msg.includes('spacing') || rule.includes('indent')) {
            return 'INDENTATION';
        }

        // LINTING — style/naming/formatting issues
        if (category === 'style' || category === 'naming' || 
            msg.includes('lint') || msg.includes('naming') || msg.includes('convention') ||
            msg.includes('camelcase') || msg.includes('snake_case') || msg.includes('unused')) {
            return 'LINTING';
        }

        // Default: LOGIC (security, performance, best-practice bugs)
        return 'LOGIC';
    }

    /**
     * Extract code snippet around a line number
     */
    _extractSnippet(content, line) {
        if (!line || line <= 0) return '';
        const lines = content.split('\n');
        const start = Math.max(0, line - 2);
        const end = Math.min(lines.length, line + 2);
        return lines.slice(start, end).join('\n');
    }

    /**
     * Fallback regex-based analysis when AST engine is unavailable
     */
    _regexAnalysis(code, filename) {
        const violations = [];
        const lines = code.split('\n');

        const patterns = [
            // Security
            { regex: /eval\s*\(/, msg: 'Use of eval() is dangerous — allows arbitrary code execution', type: 'LOGIC', severity: 'CRITICAL' },
            { regex: /exec\s*\(/, msg: 'Use of exec() is dangerous — allows arbitrary code execution', type: 'LOGIC', severity: 'CRITICAL' },
            { regex: /(password|secret|api_key|apikey|api_secret|auth_token|jwt_secret)\s*=\s*['"][^'"]+['"]/i, msg: 'Hardcoded secret/credential detected', type: 'LOGIC', severity: 'CRITICAL' },
            { regex: /\.innerHTML\s*=/, msg: 'innerHTML assignment — XSS vulnerability', type: 'LOGIC', severity: 'CRITICAL' },
            { regex: /\.outerHTML\s*=/, msg: 'outerHTML assignment — XSS vulnerability', type: 'LOGIC', severity: 'CRITICAL' },
            { regex: /document\.write\s*\(/, msg: 'document.write() — XSS vulnerability', type: 'LOGIC', severity: 'CRITICAL' },
            { regex: /new\s+Function\s*\(/, msg: 'new Function() constructor — code injection risk', type: 'LOGIC', severity: 'CRITICAL' },
            { regex: /createHash\s*\(\s*['"]md5['"]/, msg: 'Weak crypto: MD5 hash is insecure', type: 'LOGIC', severity: 'CRITICAL' },
            { regex: /createHash\s*\(\s*['"]sha1['"]/, msg: 'Weak crypto: SHA-1 hash is insecure', type: 'LOGIC', severity: 'WARNING' },
            { regex: /hashlib\.md5\s*\(/, msg: 'Weak crypto: MD5 hash is insecure', type: 'LOGIC', severity: 'CRITICAL' },
            { regex: /hashlib\.sha1\s*\(/, msg: 'Weak crypto: SHA-1 hash is insecure', type: 'LOGIC', severity: 'WARNING' },
            { regex: /Math\.random\s*\(/, msg: 'Math.random() is not cryptographically secure', type: 'LOGIC', severity: 'WARNING' },
            { regex: /rejectUnauthorized\s*:\s*false/, msg: 'SSL/TLS verification disabled', type: 'LOGIC', severity: 'CRITICAL' },
            { regex: /verify\s*=\s*False/, msg: 'SSL verification disabled (verify=False)', type: 'LOGIC', severity: 'CRITICAL' },
            { regex: /os\.system\s*\(/, msg: 'os.system() — command injection risk', type: 'LOGIC', severity: 'CRITICAL' },
            { regex: /subprocess.*shell\s*=\s*True/, msg: 'subprocess with shell=True — command injection risk', type: 'LOGIC', severity: 'CRITICAL' },
            { regex: /pickle\.(load|loads)\s*\(/, msg: 'pickle deserialization — arbitrary code execution risk', type: 'LOGIC', severity: 'CRITICAL' },
            { regex: /yaml\.load\s*\(/, msg: 'yaml.load() without SafeLoader — code execution risk', type: 'LOGIC', severity: 'CRITICAL' },
            { regex: /setTimeout\s*\(\s*['"]/, msg: 'setTimeout with string argument — eval equivalent', type: 'LOGIC', severity: 'CRITICAL' },
            { regex: /setInterval\s*\(\s*['"]/, msg: 'setInterval with string argument — eval equivalent', type: 'LOGIC', severity: 'CRITICAL' },
            { regex: /origin\s*:\s*['"]?\*['"]?/, msg: 'CORS wildcard origin — allows any domain', type: 'LOGIC', severity: 'WARNING' },
            { regex: /__proto__/, msg: '__proto__ access — prototype pollution risk', type: 'LOGIC', severity: 'CRITICAL' },
            // Style / Linting
            { regex: /console\.(log|debug|info)\s*\(/, msg: 'Console statement left in code', type: 'LINTING', severity: 'INFO' },
            { regex: /\bprint\s*\(/, msg: 'Print statement left in code', type: 'LINTING', severity: 'INFO' },
            { regex: /\bdebugger\b/, msg: 'Debugger statement left in code', type: 'LINTING', severity: 'WARNING' },
            { regex: /\balert\s*\(/, msg: 'alert() usage — remove before production', type: 'LINTING', severity: 'WARNING' },
            { regex: /\bvar\s+\w/, msg: 'Use let/const instead of var', type: 'LINTING', severity: 'INFO' },
            { regex: /TODO|FIXME|HACK|XXX/, msg: 'TODO/FIXME comment found', type: 'LINTING', severity: 'INFO' },
            // Best practice
            { regex: /catch\s*\([^)]*\)\s*\{\s*\}/, msg: 'Empty catch block — errors silently swallowed', type: 'LOGIC', severity: 'WARNING' },
            { regex: /catch\s*:\s*$/, msg: 'Bare except/catch — catches all errors', type: 'LOGIC', severity: 'WARNING' },
            { regex: /except\s*:/, msg: 'Bare except clause — catches all exceptions', type: 'LOGIC', severity: 'WARNING' },
            { regex: /throw\s+['"]/, msg: 'Throw string literal — use Error object', type: 'LOGIC', severity: 'WARNING' },
            { regex: /==\s*null|!=\s*null/, msg: 'Use strict equality (===) for null checks', type: 'LOGIC', severity: 'INFO' },
            { regex: /import\s+\*\s+from/, msg: 'Wildcard import detected', type: 'IMPORT', severity: 'WARNING' },
            { regex: /from\s+\S+\s+import\s+\*/, msg: 'Wildcard import (from x import *)', type: 'IMPORT', severity: 'WARNING' },
            { regex: /\bwith\s*\(/, msg: 'with statement — makes code unpredictable', type: 'LOGIC', severity: 'WARNING' },
            { regex: /readFileSync|writeFileSync|existsSync/, msg: 'Synchronous file operation — blocks event loop', type: 'LOGIC', severity: 'WARNING' },
            { regex: /def\s+\w+\s*\(.*=\s*\[\s*\]/, msg: 'Mutable default argument (list) — shared across calls', type: 'LOGIC', severity: 'WARNING' },
            { regex: /def\s+\w+\s*\(.*=\s*\{\s*\}/, msg: 'Mutable default argument (dict) — shared across calls', type: 'LOGIC', severity: 'WARNING' },
            { regex: /\bglobal\s+\w/, msg: 'Global statement — avoid mutable global state', type: 'LOGIC', severity: 'WARNING' },
            { regex: /\bassert\s+/, msg: 'Assert statement — disabled with -O flag in production', type: 'LOGIC', severity: 'INFO' },
        ];

        for (let i = 0; i < lines.length; i++) {
            for (const { regex, msg, type, severity } of patterns) {
                if (regex.test(lines[i])) {
                    violations.push({
                        line: i + 1,
                        message: msg,
                        category: type,
                        severity: severity || 'WARNING',
                        snippet: lines[i].trim(),
                    });
                }
            }
        }

        return violations;
    }
}

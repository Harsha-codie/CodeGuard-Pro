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

                if (result.violations && result.violations.length > 0) {
                    for (const violation of result.violations) {
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
        const msg = (violation.message || violation.description || '').toLowerCase();
        const rule = (violation.ruleName || violation.ruleId || '').toLowerCase();
        const category = (violation.category || '').toLowerCase();

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
            { regex: /eval\s*\(/, msg: 'Use of eval() is dangerous', type: 'LOGIC' },
            { regex: /exec\s*\(/, msg: 'Use of exec() is dangerous', type: 'LOGIC' },
            { regex: /(password|secret|api_key|apikey)\s*=\s*['"][^'"]+['"]/i, msg: 'Hardcoded secret detected', type: 'LOGIC' },
            { regex: /console\.(log|debug|info)\s*\(/, msg: 'Console statement found', type: 'LINTING' },
            { regex: /TODO|FIXME|HACK|XXX/, msg: 'TODO/FIXME comment found', type: 'LINTING' },
            { regex: /==\s*null|!=\s*null/, msg: 'Use strict equality (===) for null checks', type: 'LOGIC' },
            { regex: /catch\s*\(\s*\w+\s*\)\s*\{\s*\}/, msg: 'Empty catch block', type: 'LOGIC' },
            { regex: /import\s+\*\s+from/, msg: 'Wildcard import detected', type: 'IMPORT' },
        ];

        for (let i = 0; i < lines.length; i++) {
            for (const { regex, msg, type } of patterns) {
                if (regex.test(lines[i])) {
                    violations.push({
                        line: i + 1,
                        message: msg,
                        category: type,
                        snippet: lines[i].trim(),
                    });
                }
            }
        }

        return violations;
    }
}

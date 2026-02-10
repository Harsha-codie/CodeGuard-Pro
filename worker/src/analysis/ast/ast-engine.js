/**
 * AST Analysis Engine
 * 
 * Uses web-tree-sitter (WASM) to parse source code into ASTs and run
 * S-expression queries against them to detect violations.
 * 
 * This is the core detection engine. It:
 *   1. Parses source code → AST (per language grammar)
 *   2. Loads rule queries for that language
 *   3. Runs each query against the AST
 *   4. Returns violations with precise line/column info
 *   5. Falls back to regex for unsupported languages
 * 
 * Supported: JavaScript (JSX), TypeScript (TSX), Python, Java, Go, C
 */
const grammarLoader = require('./grammar-loader');
const queryRegistry = require('./queries');

class ASTEngine {
  constructor() {
    this._initialized = false;
  }

  async init() {
    if (this._initialized) return;
    await grammarLoader.init();
    this._initialized = true;
  }

  /**
   * Analyze a source file using AST-based detection.
   * 
   * @param {string} sourceCode - Raw file content
   * @param {string} filename - Filename (used for language detection)
   * @param {Object} options - Options
   * @param {string} options.language - Override language detection
   * @param {string[]} options.categories - Filter rule categories (e.g., ['security', 'style'])
   * @param {string[]} options.ruleIds - Run only specific rule IDs
   * @returns {Promise<{violations: Array, language: string, astSupported: boolean, parseTimeMs: number, queryTimeMs: number}>}
   */
  async analyze(sourceCode, filename, options = {}) {
    await this.init();

    const language = options.language || grammarLoader.detectLanguage(filename);
    
    if (!language || !grammarLoader.isSupported(language)) {
      return {
        violations: [],
        language: language || 'unknown',
        astSupported: false,
        parseTimeMs: 0,
        queryTimeMs: 0,
        message: `AST not supported for ${language || filename}. Use regex fallback.`
      };
    }

    // 1. Parse source code into AST
    const parseStart = Date.now();
    let tree;
    try {
      tree = await grammarLoader.parse(sourceCode, language);
    } catch (err) {
      console.error(`[ASTEngine] Parse failed for ${filename}:`, err.message);
      return {
        violations: [],
        language,
        astSupported: true,
        parseTimeMs: Date.now() - parseStart,
        queryTimeMs: 0,
        error: `Parse error: ${err.message}`
      };
    }
    const parseTimeMs = Date.now() - parseStart;

    // 2. Get queries for this language
    const queries = queryRegistry.getQueries(language, options.categories, options.ruleIds);
    
    if (queries.length === 0) {
      return {
        violations: [],
        language,
        astSupported: true,
        parseTimeMs,
        queryTimeMs: 0,
        message: 'No queries match the specified filters'
      };
    }

    // 3. Run each query against the AST
    const queryStart = Date.now();
    const violations = [];
    const lang = await grammarLoader.getLanguage(language);
    const lines = sourceCode.split('\n');

    for (const rule of queries) {
      try {
        const query = lang.query(rule.query);
        const matches = query.matches(tree.rootNode);

        for (const match of matches) {
          // Get the target capture (named @target, or first capture)
          let targetCapture = match.captures.find(c => c.name === 'target');
          if (!targetCapture) targetCapture = match.captures[0];
          if (!targetCapture) continue;

          const node = targetCapture.node;
          const lineNum = node.startPosition.row + 1; // 1-indexed
          const lineText = lines[node.startPosition.row] || '';

          // Check for codeguard-ignore suppression
          if (this._isSuppressed(lines, node.startPosition.row)) {
            continue;
          }

          violations.push({
            ruleId: rule.id,
            ruleName: rule.name,
            category: rule.category,
            severity: rule.severity,
            message: rule.message,
            line: lineNum,
            column: node.startPosition.column,
            endLine: node.endPosition.row + 1,
            endColumn: node.endPosition.column,
            snippet: node.text.length > 120 ? node.text.substring(0, 120) + '...' : node.text,
            lineText: lineText.trim(),
            engine: 'ast',
            language,
          });
        }

        // Free query resources
        query.delete();
      } catch (err) {
        // Log bad queries but don't crash the entire analysis
        console.warn(`[ASTEngine] Query failed for rule ${rule.id} (${language}): ${err.message}`);
      }
    }

    const queryTimeMs = Date.now() - queryStart;

    // Free tree
    tree.delete();

    return {
      violations,
      language,
      astSupported: true,
      parseTimeMs,
      queryTimeMs,
      rulesChecked: queries.length,
      matchesFound: violations.length,
    };
  }

  /**
   * Check if a line is suppressed by codeguard-ignore comment.
   */
  _isSuppressed(lines, lineIndex) {
    const line = lines[lineIndex] || '';
    const prevLine = lineIndex > 0 ? (lines[lineIndex - 1] || '') : '';

    const suppressionPattern = /codeguard-ignore|noqa|eslint-disable|@suppress/i;
    return suppressionPattern.test(line) || suppressionPattern.test(prevLine);
  }

  /**
   * Analyze multiple files in batch.
   * @param {Array<{filename: string, content: string}>} files
   * @param {Object} options - Same as analyze()
   * @returns {Promise<Array>} - Results per file
   */
  async analyzeFiles(files, options = {}) {
    await this.init();
    const results = [];

    for (const file of files) {
      const result = await this.analyze(file.content, file.filename, options);
      results.push({
        filename: file.filename,
        ...result,
      });
    }

    return results;
  }

  /**
   * Get engine status and supported languages.
   */
  getStatus() {
    return {
      initialized: this._initialized,
      supportedLanguages: grammarLoader.getSupportedLanguages(),
      totalRules: queryRegistry.getTotalRuleCount(),
      rulesByLanguage: queryRegistry.getRuleCountByLanguage(),
      rulesByCategory: queryRegistry.getRuleCountByCategory(),
    };
  }
}

// Singleton
module.exports = new ASTEngine();

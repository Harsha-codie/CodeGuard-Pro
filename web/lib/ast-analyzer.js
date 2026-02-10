/**
 * AST Analyzer for Webhook Integration
 * 
 * Lightweight wrapper that uses the worker's AST engine for analysis.
 * Falls back to regex if AST parsing isn't supported for a language.
 * 
 * This module is designed to work in Next.js serverless environment (ESM).
 */
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lazy-load AST engine to avoid loading WASM grammars until needed
let astEngine = null;
let grammarLoader = null;
let queryRegistry = null;

const AST_SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'tsx', 'python', 'java', 'go', 'c'];

/**
 * Map file extensions to language identifiers
 */
const EXT_TO_LANGUAGE = {
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.py': 'python',
  '.pyw': 'python',
  '.java': 'java',
  '.go': 'go',
  '.c': 'c',
  '.h': 'c',
};

/**
 * Detect language from filename
 */
function detectLanguage(filename) {
  const ext = path.extname(filename).toLowerCase();
  return EXT_TO_LANGUAGE[ext] || null;
}

/**
 * Check if AST analysis is supported for a language
 */
function isASTSupported(language) {
  return AST_SUPPORTED_LANGUAGES.includes(language);
}

/**
 * Initialize AST engine (lazy load)
 */
async function initASTEngine() {
  if (astEngine) return astEngine;

  try {
    // Resolve paths relative to worker directory
    const workerDir = path.resolve(__dirname, '../../worker');
    
    // Dynamic import for ESM compatibility
    const Parser = (await import('web-tree-sitter')).default;
    
    // Resolve web-tree-sitter location for WASM files
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    const webTSPath = require.resolve('web-tree-sitter');
    
    // Initialize WASM
    await Parser.init({
      locateFile(scriptName) {
        return path.join(path.dirname(webTSPath), scriptName);
      },
    });

    // Load grammar loader and query registry using createRequire for CommonJS modules
    grammarLoader = require(path.join(workerDir, 'src/analysis/ast/grammar-loader'));
    queryRegistry = require(path.join(workerDir, 'src/analysis/ast/queries'));

    await grammarLoader.init();

    // Create minimal engine wrapper
    astEngine = {
      async analyze(sourceCode, filename, options = {}) {
        const language = options.language || detectLanguage(filename);
        
        if (!language || !isASTSupported(language)) {
          return {
            violations: [],
            language: language || 'unknown',
            astSupported: false,
          };
        }

        try {
          const tree = await grammarLoader.parse(sourceCode, language);
          const queries = queryRegistry.getQueries(language, options.categories);
          
          if (queries.length === 0) {
            tree.delete();
            return {
              violations: [],
              language,
              astSupported: true,
              rulesChecked: 0,
            };
          }

          const violations = [];
          const lang = await grammarLoader.getLanguage(language);
          const lines = sourceCode.split('\n');

          for (const rule of queries) {
            try {
              const query = lang.query(rule.query);
              const matches = query.matches(tree.rootNode);

              for (const match of matches) {
                let targetCapture = match.captures.find(c => c.name === 'target');
                if (!targetCapture) targetCapture = match.captures[0];
                if (!targetCapture) continue;

                const node = targetCapture.node;
                const lineNum = node.startPosition.row + 1;
                const lineText = lines[node.startPosition.row] || '';

                // Check for suppression comments
                const prevLine = node.startPosition.row > 0 ? (lines[node.startPosition.row - 1] || '') : '';
                const suppressionPattern = /codeguard-ignore|noqa|eslint-disable/i;
                if (suppressionPattern.test(lineText) || suppressionPattern.test(prevLine)) {
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
                  snippet: node.text.length > 100 ? node.text.substring(0, 100) + '...' : node.text,
                  lineText: lineText.trim(),
                  engine: 'ast',
                  filename,
                  language,
                });
              }

              query.delete();
            } catch (err) {
              // Log but don't fail the entire analysis
              console.warn(`[AST] Query failed for rule ${rule.id}: ${err.message}`);
            }
          }

          tree.delete();

          return {
            violations,
            language,
            astSupported: true,
            rulesChecked: queries.length,
          };
        } catch (err) {
          console.error(`[AST] Parse error for ${filename}:`, err.message);
          return {
            violations: [],
            language,
            astSupported: true,
            error: err.message,
          };
        }
      },
    };

    console.log('[AST] Engine initialized successfully');
    return astEngine;
  } catch (err) {
    console.error('[AST] Failed to initialize engine:', err.message);
    astEngine = null;
    return null;
  }
}

/**
 * Analyze a file using AST-based detection
 * Falls back gracefully if AST is unavailable
 */
async function analyzeWithAST(sourceCode, filename, options = {}) {
  const engine = await initASTEngine();
  
  if (!engine) {
    return {
      violations: [],
      astSupported: false,
      error: 'AST engine not available',
    };
  }

  return engine.analyze(sourceCode, filename, options);
}

/**
 * Get AST engine status
 */
function getStatus() {
  return {
    initialized: !!astEngine,
    supportedLanguages: AST_SUPPORTED_LANGUAGES,
    totalRules: queryRegistry ? queryRegistry.getTotalRuleCount() : 0,
  };
}

export {
  analyzeWithAST,
  detectLanguage,
  isASTSupported,
  getStatus,
  AST_SUPPORTED_LANGUAGES,
};

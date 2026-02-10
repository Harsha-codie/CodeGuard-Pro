/**
 * Grammar Loader - Lazy loads WASM tree-sitter grammars
 * 
 * Uses web-tree-sitter (WASM-based) instead of native tree-sitter bindings.
 * Grammars are loaded on-demand and cached for reuse.
 * 
 * Supported Languages: JavaScript, TypeScript (TSX), Python, Java, Go, C
 */
const path = require('path');
const Parser = require('web-tree-sitter');

// Map language identifiers to WASM grammar files
const GRAMMAR_FILES = {
  javascript: 'tree-sitter-javascript.wasm',
  typescript: 'tree-sitter-typescript.wasm',
  tsx: 'tree-sitter-tsx.wasm',
  python: 'tree-sitter-python.wasm',
  java: 'tree-sitter-java.wasm',
  go: 'tree-sitter-go.wasm',
  c: 'tree-sitter-c.wasm',
};

// File extension to language mapping
const EXT_TO_LANGUAGE = {
  '.js': 'javascript',
  '.jsx': 'javascript',  // JSX uses the same JavaScript grammar
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

class GrammarLoader {
  constructor() {
    this._initialized = false;
    this._initPromise = null;
    this._languages = new Map();    // language name -> Language object
    this._parser = null;            // shared Parser instance
  }

  /**
   * Initialize web-tree-sitter WASM runtime (one-time)
   */
  async init() {
    if (this._initialized) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      await Parser.init({
        locateFile(scriptName) {
          return path.join(
            path.dirname(require.resolve('web-tree-sitter')),
            scriptName
          );
        },
      });
      this._parser = new Parser();
      this._initialized = true;
      console.log('[GrammarLoader] WASM runtime initialized');
    })();

    return this._initPromise;
  }

  /**
   * Get a Language object for the given language name.
   * Lazy-loads the WASM grammar on first use.
   */
  async getLanguage(languageName) {
    await this.init();

    if (this._languages.has(languageName)) {
      return this._languages.get(languageName);
    }

    const grammarFile = GRAMMAR_FILES[languageName];
    if (!grammarFile) {
      throw new Error(`Unsupported language: ${languageName}. Supported: ${Object.keys(GRAMMAR_FILES).join(', ')}`);
    }

    // Resolve grammar path from tree-sitter-wasms package
    const grammarPath = path.join(
      path.dirname(require.resolve('tree-sitter-wasms/package.json')),
      'out',
      grammarFile
    );

    const lang = await Parser.Language.load(grammarPath);
    this._languages.set(languageName, lang);
    console.log(`[GrammarLoader] Loaded grammar: ${languageName}`);
    return lang;
  }

  /**
   * Parse source code into an AST tree.
   * @param {string} sourceCode - The raw source code
   * @param {string} languageName - Language identifier (e.g., 'javascript')
   * @returns {Promise<Tree>} - The parsed AST tree
   */
  async parse(sourceCode, languageName) {
    await this.init();
    const lang = await this.getLanguage(languageName);
    this._parser.setLanguage(lang);
    return this._parser.parse(sourceCode);
  }

  /**
   * Detect language from file extension.
   * @param {string} filename - The filename or path
   * @returns {string|null} - Language name or null if unsupported
   */
  detectLanguage(filename) {
    const ext = path.extname(filename).toLowerCase();
    return EXT_TO_LANGUAGE[ext] || null;
  }

  /**
   * Check if a language is supported for AST parsing.
   */
  isSupported(languageName) {
    return !!GRAMMAR_FILES[languageName];
  }

  /**
   * Get list of all supported languages.
   */
  getSupportedLanguages() {
    return Object.keys(GRAMMAR_FILES);
  }
}

// Singleton
module.exports = new GrammarLoader();

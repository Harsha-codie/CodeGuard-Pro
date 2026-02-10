/**
 * Query Registry - Central registry for all AST detection queries
 * 
 * Aggregates queries from all language files and provides lookup/filter methods.
 * 
 * Rule Structure:
 *   id:       Unique identifier (e.g., 'js-sec-001')
 *   name:     Human-readable name (e.g., 'no-eval')
 *   category: security | naming | style | best-practice | performance
 *   severity: CRITICAL | WARNING | INFO
 *   message:  Description of the issue and how to fix it
 *   query:    Tree-sitter S-expression query
 */

// Load queries for each language
const javascriptQueries = require('./javascript');
const typescriptQueries = require('./typescript');
const pythonQueries = require('./python');
const javaQueries = require('./java');
const goQueries = require('./go');
const cQueries = require('./c');

// Map language name to queries
const QUERIES_BY_LANG = {
  javascript: javascriptQueries,
  typescript: typescriptQueries,
  tsx: typescriptQueries,     // TSX uses TS queries
  python: pythonQueries,
  java: javaQueries,
  go: goQueries,
  c: cQueries,
};

class QueryRegistry {
  /**
   * Get all queries for a language, optionally filtered by category/ruleIds.
   * 
   * @param {string} language - Language name (e.g., 'javascript')
   * @param {string[]} categories - Filter by categories (e.g., ['security', 'style'])
   * @param {string[]} ruleIds - Filter to specific rule IDs
   * @returns {Array} - Matching rules
   */
  getQueries(language, categories = null, ruleIds = null) {
    const langQueries = QUERIES_BY_LANG[language];
    if (!langQueries) {
      return [];
    }

    let queries = [...langQueries];

    // Filter by categories
    if (categories && categories.length > 0) {
      const categorySet = new Set(categories.map(c => c.toLowerCase()));
      queries = queries.filter(q => categorySet.has(q.category.toLowerCase()));
    }

    // Filter by ruleIds
    if (ruleIds && ruleIds.length > 0) {
      const idSet = new Set(ruleIds.map(id => id.toLowerCase()));
      queries = queries.filter(q => idSet.has(q.id.toLowerCase()));
    }

    return queries;
  }

  /**
   * Get all queries for a language by category.
   */
  getQueriesByCategory(language, category) {
    return this.getQueries(language, [category]);
  }

  /**
   * Get a single rule by ID (across all languages).
   */
  getRuleById(ruleId) {
    for (const lang of Object.keys(QUERIES_BY_LANG)) {
      const rule = QUERIES_BY_LANG[lang].find(q => q.id === ruleId);
      if (rule) {
        return { ...rule, language: lang };
      }
    }
    return null;
  }

  /**
   * Get total count of all rules across all languages.
   */
  getTotalRuleCount() {
    let count = 0;
    for (const queries of Object.values(QUERIES_BY_LANG)) {
      count += queries.length;
    }
    return count;
  }

  /**
   * Get rule count grouped by language.
   */
  getRuleCountByLanguage() {
    const counts = {};
    for (const [lang, queries] of Object.entries(QUERIES_BY_LANG)) {
      counts[lang] = queries.length;
    }
    return counts;
  }

  /**
   * Get rule count grouped by category (across all languages).
   */
  getRuleCountByCategory() {
    const counts = {};
    for (const queries of Object.values(QUERIES_BY_LANG)) {
      for (const q of queries) {
        const cat = q.category;
        counts[cat] = (counts[cat] || 0) + 1;
      }
    }
    return counts;
  }

  /**
   * Get all supported languages.
   */
  getSupportedLanguages() {
    return Object.keys(QUERIES_BY_LANG);
  }

  /**
   * Get all unique categories.
   */
  getCategories() {
    const cats = new Set();
    for (const queries of Object.values(QUERIES_BY_LANG)) {
      for (const q of queries) {
        cats.add(q.category);
      }
    }
    return Array.from(cats);
  }

  /**
   * Search rules by name or message (across all languages).
   */
  searchRules(searchText) {
    const results = [];
    const searchLower = searchText.toLowerCase();
    
    for (const [lang, queries] of Object.entries(QUERIES_BY_LANG)) {
      for (const q of queries) {
        if (q.name.toLowerCase().includes(searchLower) ||
            q.message.toLowerCase().includes(searchLower)) {
          results.push({ ...q, language: lang });
        }
      }
    }
    
    return results;
  }

  /**
   * Get all CRITICAL severity rules (for high-priority scanning).
   */
  getCriticalRules(language = null) {
    if (language) {
      return this.getQueries(language).filter(q => q.severity === 'CRITICAL');
    }
    
    const results = [];
    for (const [lang, queries] of Object.entries(QUERIES_BY_LANG)) {
      for (const q of queries) {
        if (q.severity === 'CRITICAL') {
          results.push({ ...q, language: lang });
        }
      }
    }
    return results;
  }

  /**
   * Get security-only rules for a language.
   */
  getSecurityRules(language) {
    return this.getQueriesByCategory(language, 'security');
  }

  /**
   * Validate all queries by checking their syntax.
   * @param {Function} queryCompiler - A function (lang, query) => compiled | error
   * @returns {Array<{ruleId: string, language: string, error: string}>}
   */
  async validateQueries(queryCompiler) {
    const errors = [];
    
    for (const [lang, queries] of Object.entries(QUERIES_BY_LANG)) {
      // Skip duplicates (tsx = typescript queries)
      if (lang === 'tsx') continue;
      
      for (const q of queries) {
        try {
          await queryCompiler(lang, q.query);
        } catch (err) {
          errors.push({
            ruleId: q.id,
            language: lang,
            error: err.message,
          });
        }
      }
    }
    
    return errors;
  }
}

module.exports = new QueryRegistry();

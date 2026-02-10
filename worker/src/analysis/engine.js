/**
 * Analysis Engine - Uses WASM-based Tree-sitter for AST analysis
 * 
 * This engine wraps our new AST engine for backward compatibility
 * with existing code that imports this module.
 */
const path = require('path');

// Lazy-load the AST engine
let astEngine = null;
let grammarLoader = null;

async function getASTEngine() {
    if (astEngine) return { engine: astEngine, loader: grammarLoader };
    
    const ASTEngine = require('./ast/ast-engine');
    grammarLoader = require('./ast/grammar-loader');
    
    // Initialize grammar loader
    await grammarLoader.init();
    
    astEngine = ASTEngine;
    return { engine: astEngine, loader: grammarLoader };
}

class AnalysisEngine {
    /**
     * Run a full analysis on a file.
     * @param {string} sourceCode - The raw file content.
     * @param {string} language - The language identifier (e.g., 'javascript').
     * @param {Array<{id: string, treeSitterQuery: string, message: string}>} rules - List of rules to check.
     * @returns {Promise<Array<Violation>>} - List of detected violations.
     */
    async analyze(sourceCode, language, rules) {
        if (!rules || rules.length === 0) return [];

        const violations = [];

        try {
            const { engine, loader } = await getASTEngine();
            
            // Check if AST analysis is supported for this language
            const supportedLanguages = ['javascript', 'typescript', 'tsx', 'python', 'java', 'go', 'c'];
            if (!supportedLanguages.includes(language)) {
                console.log(`[Engine] Language ${language} not supported for AST analysis`);
                return [];
            }

            // Parse the source code
            const tree = await loader.parse(sourceCode, language);
            const langObj = await loader.getLanguage(language);
            
            if (!tree || !langObj) {
                console.error(`[Engine] Failed to parse ${language} code`);
                return [];
            }

            // Execute each rule's query
            for (const rule of rules) {
                try {
                    if (!rule.treeSitterQuery || rule.treeSitterQuery.trim() === '') {
                        continue;
                    }

                    // Compile and execute the query
                    const query = langObj.query(rule.treeSitterQuery);
                    const matches = query.matches(tree.rootNode);

                    // Process matches
                    for (const match of matches) {
                        const capture = match.captures[0];
                        if (!capture) continue;

                        const node = capture.node;

                        violations.push({
                            ruleId: rule.id,
                            message: rule.message || "Rule violation detected",
                            line: node.startPosition.row + 1,
                            column: node.startPosition.column,
                            snippet: node.text.length > 100 ? node.text.substring(0, 100) + '...' : node.text
                        });
                    }
                    
                    query.delete();
                } catch (queryError) {
                    console.error(`Invalid Query for Rule ${rule.id}:`, queryError.message);
                    violations.push({
                        ruleId: rule.id,
                        message: `Configuration Error: Invalid Tree-sitter Query. Please update the rule.`,
                        line: 1,
                        isSystemError: true
                    });
                }
            }
            
            tree.delete();

        } catch (err) {
            console.error("Analysis Failed:", err);
            throw err;
        }

        return violations;
    }
}

module.exports = new AnalysisEngine();

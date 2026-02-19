/**
 * FixAgent — AI-powered code fix generator
 * 
 * Receives ONE issue at a time with minimal code context.
 * Generates a corrected code block using the Gemini API.
 * Never sends the entire repository to the LLM.
 */

export class FixAgent {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        this.model = 'gemini-2.0-flash';
        this.endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
    }

    /**
     * Generate a fix for a single issue
     * 
     * @param {Object} issue - { file, line, bug_type, description, code_snippet }
     * @param {string} fullFileContent - The full content of the affected file
     * @returns {Object} - { success, fixedCode, commitMessage, explanation }
     */
    async generateFix(issue, fullFileContent) {
        console.log(`[FixAgent] Generating fix for ${issue.file}:${issue.line} (${issue.bug_type})`);

        // Extract relevant context (not the whole file — just around the issue)
        const contextSnippet = this._extractContext(fullFileContent, issue.line, 15);

        const prompt = this._buildPrompt(issue, contextSnippet, fullFileContent);

        try {
            if (!this.apiKey) {
                // No AI key — use rule-based fixes
                return this._ruleBasedFix(issue, fullFileContent);
            }

            const response = await fetch(`${this.endpoint}?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 4096,
                    },
                }),
            });

            if (!response.ok) {
                console.warn(`[FixAgent] API error: ${response.status}`);
                return this._ruleBasedFix(issue, fullFileContent);
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            return this._parseAIResponse(text, issue, fullFileContent);

        } catch (error) {
            console.error(`[FixAgent] Error: ${error.message}`);
            return this._ruleBasedFix(issue, fullFileContent);
        }
    }

    /**
     * Build the prompt for the AI
     */
    _buildPrompt(issue, contextSnippet, fullContent) {
        return `You are a code fix agent. Fix ONLY the specific issue described below.
Do NOT change any other code. Preserve all existing logic, comments, and formatting.

FILE: ${issue.file}
LINE: ${issue.line}
BUG TYPE: ${issue.bug_type}
DESCRIPTION: ${issue.description}

CODE CONTEXT (around line ${issue.line}):
\`\`\`
${contextSnippet}
\`\`\`

FULL FILE:
\`\`\`
${fullContent}
\`\`\`

INSTRUCTIONS:
1. Return the COMPLETE fixed file content
2. Fix ONLY the described issue
3. Do NOT add new features or refactor
4. Preserve all comments, imports, and structure
5. If you cannot fix it safely, return the original code unchanged

RESPONSE FORMAT:
===FIXED_CODE_START===
(complete fixed file content here)
===FIXED_CODE_END===
===COMMIT_MESSAGE===
[AI-AGENT] (your commit message here)
===EXPLANATION===
(brief explanation of what was fixed)`;
    }

    /**
     * Parse AI response into structured fix
     */
    _parseAIResponse(text, issue, originalContent) {
        try {
            // Extract fixed code
            const codeMatch = text.match(/===FIXED_CODE_START===\s*\n?([\s\S]*?)===FIXED_CODE_END===/);
            const commitMatch = text.match(/===COMMIT_MESSAGE===\s*\n?(.*?)(?:\n|===)/);
            const explainMatch = text.match(/===EXPLANATION===\s*\n?([\s\S]*?)$/);

            if (!codeMatch) {
                // Try extracting from code block
                const blockMatch = text.match(/```[\w]*\n([\s\S]*?)```/);
                if (blockMatch) {
                    return {
                        success: true,
                        fixedCode: blockMatch[1].trim(),
                        commitMessage: `[AI-AGENT] Fix ${issue.bug_type.toLowerCase()} in ${issue.file}`,
                        explanation: `Fixed ${issue.bug_type} issue at line ${issue.line}`,
                    };
                }
                return this._ruleBasedFix(issue, originalContent);
            }

            const fixedCode = codeMatch[1].trim();
            const commitMessage = commitMatch?.[1]?.trim() || `[AI-AGENT] Fix ${issue.bug_type.toLowerCase()} in ${issue.file}`;
            const explanation = explainMatch?.[1]?.trim() || `Fixed ${issue.bug_type} issue`;

            // Validate: fixed code should be similar length (not empty or doubled)
            if (fixedCode.length < originalContent.length * 0.3 || fixedCode.length > originalContent.length * 3) {
                console.warn('[FixAgent] AI output suspicious length, using rule-based fix');
                return this._ruleBasedFix(issue, originalContent);
            }

            return {
                success: true,
                fixedCode,
                commitMessage: commitMessage.startsWith('[AI-AGENT]') ? commitMessage : `[AI-AGENT] ${commitMessage}`,
                explanation,
            };

        } catch (error) {
            console.error('[FixAgent] Failed to parse AI response:', error.message);
            return this._ruleBasedFix(issue, originalContent);
        }
    }

    /**
     * Rule-based fix fallback (no AI key needed)
     */
    _ruleBasedFix(issue, originalContent) {
        const lines = originalContent.split('\n');
        const lineIdx = issue.line - 1;
        let fixed = false;
        let description = '';

        if (lineIdx < 0 || lineIdx >= lines.length) {
            return { success: false, fixedCode: originalContent, commitMessage: '', explanation: 'Line out of range' };
        }

        const line = lines[lineIdx];

        switch (issue.bug_type) {
            case 'SYNTAX': {
                // Fix common syntax issues
                // Missing semicolons (JS/TS)
                if (issue.file.match(/\.(js|ts|jsx|tsx)$/) && !line.trim().endsWith(';') && !line.trim().endsWith('{') && !line.trim().endsWith('}') && !line.trim().endsWith(',') && !line.trim().startsWith('//') && !line.trim().startsWith('/*') && !line.trim().startsWith('*') && line.trim().length > 0) {
                    lines[lineIdx] = line.replace(/\s*$/, ';');
                    fixed = true;
                    description = 'Added missing semicolon';
                }
                break;
            }

            case 'LINTING': {
                // Remove console.log statements
                if (line.match(/console\.(log|debug|info)\s*\(/)) {
                    lines[lineIdx] = `// ${line.trim()} // Removed by AI-AGENT`;
                    fixed = true;
                    description = 'Commented out console statement';
                }
                // Fix naming conventions
                break;
            }

            case 'LOGIC': {
                // Fix eval usage
                if (line.match(/\beval\s*\(/)) {
                    lines[lineIdx] = line.replace(/\beval\s*\(/, 'Function(');
                    fixed = true;
                    description = 'Replaced eval() with Function()';
                }
                // Fix == to ===
                if (line.match(/[^=!]==[^=]/)) {
                    lines[lineIdx] = line.replace(/([^=!])==([^=])/g, '$1===$2');
                    fixed = true;
                    description = 'Fixed loose equality to strict equality';
                }
                // Fix hardcoded secrets
                if (line.match(/(password|secret|api_key)\s*=\s*['"][^'"]+['"]/i)) {
                    lines[lineIdx] = line.replace(/=\s*['"][^'"]+['"]/, '= process.env.SECRET_VALUE');
                    fixed = true;
                    description = 'Replaced hardcoded secret with environment variable';
                }
                break;
            }

            case 'TYPE_ERROR': {
                // Add null checks
                if (line.match(/\.\w+/) && !line.match(/\?\./)) {
                    // Add optional chaining
                    lines[lineIdx] = line.replace(/(\w+)\.(\w+)/g, '$1?.$2');
                    fixed = true;
                    description = 'Added optional chaining for null safety';
                }
                break;
            }

            case 'IMPORT': {
                // Comment out broken imports
                if (line.match(/^(import|from|require)/)) {
                    lines[lineIdx] = `// ${line} // TODO: Fix import`;
                    fixed = true;
                    description = 'Commented out broken import';
                }
                break;
            }

            case 'INDENTATION': {
                // Fix indentation (replace tabs with spaces)
                if (line.match(/\t/)) {
                    lines[lineIdx] = line.replace(/\t/g, '    ');
                    fixed = true;
                    description = 'Fixed indentation (tabs to spaces)';
                }
                break;
            }
        }

        return {
            success: fixed,
            fixedCode: lines.join('\n'),
            commitMessage: fixed ? `[AI-AGENT] Fix ${issue.bug_type.toLowerCase()} in ${issue.file}` : '',
            explanation: fixed ? description : 'Could not auto-fix this issue',
        };
    }

    /**
     * Extract context around a line number
     */
    _extractContext(content, line, contextLines = 10) {
        const lines = content.split('\n');
        const start = Math.max(0, line - contextLines - 1);
        const end = Math.min(lines.length, line + contextLines);
        return lines
            .slice(start, end)
            .map((l, i) => `${start + i + 1}: ${l}`)
            .join('\n');
    }
}

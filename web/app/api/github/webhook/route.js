import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { Octokit } from 'octokit';
import { getInstallationOctokit } from '../../../../lib/github-app';

const prisma = new PrismaClient();

// Default security rules to seed when a project is auto-created
const DEFAULT_SECURITY_RULES = [
    { description: 'Prevent hardcoded API keys, passwords, tokens, or credentials in source code', language: 'javascript', treeSitterQuery: '(string) @secret', severity: 'CRITICAL' },
    { description: 'Avoid using weak or deprecated cryptographic algorithms like MD5 or SHA1', language: 'javascript', treeSitterQuery: '(call_expression) @weak_crypto', severity: 'CRITICAL' },
    { description: 'Avoid hardcoding URLs in source code. Use configuration or environment variables', language: 'javascript', treeSitterQuery: '(string) @hardcoded_url', severity: 'WARNING' },
    { description: 'Avoid using eval() or exec() which can execute arbitrary code - security risk', language: 'javascript', treeSitterQuery: '(call_expression) @eval_exec', severity: 'CRITICAL' },
    { description: 'Use cryptographically secure random number generators, not Math.random()', language: 'javascript', treeSitterQuery: '(call_expression) @insecure_random', severity: 'WARNING' },
    { description: 'Never disable SSL certificate verification. This makes connections vulnerable to MITM attacks', language: 'javascript', treeSitterQuery: '(pair) @ssl_disabled', severity: 'CRITICAL' },
    { description: 'Avoid using pickle for untrusted data - security risk for Python deserialization', language: 'python', treeSitterQuery: '(call) @pickle_usage', severity: 'CRITICAL' },
    { description: 'Avoid document.write() as it can overwrite the entire DOM - XSS risk', language: 'javascript', treeSitterQuery: '(call_expression) @document_write', severity: 'WARNING' },
];

// Simple in-memory analysis (no Redis needed)
async function runInlineAnalysis(jobData) {
    const { analysisId, repoOwner, repoName, prNumber, headSha, projectId, installationId } = jobData;
    
    console.log(`[InlineAnalysis] Starting for ${repoOwner}/${repoName}#${prNumber}`);
    
    try {
        // Analysis is already PENDING, we'll update to SUCCESS or FAILURE at the end

        // Get authenticated Octokit - uses Installation Token if available, falls back to PAT
        const octokit = await getInstallationOctokit(installationId);

        // ── Set commit status to "pending" ──
        try {
            await octokit.rest.repos.createCommitStatus({
                owner: repoOwner,
                repo: repoName,
                sha: headSha,
                state: 'pending',
                description: 'CodeGuard is analyzing your code...',
                context: 'CodeGuard Pro / Security Analysis',
            });
            console.log('[InlineAnalysis] Commit status set: pending');
        } catch (e) {
            console.log('[InlineAnalysis] Could not set pending status:', e.message);
        }

        // Get changed files
        const { data: files } = await octokit.rest.pulls.listFiles({
            owner: repoOwner,
            repo: repoName,
            pull_number: prNumber,
        });

        console.log(`[InlineAnalysis] Found ${files.length} changed files`);

        // Get rules for this project
        const rules = await prisma.rule.findMany({
            where: { projectId, isActive: true }
        });

        console.log(`[InlineAnalysis] Found ${rules.length} active rules`);

        // Supported extensions
        const extToLang = {
            '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
            '.py': 'python', '.java': 'java', '.c': 'c', '.cpp': 'cpp', '.go': 'go', '.rs': 'rust'
        };

        const allViolations = [];

        for (const file of files) {
            if (file.status === 'removed') continue;
            
            const ext = '.' + file.filename.split('.').pop();
            const language = extToLang[ext];
            if (!language) continue;

            // Get file content
            let content;
            try {
                const { data } = await octokit.rest.repos.getContent({
                    owner: repoOwner, repo: repoName, path: file.filename, ref: headSha
                });
                content = Buffer.from(data.content, 'base64').toString('utf-8');
                console.log(`[InlineAnalysis] Fetched ${file.filename} (${content.length} chars)`);
            } catch (e) {
                console.log(`[InlineAnalysis] Could not fetch ${file.filename}: ${e.message}`);
                continue;
            }

            // Direct pattern matching for each rule
            // Rules are LANGUAGE-AGNOSTIC - same patterns work for JS, Python, Java, TS
            for (const rule of rules) {
                // Skip only if language is completely incompatible
                // Most security rules (hardcoded secrets, weak crypto, etc.) apply to ALL languages
                const compatibleLanguages = ['javascript', 'typescript', 'python', 'java'];
                if (!compatibleLanguages.includes(language)) {
                    continue;
                }

                const ruleText = (rule.treeSitterQuery + ' ' + rule.description).toLowerCase();
                const lines = content.split('\n');
                
                // Check each line for violations based on rule type
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    const lineNum = i + 1;
                    let violation = null;
                    
                    // ═══════════════════════════════════════════════
                    // DETECTION PATTERNS (30+ security & code quality)
                    // ═══════════════════════════════════════════════

                    // ── 1. SSL/Certificate Verification Disabled ──
                    if (ruleText.includes('ssl') || ruleText.includes('certificate') || ruleText.includes('tls')) {
                        if (/rejectUnauthorized\s*:\s*false/i.test(line)) {
                            violation = { match: 'rejectUnauthorized: false', type: 'SSL disabled' };
                        }
                        // Python: verify=False
                        if (/verify\s*=\s*False/.test(line) && /requests\.|urllib|http/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'SSL verification disabled (Python)' };
                        }
                        // Java: TrustAllCerts
                        if (/TrustAll|ALLOW_ALL_HOSTNAME|setHostnameVerifier/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'SSL bypass (Java)' };
                        }
                        // Node.js env
                        if (/NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0/.test(line)) {
                            violation = { match: 'NODE_TLS_REJECT_UNAUTHORIZED=0', type: 'SSL globally disabled' };
                        }
                    }
                    
                    // ── 2. Hardcoded Secrets/Credentials ──
                    if (ruleText.includes('api') || ruleText.includes('key') || ruleText.includes('password') || 
                        ruleText.includes('token') || ruleText.includes('secret') || ruleText.includes('credential')) {
                        if (/(api_?key|apikey|password|secret|token|auth|credential)\s*[=:]\s*["'][^"']{4,}["']/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'Hardcoded credential' };
                        }
                        if (/(API_?KEY|PASSWORD|SECRET|TOKEN|AUTH)\s*=\s*["'][^"']+["']/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'Hardcoded credential' };
                        }
                        // Known API key formats
                        if (/["'](sk-|ghp_|gho_|ghu_|ghs_|xox[a-z]-|AKIA|AIza|pk_live_|sk_live_|rk_live_|sq0atp-|EAACEdEose)[A-Za-z0-9_\-]{8,}["']/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'API key pattern detected' };
                        }
                        // Private keys
                        if (/-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/.test(line)) {
                            violation = { match: 'Private key embedded in code', type: 'Private key exposure' };
                        }
                        // Connection strings with credentials
                        if (/(mongodb|postgres|mysql|redis):\/\/[^:]+:[^@]+@/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'Hardcoded connection string' };
                        }
                    }
                    
                    // ── 3. Weak Cryptography ──
                    if (ruleText.includes('md5') || ruleText.includes('sha1') || ruleText.includes('crypto') || ruleText.includes('weak') || ruleText.includes('hash')) {
                        // Node.js crypto
                        if (/createHash\s*\(\s*["'](md5|sha1|md4|ripemd160)["']/i.test(line)) {
                            const algo = line.match(/createHash\s*\(\s*["'](md5|sha1|md4|ripemd160)["']/i)[1];
                            violation = { match: `createHash("${algo}")`, type: `Weak hash ${algo.toUpperCase()}` };
                        }
                        // Python hashlib
                        if (/hashlib\.(md5|sha1|md4)\s*\(/.test(line)) {
                            violation = { match: line.trim().substring(0, 50), type: 'Weak hash (Python)' };
                        }
                        // Java MessageDigest
                        if (/MessageDigest\.getInstance\s*\(\s*["'](MD5|SHA-?1|MD4)["']/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'Weak hash (Java)' };
                        }
                        // DES / RC4 weak ciphers
                        if (/createCipher(iv)?\s*\(\s*["'](des|rc4|rc2|blowfish)["']/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'Weak cipher algorithm' };
                        }
                    }
                    
                    // ── 4. Hardcoded URLs/IPs ──
                    if (ruleText.includes('url') || ruleText.includes('hardcod') || ruleText.includes('ip')) {
                        if (/["']https?:\/\/[^"'\s]{10,}["']/.test(line) && !line.includes('localhost') && !line.includes('127.0.0.1') && !line.includes('example.com') && !/^\s*\/\//.test(line) && !/^\s*\*/.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'Hardcoded URL' };
                        }
                        // Hardcoded IP addresses
                        if (/["']\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?["']/.test(line) && !line.includes('127.0.0.1') && !line.includes('0.0.0.0')) {
                            violation = { match: line.trim().substring(0, 60), type: 'Hardcoded IP address' };
                        }
                    }
                    
                    // ── 5. Insecure Random ──
                    if (ruleText.includes('random') || ruleText.includes('secure')) {
                        if (/Math\.random\s*\(/.test(line)) {
                            violation = { match: 'Math.random()', type: 'Insecure random' };
                        }
                        if (/random\.(random|randint|choice|shuffle|uniform)\s*\(/.test(line)) {
                            violation = { match: line.trim().substring(0, 50), type: 'Insecure random (Python)' };
                        }
                        // Java
                        if (/new\s+Random\s*\(/.test(line) && !/SecureRandom/.test(line)) {
                            violation = { match: line.trim().substring(0, 50), type: 'Insecure random (Java)' };
                        }
                    }
                    
                    // ── 6. XSS Risks ──
                    if (ruleText.includes('document') || ruleText.includes('write') || ruleText.includes('xss') || ruleText.includes('innerhtml') || ruleText.includes('injection')) {
                        if (/document\.write\s*\(/.test(line)) {
                            violation = { match: 'document.write()', type: 'XSS risk - document.write' };
                        }
                        if (/\.innerHTML\s*=/.test(line) && !/sanitize|escape|purify/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'XSS risk - innerHTML' };
                        }
                        if (/\.outerHTML\s*=/.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'XSS risk - outerHTML' };
                        }
                        if (/dangerouslySetInnerHTML/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'XSS risk - dangerouslySetInnerHTML' };
                        }
                    }
                    
                    // ── 7. Code Injection (eval/exec) ──
                    if (ruleText.includes('eval') || ruleText.includes('exec') || ruleText.includes('arbitrary') || ruleText.includes('injection') || ruleText.includes('dynamic')) {
                        if (/\beval\s*\(/.test(line) && !/^\s*\/\//.test(line)) {
                            violation = { match: 'eval()', type: 'Dangerous eval()' };
                        }
                        if (/\bexec\s*\(/.test(line) && !/child_process|\.exec\(\)/.test(line)) {
                            violation = { match: 'exec()', type: 'Dangerous exec()' };
                        }
                        // new Function() constructor
                        if (/new\s+Function\s*\(/.test(line)) {
                            violation = { match: 'new Function()', type: 'Dynamic code execution' };
                        }
                        // setTimeout/setInterval with string
                        if (/(setTimeout|setInterval)\s*\(\s*["']/.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'String-based timer (code injection)' };
                        }
                        // Python: compile + exec
                        if (/\bcompile\s*\(.*["']exec["']/.test(line)) {
                            violation = { match: line.trim().substring(0, 50), type: 'Dynamic code compilation' };
                        }
                    }
                    
                    // ── 8. Pickle Deserialization (Python) ──
                    if (ruleText.includes('pickle') || ruleText.includes('deserializ') || ruleText.includes('untrusted')) {
                        if (/pickle\.(load|loads)\s*\(/.test(line)) {
                            violation = { match: line.trim().substring(0, 50), type: 'Insecure pickle usage' };
                        }
                        if (/yaml\.(load|unsafe_load)\s*\(/.test(line) && !/SafeLoader|safe_load/.test(line)) {
                            violation = { match: line.trim().substring(0, 50), type: 'Insecure YAML deserialization' };
                        }
                        // Java: ObjectInputStream
                        if (/ObjectInputStream|readObject\s*\(/.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'Insecure Java deserialization' };
                        }
                    }
                    
                    // ── 9. SQL Injection ──
                    if (ruleText.includes('sql') || ruleText.includes('injection') || ruleText.includes('query') || ruleText.includes('concatenat')) {
                        // String concatenation in SQL
                        if (/(SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)\s+.*\+\s*(req\.|user|input|param|args)/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'SQL injection risk' };
                        }
                        // Template literals in SQL
                        if (/(SELECT|INSERT|UPDATE|DELETE)\s+.*\$\{/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'SQL injection via template literal' };
                        }
                        // Python f-string SQL
                        if (/f["'].*?(SELECT|INSERT|UPDATE|DELETE)\s+.*\{/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'SQL injection via f-string' };
                        }
                        // Python string format SQL  
                        if (/(SELECT|INSERT|UPDATE|DELETE).*\.format\s*\(/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'SQL injection via .format()' };
                        }
                    }
                    
                    // ── 10. Command Injection ──
                    if (ruleText.includes('command') || ruleText.includes('shell') || ruleText.includes('injection') || ruleText.includes('exec')) {
                        // child_process.exec with user input
                        if (/child_process|\.exec\s*\(.*(\$\{|req\.|user|input|param)/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'Command injection risk' };
                        }
                        // Python subprocess with shell=True
                        if (/subprocess\.(call|run|Popen)\s*\(.*shell\s*=\s*True/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'Command injection (shell=True)' };
                        }
                        // Python os.system
                        if (/os\.system\s*\(/.test(line)) {
                            violation = { match: line.trim().substring(0, 50), type: 'Command injection - os.system()' };
                        }
                        // Java Runtime.exec
                        if (/Runtime\.getRuntime\(\)\.exec\s*\(/.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'Command injection (Java)' };
                        }
                    }
                    
                    // ── 11. CORS Misconfiguration ──
                    if (ruleText.includes('cors') || ruleText.includes('origin') || ruleText.includes('access-control')) {
                        if (/Access-Control-Allow-Origin['":\s]*\*/.test(line) || /origin\s*:\s*["']\*["']/.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'CORS wildcard (*) - allows any origin' };
                        }
                        if (/credentials\s*:\s*true.*origin\s*:\s*["']\*|origin\s*:\s*["']\*.*credentials\s*:\s*true/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'CORS with credentials + wildcard' };
                        }
                    }
                    
                    // ── 12. Debug Statements ──
                    if (ruleText.includes('console') || ruleText.includes('debug') || ruleText.includes('log')) {
                        if (/console\.(log|debug|warn|info)\s*\(/.test(line) && !/^\s*\/\//.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'Debug statement in production' };
                        }
                        if (/\bdebugger\b/.test(line) && !/^\s*\/\//.test(line)) {
                            violation = { match: 'debugger', type: 'Debugger statement' };
                        }
                        // Python print
                        if (language === 'python' && /\bprint\s*\(/.test(line) && !/logging|logger/i.test(line)) {
                            violation = { match: line.trim().substring(0, 50), type: 'Debug print() statement' };
                        }
                    }
                    
                    // ── 13. TODO/FIXME Comments ──
                    if (ruleText.includes('todo') || ruleText.includes('fixme') || ruleText.includes('hack') || ruleText.includes('comment')) {
                        if (/\/\/\s*(TODO|FIXME|HACK|XXX|BUG)\b/i.test(line) || /#\s*(TODO|FIXME|HACK|XXX|BUG)\b/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'Unresolved TODO/FIXME' };
                        }
                    }
                    
                    // ── 14. Empty Catch Blocks ──
                    if (ruleText.includes('catch') || ruleText.includes('error') || ruleText.includes('empty')) {
                        if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(line)) {
                            violation = { match: 'catch() { }', type: 'Empty catch block' };
                        }
                        // Python bare except
                        if (/except\s*:\s*$/.test(line.trim()) || /except\s*:\s*pass/.test(line)) {
                            violation = { match: line.trim().substring(0, 50), type: 'Bare except / swallowed error' };
                        }
                    }
                    
                    // ── 15. Const Preference (var/let) ──
                    if (ruleText.includes('const') || ruleText.includes('var') || ruleText.includes('let') || ruleText.includes('prefer')) {
                        if (/\bvar\s+\w+\s*=/.test(line) && (language === 'javascript' || language === 'typescript')) {
                            violation = { match: line.trim().substring(0, 60), type: 'Use const/let instead of var' };
                        }
                    }
                    
                    // ── 16. Naming Conventions ──
                    if (ruleText.includes('naming') || ruleText.includes('variable') || ruleText.includes('name') || ruleText.includes('hungarian') || ruleText.includes('length')) {
                        // Hungarian notation
                        if (/\b(str|int|bool|arr|obj|num|fn)[A-Z][a-zA-Z]+\s*[=:]/.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'Hungarian notation detected' };
                        }
                        // Very long variable names (40+ chars)
                        if (/\b(const|let|var|def|int|string)\s+(\w{41,})\s*[=]/.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'Variable name too long (>40 chars)' };
                        }
                    }
                    
                    // ── 17. Magic Numbers ──
                    if (ruleText.includes('magic') || ruleText.includes('number') || ruleText.includes('constant')) {
                        if (/[=<>!]+\s*\d{3,}/.test(line) && !/^\s*(\/\/|#|\*|import|require|port|status|http|error)/i.test(line) && !/\.(length|size|status|port)/.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'Magic number - use named constant' };
                        }
                    }
                    
                    // ── 18. Path Traversal ──
                    if (ruleText.includes('path') || ruleText.includes('traversal') || ruleText.includes('directory') || ruleText.includes('file')) {
                        if (/\.\.\/(\.\.\/)*/.test(line) && /(readFile|readdir|createReadStream|open|access)/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'Potential path traversal' };
                        }
                        if (/req\.(params|query|body)\s*\[?.*\]?\s*.*\b(readFile|join|resolve)/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'User input in file path' };
                        }
                    }
                    
                    // ── 19. ReDoS (Regex Denial of Service) ──
                    if (ruleText.includes('regex') || ruleText.includes('redos') || ruleText.includes('denial')) {
                        // Nested quantifiers that could cause catastrophic backtracking
                        if (/new\s+RegExp\s*\(.*(\+|\*).*(\+|\*)/.test(line) || /\/.*(\+|\*)\).*(\+|\*)/.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'Potential ReDoS pattern' };
                        }
                    }
                    
                    // ── 20. Hardcoded Port Numbers ──
                    if (ruleText.includes('port') || ruleText.includes('hardcod') || ruleText.includes('config')) {
                        if (/\.listen\s*\(\s*\d{4,5}\s*[,)]/.test(line) && !/process\.env|PORT|config/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'Hardcoded port number' };
                        }
                    }
                    
                    // ── 21. Exposed Error Details ──
                    if (ruleText.includes('error') || ruleText.includes('stack') || ruleText.includes('expose')) {
                        if (/res\.(send|json)\s*\(.*\b(stack|stackTrace|err\.message)/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'Exposed error/stack trace' };
                        }
                    }
                    
                    // ── 22. Insecure HTTP ──
                    if (ruleText.includes('http') || ruleText.includes('insecure') || ruleText.includes('protocol')) {
                        if (/["']http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[^"'\s]+["']/.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'Insecure HTTP (use HTTPS)' };
                        }
                    }
                    
                    // ── 23. Unsafe Object Prototype ──
                    if (ruleText.includes('prototype') || ruleText.includes('pollution') || ruleText.includes('object')) {
                        if (/\.__proto__\b/.test(line) || /Object\.assign\s*\(\s*\{\}.*req\.(body|query|params)/i.test(line)) {
                            violation = { match: line.trim().substring(0, 60), type: 'Prototype pollution risk' };
                        }
                    }
                    
                    // Add violation if found
                    if (violation) {
                        console.log(`[InlineAnalysis] FOUND: ${file.filename}:${lineNum} - ${violation.type}`);
                        allViolations.push({
                            ruleId: rule.id,
                            ruleName: rule.description.substring(0, 50),
                            message: rule.description,
                            severity: rule.severity,
                            filePath: file.filename,
                            line: lineNum,
                            snippet: violation.match
                        });
                    }
                }
            }
        }

        console.log(`[InlineAnalysis] Found ${allViolations.length} violations`);

        // ── Set GitHub Commit Status (pending → success/failure) ──
        try {
            await octokit.rest.repos.createCommitStatus({
                owner: repoOwner,
                repo: repoName,
                sha: headSha,
                state: allViolations.length > 0 ? 'failure' : 'success',
                description: allViolations.length > 0 
                    ? `Found ${allViolations.length} violation(s)` 
                    : 'No compliance violations found',
                context: 'CodeGuard Pro / Security Analysis',
                target_url: process.env.NEXTAUTH_URL ? `${process.env.NEXTAUTH_URL}/history` : undefined,
            });
            console.log(`[InlineAnalysis] Commit status set: ${allViolations.length > 0 ? 'failure' : 'success'}`);
        } catch (statusError) {
            console.error('[InlineAnalysis] Error setting commit status:', statusError.message);
        }

        // Create violation records in DB
        for (const v of allViolations) {
            await prisma.violation.create({
                data: {
                    analysisId,
                    ruleId: v.ruleId,
                    filePath: v.filePath,
                    lineNumber: v.line,
                    message: v.message,
                }
            });
        }

        // Post to GitHub PR
        if (allViolations.length > 0) {
            // Group violations by file for PR review
            const reviewComments = allViolations.slice(0, 20).map(v => ({
                path: v.filePath,
                line: v.line,
                body: `⚠️ **${v.ruleName}**\n\n${v.message}\n\n\`\`\`\n${v.snippet}\n\`\`\``
            }));

            try {
                await octokit.rest.pulls.createReview({
                    owner: repoOwner,
                    repo: repoName,
                    pull_number: prNumber,
                    commit_id: headSha,
                    event: 'COMMENT',
                    comments: reviewComments
                });
                console.log('[InlineAnalysis] Posted review comments to PR');
            } catch (reviewError) {
                console.error('[InlineAnalysis] Error posting review:', reviewError.message);
                // Fallback: post a single comment
                try {
                    const body = `## 🔍 CodeGuard Analysis Results\n\nFound **${allViolations.length}** compliance violation(s):\n\n` +
                        allViolations.slice(0, 10).map(v => 
                            `- **${v.filePath}:${v.line}** - ${v.ruleName}`
                        ).join('\n') +
                        (allViolations.length > 10 ? `\n\n...and ${allViolations.length - 10} more` : '');
                    
                    await octokit.rest.issues.createComment({
                        owner: repoOwner,
                        repo: repoName,
                        issue_number: prNumber,
                        body
                    });
                    console.log('[InlineAnalysis] Posted summary comment to PR');
                } catch (commentError) {
                    console.error('[InlineAnalysis] Error posting comment:', commentError.message);
                }
            }
        } else {
            // Post success comment
            try {
                await octokit.rest.issues.createComment({
                    owner: repoOwner,
                    repo: repoName,
                    issue_number: prNumber,
                    body: '## ✅ CodeGuard Analysis Passed\n\nNo compliance violations detected. Great job!'
                });
            } catch (e) {
                console.log('[InlineAnalysis] Could not post success comment:', e.message);
            }
        }

        // Update analysis status
        await prisma.analysis.update({
            where: { id: analysisId },
            data: {
                status: 'SUCCESS',
            }
        });

        // ── Slack Notification ──
        try {
            const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
            if (slackWebhookUrl) {
                const statusEmoji = allViolations.length > 0 ? '❌' : '✅';
                const statusText = allViolations.length > 0 ? 'Failed' : 'Passed';
                
                const slackPayload = {
                    text: `${statusEmoji} CodeGuard: ${repoOwner}/${repoName} PR #${prNumber} - ${statusText}`,
                    blocks: [
                        {
                            type: 'header',
                            text: { type: 'plain_text', text: `${statusEmoji} CodeGuard Analysis ${statusText}` }
                        },
                        {
                            type: 'section',
                            fields: [
                                { type: 'mrkdwn', text: `*Repository:*\n${repoOwner}/${repoName}` },
                                { type: 'mrkdwn', text: `*PR:*\n#${prNumber}` },
                                { type: 'mrkdwn', text: `*Violations:*\n${allViolations.length}` },
                                { type: 'mrkdwn', text: `*Commit:*\n\`${headSha.slice(0, 7)}\`` }
                            ]
                        }
                    ]
                };

                if (allViolations.length > 0) {
                    const violationList = allViolations.slice(0, 5).map(v =>
                        `• \`${v.filePath}:${v.line}\` - ${v.snippet}`
                    ).join('\n');
                    slackPayload.blocks.push({
                        type: 'section',
                        text: { type: 'mrkdwn', text: `*Top Violations:*\n${violationList}${allViolations.length > 5 ? `\n...and ${allViolations.length - 5} more` : ''}` }
                    });
                }

                await fetch(slackWebhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(slackPayload)
                });
                console.log('[InlineAnalysis] Slack notification sent');
            }
        } catch (slackErr) {
            console.log('[InlineAnalysis] Slack notification failed:', slackErr.message);
        }

        console.log(`[InlineAnalysis] Completed. Found ${allViolations.length} violations.`);
        return { violations: allViolations.length };

    } catch (error) {
        console.error('[InlineAnalysis] Error:', error);
        await prisma.analysis.update({
            where: { id: analysisId },
            data: { status: 'FAILURE' }
        });
        throw error;
    }
}

// Extract regex patterns from tree-sitter queries (simplified)
function extractPatternsFromQuery(query) {
    const patterns = [];
    const q = query.toLowerCase();
    
    // ===== SECURITY RULES =====
    
    // SSL certificate verification disabled (rejectUnauthorized: false)
    if (q.includes('ssl') || q.includes('certificate') || q.includes('rejectunauthorized')) {
        patterns.push({ regex: 'rejectUnauthorized\\s*:\\s*false' });
        patterns.push({ regex: 'NODE_TLS_REJECT_UNAUTHORIZED\\s*=\\s*["\']?0' });
    }
    
    // Hardcoded secrets/API keys/passwords/tokens
    if (q.includes('secret') || q.includes('api') || q.includes('key') || 
        q.includes('password') || q.includes('token') || q.includes('credential') ||
        q.includes('hardcoded') || q.includes('hardcode')) {
        // Match: apiKey = "value", api_key: "value", etc.
        patterns.push({ regex: '(api_?key|apikey|secret|password|token|auth|credential)\\s*[=:]\\s*["\'][^"\']{4,}["\']' });
        // Match: const API_KEY = "..."
        patterns.push({ regex: '(API_?KEY|SECRET|PASSWORD|TOKEN|AUTH|CREDENTIAL)\\s*=\\s*["\'][^"\']+["\']' });
        // Match: "sk-...", "ghp_...", "xox..." (common token formats)
        patterns.push({ regex: '["\'](?:sk-|ghp_|xox[a-z]-|AKIA)[A-Za-z0-9]{10,}["\']' });
    }
    
    // Weak cryptographic algorithms (MD5, SHA1)
    if (q.includes('md5') || q.includes('sha1') || q.includes('crypto') || q.includes('weak') || q.includes('deprecated')) {
        patterns.push({ regex: 'createHash\\s*\\(\\s*["\']md5["\']' });
        patterns.push({ regex: 'createHash\\s*\\(\\s*["\']sha1["\']' });
        patterns.push({ regex: '\\.md5\\s*\\(' });
        patterns.push({ regex: '\\.sha1\\s*\\(' });
    }
    
    // Hardcoded URLs
    if (q.includes('url') || q.includes('hardcod')) {
        patterns.push({ regex: '["\']https?://[^"\'\\s]{10,}["\']' });
    }
    
    // Insecure random (Math.random for security)
    if (q.includes('random') || q.includes('secure')) {
        patterns.push({ regex: 'Math\\.random\\s*\\(' });
    }
    
    // document.write (XSS risk)
    if (q.includes('document.write') || q.includes('xss')) {
        patterns.push({ regex: 'document\\.write\\s*\\(' });
    }
    
    // ===== CODE QUALITY RULES =====
    
    // Console.log detection
    if (q.includes('console')) {
        patterns.push({ regex: 'console\\.(log|warn|error|info|debug)\\s*\\(' });
    }
    
    // Eval detection
    if (q.includes('eval')) {
        patterns.push({ regex: '\\beval\\s*\\(' });
    }
    
    // Debugger statements
    if (q.includes('debugger')) {
        patterns.push({ regex: '\\bdebugger\\b' });
    }
    
    // TODO/FIXME comments
    if (q.includes('todo') || q.includes('fixme')) {
        patterns.push({ regex: '(TODO|FIXME|HACK|XXX)' });
    }
    
    // Empty catch blocks
    if (q.includes('catch') && q.includes('empty')) {
        patterns.push({ regex: 'catch\\s*\\([^)]*\\)\\s*\\{\\s*\\}' });
    }
    
    // var usage (prefer let/const)
    if (q.includes('var ')) {
        patterns.push({ regex: '\\bvar\\s+\\w+' });
    }
    
    // == instead of ===
    if (q.includes('===') || q.includes('equality') || q.includes('strict')) {
        patterns.push({ regex: '[^=!]==[^=]' });
    }
    
    console.log(`[PatternExtractor] Query keywords found, generated ${patterns.length} patterns`);
    return patterns;
}

/**
 * GitHub App Webhook Handler
 * Receives events from GitHub when PRs are created/updated.
 */
export async function POST(request) {
    try {
        const signature = request.headers.get('x-hub-signature-256');
        const event = request.headers.get('x-github-event');
        const delivery = request.headers.get('x-github-delivery');

        if (!event) {
            console.error('[Webhook] Missing x-github-event header');
            return NextResponse.json({ error: 'Missing event header' }, { status: 400 });
        }

        const body = await request.text();

        if (!body) {
            console.error('[Webhook] Empty request body');
            return NextResponse.json({ error: 'Empty request body' }, { status: 400 });
        }

        // Verify webhook signature
        if (!verifySignature(body, signature)) {
            console.error('[Webhook] Invalid webhook signature');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        let payload;
        try {
            payload = JSON.parse(body);
        } catch (parseError) {
            console.error('[Webhook] Invalid JSON payload:', parseError.message);
            return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
        }

        console.log(`[Webhook] Received: ${event} (${delivery})`);

        // Handle different event types
        switch (event) {
            case 'pull_request':
                const prResult = await handlePullRequest(payload);
                return NextResponse.json({ 
                    received: true, 
                    event: 'pull_request',
                    ...prResult 
                });
            case 'installation':
                await handleInstallation(payload);
                return NextResponse.json({ received: true, event: 'installation' });
            case 'ping':
                console.log('[Webhook] Ping received - webhook is configured correctly!');
                return NextResponse.json({ received: true, event: 'ping', message: 'Pong!' });
            default:
                console.log(`[Webhook] Ignoring event: ${event}`);
                return NextResponse.json({ received: true, event, ignored: true });
        }
    } catch (error) {
        console.error('[Webhook] Unhandled error:', error);
        return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
    }
}

/**
 * Verify GitHub webhook signature
 */
function verifySignature(payload, signature) {
    if (!signature || !process.env.GITHUB_WEBHOOK_SECRET) {
        // In development, allow unsigned webhooks
        if (process.env.NODE_ENV === 'development') return true;
        return false;
    }

    const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET);
    const digest = 'sha256=' + hmac.update(payload).digest('hex');

    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

/**
 * Handle Pull Request events
 */
async function handlePullRequest(payload) {
    const action = payload.action;
    const pr = payload.pull_request;
    const repo = payload.repository;

    console.log(`[PR] ${action}: ${repo.full_name}#${pr.number}`);

    // Only analyze on open/synchronize (new commits pushed)
    if (!['opened', 'synchronize', 'reopened'].includes(action)) {
        return { status: 'ignored', reason: `Action '${action}' not tracked` };
    }

    try {
        // Find the project in our database
        const project = await prisma.project.findFirst({
            where: {
                repoOwner: repo.owner.login,
                repoName: repo.name,
            },
            include: {
                rules: {
                    where: { isActive: true },
                    select: { id: true }
                }
            }
        });

        if (!project) {
            console.log(`[PR] No project configured for ${repo.full_name}`);
            console.log(`[PR] To add this repo, run: node add-project.js ${repo.owner.login} ${repo.name}`);
            return { 
                status: 'skipped', 
                reason: 'Project not configured',
                repo: repo.full_name,
                hint: 'Add project to database with rules to enable analysis'
            };
        }

        if (project.rules.length === 0) {
            console.log(`[PR] No active rules for ${repo.full_name}`);
            return { 
                status: 'skipped', 
                reason: 'No active rules',
                repo: repo.full_name,
                projectId: project.id
            };
        }

        // Create a pending analysis record
        const analysis = await prisma.analysis.create({
            data: {
                projectId: project.id,
                commitHash: pr.head.sha,
                prNumber: pr.number,
                status: 'PENDING',
            }
        });

        console.log(`[PR] Created analysis ${analysis.id} for PR #${pr.number}`);

        // Queue analysis job
        const jobData = {
            analysisId: analysis.id,
            prNumber: pr.number,
            repoFullName: repo.full_name,
            repoOwner: repo.owner.login,
            repoName: repo.name,
            headSha: pr.head.sha,
            baseSha: pr.base.sha,
            installationId: payload.installation?.id,
            projectId: project.id,
        };

        // Run inline analysis (no Redis needed)
        console.log('[PR] Starting inline analysis...');
        runInlineAnalysis(jobData).catch(err => {
            console.error('[PR] Inline analysis error:', err);
        });
        
        return { 
            status: 'analyzing',
            analysisId: analysis.id,
            repo: repo.full_name,
            pr: pr.number,
            rulesCount: project.rules.length
        };

    } catch (error) {
        console.error('[PR] Error handling PR event:', error);
        return { status: 'error', message: error.message };
    }
}

/**
 * Handle GitHub App installation events
 * Auto-creates projects with default security rules when app is installed
 */
async function handleInstallation(payload) {
    const action = payload.action;
    const installation = payload.installation;
    const sender = payload.sender;
    const repos = payload.repositories || [];

    console.log(`[Installation] ${action} by ${sender.login} (${repos.length} repos)`);

    if (action === 'created') {
        console.log(`[Installation] App installed on: ${installation.account.login}`);
        
        // Find or create user
        let user = await prisma.user.findUnique({
            where: { githubId: String(sender.id) }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    githubId: String(sender.id),
                    name: sender.login,
                    avatarUrl: sender.avatar_url,
                }
            });
            console.log(`[Installation] Created user: ${sender.login}`);
        }

        // Auto-create projects for each repo
        for (const repo of repos) {
            try {
                const existing = await prisma.project.findUnique({
                    where: { githubRepoId: BigInt(repo.id) }
                });

                if (existing) {
                    // Update installation ID if project already exists
                    await prisma.project.update({
                        where: { id: existing.id },
                        data: { installationId: String(installation.id) }
                    });
                    console.log(`[Installation] Updated installation ID for ${repo.full_name}`);
                    continue;
                }

                const project = await prisma.project.create({
                    data: {
                        ownerId: user.id,
                        repoName: repo.name,
                        repoOwner: installation.account.login,
                        repoUrl: `https://github.com/${repo.full_name}`,
                        githubRepoId: BigInt(repo.id),
                        installationId: String(installation.id),
                    }
                });

                // Seed default security rules
                for (const rule of DEFAULT_SECURITY_RULES) {
                    await prisma.rule.create({
                        data: {
                            projectId: project.id,
                            description: rule.description,
                            language: rule.language,
                            treeSitterQuery: rule.treeSitterQuery,
                            severity: rule.severity,
                            isActive: true,
                        }
                    });
                }

                console.log(`[Installation] Auto-created project "${repo.full_name}" with ${DEFAULT_SECURITY_RULES.length} default rules`);
            } catch (repoError) {
                console.error(`[Installation] Error creating project for ${repo.full_name}:`, repoError.message);
            }
        }

        console.log(`[Installation] Setup complete for ${installation.account.login}`);

    } else if (action === 'added') {
        // Repos added to existing installation
        const addedRepos = payload.repositories_added || [];
        console.log(`[Installation] ${addedRepos.length} repos added to installation`);

        let user = await prisma.user.findUnique({
            where: { githubId: String(sender.id) }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    githubId: String(sender.id),
                    name: sender.login,
                    avatarUrl: sender.avatar_url,
                }
            });
        }

        for (const repo of addedRepos) {
            try {
                const existing = await prisma.project.findUnique({
                    where: { githubRepoId: BigInt(repo.id) }
                });
                if (existing) continue;

                const project = await prisma.project.create({
                    data: {
                        ownerId: user.id,
                        repoName: repo.name,
                        repoOwner: installation.account.login,
                        repoUrl: `https://github.com/${repo.full_name}`,
                        githubRepoId: BigInt(repo.id),
                        installationId: String(installation.id),
                    }
                });

                for (const rule of DEFAULT_SECURITY_RULES) {
                    await prisma.rule.create({
                        data: {
                            projectId: project.id,
                            description: rule.description,
                            language: rule.language,
                            treeSitterQuery: rule.treeSitterQuery,
                            severity: rule.severity,
                            isActive: true,
                        }
                    });
                }

                console.log(`[Installation] Auto-created project "${repo.full_name}" with default rules`);
            } catch (repoError) {
                console.error(`[Installation] Error adding repo ${repo.full_name}:`, repoError.message);
            }
        }

    } else if (action === 'removed') {
        // Repos removed from installation
        const removedRepos = payload.repositories_removed || [];
        console.log(`[Installation] ${removedRepos.length} repos removed from installation`);

        for (const repo of removedRepos) {
            console.log(`[Installation] Repo removed: ${repo.full_name} (keeping in DB for history)`);
        }

    } else if (action === 'deleted') {
        console.log(`[Installation] App uninstalled from: ${installation.account.login}`);
        // Keep projects in DB for historical record, just log the event
    }
}

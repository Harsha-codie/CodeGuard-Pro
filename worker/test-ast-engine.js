/**
 * AST Engine Test Harness
 * 
 * Tests the AST detection engine with sample code to verify queries work correctly.
 * 
 * Run: node test-ast-engine.js
 */
const path = require('path');

// Set up module paths relative to worker directory
process.chdir(__dirname);

async function runTests() {
  console.log('========================================');
  console.log('  AST Engine Test Suite');
  console.log('========================================\n');

  // Import dynamically after chdir
  const astEngine = require('./src/analysis/ast/ast-engine');
  const queryRegistry = require('./src/analysis/ast/queries');

  // Initialize engine
  console.log('[Init] Initializing AST engine...');
  await astEngine.init();
  
  // Get status
  const status = astEngine.getStatus();
  console.log('[Status] Supported languages:', status.supportedLanguages.join(', '));
  console.log('[Status] Total rules:', status.totalRules);
  console.log('[Status] Rules by language:', JSON.stringify(status.rulesByLanguage));
  console.log('[Status] Rules by category:', JSON.stringify(status.rulesByCategory));
  console.log('');

  // ═══════════════════════════════════════
  // TEST SAMPLES PER LANGUAGE
  // ═══════════════════════════════════════

  const testCases = [
    {
      name: 'JavaScript - Security Issues',
      filename: 'test.js',
      code: `
const password = 'secret123';
eval('alert(1)');
const hash = crypto.createHash('md5');
const x = Math.random();
document.write('<div>hi</div>');
div.innerHTML = userInput;
var oldVar = true;
console.log('debug');
setTimeout('doSomething()', 1000);
new Function('return 42');
// TODO: fix this security issue
`,
      expectedPatterns: ['no-eval', 'no-hardcoded-secret', 'no-weak-crypto', 'no-insecure-random', 
                         'no-document-write', 'no-innerhtml', 'no-var', 'no-console-log', 
                         'no-settimeout-string', 'no-function-constructor', 'no-todo-comments'],
    },
    {
      name: 'JavaScript - React/JSX Issues',
      filename: 'component.jsx',
      code: `
function App() {
  return (
    <div>
      <div dangerouslySetInnerHTML={{ __html: userInput }} />
      <div style={{ color: 'red' }}>Inline styled</div>
      {items.map((item, index) => <li key={index}>{item}</li>)}
      <button onClick={() => document.getElementById('foo').focus()}>Click</button>
    </div>
  );
}
`,
      expectedPatterns: ['no-dangerously-set-innerhtml', 'no-jsx-inline-style', 
                         'no-array-index-key', 'no-direct-dom-manipulation'],
    },
    {
      name: 'TypeScript - Type Issues',
      filename: 'service.ts',
      code: `
const data: any = fetchData();
// @ts-ignore
const broken = wrongCall();
const value = maybeNull!;
interface user {}
enum status { active, inactive }
`,
      expectedPatterns: ['no-any-type', 'no-ts-ignore', 'no-non-null-assertion', 
                         'interface-pascal-case', 'enum-pascal-case'],
    },
    {
      name: 'Python - Security Issues',
      filename: 'app.py',
      code: `
import pickle
import hashlib
import os
import subprocess

password = "secret123"
h = hashlib.md5(data)
pickle.loads(user_data)
eval(user_input)
exec(code)
os.system(cmd)
subprocess.call(cmd, shell=True)
x = random.randint(1, 100)
print("debug")
# TODO: fix this
try:
    risky()
except:
    pass
`,
      expectedPatterns: ['no-eval', 'no-exec', 'no-pickle', 'no-hardcoded-password',
                         'no-weak-hash', 'no-os-system', 'no-subprocess-shell', 
                         'no-insecure-random', 'no-print', 'no-todo', 'no-bare-except'],
    },
    {
      name: 'Java - Security Issues',
      filename: 'Example.java',
      code: `
public class Example {
    public void test() {
        String password = "secret123";
        MessageDigest md = MessageDigest.getInstance("MD5");
        Random r = new Random();
        Runtime.getRuntime().exec(cmd);
        ObjectInputStream ois = new ObjectInputStream(fis);
        Object obj = ois.readObject();
        System.out.println("debug");
        // TODO: fix this
    }
}
`,
      expectedPatterns: ['no-runtime-exec', 'no-weak-hash', 'no-insecure-random',
                         'no-object-deserialization', 'no-system-out', 'no-todo'],
    },
    {
      name: 'Go - Security Issues',
      filename: 'main.go',
      code: `
package main
import (
    "crypto/md5"
    "os/exec"
    "math/rand"
    "fmt"
)
func main() {
    password := "secret123"
    h := md5.New()
    r := rand.Intn(100)
    cmd := exec.Command("sh", "-c", input)
    fmt.Println("debug")
    // TODO: fix
}
`,
      expectedPatterns: ['no-md5-hash', 'no-exec-command', 'no-insecure-random',
                         'no-fmt-println', 'no-todo'],
    },
    {
      name: 'C - Security Issues',
      filename: 'main.c',
      code: `
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
int main() {
    char *password = "secret123";
    char buffer[64];
    gets(buffer);
    strcpy(buffer, input);
    sprintf(buffer, "%s", input);
    system(cmd);
    printf("debug: %s\\n", data);
    scanf("%s", buffer);
    // TODO: fix
    return 0;
}
`,
      expectedPatterns: ['no-gets', 'no-strcpy', 'no-sprintf', 'no-system', 
                         'no-scanf', 'no-todo'],
    },
  ];

  // Run each test
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = [];

  for (const testCase of testCases) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`[Test] ${testCase.name}`);
    console.log(`${'─'.repeat(50)}`);

    const result = await astEngine.analyze(testCase.code, testCase.filename);
    
    console.log(`  Language: ${result.language}`);
    console.log(`  AST Supported: ${result.astSupported}`);
    console.log(`  Parse Time: ${result.parseTimeMs}ms`);
    console.log(`  Query Time: ${result.queryTimeMs}ms`);
    console.log(`  Rules Checked: ${result.rulesChecked || 'N/A'}`);
    console.log(`  Violations Found: ${result.violations.length}`);
    
    if (result.violations.length > 0) {
      console.log('\n  Violations:');
      for (const v of result.violations) {
        console.log(`    [${v.severity}] Line ${v.line}: ${v.ruleName}`);
        console.log(`      ${v.message.substring(0, 80)}...`);
        console.log(`      Snippet: ${v.snippet.substring(0, 60)}...`);
      }
    }

    // Check expected patterns
    const foundNames = result.violations.map(v => v.ruleName.toLowerCase());
    for (const expected of testCase.expectedPatterns) {
      totalTests++;
      const matched = foundNames.some(name => name.includes(expected.toLowerCase()));
      if (matched) {
        passedTests++;
        console.log(`    ✓ Found: ${expected}`);
      } else {
        failedTests.push({ test: testCase.name, pattern: expected });
        console.log(`    ✗ Missing: ${expected}`);
      }
    }
  }

  // Summary
  console.log(`\n${'═'.repeat(50)}`);
  console.log('  TEST SUMMARY');
  console.log(`${'═'.repeat(50)}`);
  console.log(`  Total Pattern Checks: ${totalTests}`);
  console.log(`  Passed: ${passedTests}`);
  console.log(`  Failed: ${failedTests.length}`);
  
  if (failedTests.length > 0) {
    console.log('\n  Failed Patterns:');
    for (const f of failedTests) {
      console.log(`    - ${f.test}: ${f.pattern}`);
    }
  }

  console.log(`\n  Pass Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
  console.log('');
  
  // Exit with appropriate code
  process.exit(failedTests.length > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

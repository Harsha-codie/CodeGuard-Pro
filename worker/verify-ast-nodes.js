/**
 * Verify AST node types for all 6 languages.
 * Run: node verify-ast-nodes.js
 */
const Parser = require('web-tree-sitter');
const path = require('path');

const gramDir = path.join(path.dirname(require.resolve('tree-sitter-wasms/package.json')), 'out');

async function verifyLanguage(name, code) {
  const parser = new Parser();
  const lang = await Parser.Language.load(path.join(gramDir, `tree-sitter-${name}.wasm`));
  parser.setLanguage(lang);
  const tree = parser.parse(code);
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${name.toUpperCase()} AST Node Types`);
  console.log(`${'='.repeat(60)}`);
  console.log(tree.rootNode.toString().substring(0, 3000));
  console.log('...\n');

  // Also test a simple query
  try {
    const q = lang.query('(call_expression function: (identifier) @fn)');
    const matches = q.matches(tree.rootNode);
    console.log(`[Test Query] Found ${matches.length} call_expression matches`);
    matches.forEach(m => {
      const node = m.captures[0].node;
      console.log(`  - ${node.text} at line ${node.startPosition.row + 1}`);
    });
    q.delete();
  } catch (e) {
    console.log(`[Test Query] call_expression query: ${e.message}`);
  }

  tree.delete();
  parser.delete();
}

(async () => {
  await Parser.init({
    locateFile(f) { return path.join(path.dirname(require.resolve('web-tree-sitter')), f); }
  });

  // JavaScript
  await verifyLanguage('javascript', `
const password = 'secret123';
eval('alert(1)');
const crypto = require('crypto');
const hash = crypto.createHash('md5');
const x = Math.random();
document.write('<h1>hi</h1>');
document.getElementById('foo').innerHTML = userInput;
var oldStyle = true;
console.log('debug');
setTimeout('doSomething()', 1000);
new Function('return 1');
const url = 'http://api.example.com/data';
try { throw new Error(); } catch(e) {}
// TODO: fix this
const r = /((a+)+)b/;
`);

  // Python
  await verifyLanguage('python', `
import pickle
import hashlib
import os
import subprocess
password = "secret123"
h = hashlib.md5(data)
pickle.loads(data)
eval(user_input)
exec(code)
os.system(cmd)
subprocess.call(cmd, shell=True)
x = random.randint(1, 100)
conn = "postgres://user:pass@host/db"
print("debug")
# TODO: fix this
try:
    risky()
except:
    pass
`);

  // Java
  await verifyLanguage('java', `
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
`);

  // Go
  await verifyLanguage('go', `
package main
import (
    "fmt"
    "crypto/md5"
    "os/exec"
    "math/rand"
    "net/http"
)
func main() {
    password := "secret123"
    h := md5.New()
    r := rand.Intn(100)
    cmd := exec.Command("sh", "-c", input)
    fmt.Println("debug")
    // TODO: fix
    http.ListenAndServe(":8080", nil)
}
`);

  // C
  await verifyLanguage('c', `
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
    printf("debug: %s", data);
    // TODO: fix
    return 0;
}
`);

  console.log('\n[Done] All languages verified!');
})();

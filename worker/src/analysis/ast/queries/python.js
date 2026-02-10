/**
 * Python AST Query Patterns
 * 
 * Tree-sitter node types for Python:
 *   call (NOT call_expression!), attribute, identifier, string,
 *   string_content, assignment, import_statement, dotted_name,
 *   argument_list, keyword_argument, try_statement, except_clause,
 *   pass_statement, block, function_definition, class_definition,
 *   comment, for_statement, while_statement, if_statement
 */
module.exports = [
  // ═══════════════════════════════════════
  // SECURITY (12 rules)
  // ═══════════════════════════════════════

  {
    id: 'py-sec-001',
    name: 'no-eval',
    category: 'security',
    severity: 'CRITICAL',
    message: 'eval() executes arbitrary code and is a security risk. Use ast.literal_eval() for safe parsing.',
    query: `(call
      function: (identifier) @target
      (#eq? @target "eval"))`,
  },
  {
    id: 'py-sec-002',
    name: 'no-exec',
    category: 'security',
    severity: 'CRITICAL',
    message: 'exec() executes arbitrary code and is a security risk.',
    query: `(call
      function: (identifier) @target
      (#eq? @target "exec"))`,
  },
  {
    id: 'py-sec-003',
    name: 'no-pickle-loads',
    category: 'security',
    severity: 'CRITICAL',
    message: 'pickle.loads() can execute arbitrary code during deserialization. Use JSON or a safe format.',
    query: `(call
      function: (attribute
        object: (identifier) @mod
        attribute: (identifier) @fn
        (#eq? @mod "pickle")
        (#match? @fn "^(loads?|Unpickler)$"))
      @target)`,
  },
  {
    id: 'py-sec-004',
    name: 'no-yaml-unsafe-load',
    category: 'security',
    severity: 'CRITICAL',
    message: 'yaml.load() without SafeLoader can execute arbitrary code. Use yaml.safe_load() instead.',
    query: `(call
      function: (attribute
        object: (identifier) @mod
        attribute: (identifier) @fn
        (#eq? @mod "yaml")
        (#match? @fn "^(load|unsafe_load)$"))
      @target)`,
  },
  {
    id: 'py-sec-005',
    name: 'no-os-system',
    category: 'security',
    severity: 'CRITICAL',
    message: 'os.system() is vulnerable to command injection. Use subprocess.run() with shell=False.',
    query: `(call
      function: (attribute
        object: (identifier) @mod
        attribute: (identifier) @fn
        (#eq? @mod "os")
        (#eq? @fn "system"))
      @target)`,
  },
  {
    id: 'py-sec-006',
    name: 'no-subprocess-shell',
    category: 'security',
    severity: 'CRITICAL',
    message: 'subprocess with shell=True is vulnerable to command injection. Use shell=False and a list of args.',
    query: `(call
      function: (attribute
        object: (identifier) @mod
        (#eq? @mod "subprocess"))
      arguments: (argument_list
        (keyword_argument
          name: (identifier) @kwarg
          value: (true)
          (#eq? @kwarg "shell")))
      @target)`,
  },
  {
    id: 'py-sec-007',
    name: 'no-hardcoded-password',
    category: 'security',
    severity: 'CRITICAL',
    message: 'Hardcoded password/secret detected. Use environment variables or a secrets manager.',
    query: `(assignment
      left: (identifier) @name
      right: (string) @target
      (#match? @name "^(password|Password|PASSWORD|secret|Secret|SECRET|api_key|API_KEY|apiKey|token|Token|TOKEN|auth|Auth|AUTH|credential|Credential|CREDENTIAL)$"))`,
  },
  {
    id: 'py-sec-008',
    name: 'no-weak-hash-md5',
    category: 'security',
    severity: 'CRITICAL',
    message: 'MD5 is a weak hash algorithm. Use hashlib.sha256() or hashlib.sha3_256() instead.',
    query: `(call
      function: (attribute
        object: (identifier) @mod
        attribute: (identifier) @fn
        (#eq? @mod "hashlib")
        (#match? @fn "^(md5|md4)$"))
      @target)`,
  },
  {
    id: 'py-sec-009',
    name: 'no-weak-hash-sha1',
    category: 'security',
    severity: 'WARNING',
    message: 'SHA-1 is deprecated. Use hashlib.sha256() or hashlib.sha3_256() instead.',
    query: `(call
      function: (attribute
        object: (identifier) @mod
        attribute: (identifier) @fn
        (#eq? @mod "hashlib")
        (#eq? @fn "sha1"))
      @target)`,
  },
  {
    id: 'py-sec-010',
    name: 'no-insecure-random',
    category: 'security',
    severity: 'WARNING',
    message: 'random module is not cryptographically secure. Use secrets module instead.',
    query: `(call
      function: (attribute
        object: (identifier) @mod
        attribute: (identifier) @fn
        (#eq? @mod "random")
        (#match? @fn "^(random|randint|choice|shuffle|uniform|randrange)$"))
      @target)`,
  },
  {
    id: 'py-sec-011',
    name: 'no-ssl-verify-false',
    category: 'security',
    severity: 'CRITICAL',
    message: 'Disabling SSL verification makes connections vulnerable to MITM attacks.',
    query: `(call
      arguments: (argument_list
        (keyword_argument
          name: (identifier) @kwarg
          value: (false) @target
          (#eq? @kwarg "verify"))))`,
  },
  {
    id: 'py-sec-012',
    name: 'no-input-function',
    category: 'security',
    severity: 'INFO',
    message: 'Be careful with input() in Python 2 - it evaluates expressions. In Python 3 it is safe, but validate the input.',
    query: `(call
      function: (identifier) @target
      (#eq? @target "input"))`,
  },

  // ═══════════════════════════════════════
  // NAMING (8 rules)
  // ═══════════════════════════════════════

  {
    id: 'py-name-001',
    name: 'class-pascal-case',
    category: 'naming',
    severity: 'INFO',
    message: 'Class names should use PascalCase (PEP 8).',
    query: `(class_definition
      name: (identifier) @target
      (#not-match? @target "^[A-Z][a-zA-Z0-9]*$"))`,
  },
  {
    id: 'py-name-002',
    name: 'function-snake-case',
    category: 'naming',
    severity: 'INFO',
    message: 'Function names should use snake_case (PEP 8).',
    query: `(function_definition
      name: (identifier) @target
      (#match? @target "[A-Z]")
      (#not-match? @target "^(setUp|tearDown|setUpClass|tearDownClass)$"))`,
  },
  {
    id: 'py-name-003',
    name: 'constant-upper-case',
    category: 'naming',
    severity: 'INFO',
    message: 'Module-level constants should use UPPER_SNAKE_CASE (PEP 8).',
    query: `(module
      (expression_statement
        (assignment
          left: (identifier) @target
          right: [(integer) (float) (string)]
          (#not-match? @target "^[A-Z_][A-Z0-9_]*$")
          (#not-match? @target "^__"))))`,
  },
  {
    id: 'py-name-004',
    name: 'no-single-letter-var',
    category: 'naming',
    severity: 'INFO',
    message: 'Avoid single-letter variable names. Use descriptive names.',
    query: `(assignment
      left: (identifier) @target
      (#match? @target "^[a-z]$")
      (#not-match? @target "^[_ij]$"))`,
  },

  // ═══════════════════════════════════════
  // STYLE (7 rules)
  // ═══════════════════════════════════════

  {
    id: 'py-style-001',
    name: 'no-print-statements',
    category: 'style',
    severity: 'INFO',
    message: 'Remove print() statements before committing. Use logging module instead.',
    query: `(call
      function: (identifier) @target
      (#eq? @target "print"))`,
  },
  {
    id: 'py-style-002',
    name: 'no-todo-comments',
    category: 'style',
    severity: 'INFO',
    message: 'TODO/FIXME comment found. Track in issue tracker instead.',
    query: `(comment) @target
      (#match? @target "(TODO|FIXME|HACK|XXX|BUG)")`,
  },
  {
    id: 'py-style-003',
    name: 'no-star-import',
    category: 'style',
    severity: 'WARNING',
    message: 'Wildcard imports (from x import *) make it hard to track where names come from.',
    query: `(import_from_statement
      (wildcard_import) @target)`,
  },
  {
    id: 'py-style-004',
    name: 'no-pass-in-except',
    category: 'style',
    severity: 'WARNING',
    message: 'Bare except with pass silently swallows all errors. Catch specific exceptions.',
    query: `(except_clause
      (block
        (pass_statement) @target))`,
  },
  {
    id: 'py-style-005',
    name: 'no-bare-except',
    category: 'style',
    severity: 'WARNING',
    message: 'Bare except catches all exceptions including SystemExit and KeyboardInterrupt. Catch specific exceptions.',
    query: `(except_clause) @target
      (#not-match? @target "except [A-Z]")`,
  },

  // ═══════════════════════════════════════
  // BEST PRACTICE (8 rules)
  // ═══════════════════════════════════════

  {
    id: 'py-bp-001',
    name: 'no-mutable-default-arg',
    category: 'best-practice',
    severity: 'WARNING',
    message: 'Mutable default arguments (list, dict, set) are shared between calls. Use None and create inside function.',
    query: `(default_parameter
      value: (list) @target)`,
  },
  {
    id: 'py-bp-002',
    name: 'no-mutable-default-dict',
    category: 'best-practice',
    severity: 'WARNING',
    message: 'Mutable default arguments (list, dict, set) are shared between calls. Use None and create inside function.',
    query: `(default_parameter
      value: (dictionary) @target)`,
  },
  {
    id: 'py-bp-003',
    name: 'no-assert-in-production',
    category: 'best-practice',
    severity: 'INFO',
    message: 'assert statements are stripped with python -O. Use proper validation for production code.',
    query: `(assert_statement) @target`,
  },
  {
    id: 'py-bp-004',
    name: 'no-global-statement',
    category: 'best-practice',
    severity: 'WARNING',
    message: 'global statements make code harder to reason about. Use function parameters or class attributes.',
    query: `(global_statement) @target`,
  },
  {
    id: 'py-bp-005',
    name: 'prefer-f-string',
    category: 'best-practice',
    severity: 'INFO',
    message: 'Consider using f-strings for string formatting (Python 3.6+).',
    query: `(call
      function: (attribute
        attribute: (identifier) @fn
        (#eq? @fn "format"))
      @target)`,
  },
  {
    id: 'py-bp-006',
    name: 'no-type-comparison',
    category: 'best-practice',
    severity: 'INFO',
    message: 'Use isinstance() instead of type() == for type checking. It handles inheritance correctly.',
    query: `(comparison_operator
      (call
        function: (identifier) @fn
        (#eq? @fn "type"))
      @target)`,
  },

  // ═══════════════════════════════════════
  // PERFORMANCE (4 rules)
  // ═══════════════════════════════════════

  {
    id: 'py-perf-001',
    name: 'no-list-comprehension-in-all-any',
    category: 'performance',
    severity: 'INFO',
    message: 'Use generator expression instead of list comprehension in all()/any() to save memory.',
    query: `(call
      function: (identifier) @fn
      arguments: (argument_list
        (list_comprehension) @target)
      (#match? @fn "^(all|any)$"))`,
  },
  {
    id: 'py-perf-002',
    name: 'no-plus-string-concat-in-loop',
    category: 'performance',
    severity: 'INFO',
    message: 'String concatenation with + in a loop is O(n^2). Use str.join() or a list.',
    query: `(for_statement
      body: (block
        (expression_statement
          (augmented_assignment
            operator: "+="
            right: (string) @target))))`,
  },
];

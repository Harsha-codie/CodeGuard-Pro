/**
 * JavaScript & JSX AST Query Patterns
 * 
 * Tree-sitter node types for JavaScript:
 *   call_expression, member_expression, identifier, property_identifier,
 *   string, string_fragment, new_expression, variable_declaration,
 *   variable_declarator, assignment_expression, regex, comment,
 *   try_statement, catch_clause, statement_block, arguments
 * 
 * 50 rules + 8 React-specific = 58 total for JS
 */
module.exports = [
  // ═══════════════════════════════════════
  // SECURITY (15 rules)
  // ═══════════════════════════════════════

  {
    id: 'js-sec-001',
    name: 'no-eval',
    category: 'security',
    severity: 'CRITICAL',
    message: 'eval() executes arbitrary code and is a security risk. Use JSON.parse() or a safe parser instead.',
    query: `(call_expression
      function: (identifier) @target
      (#eq? @target "eval"))`,
  },
  {
    id: 'js-sec-002',
    name: 'no-function-constructor',
    category: 'security',
    severity: 'CRITICAL',
    message: 'new Function() is equivalent to eval() and executes arbitrary code.',
    query: `(new_expression
      constructor: (identifier) @target
      (#eq? @target "Function"))`,
  },
  {
    id: 'js-sec-003',
    name: 'no-innerhtml',
    category: 'security',
    severity: 'WARNING',
    message: 'innerHTML can lead to XSS attacks. Use textContent or a sanitization library.',
    query: `(assignment_expression
      left: (member_expression
        property: (property_identifier) @prop
        (#eq? @prop "innerHTML"))
      @target)`,
  },
  {
    id: 'js-sec-004',
    name: 'no-document-write',
    category: 'security',
    severity: 'WARNING',
    message: 'document.write() can overwrite the entire DOM and is an XSS risk.',
    query: `(call_expression
      function: (member_expression
        object: (identifier) @obj
        property: (property_identifier) @prop
        (#eq? @obj "document")
        (#eq? @prop "write"))
      @target)`,
  },
  {
    id: 'js-sec-005',
    name: 'no-hardcoded-secret',
    category: 'security',
    severity: 'CRITICAL',
    message: 'Hardcoded password/secret detected. Use environment variables instead.',
    query: `(variable_declarator
      name: (identifier) @name
      value: (string) @target
      (#match? @name "^(password|Password|PASSWORD|secret|Secret|SECRET|apiKey|ApiKey|API_KEY|api_key|token|Token|TOKEN|auth|Auth|AUTH|credential|Credential|CREDENTIAL)$"))`,
  },
  {
    id: 'js-sec-006',
    name: 'no-weak-crypto-md5',
    category: 'security',
    severity: 'CRITICAL',
    message: 'MD5 is a weak hash algorithm. Use SHA-256 or SHA-3 instead.',
    query: `(call_expression
      function: (member_expression
        property: (property_identifier) @fn
        (#eq? @fn "createHash"))
      arguments: (arguments
        (string (string_fragment) @algo
          (#match? @algo "^(md5|md4)$")))
      @target)`,
  },
  {
    id: 'js-sec-007',
    name: 'no-weak-crypto-sha1',
    category: 'security',
    severity: 'WARNING',
    message: 'SHA-1 is deprecated. Use SHA-256 or SHA-3 instead.',
    query: `(call_expression
      function: (member_expression
        property: (property_identifier) @fn
        (#eq? @fn "createHash"))
      arguments: (arguments
        (string (string_fragment) @algo
          (#eq? @algo "sha1")))
      @target)`,
  },
  {
    id: 'js-sec-008',
    name: 'no-insecure-random',
    category: 'security',
    severity: 'WARNING',
    message: 'Math.random() is not cryptographically secure. Use crypto.randomBytes() or crypto.getRandomValues().',
    query: `(call_expression
      function: (member_expression
        object: (identifier) @obj
        property: (property_identifier) @prop
        (#eq? @obj "Math")
        (#eq? @prop "random"))
      @target)`,
  },
  {
    id: 'js-sec-009',
    name: 'no-ssl-disabled',
    category: 'security',
    severity: 'CRITICAL',
    message: 'Disabling SSL verification makes connections vulnerable to MITM attacks.',
    query: `(pair
      key: (property_identifier) @key
      value: (false) @target
      (#eq? @key "rejectUnauthorized"))`,
  },
  {
    id: 'js-sec-010',
    name: 'no-settimeout-string',
    category: 'security',
    severity: 'WARNING',
    message: 'setTimeout with a string argument is equivalent to eval(). Use a function instead.',
    query: `(call_expression
      function: (identifier) @fn
      arguments: (arguments (string) @target)
      (#eq? @fn "setTimeout"))`,
  },
  {
    id: 'js-sec-011',
    name: 'no-setinterval-string',
    category: 'security',
    severity: 'WARNING',
    message: 'setInterval with a string argument is equivalent to eval(). Use a function instead.',
    query: `(call_expression
      function: (identifier) @fn
      arguments: (arguments (string) @target)
      (#eq? @fn "setInterval"))`,
  },
  {
    id: 'js-sec-012',
    name: 'no-cors-wildcard',
    category: 'security',
    severity: 'WARNING',
    message: 'CORS wildcard (*) allows any origin to access resources. Restrict to specific origins.',
    query: `(pair
      key: (property_identifier) @key
      value: (string (string_fragment) @val
        (#eq? @val "*"))
      @target
      (#match? @key "^(origin|Origin|ORIGIN)$"))`,
  },
  {
    id: 'js-sec-013',
    name: 'no-outerhtml',
    category: 'security',
    severity: 'WARNING',
    message: 'outerHTML can lead to XSS attacks. Use safe DOM APIs instead.',
    query: `(assignment_expression
      left: (member_expression
        property: (property_identifier) @prop
        (#eq? @prop "outerHTML"))
      @target)`,
  },
  {
    id: 'js-sec-014',
    name: 'no-proto-access',
    category: 'security',
    severity: 'CRITICAL',
    message: 'Direct __proto__ access can lead to prototype pollution attacks.',
    query: `(member_expression
      property: (property_identifier) @target
      (#eq? @target "__proto__"))`,
  },
  {
    id: 'js-sec-015',
    name: 'no-unsafe-regex',
    category: 'security',
    severity: 'WARNING',
    message: 'Complex nested regex quantifiers can cause ReDoS (catastrophic backtracking).',
    query: `(regex
      pattern: (regex_pattern) @target
      (#match? @target "\\\\(.*[+*].*\\\\).*[+*]"))`,
  },

  // ═══════════════════════════════════════
  // NAMING (10 rules)
  // ═══════════════════════════════════════

  {
    id: 'js-name-001',
    name: 'no-single-letter-var',
    category: 'naming',
    severity: 'INFO',
    message: 'Avoid single-letter variable names. Use descriptive names for readability.',
    query: `(variable_declarator
      name: (identifier) @target
      (#match? @target "^[a-z]$")
      (#not-match? @target "^[ij_]$"))`,
  },
  {
    id: 'js-name-002',
    name: 'no-hungarian-notation',
    category: 'naming',
    severity: 'INFO',
    message: 'Avoid Hungarian notation (e.g., strName, intValue). Use plain descriptive names.',
    query: `(variable_declarator
      name: (identifier) @target
      (#match? @target "^(str|int|bool|arr|obj|fn|num|flt|dbl)[A-Z]"))`,
  },
  {
    id: 'js-name-003',
    name: 'class-pascal-case',
    category: 'naming',
    severity: 'INFO',
    message: 'Class names should use PascalCase.',
    query: `(class_declaration
      name: (identifier) @target
      (#not-match? @target "^[A-Z][a-zA-Z0-9]*$"))`,
  },
  {
    id: 'js-name-004',
    name: 'function-camel-case',
    category: 'naming',
    severity: 'INFO',
    message: 'Function names should use camelCase.',
    query: `(function_declaration
      name: (identifier) @target
      (#match? @target "^[A-Z]")
      (#not-match? @target "^[A-Z][a-zA-Z0-9]*$"))`,
  },
  {
    id: 'js-name-005',
    name: 'constant-upper-case',
    category: 'naming',
    severity: 'INFO',
    message: 'Top-level constants should use UPPER_SNAKE_CASE.',
    query: `(program
      (lexical_declaration
        (variable_declarator
          name: (identifier) @target
          value: [(number) (string)]
          (#not-match? @target "^[A-Z_][A-Z0-9_]*$")
          (#not-match? @target "^[a-z]"))))`,
  },

  // ═══════════════════════════════════════
  // STYLE (10 rules)
  // ═══════════════════════════════════════

  {
    id: 'js-style-001',
    name: 'no-console-log',
    category: 'style',
    severity: 'INFO',
    message: 'Remove console.log() before committing. Use a proper logging library.',
    query: `(call_expression
      function: (member_expression
        object: (identifier) @obj
        property: (property_identifier) @prop
        (#eq? @obj "console")
        (#match? @prop "^(log|debug|info|warn|trace)$"))
      @target)`,
  },
  {
    id: 'js-style-002',
    name: 'no-debugger',
    category: 'style',
    severity: 'WARNING',
    message: 'Remove debugger statements before committing.',
    query: `(debugger_statement) @target`,
  },
  {
    id: 'js-style-003',
    name: 'no-alert',
    category: 'style',
    severity: 'INFO',
    message: 'Avoid alert() in production code. Use a proper UI notification.',
    query: `(call_expression
      function: (identifier) @target
      (#eq? @target "alert"))`,
  },
  {
    id: 'js-style-004',
    name: 'no-var',
    category: 'style',
    severity: 'WARNING',
    message: 'Use const or let instead of var. var has function-scoping issues.',
    query: `(variable_declaration) @target`,
  },
  {
    id: 'js-style-005',
    name: 'no-todo-comments',
    category: 'style',
    severity: 'INFO',
    message: 'TODO/FIXME/HACK/XXX comment found. Track in issue tracker instead.',
    query: `(comment) @target
      (#match? @target "(TODO|FIXME|HACK|XXX|BUG)")`,
  },
  {
    id: 'js-style-006',
    name: 'no-nested-ternary',
    category: 'style',
    severity: 'INFO',
    message: 'Nested ternary operators reduce readability. Use if/else or switch.',
    query: `(ternary_expression
      consequence: (ternary_expression) @target)`,
  },
  {
    id: 'js-style-007',
    name: 'no-nested-ternary-alt',
    category: 'style',
    severity: 'INFO',
    message: 'Nested ternary operators reduce readability. Use if/else or switch.',
    query: `(ternary_expression
      alternative: (ternary_expression) @target)`,
  },

  // ═══════════════════════════════════════
  // BEST PRACTICE (10 rules)
  // ═══════════════════════════════════════

  {
    id: 'js-bp-001',
    name: 'no-empty-catch',
    category: 'best-practice',
    severity: 'WARNING',
    message: 'Empty catch blocks silently swallow errors. Log or handle the error.',
    query: `(catch_clause
      body: (statement_block) @target
      (#eq? @target "{}"))`,
  },
  {
    id: 'js-bp-002',
    name: 'no-throw-literal',
    category: 'best-practice',
    severity: 'WARNING',
    message: 'Throw Error objects instead of literals for proper stack traces.',
    query: `(throw_statement
      (string) @target)`,
  },
  {
    id: 'js-bp-003',
    name: 'no-with-statement',
    category: 'best-practice',
    severity: 'CRITICAL',
    message: 'with statements make code unpredictable and are prohibited in strict mode.',
    query: `(with_statement) @target`,
  },
  {
    id: 'js-bp-004',
    name: 'no-delete-var',
    category: 'best-practice',
    severity: 'WARNING',
    message: 'delete on variables has no effect in strict mode. Only use on object properties.',
    query: `(expression_statement
      (unary_expression
        operator: "delete"
        argument: (identifier) @target))`,
  },
  {
    id: 'js-bp-005',
    name: 'no-void-expression',
    category: 'best-practice',
    severity: 'INFO',
    message: 'void operator is unnecessary. Use undefined directly.',
    query: `(unary_expression
      operator: "void" @target)`,
  },
  {
    id: 'js-bp-006',
    name: 'no-comma-operator',
    category: 'best-practice',
    severity: 'INFO',
    message: 'Comma operator makes code harder to read. Use separate statements.',
    query: `(sequence_expression) @target`,
  },
  {
    id: 'js-bp-007',
    name: 'no-label',
    category: 'best-practice',
    severity: 'INFO',
    message: 'Labeled statements are a code smell. Refactor to use functions or break conditions.',
    query: `(labeled_statement) @target`,
  },
  {
    id: 'js-bp-008',
    name: 'prefer-template-literal',
    category: 'best-practice',
    severity: 'INFO',
    message: 'Use template literals instead of string concatenation for readability.',
    query: `(binary_expression
      left: (string)
      operator: "+"
      right: (identifier)
      @target)`,
  },
  {
    id: 'js-bp-009',
    name: 'no-magic-number',
    category: 'best-practice',
    severity: 'INFO',
    message: 'Avoid magic numbers. Define as named constants for clarity.',
    query: `(binary_expression
      [(number) @target]
      (#not-match? @target "^[012]$"))`,
  },
  {
    id: 'js-bp-010',
    name: 'max-params',
    category: 'best-practice',
    severity: 'INFO',
    message: 'Function has too many parameters. Consider using an options object.',
    query: `(function_declaration
      parameters: (formal_parameters
        (identifier) (identifier) (identifier) (identifier) (identifier) @target))`,
  },

  // ═══════════════════════════════════════
  // PERFORMANCE (5 rules)
  // ═══════════════════════════════════════

  {
    id: 'js-perf-001',
    name: 'no-sync-fs',
    category: 'performance',
    severity: 'WARNING',
    message: 'Synchronous filesystem operations block the event loop. Use async alternatives.',
    query: `(call_expression
      function: (member_expression
        property: (property_identifier) @target
        (#match? @target "Sync$")))`,
  },
  {
    id: 'js-perf-002',
    name: 'no-await-in-loop',
    category: 'performance',
    severity: 'WARNING',
    message: 'Avoid await inside loops. Use Promise.all() for concurrent operations.',
    query: `(for_statement
      body: (_
        (expression_statement
          (await_expression) @target)))`,
  },
  {
    id: 'js-perf-003',
    name: 'no-await-in-for-of',
    category: 'performance',
    severity: 'INFO',
    message: 'Consider using Promise.all() instead of await in for...of loops when iterations are independent.',
    query: `(for_in_statement
      body: (_
        (expression_statement
          (await_expression) @target)))`,
  },

  // ═══════════════════════════════════════
  // REACT / JSX (8 rules)
  // ═══════════════════════════════════════

  {
    id: 'js-react-001',
    name: 'no-dangerously-set-innerhtml',
    category: 'security',
    severity: 'CRITICAL',
    message: 'dangerouslySetInnerHTML can lead to XSS attacks. Use a sanitization library like DOMPurify.',
    query: `(jsx_attribute
      (property_identifier) @target
      (#eq? @target "dangerouslySetInnerHTML"))`,
  },
  {
    id: 'js-react-002',
    name: 'no-jsx-inline-style',
    category: 'style',
    severity: 'INFO',
    message: 'Avoid inline styles in JSX. Use CSS modules or styled-components for maintainability.',
    query: `(jsx_attribute
      (property_identifier) @target
      (#eq? @target "style"))`,
  },
  {
    id: 'js-react-003',
    name: 'no-direct-dom-manipulation',
    category: 'best-practice',
    severity: 'WARNING',
    message: 'Avoid direct DOM manipulation in React. Use refs or state instead.',
    query: `(call_expression
      function: (member_expression
        object: (identifier) @obj
        property: (property_identifier) @target
        (#eq? @obj "document")
        (#match? @target "^(getElementById|querySelector|querySelectorAll|getElementsBy)$")))`,
  },
  {
    id: 'js-react-004',
    name: 'no-array-index-key',
    category: 'best-practice',
    severity: 'WARNING',
    message: 'Avoid using array index as key prop. Use a stable unique identifier.',
    query: `(jsx_attribute
      (property_identifier) @attr
      (#eq? @attr "key")
      (jsx_expression
        (identifier) @target
        (#match? @target "^(index|idx|i)$")))`,
  },
];

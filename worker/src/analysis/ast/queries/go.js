/**
 * Go AST Query Patterns
 * 
 * Tree-sitter node types for Go:
 *   call_expression, selector_expression, field_identifier, identifier,
 *   interpreted_string_literal, short_var_declaration, expression_list,
 *   function_declaration, method_declaration, parameter_list,
 *   source_file, package_clause, import_declaration, import_spec,
 *   for_statement, if_statement, block, comment
 */
module.exports = [
  // ═══════════════════════════════════════
  // SECURITY (10 rules)
  // ═══════════════════════════════════════

  {
    id: 'go-sec-001',
    name: 'no-exec-command',
    category: 'security',
    severity: 'CRITICAL',
    message: 'exec.Command() with user input is vulnerable to command injection. Validate and sanitize inputs.',
    query: `(call_expression
      function: (selector_expression
        operand: (identifier) @pkg
        field: (field_identifier) @fn
        (#eq? @pkg "exec")
        (#eq? @fn "Command"))
      @target)`,
  },
  {
    id: 'go-sec-002',
    name: 'no-md5-hash',
    category: 'security',
    severity: 'CRITICAL',
    message: 'MD5 is a weak hash. Use crypto/sha256 instead.',
    query: `(call_expression
      function: (selector_expression
        operand: (identifier) @pkg
        field: (field_identifier) @fn
        (#eq? @pkg "md5")
        (#match? @fn "^(New|Sum)$"))
      @target)`,
  },
  {
    id: 'go-sec-003',
    name: 'no-sha1-hash',
    category: 'security',
    severity: 'WARNING',
    message: 'SHA-1 is deprecated. Use crypto/sha256 instead.',
    query: `(call_expression
      function: (selector_expression
        operand: (identifier) @pkg
        field: (field_identifier) @fn
        (#eq? @pkg "sha1")
        (#match? @fn "^(New|Sum)$"))
      @target)`,
  },
  {
    id: 'go-sec-004',
    name: 'no-insecure-random',
    category: 'security',
    severity: 'WARNING',
    message: 'math/rand is not cryptographically secure. Use crypto/rand instead.',
    query: `(call_expression
      function: (selector_expression
        operand: (identifier) @pkg
        field: (field_identifier) @fn
        (#eq? @pkg "rand")
        (#match? @fn "^(Intn|Int63|Float64|Int31|Seed)$"))
      @target)`,
  },
  {
    id: 'go-sec-005',
    name: 'no-tls-skip-verify',
    category: 'security',
    severity: 'CRITICAL',
    message: 'InsecureSkipVerify disables TLS certificate validation. Remove it for production.',
    query: `(keyed_element
      (field_identifier) @key
      (true) @target
      (#eq? @key "InsecureSkipVerify"))`,
  },
  {
    id: 'go-sec-006',
    name: 'no-hardcoded-secret',
    category: 'security',
    severity: 'CRITICAL',
    message: 'Hardcoded secret detected. Use environment variables or a secrets manager.',
    query: `(short_var_declaration
      left: (expression_list
        (identifier) @name
        (#match? @name "^(password|Password|PASSWORD|secret|Secret|SECRET|apiKey|API_KEY|token|Token|TOKEN|credential|Credential|CREDENTIAL)$"))
      right: (expression_list
        (interpreted_string_literal) @target))`,
  },
  {
    id: 'go-sec-007',
    name: 'no-sql-string-concat',
    category: 'security',
    severity: 'CRITICAL',
    message: 'SQL query built with concatenation is vulnerable to injection. Use parameterized queries.',
    query: `(call_expression
      function: (selector_expression
        field: (field_identifier) @fn
        (#match? @fn "^(Query|Exec|QueryRow)$"))
      arguments: (argument_list
        (binary_expression
          operator: "+"
          (interpreted_string_literal) @target
          (#match? @target "(SELECT|INSERT|UPDATE|DELETE|select|insert|update|delete)")))
      @target)`,
  },
  {
    id: 'go-sec-008',
    name: 'no-http-listenandserve',
    category: 'security',
    severity: 'WARNING',
    message: 'http.ListenAndServe serves over plain HTTP. Use ListenAndServeTLS for production.',
    query: `(call_expression
      function: (selector_expression
        operand: (identifier) @pkg
        field: (field_identifier) @fn
        (#eq? @pkg "http")
        (#eq? @fn "ListenAndServe"))
      @target)`,
  },

  // ═══════════════════════════════════════
  // NAMING (8 rules)
  // ═══════════════════════════════════════

  {
    id: 'go-name-001',
    name: 'exported-func-pascal-case',
    category: 'naming',
    severity: 'INFO',
    message: 'Exported functions must start with uppercase in Go.',
    query: `(function_declaration
      name: (identifier) @target
      (#match? @target "^[a-z].*[A-Z]"))`,
  },
  {
    id: 'go-name-002',
    name: 'no-underscore-name',
    category: 'naming',
    severity: 'INFO',
    message: 'Go conventions prefer camelCase/PascalCase, not snake_case.',
    query: `(function_declaration
      name: (identifier) @target
      (#match? @target "_[a-z]"))`,
  },

  // ═══════════════════════════════════════
  // STYLE (5 rules)
  // ═══════════════════════════════════════

  {
    id: 'go-style-001',
    name: 'no-fmt-println',
    category: 'style',
    severity: 'INFO',
    message: 'Use a structured logging library instead of fmt.Println() in production.',
    query: `(call_expression
      function: (selector_expression
        operand: (identifier) @pkg
        field: (field_identifier) @fn
        (#eq? @pkg "fmt")
        (#match? @fn "^(Print|Println|Printf)$"))
      @target)`,
  },
  {
    id: 'go-style-002',
    name: 'no-todo-comments',
    category: 'style',
    severity: 'INFO',
    message: 'TODO/FIXME comment found. Track in issue tracker.',
    query: `(comment) @target
      (#match? @target "(TODO|FIXME|HACK|XXX|BUG)")`,
  },
  {
    id: 'go-style-003',
    name: 'no-panic',
    category: 'style',
    severity: 'WARNING',
    message: 'Avoid panic() in library/production code. Return errors instead.',
    query: `(call_expression
      function: (identifier) @target
      (#eq? @target "panic"))`,
  },

  // ═══════════════════════════════════════
  // BEST PRACTICE (6 rules)
  // ═══════════════════════════════════════

  {
    id: 'go-bp-001',
    name: 'no-error-ignored',
    category: 'best-practice',
    severity: 'WARNING',
    message: 'Error return value is ignored (assigned to _). Handle or explicitly document why it is safe to ignore.',
    query: `(short_var_declaration
      left: (expression_list
        (identifier)
        (identifier) @target
        (#eq? @target "_")))`,
  },
  {
    id: 'go-bp-002',
    name: 'no-init-in-declaration',
    category: 'best-practice',
    severity: 'INFO',
    message: 'Use short variable declarations (:=) inside functions instead of var.',
    query: `(function_declaration
      body: (block
        (var_declaration) @target))`,
  },
  {
    id: 'go-bp-003',
    name: 'no-naked-return',
    category: 'best-practice',
    severity: 'INFO',
    message: 'Naked returns (return without values) can reduce readability in long functions.',
    query: `(return_statement) @target
      (#eq? @target "return")`,
  },
  {
    id: 'go-bp-004',
    name: 'defer-in-loop',
    category: 'best-practice',
    severity: 'WARNING',
    message: 'defer inside a loop will not execute until function returns, potentially leaking resources.',
    query: `(for_statement
      body: (block
        (defer_statement) @target))`,
  },

  // ═══════════════════════════════════════
  // PERFORMANCE (3 rules)
  // ═══════════════════════════════════════

  {
    id: 'go-perf-001',
    name: 'prefer-make-slice-cap',
    category: 'performance',
    severity: 'INFO',
    message: 'Specify capacity in make([]T, 0, cap) to avoid frequent re-allocation.',
    query: `(call_expression
      function: (identifier) @fn
      arguments: (argument_list
        (slice_type)
        (int_literal) @target)
      (#eq? @fn "make"))`,
  },
];

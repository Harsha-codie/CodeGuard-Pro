/**
 * C AST Query Patterns
 * 
 * Tree-sitter node types for C:
 *   call_expression, identifier, string_literal, string_content,
 *   function_definition, function_declarator, parameter_list,
 *   declaration, init_declarator, pointer_declarator, number_literal,
 *   preproc_include, system_lib_string, compound_statement,
 *   expression_statement, return_statement, comment, primitive_type,
 *   array_declarator, argument_list, binary_expression
 */
module.exports = [
  // ═══════════════════════════════════════
  // SECURITY (8 rules)
  // ═══════════════════════════════════════

  {
    id: 'c-sec-001',
    name: 'no-gets',
    category: 'security',
    severity: 'CRITICAL',
    message: 'gets() has no bounds checking and is removed in C11. Use fgets() instead.',
    query: `(call_expression
      function: (identifier) @target
      (#eq? @target "gets"))`,
  },
  {
    id: 'c-sec-002',
    name: 'no-strcpy',
    category: 'security',
    severity: 'CRITICAL',
    message: 'strcpy() has no bounds checking. Use strncpy() or strlcpy() instead.',
    query: `(call_expression
      function: (identifier) @target
      (#eq? @target "strcpy"))`,
  },
  {
    id: 'c-sec-003',
    name: 'no-strcat',
    category: 'security',
    severity: 'CRITICAL',
    message: 'strcat() has no bounds checking. Use strncat() or strlcat() instead.',
    query: `(call_expression
      function: (identifier) @target
      (#eq? @target "strcat"))`,
  },
  {
    id: 'c-sec-004',
    name: 'no-sprintf',
    category: 'security',
    severity: 'CRITICAL',
    message: 'sprintf() has no bounds checking. Use snprintf() instead.',
    query: `(call_expression
      function: (identifier) @target
      (#eq? @target "sprintf"))`,
  },
  {
    id: 'c-sec-005',
    name: 'no-system',
    category: 'security',
    severity: 'CRITICAL',
    message: 'system() is vulnerable to command injection. Use exec*() family with separate arguments.',
    query: `(call_expression
      function: (identifier) @target
      (#eq? @target "system"))`,
  },
  {
    id: 'c-sec-006',
    name: 'no-scanf-unbounded',
    category: 'security',
    severity: 'WARNING',
    message: 'scanf with %s has no bounds checking. Use %Ns with a size limit or fgets().',
    query: `(call_expression
      function: (identifier) @fn
      arguments: (argument_list
        (string_literal (string_content) @target
          (#match? @target "%s")))
      (#eq? @fn "scanf"))`,
  },
  {
    id: 'c-sec-007',
    name: 'no-hardcoded-password',
    category: 'security',
    severity: 'CRITICAL',
    message: 'Hardcoded password/secret detected. Use environment variables or config files.',
    query: `(init_declarator
      declarator: [(identifier) (pointer_declarator declarator: (identifier))] @name
      value: (string_literal) @target
      (#match? @name "^(password|Password|PASSWORD|secret|Secret|SECRET|api_key|API_KEY|token|Token|TOKEN|credential|Credential|CREDENTIAL)$"))`,
  },
  {
    id: 'c-sec-008',
    name: 'no-atoi',
    category: 'security',
    severity: 'WARNING',
    message: 'atoi() has no error handling. Use strtol() which reports conversion errors.',
    query: `(call_expression
      function: (identifier) @target
      (#eq? @target "atoi"))`,
  },

  // ═══════════════════════════════════════
  // NAMING (6 rules)
  // ═══════════════════════════════════════

  {
    id: 'c-name-001',
    name: 'function-snake-case',
    category: 'naming',
    severity: 'INFO',
    message: 'C function names conventionally use snake_case.',
    query: `(function_definition
      declarator: (function_declarator
        declarator: (identifier) @target
        (#match? @target "[A-Z]")
        (#not-match? @target "^(SDL_|GL_|WM_|MSG_)")))`,
  },
  {
    id: 'c-name-002',
    name: 'macro-upper-case',
    category: 'naming',
    severity: 'INFO',
    message: 'Preprocessor macros should use UPPER_SNAKE_CASE.',
    query: `(preproc_def
      name: (identifier) @target
      (#not-match? @target "^[A-Z_][A-Z0-9_]*$"))`,
  },
  {
    id: 'c-name-003',
    name: 'no-single-letter-var',
    category: 'naming',
    severity: 'INFO',
    message: 'Avoid single-letter variable names outside loops. Use descriptive names.',
    query: `(declaration
      declarator: (init_declarator
        declarator: (identifier) @target
        (#match? @target "^[a-z]$")
        (#not-match? @target "^[ij_]$")))`,
  },

  // ═══════════════════════════════════════
  // STYLE (3 rules)
  // ═══════════════════════════════════════

  {
    id: 'c-style-001',
    name: 'no-printf-debug',
    category: 'style',
    severity: 'INFO',
    message: 'Remove debug printf() statements before committing.',
    query: `(call_expression
      function: (identifier) @fn
      arguments: (argument_list
        (string_literal (string_content) @target
          (#match? @target "(debug|Debug|DEBUG|trace|Trace|TRACE|test|Test|TEST)")))
      (#eq? @fn "printf"))`,
  },
  {
    id: 'c-style-002',
    name: 'no-todo-comments',
    category: 'style',
    severity: 'INFO',
    message: 'TODO/FIXME comment found. Track in issue tracker.',
    query: `(comment) @target
      (#match? @target "(TODO|FIXME|HACK|XXX|BUG)")`,
  },

  // ═══════════════════════════════════════
  // BEST PRACTICE (4 rules)
  // ═══════════════════════════════════════

  {
    id: 'c-bp-001',
    name: 'no-malloc-without-sizeof',
    category: 'best-practice',
    severity: 'WARNING',
    message: 'malloc() without sizeof() may allocate wrong amount. Use malloc(n * sizeof(type)).',
    query: `(call_expression
      function: (identifier) @fn
      arguments: (argument_list
        (number_literal) @target)
      (#eq? @fn "malloc"))`,
  },
  {
    id: 'c-bp-002',
    name: 'no-goto',
    category: 'best-practice',
    severity: 'WARNING',
    message: 'goto makes control flow hard to follow. Use structured loops and functions.',
    query: `(goto_statement) @target`,
  },
  {
    id: 'c-bp-003',
    name: 'no-magic-number',
    category: 'best-practice',
    severity: 'INFO',
    message: 'Avoid magic numbers. Define as named constants (#define or const).',
    query: `(binary_expression
      [(number_literal) @target]
      (#not-match? @target "^[012]$"))`,
  },

  // ═══════════════════════════════════════
  // PERFORMANCE (2 rules)
  // ═══════════════════════════════════════

  {
    id: 'c-perf-001',
    name: 'no-strlen-in-loop',
    category: 'performance',
    severity: 'WARNING',
    message: 'strlen() in loop condition is O(n) per iteration, making the loop O(n^2). Cache the length.',
    query: `(for_statement
      condition: (_
        (call_expression
          function: (identifier) @target
          (#eq? @target "strlen"))))`,
  },
];

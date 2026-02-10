/**
 * Java AST Query Patterns
 * 
 * Tree-sitter node types for Java:
 *   method_invocation, object_creation_expression, type_identifier,
 *   identifier, string_literal, string_fragment, class_declaration,
 *   method_declaration, field_declaration, local_variable_declaration,
 *   variable_declarator, formal_parameters, argument_list,
 *   try_statement, catch_clause, block, line_comment, block_comment,
 *   modifiers, field_access
 */
module.exports = [
  // ═══════════════════════════════════════
  // SECURITY (12 rules)
  // ═══════════════════════════════════════

  {
    id: 'java-sec-001',
    name: 'no-runtime-exec',
    category: 'security',
    severity: 'CRITICAL',
    message: 'Runtime.exec() is vulnerable to command injection. Use ProcessBuilder with argument lists.',
    query: `(method_invocation
      name: (identifier) @target
      (#eq? @target "exec"))`,
  },
  {
    id: 'java-sec-002',
    name: 'no-weak-hash-md5',
    category: 'security',
    severity: 'CRITICAL',
    message: 'MD5 is a weak hash. Use MessageDigest.getInstance("SHA-256") instead.',
    query: `(method_invocation
      name: (identifier) @fn
      arguments: (argument_list
        (string_literal (string_fragment) @target
          (#match? @target "^(MD5|MD4)$")))
      (#eq? @fn "getInstance"))`,
  },
  {
    id: 'java-sec-003',
    name: 'no-weak-hash-sha1',
    category: 'security',
    severity: 'WARNING',
    message: 'SHA-1 is deprecated. Use MessageDigest.getInstance("SHA-256") instead.',
    query: `(method_invocation
      name: (identifier) @fn
      arguments: (argument_list
        (string_literal (string_fragment) @target
          (#eq? @target "SHA-1")))
      (#eq? @fn "getInstance"))`,
  },
  {
    id: 'java-sec-004',
    name: 'no-insecure-random',
    category: 'security',
    severity: 'WARNING',
    message: 'java.util.Random is not cryptographically secure. Use java.security.SecureRandom instead.',
    query: `(object_creation_expression
      type: (type_identifier) @target
      (#eq? @target "Random"))`,
  },
  {
    id: 'java-sec-005',
    name: 'no-object-deserialization',
    category: 'security',
    severity: 'CRITICAL',
    message: 'ObjectInputStream.readObject() can execute arbitrary code during deserialization. Use safe alternatives.',
    query: `(method_invocation
      name: (identifier) @target
      (#eq? @target "readObject"))`,
  },
  {
    id: 'java-sec-006',
    name: 'no-hardcoded-password',
    category: 'security',
    severity: 'CRITICAL',
    message: 'Hardcoded password/secret detected. Use environment variables or a secrets manager.',
    query: `(variable_declarator
      name: (identifier) @name
      value: (string_literal) @target
      (#match? @name "^(password|Password|PASSWORD|secret|Secret|SECRET|apiKey|API_KEY|token|Token|TOKEN|credential|Credential|CREDENTIAL)$"))`,
  },
  {
    id: 'java-sec-007',
    name: 'no-trust-all-certs',
    category: 'security',
    severity: 'CRITICAL',
    message: 'Disabling SSL/TLS verification makes connections vulnerable to MITM attacks.',
    query: `(object_creation_expression
      type: (type_identifier) @target
      (#match? @target "^(TrustAllCerts|TrustAll|AllowAllHostnames|ALLOW_ALL_HOSTNAME_VERIFIER|NullTrustManager)$"))`,
  },
  {
    id: 'java-sec-008',
    name: 'no-des-cipher',
    category: 'security',
    severity: 'CRITICAL',
    message: 'DES/3DES are weak ciphers. Use AES-256 instead.',
    query: `(method_invocation
      name: (identifier) @fn
      arguments: (argument_list
        (string_literal (string_fragment) @target
          (#match? @target "^(DES|DESede|RC4|RC2|Blowfish)$")))
      (#eq? @fn "getInstance"))`,
  },
  {
    id: 'java-sec-009',
    name: 'no-sql-string-concat',
    category: 'security',
    severity: 'CRITICAL',
    message: 'SQL query built with string concatenation is vulnerable to SQL injection. Use PreparedStatement.',
    query: `(binary_expression
      left: (string_literal
        (string_fragment) @target
        (#match? @target "(SELECT|INSERT|UPDATE|DELETE|DROP|select|insert|update|delete|drop)"))
      operator: "+")`,
  },
  {
    id: 'java-sec-010',
    name: 'no-xpath-injection',
    category: 'security',
    severity: 'CRITICAL',
    message: 'XPath expression built with concatenation is vulnerable to injection.',
    query: `(method_invocation
      name: (identifier) @fn
      arguments: (argument_list
        (binary_expression
          left: (string_literal) @target
          operator: "+"))
      (#eq? @fn "compile"))`,
  },

  // ═══════════════════════════════════════
  // NAMING (8 rules)
  // ═══════════════════════════════════════

  {
    id: 'java-name-001',
    name: 'class-pascal-case',
    category: 'naming',
    severity: 'INFO',
    message: 'Class names should use PascalCase.',
    query: `(class_declaration
      name: (identifier) @target
      (#not-match? @target "^[A-Z][a-zA-Z0-9]*$"))`,
  },
  {
    id: 'java-name-002',
    name: 'interface-pascal-case',
    category: 'naming',
    severity: 'INFO',
    message: 'Interface names should use PascalCase.',
    query: `(interface_declaration
      name: (identifier) @target
      (#not-match? @target "^[A-Z][a-zA-Z0-9]*$"))`,
  },
  {
    id: 'java-name-003',
    name: 'method-camel-case',
    category: 'naming',
    severity: 'INFO',
    message: 'Method names should use camelCase.',
    query: `(method_declaration
      name: (identifier) @target
      (#match? @target "^[A-Z]")
      (#not-match? @target "^[A-Z][a-zA-Z0-9]*$"))`,
  },
  {
    id: 'java-name-004',
    name: 'constant-upper-case',
    category: 'naming',
    severity: 'INFO',
    message: 'static final fields should use UPPER_SNAKE_CASE.',
    query: `(field_declaration
      (modifiers "static" "final")
      declarator: (variable_declarator
        name: (identifier) @target
        (#not-match? @target "^[A-Z_][A-Z0-9_]*$")))`,
  },

  // ═══════════════════════════════════════
  // STYLE (6 rules)
  // ═══════════════════════════════════════

  {
    id: 'java-style-001',
    name: 'no-system-out',
    category: 'style',
    severity: 'INFO',
    message: 'Use a logging framework (SLF4J/Log4j) instead of System.out.println().',
    query: `(method_invocation
      object: (field_access
        object: (identifier) @obj
        field: (identifier) @target
        (#eq? @obj "System")
        (#match? @target "^(out|err)$")))`,
  },
  {
    id: 'java-style-002',
    name: 'no-todo-comments',
    category: 'style',
    severity: 'INFO',
    message: 'TODO/FIXME comment found. Track in issue tracker instead.',
    query: `(line_comment) @target
      (#match? @target "(TODO|FIXME|HACK|XXX|BUG)")`,
  },
  {
    id: 'java-style-003',
    name: 'no-star-import',
    category: 'style',
    severity: 'INFO',
    message: 'Wildcard imports make it hard to track dependencies. Import specific classes.',
    query: `(import_declaration) @target
      (#match? @target "\\\\*")`,
  },

  // ═══════════════════════════════════════
  // BEST PRACTICE (7 rules)
  // ═══════════════════════════════════════

  {
    id: 'java-bp-001',
    name: 'no-empty-catch',
    category: 'best-practice',
    severity: 'WARNING',
    message: 'Empty catch blocks silently swallow errors. Log the exception at minimum.',
    query: `(catch_clause
      body: (block) @target
      (#eq? @target "{}"))`,
  },
  {
    id: 'java-bp-002',
    name: 'no-catch-throwable',
    category: 'best-practice',
    severity: 'WARNING',
    message: 'Catching Throwable/Exception is too broad. Catch specific exceptions.',
    query: `(catch_clause
      (catch_formal_parameter
        (catch_type
          (type_identifier) @target
          (#match? @target "^(Throwable|Exception|Error)$"))))`,
  },
  {
    id: 'java-bp-003',
    name: 'no-thread-sleep',
    category: 'best-practice',
    severity: 'INFO',
    message: 'Thread.sleep() can hide concurrency issues. Consider using ScheduledExecutorService.',
    query: `(method_invocation
      object: (identifier) @obj
      name: (identifier) @target
      (#eq? @obj "Thread")
      (#eq? @target "sleep"))`,
  },
  {
    id: 'java-bp-004',
    name: 'no-finalize',
    category: 'best-practice',
    severity: 'WARNING',
    message: 'finalize() is deprecated since Java 9. Use try-with-resources or Cleaner.',
    query: `(method_declaration
      name: (identifier) @target
      (#eq? @target "finalize"))`,
  },
  {
    id: 'java-bp-005',
    name: 'prefer-string-equals',
    category: 'best-practice',
    severity: 'WARNING',
    message: 'Use .equals() instead of == for String comparison. == compares references, not values.',
    query: `(binary_expression
      left: [(identifier) (string_literal)]
      operator: "=="
      right: (string_literal) @target)`,
  },

  // ═══════════════════════════════════════
  // PERFORMANCE (4 rules)
  // ═══════════════════════════════════════

  {
    id: 'java-perf-001',
    name: 'no-string-concat-in-loop',
    category: 'performance',
    severity: 'WARNING',
    message: 'String concatenation in a loop is O(n^2). Use StringBuilder instead.',
    query: `(for_statement
      body: (_
        (expression_statement
          (assignment_expression
            right: (binary_expression
              operator: "+"
              [(identifier) (string_literal)] @target)))))`,
  },
  {
    id: 'java-perf-002',
    name: 'prefer-arraylist-size',
    category: 'performance',
    severity: 'INFO',
    message: 'Consider specifying initial ArrayList capacity to avoid frequent resizing.',
    query: `(object_creation_expression
      type: (type_identifier) @target
      arguments: (argument_list)
      (#eq? @target "ArrayList"))`,
  },
];

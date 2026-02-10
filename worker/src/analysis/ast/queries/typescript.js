/**
 * TypeScript & TSX AST Query Patterns
 * 
 * TypeScript shares most node types with JavaScript but adds:
 *   type_annotation, interface_declaration, enum_declaration,
 *   type_identifier, accessibility_modifier, predefined_type,
 *   type_alias_declaration, as_expression
 * 
 * Most JS queries also work in TS. These are TS-specific additions.
 * The query registry merges JS queries with these TS-specific ones.
 */
module.exports = [
  // ═══════════════════════════════════════
  // SECURITY (inherits all JS security rules + TS-specific)
  // ═══════════════════════════════════════

  {
    id: 'ts-sec-001',
    name: 'no-any-type',
    category: 'security',
    severity: 'WARNING',
    message: 'Avoid using "any" type. It bypasses TypeScript type checking and can hide bugs.',
    query: `(type_annotation
      (predefined_type) @target
      (#eq? @target "any"))`,
  },
  {
    id: 'ts-sec-002',
    name: 'no-ts-ignore',
    category: 'security',
    severity: 'WARNING',
    message: 'Avoid @ts-ignore. Fix the type error instead of suppressing it.',
    query: `(comment) @target
      (#match? @target "@ts-ignore")`,
  },
  {
    id: 'ts-sec-003',
    name: 'no-non-null-assertion',
    category: 'security',
    severity: 'INFO',
    message: 'Non-null assertion (!) can cause runtime errors. Use proper null checks.',
    query: `(non_null_expression) @target`,
  },

  // ═══════════════════════════════════════
  // NAMING (TS-specific)
  // ═══════════════════════════════════════

  {
    id: 'ts-name-001',
    name: 'interface-pascal-case',
    category: 'naming',
    severity: 'INFO',
    message: 'Interface names should use PascalCase.',
    query: `(interface_declaration
      name: (type_identifier) @target
      (#not-match? @target "^[A-Z][a-zA-Z0-9]*$"))`,
  },
  {
    id: 'ts-name-002',
    name: 'enum-pascal-case',
    category: 'naming',
    severity: 'INFO',
    message: 'Enum names should use PascalCase.',
    query: `(enum_declaration
      name: (identifier) @target
      (#not-match? @target "^[A-Z][a-zA-Z0-9]*$"))`,
  },
  {
    id: 'ts-name-003',
    name: 'type-alias-pascal-case',
    category: 'naming',
    severity: 'INFO',
    message: 'Type alias names should use PascalCase.',
    query: `(type_alias_declaration
      name: (type_identifier) @target
      (#not-match? @target "^[A-Z][a-zA-Z0-9]*$"))`,
  },

  // ═══════════════════════════════════════
  // BEST PRACTICE (TS-specific)
  // ═══════════════════════════════════════

  {
    id: 'ts-bp-001',
    name: 'no-empty-interface',
    category: 'best-practice',
    severity: 'INFO',
    message: 'Empty interfaces are unnecessary. Use a type alias or remove it.',
    query: `(interface_declaration
      body: (interface_body) @target
      (#eq? @target "{}"))`,
  },
  {
    id: 'ts-bp-002',
    name: 'prefer-readonly',
    category: 'best-practice',
    severity: 'INFO',
    message: 'Consider marking this property as readonly if it should not be reassigned.',
    query: `(public_field_definition
      (accessibility_modifier) @mod
      (#eq? @mod "public")
      name: (property_identifier) @target)`,
  },
];

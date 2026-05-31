import Parser from 'web-tree-sitter';
import { LanguageParser, ParserResult, StringAssignment } from './types';

/**
 * Tree-sitter query for JavaScript/TypeScript string literal assignments.
 *
 * Matches patterns like:
 *   const apiKey = "sk-xxxx"
 *   let OPENAI_API_KEY = 'sk-xxxx'
 *   var token = "abc123"
 *   apiKey = "sk-xxxx"          (reassignment)
 *
 * Tree-sitter node types:
 *   - program: the root node
 *   - lexical_declaration: const/let declaration
 *   - variable_declaration: var declaration
 *   - variable_declarator: name = value pair
 *   - assignment_expression: x = value
 *   - identifier: a variable name
 *   - string: a string literal (includes quotes in source)
 */
const JS_QUERY = `
(program
  (lexical_declaration
    (variable_declarator
      name: (identifier) @variable-name
      value: (string) @string-value)))

(program
  (variable_declaration
    (variable_declarator
      name: (identifier) @variable-name
      value: (string) @string-value)))

(program
  (expression_statement
    (assignment_expression
      left: (identifier) @variable-name
      right: (string) @string-value)))
`;

/**
 * JavaScript/TypeScript language parser using tree-sitter.
 *
 * Extracts all `const/let/var x = "string literal"` and `x = "string literal"`
 * assignments from JS/TS source code.
 */
export class JsParser implements LanguageParser {
  readonly languageId = 'javascript';
  private query: Parser.Query | null = null;

  async parse(_source: string, _oldTree?: Parser.Tree | null): Promise<ParserResult> {
    return {
      assignments: [],
      astMode: false,
      errors: ['JsParser.parse() should not be called directly — use extractAssignments() with a pre-parsed tree'],
    };
  }

  /**
   * 编译 tree-sitter 查询（惰性，缓存）。
   * 必须在 extractAssignments 之前调用。
   */
  compileQuery(language: Parser.Language): void {
    if (!this.query) {
      this.query = language.query(JS_QUERY);
      console.log('[Envify] JsParser: tree-sitter query 已编译');
    }
  }

  /**
   * Extract string assignments from a pre-parsed tree-sitter tree.
   */
  extractAssignments(tree: Parser.Tree, source: string): StringAssignment[] {
    const query = this.query;
    if (!query) {
      return [];
    }

    const assignments: StringAssignment[] = [];
    const captures = query.captures(tree.rootNode);

    // Group captures by their enclosing declaration/assignment parent
    const grouped = this.groupCaptures(captures);

    for (const [_parent, vars] of grouped) {
      const varNameCapture = vars.find(c => c.name === 'variable-name');
      const strCapture = vars.find(c => c.name === 'string-value');

      if (varNameCapture && strCapture) {
        const variableName = varNameCapture.node.text;
        const rawValue = strCapture.node.text;
        const stringValue = this.stripQuotes(rawValue);

        assignments.push({
          variableName,
          stringValue,
          startLine: strCapture.node.startPosition.row,
          startChar: strCapture.node.startPosition.column,
          endLine: strCapture.node.endPosition.row,
          endChar: strCapture.node.endPosition.column,
        });
      }
    }

    return assignments;
  }

  private groupCaptures(captures: Parser.QueryCapture[]): Map<Parser.SyntaxNode, Parser.QueryCapture[]> {
    const grouped = new Map<Parser.SyntaxNode, Parser.QueryCapture[]>();

    for (const capture of captures) {
      // Find the parent node (variable_declarator or assignment_expression or expression_statement)
      let parent: Parser.SyntaxNode | null = capture.node;
      while (parent) {
        const type = parent.type;
        if (
          type === 'variable_declarator' ||
          type === 'assignment_expression' ||
          type === 'expression_statement'
        ) {
          break;
        }
        parent = parent.parent;
      }

      if (parent) {
        const existing = grouped.get(parent);
        if (existing) {
          existing.push(capture);
        } else {
          grouped.set(parent, [capture]);
        }
      }
    }

    return grouped;
  }

  private stripQuotes(raw: string): string {
    // Remove template literal backticks
    if (raw.startsWith('`') && raw.endsWith('`')) {
      return raw.slice(1, -1);
    }

    // Remove single/double quotes
    if ((raw.startsWith('"') && raw.endsWith('"')) ||
        (raw.startsWith("'") && raw.endsWith("'"))) {
      return raw.slice(1, -1);
    }

    return raw;
  }
}

import Parser from 'web-tree-sitter';
import { LanguageParser, ParserResult, StringAssignment } from './types';

/**
 * Tree-sitter query for Python string literal assignments.
 *
 * Matches patterns like:
 *   api_key = "sk-xxxx"
 *   OPENAI_API_KEY = 'sk-xxxx'
 *
 * Tree-sitter node types:
 *   - module: the root node
 *   - expression_statement: a statement that is an expression
 *   - assignment: left = right
 *   - identifier: a variable name
 *   - string: a string literal (includes quotes in source)
 */
const PYTHON_QUERY = `
(module
  (expression_statement
    (assignment
      left: (identifier) @variable-name
      right: [
        (string) @string-value
        (string
          (string_start) @string-value
          (string_content) @string-content
          (string_end))
      ]))) @assignment
`;

/**
 * Python language parser using tree-sitter.
 *
 * Extracts all `identifier = "string literal"` assignments from Python source code,
 * returning the variable name, string value, and precise source range for each.
 */
export class PyParser implements LanguageParser {
  readonly languageId = 'python';
  private query: Parser.Query | null = null;

  /**
   * Parse Python source code and extract all string literal assignments.
   */
  async parse(source: string, oldTree?: Parser.Tree | null): Promise<ParserResult> {
    // This parser is instantiated by the registry, which already has a live Parser.
    // The actual parse call happens in scanEngine, which passes the parser and source.
    // This class holds the query (compiled once) and applies it to completed parses.
    return {
      assignments: [],
      astMode: false,
      errors: ['PyParser.parse() should not be called directly — use extractAssignments() with a pre-parsed tree'],
    };
  }

  /**
   * 编译 tree-sitter 查询（惰性，缓存）。
   * 必须在 extractAssignments 之前调用。
   */
  compileQuery(language: Parser.Language): void {
    if (!this.query) {
      this.query = language.query(PYTHON_QUERY);
      console.log('[Envify] PyParser: tree-sitter query 已编译');
    }
  }

  /**
   * Extract string assignments from a pre-parsed tree-sitter tree.
   *
   * @param tree The parsed tree-sitter tree
   * @param source The original source code (for extracting text by byte offset)
   * @returns Parsed string assignments with variable names and ranges
   */
  extractAssignments(tree: Parser.Tree, source: string): StringAssignment[] {
    const query = this.query;
    if (!query) {
      return [];
    }

    const assignments: StringAssignment[] = [];
    const captures = query.captures(tree.rootNode);

    // Group captures by assignment node
    // tree-sitter returns captures as {name, node} pairs — we need to group by parent assignment
    const grouped = this.groupCaptures(captures, source);

    for (const [_assignmentNode, vars] of grouped) {
      const varNameCapture = vars.find(c => c.name === 'variable-name');
      const strCapture = vars.find(c => c.name === 'string-value');

      if (varNameCapture && strCapture) {
        const variableName = varNameCapture.node.text;
        // The string node includes quotes — strip them
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

  /**
   * Group query captures by their containing assignment node.
   */
  private groupCaptures(
    captures: Parser.QueryCapture[],
    _source: string
  ): Map<Parser.SyntaxNode, Parser.QueryCapture[]> {
    const grouped = new Map<Parser.SyntaxNode, Parser.QueryCapture[]>();

    for (const capture of captures) {
      // Find the parent assignment node by walking up
      let assignmentNode: Parser.SyntaxNode | null = null;
      let current: Parser.SyntaxNode | null = capture.node;
      while (current) {
        if (current.type === 'assignment') {
          assignmentNode = current;
          break;
        }
        current = current.parent;
      }

      if (assignmentNode) {
        const existing = grouped.get(assignmentNode);
        if (existing) {
          existing.push(capture);
        } else {
          grouped.set(assignmentNode, [capture]);
        }
      }
    }

    return grouped;
  }

  /**
   * Strip surrounding quotes from a string literal.
   * Handles single quotes, double quotes, triple quotes, f-strings, and raw strings.
   */
  private stripQuotes(raw: string): string {
    let s = raw;

    // Remove string prefixes: f, r, b, u, fr, rf, br, rb
    s = s.replace(/^[fFrRbBuU]+/, '');

    // Remove triple quotes
    if (s.startsWith('"""') && s.endsWith('"""')) {
      return s.slice(3, -3);
    }
    if (s.startsWith("'''") && s.endsWith("'''")) {
      return s.slice(3, -3);
    }

    // Remove single quotes
    if ((s.startsWith('"') && s.endsWith('"')) ||
        (s.startsWith("'") && s.endsWith("'"))) {
      return s.slice(1, -1);
    }

    // Couldn't determine quoting — return as-is
    return s;
  }
}

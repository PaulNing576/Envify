/**
 * AST extraction types for the parser layer.
 */

/**
 * Represents a string literal assignment extracted from an AST.
 */
export interface StringAssignment {
  /** The variable name the string is assigned to, e.g. "api_key" */
  variableName: string;
  /** The string value with surrounding quotes stripped, e.g. "sk-proj-abc123" */
  stringValue: string;
  /** 0-based line number where the string literal starts */
  startLine: number;
  /** 0-based character offset where the string literal starts */
  startChar: number;
  /** 0-based line number where the string literal ends */
  endLine: number;
  /** 0-based character offset where the string literal ends */
  endChar: number;
}

/**
 * Result of parsing a document for string assignments.
 */
export interface ParserResult {
  assignments: StringAssignment[];
  /** True if the parser was able to parse successfully (AST mode) */
  astMode: boolean;
  /** Any errors encountered during parsing */
  errors: string[];
}

/**
 * Interface that all language-specific parsers must implement.
 */
export interface LanguageParser {
  /** The language ID this parser handles (e.g. "python") */
  readonly languageId: string;

  /**
   * Parse source text and return all string literal assignments.
   * @param source The full source code text
   * @param oldTree Optional previous parse tree for incremental parsing
   */
  parse(source: string, oldTree?: unknown): Promise<ParserResult>;
}

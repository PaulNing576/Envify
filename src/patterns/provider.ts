/**
 * Interface defining an API provider whose secrets the scanner should detect.
 */
export interface ApiProvider {
  /** Human-readable name, e.g. "OpenAI" */
  name: string;
  /** Unique diagnostic code, e.g. "envify.openai-key" — used for CodeAction discrimination */
  diagnosticCode: string;
  /** Suggested environment variable name, e.g. "OPENAI_API_KEY" */
  envVarName: string;
  /** Ordered list of regex patterns — first match wins */
  patterns: RegExp[];
  /** Optional: known prefix for fast string pre-filtering (e.g. "sk-") */
  prefixHint?: string;
  /** Optional: minimum string length to consider before matching */
  minLength?: number;
}

/**
 * Result of matching a string against the provider registry.
 */
export interface MatchResult {
  provider: ApiProvider;
  /** 'high' for exact pattern match, 'medium' for entropy fallback */
  confidence: 'high' | 'medium';
}

/**
 * Normalized detection record emitted to the diagnostic system.
 */
export interface SecretDetection {
  /** The matched provider (or a synthetic one for unknown secrets) */
  provider: ApiProvider;
  /** The detected secret value (will be masked in diagnostics) */
  value: string;
  /** The variable name the secret was assigned to */
  variableName: string;
  /** Confidence level */
  confidence: 'high' | 'medium';
  /** Source range of the string literal in the document */
  range: {
    startLine: number;
    startChar: number;
    endLine: number;
    endChar: number;
  };
}

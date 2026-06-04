import * as vscode from 'vscode';
import { SecretDetection } from '../patterns/provider';

/**
 * Language-specific environment variable access templates.
 *
 * Each language maps to a function that generates the replacement expression
 * given the env var name.
 */
const ENV_VAR_TEMPLATES: Record<string, (varName: string) => string> = {
  python: (v) => `os.getenv("${v}")`,
  javascript: (v) => `process.env.${v}`,
  typescript: (v) => `process.env.${v}`,
  javascriptreact: (v) => `process.env.${v}`,
  typescriptreact: (v) => `process.env.${v}`,
};

/**
 * Check if a Python file has `import os` and return the insertion edit if missing.
 */
export function getImportOsEdit(document: vscode.TextDocument): vscode.TextEdit | null {
  if (document.languageId !== 'python') {
    return null;
  }

  const text = document.getText();
  if (/^import\s+os\s*$/m.test(text) || /^from\s+os\s+import/m.test(text)) {
    return null; // already imported
  }

  // Prepend `import os` at the top of the file
  return vscode.TextEdit.insert(new vscode.Position(0, 0), 'import os\n');
}

/**
 * Generate the replacement expression for replacing a hardcoded string
 * with an environment variable read, appropriate for the document's language.
 */
export function getEnvVarExpression(
  languageId: string,
  envVarName: string
): string {
  const template = ENV_VAR_TEMPLATES[languageId];
  if (!template) {
    // Fallback: use process.env style
    return `process.env.${envVarName}`;
  }
  return template(envVarName);
}

/**
 * Get the language-appropriate template function.
 */
export function hasTemplate(languageId: string): boolean {
  return languageId in ENV_VAR_TEMPLATES;
}

/**
 * Result of context-aware replacement analysis.
 */
export interface SmartFixResult {
  /** The TextEdits to apply for the code replacement */
  edits: vscode.TextEdit[];
  /** Whether the secret was inside an existing env-var read (os.getenv / process.env ||) */
  wasDefaultValue: boolean;
}

/**
 * Generate context-aware edits for fixing a secret in-place.
 *
 * Detects whether the secret is already part of an environment-variable
 * read expression and chooses the right strategy:
 *
 *   Python:
 *     os.getenv("VAR", "secret")        → remove ", secret"     → os.getenv("VAR")
 *     os.getenv("VAR",\n    "secret")   → remove ",\n    secret" → os.getenv("VAR")
 *     plain assignment                  → replace "secret" with os.getenv("VAR")
 *
 *   JS / TS:
 *     process.env.VAR || "secret"       → remove || "secret"    → process.env.VAR
 *     plain assignment                  → replace "secret" with process.env.VAR
 *
 * @returns The edits to apply and whether the secret was a default/fallback value.
 */
export function getSmartFixEdits(
  document: vscode.TextDocument,
  secret: SecretDetection,
  envVarName: string
): SmartFixResult {
  const langId = document.languageId;
  const source = document.getText();

  const secretStartPos = new vscode.Position(
    secret.range.startLine,
    secret.range.startChar
  );
  const secretEndPos = new vscode.Position(
    secret.range.endLine,
    secret.range.endChar
  );
  const secretStartOffset = document.offsetAt(secretStartPos);

  // ── Python: check if secret is a default value in os.getenv() ──
  if (langId === 'python') {
    const commaPos = findGetenvDefaultComma(source, secretStartOffset);
    if (commaPos !== null) {
      const deleteStart = document.positionAt(commaPos);
      return {
        edits: [
          vscode.TextEdit.delete(new vscode.Range(deleteStart, secretEndPos)),
        ],
        wasDefaultValue: true,
      };
    }
  }

  // ── JS / TS: check if secret is a || fallback from process.env ──
  if (
    ['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(
      langId
    )
  ) {
    const fallbackPos = findProcessEnvFallback(source, secretStartOffset);
    if (fallbackPos !== null) {
      const deleteStart = document.positionAt(fallbackPos);
      return {
        edits: [
          vscode.TextEdit.delete(new vscode.Range(deleteStart, secretEndPos)),
        ],
        wasDefaultValue: true,
      };
    }
  }

  // ── Default: replace the secret string literal with an env-var read ──
  const replacement = getEnvVarExpression(langId, envVarName);
  return {
    edits: [
      vscode.TextEdit.replace(
        new vscode.Range(secretStartPos, secretEndPos),
        replacement
      ),
    ],
    wasDefaultValue: false,
  };
}

/**
 * Check whether the position right before `secretStartOffset` is the second
 * argument (default value) of an `os.getenv("VAR", …)` call.
 *
 * Handles both single-line and multi-line forms:
 *   os.getenv("VAR", "secret")
 *   os.getenv(
 *       "VAR",
 *       "secret"
 *   )
 *
 * Returns the byte offset of the comma that introduces the default value,
 * or `null` when the context does not match.
 */
function findGetenvDefaultComma(
  source: string,
  secretStartOffset: number
): number | null {
  const beforeText = source.substring(0, secretStartOffset);

  // Match the entire os.getenv / os.environ.get opening through the comma.
  // Capture the whitespace between the comma and the secret string so we can
  // compute the exact comma offset.
  //
  // Examples of matched text (before the secret-opening-quote):
  //   "...os.getenv("SLACK_BOT_TOKEN", "
  //   "...os.getenv(\n    "SLACK_BOT_TOKEN",\n    "
  const regex =
    /os\.(?:getenv|environ\.get)\s*\(\s*["'][^"']+["']\s*,(\s*)$/s;
  const match = regex.exec(beforeText);

  if (!match) {
    return null;
  }

  // Comma sits right before the trailing whitespace captured in group 1
  const trailingWsLen = match[1].length;
  return match.index + match[0].length - trailingWsLen - 1;
}

/**
 * Check whether the position right before `secretStartOffset` is a fallback
 * value after a `process.env.VAR ||` expression.
 *
 * Handles:
 *   process.env.SLACK_TOKEN || "secret"
 *   process.env.SLACK_TOKEN ||\n    "secret"
 *
 * Returns the byte offset of the `||` operator start, or `null`.
 */
function findProcessEnvFallback(
  source: string,
  secretStartOffset: number
): number | null {
  const beforeText = source.substring(0, secretStartOffset);

  // Match process.env.VAR || [optional whitespace before the secret]
  const regex = /process\.env\.\w+\s*(\|\|\s*)$/s;
  const match = regex.exec(beforeText);

  if (!match) {
    return null;
  }

  // The || sits at the start of the captured group
  const capturedLen = match[1].length; // includes "||" + trailing whitespace
  return match.index + match[0].length - capturedLen;
}

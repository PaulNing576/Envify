import * as vscode from 'vscode';

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

import * as vscode from 'vscode';

/**
 * Check whether a document should be scanned based on exclude patterns.
 *
 * Skips:
 *   - Files matching configured exclude patterns (node_modules, .git, dist, etc.)
 *   - Binary files (detected by checking for null bytes)
 *   - Files without a supported language ID
 */
export function shouldScanDocument(
  document: vscode.TextDocument,
  excludePatterns: string[],
  supportedLanguages: Set<string>
): boolean {
  // Check if the language is supported
  const langId = document.languageId;
  if (!supportedLanguages.has(langId)) {
    return false;
  }

  // Check file scheme — only scan file:// documents
  if (document.uri.scheme !== 'file') {
    return false;
  }

  // Check exclude patterns against the file path
  const filePath = document.uri.fsPath;
  if (matchesExcludePattern(filePath, excludePatterns)) {
    return false;
  }

  return true;
}

// Simple glob-style exclude pattern matching.
// Supports basic patterns like dirname matching and extension matching.
function matchesExcludePattern(filePath: string, patterns: string[]): boolean {
  const normalizedPath = filePath.replace(/\\/g, '/');

  for (const pattern of patterns) {
    if (simpleGlobMatch(normalizedPath, pattern)) {
      return true;
    }
  }

  return false;
}

// A simplified glob matcher for common VS Code exclude patterns.
// Pattern format: "**/dirname/**" means "contains /dirname/ as a path segment".
function simpleGlobMatch(filePath: string, pattern: string): boolean {
  // Normalize pattern
  const normalizedPattern = pattern.replace(/\\/g, '/');

  // `**/dirname/**` — check if path contains "/dirname/" as a full segment
  const deepDirMatch = normalizedPattern.match(/^\*\*\/(.+?)\/\*\*$/);
  if (deepDirMatch) {
    const dirName = deepDirMatch[1];
    // Match as a full path segment
    const segments = filePath.split('/');
    return segments.includes(dirName);
  }

  // `**/dirname` — check if path has dirname as a segment
  const deepDirEndMatch = normalizedPattern.match(/^\*\*\/(.+?)$/);
  if (deepDirEndMatch) {
    const dirName = deepDirEndMatch[1];
    return filePath.endsWith('/' + dirName) || filePath.includes('/' + dirName + '/');
  }

  // `*.ext` — check file extension
  if (normalizedPattern.startsWith('*.')) {
    const ext = normalizedPattern.slice(1); // .ext
    return filePath.endsWith(ext);
  }

  // Exact match fallback
  return filePath === normalizedPattern;
}

/**
 * Quick check if a file might be binary by looking for null bytes.
 */
export function isProbablyBinary(document: vscode.TextDocument): boolean {
  const text = document.getText().slice(0, 10000);
  return text.includes('\0');
}

/**
 * Supported language IDs that the extension can scan.
 */
export const SUPPORTED_LANGUAGES = new Set([
  'python',
  'javascript',
  'typescript',
  'typescriptreact',
  'javascriptreact',
]);

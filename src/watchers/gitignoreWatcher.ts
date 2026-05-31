import * as vscode from 'vscode';
import { GitignoreChecker } from '../codeActions/gitignoreChecker';
import { t } from '../i18n';

/**
 * Watches for changes to .gitignore files. When .gitignore changes,
 * checks whether .env is listed and emits an Information diagnostic
 * with a Quick Fix if it's missing.
 */
export function setupGitignoreWatcher(): vscode.FileSystemWatcher {
  const collection = vscode.languages.createDiagnosticCollection('envify-gitignore');
  const watcher = vscode.workspace.createFileSystemWatcher('**/.gitignore');

  const checkAndEmit = async (uri: vscode.Uri) => {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
      return;
    }

    const result = await GitignoreChecker.checkGitignore(workspaceFolder);

    if (result) {
      // .env is missing from .gitignore — emit diagnostic
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(0, 0, 0, 0),
        t('gitignore.missing'),
        vscode.DiagnosticSeverity.Information
      );
      diagnostic.source = 'Envify';
      diagnostic.code = 'envify.missing-gitignore';

      collection.set(uri, [diagnostic]);
    } else {
      // .env is in .gitignore — clear diagnostic
      collection.delete(uri);
    }
  };

  watcher.onDidChange(checkAndEmit);
  watcher.onDidCreate(checkAndEmit);

  return watcher;
}

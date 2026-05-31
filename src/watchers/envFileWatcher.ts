import * as vscode from 'vscode';
import { ScanEngine, ScanConfig } from '../scanner/scanEngine';

/**
 * Watches for changes to .env files and triggers re-scanning of
 * all open documents when .env changes.
 *
 * This ensures diagnostics stay in sync — e.g., if a user adds
 * a key to .env, any open files that reference it can be flagged
 * or cleared appropriately.
 */
export function setupEnvFileWatcher(
  scanEngine: ScanEngine,
  getConfig: () => ScanConfig
): vscode.FileSystemWatcher {
  const watcher = vscode.workspace.createFileSystemWatcher('**/.env');

  watcher.onDidChange(async (uri) => {
    console.log(`[Envify] .env changed: ${uri.fsPath}, re-scanning open documents`);
    await scanEngine.scanAllOpenDocuments(getConfig());
  });

  watcher.onDidCreate(async (uri) => {
    console.log(`[Envify] .env created: ${uri.fsPath}, re-scanning open documents`);
    await scanEngine.scanAllOpenDocuments(getConfig());
  });

  watcher.onDidDelete(async (uri) => {
    console.log(`[Envify] .env deleted: ${uri.fsPath}, re-scanning open documents`);
    await scanEngine.scanAllOpenDocuments(getConfig());
  });

  return watcher;
}

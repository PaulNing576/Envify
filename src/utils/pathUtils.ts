import * as vscode from 'vscode';

/**
 * Get the workspace folder that contains the given URI.
 *
 * In a multi-root workspace, returns the specific workspace folder
 * that owns the file. Falls back to the first workspace folder.
 */
export function getWorkspaceFolder(uri: vscode.Uri): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.getWorkspaceFolder(uri);
}

/**
 * Get all workspace folders, or an empty array if no workspace is open.
 */
export function getAllWorkspaceFolders(): readonly vscode.WorkspaceFolder[] {
  return vscode.workspace.workspaceFolders ?? [];
}

/**
 * Check if there is an active workspace.
 */
export function hasWorkspace(): boolean {
  return vscode.workspace.workspaceFolders !== undefined &&
    vscode.workspace.workspaceFolders.length > 0;
}

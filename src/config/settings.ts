import * as vscode from 'vscode';
import { ScanConfig } from '../scanner/scanEngine';

/**
 * Read the current Envify configuration from VS Code settings.
 *
 * Returns a fully resolved ScanConfig that can be passed directly
 * to the ScanEngine.
 */
export function getScanConfig(): ScanConfig {
  const config = vscode.workspace.getConfiguration('envify');

  return {
    enabledProviders: config.get<string[]>('providers', ['openai']),
    entropyThreshold: config.get<number>('entropyThreshold', 4.5),
    excludePatterns: config.get<string[]>('excludePatterns', [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/__pycache__/**',
      '**/.venv/**',
      '**/venv/**',
    ]),
    largeFileThreshold: config.get<number>('largeFileThreshold', 5000),
  };
}

/**
 * Check if Envify is globally enabled.
 */
export function isEnabled(): boolean {
  return vscode.workspace.getConfiguration('envify').get<boolean>('enabled', true);
}

/**
 * Check if auto-fix on save is enabled.
 */
export function isAutoFixOnSave(): boolean {
  return vscode.workspace.getConfiguration('envify').get<boolean>('autoFixOnSave', false);
}

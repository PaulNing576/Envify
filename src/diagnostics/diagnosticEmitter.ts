import * as vscode from 'vscode';
import { SecretDetection } from '../patterns/provider';
import { formatDiagnosticMessage, formatHoverMessage } from './diagnosticFormatter';

/**
 * Manages the VS Code DiagnosticCollection for Envify.
 *
 * Creates and updates diagnostics for detected secrets. Each diagnostic
 * carries a unique `code` (the provider's diagnosticCode) so the
 * CodeActionProvider can discriminate and offer the right fix.
 */
export class DiagnosticEmitter {
  private collection: vscode.DiagnosticCollection;

  constructor() {
    this.collection = vscode.languages.createDiagnosticCollection('envify');
  }

  /**
   * Set diagnostics for a specific document URI.
   * Replaces any previous diagnostics for this URI.
   */
  set(uri: vscode.Uri, detections: SecretDetection[]): void {
    const diagnostics: vscode.Diagnostic[] = [];

    for (const detection of detections) {
      const range = new vscode.Range(
        detection.range.startLine,
        detection.range.startChar,
        detection.range.endLine,
        detection.range.endChar
      );

      const message = formatDiagnosticMessage(detection);
      const hoverMessage = formatHoverMessage(detection);

      const diagnostic = new vscode.Diagnostic(
        range,
        message,
        vscode.DiagnosticSeverity.Warning
      );

      diagnostic.source = 'Envify';
      diagnostic.code = detection.provider.diagnosticCode;

      // Store the full detection data as a JSON string in the diagnostic code
      // for the Quick Fix provider to use. We use a custom property pattern
      // since Diagnostic.code doesn't support complex objects well.
      (diagnostic as any)._envifyDetection = detection;

      diagnostics.push(diagnostic);
    }

    this.collection.set(uri, diagnostics);
  }

  /**
   * Clear diagnostics for a specific URI.
   */
  clear(uri: vscode.Uri): void {
    this.collection.delete(uri);
  }

  /**
   * Clear all diagnostics (e.g., on extension deactivation).
   */
  clearAll(): void {
    this.collection.clear();
  }

  /**
   * Get the underlying DiagnosticCollection.
   */
  getCollection(): vscode.DiagnosticCollection {
    return this.collection;
  }

  /**
   * Dispose the collection.
   */
  dispose(): void {
    this.collection.dispose();
  }
}

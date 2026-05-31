import Parser from 'web-tree-sitter';
import * as vscode from 'vscode';
import { LanguageParser, ParserResult } from './types';

/**
 * Registry that manages tree-sitter parser instances per language.
 *
 * Each language parser is lazily initialized on first use and cached
 * for the lifetime of the extension. WASM grammar files are loaded
 * from the extension's resources/wasm/ directory.
 */
export class ParserRegistry {
  private parsers: Map<string, Parser> = new Map();
  private initialized = false;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  /**
   * Initialize the web-tree-sitter runtime. Must be called once before
   * any parser can be created. Safe to call multiple times — it's idempotent.
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await Parser.init({
      locateFile(scriptName: string, scriptDirectory?: string) {
        // Use the WASM bundled with web-tree-sitter
        // In VS Code, we need to resolve this from the extension's node_modules
        return require.resolve('web-tree-sitter/tree-sitter.wasm');
      },
    });

    this.initialized = true;
  }

  /**
   * Get (or create and cache) a parser for the given language.
   *
   * @param lang The language identifier (e.g. "python", "javascript")
   * @returns A configured web-tree-sitter Parser, or null if the language isn't supported
   */
  async getParser(lang: string): Promise<Parser | null> {
    // Check cache first
    const cached = this.parsers.get(lang);
    if (cached) {
      return cached;
    }

    await this.init();

    try {
      const wasmPath = this.context.asAbsolutePath(`resources/wasm/tree-sitter-${lang}.wasm`);
      const language = await Parser.Language.load(wasmPath);
      const parser = new Parser();
      parser.setLanguage(language);
      this.parsers.set(lang, parser);
      return parser;
    } catch (err) {
      // WASM not available for this language — it's not supported yet
      console.warn(`[Envify] Could not load tree-sitter WASM for "${lang}":`, err);
      return null;
    }
  }

  /**
   * Returns true if tree-sitter support is available for the given language.
   */
  hasSupport(lang: string): boolean {
    const supportedLanguages = ['python', 'javascript', 'typescript', 'tsx'];
    return supportedLanguages.includes(lang);
  }

  /**
   * Clear all cached parsers (useful for testing or hot-reload scenarios).
   */
  dispose(): void {
    for (const parser of this.parsers.values()) {
      parser.delete();
    }
    this.parsers.clear();
  }
}

import * as vscode from 'vscode';
import { ParserRegistry } from '../parser/parserRegistry';
import { PyParser } from '../parser/pyParser';
import { JsParser } from '../parser/jsParser';
import { StringAssignment } from '../parser/types';
import { PatternRegistry } from '../patterns/patternRegistry';
import { SecretDetection } from '../patterns/provider';
import { DiagnosticEmitter } from '../diagnostics/diagnosticEmitter';
import { shouldScanDocument, isProbablyBinary, SUPPORTED_LANGUAGES } from './fileFilter';

/**
 * Configuration for the scan engine.
 */
export interface ScanConfig {
  enabledProviders: string[];
  entropyThreshold: number;
  excludePatterns: string[];
  largeFileThreshold: number;
}

/**
 * Core scan orchestrator.
 *
 * Coordinates the pipeline:
 *   Document event → File filter → Language dispatch → AST parse → Pattern match → Diagnostics
 */
export class ScanEngine {
  private parserRegistry: ParserRegistry;
  private patternRegistry: PatternRegistry;
  private diagnosticEmitter: DiagnosticEmitter;
  private pyParser: PyParser = new PyParser();
  private jsParser: JsParser = new JsParser();

  constructor(
    parserRegistry: ParserRegistry,
    patternRegistry: PatternRegistry,
    diagnosticEmitter: DiagnosticEmitter
  ) {
    this.parserRegistry = parserRegistry;
    this.patternRegistry = patternRegistry;
    this.diagnosticEmitter = diagnosticEmitter;
  }

  /**
   * Scan a single document for secrets.
   */
  async scanDocument(
    document: vscode.TextDocument,
    config: ScanConfig
  ): Promise<void> {
    if (!shouldScanDocument(document, config.excludePatterns, SUPPORTED_LANGUAGES)) {
      this.diagnosticEmitter.clear(document.uri);
      return;
    }
    if (isProbablyBinary(document)) { return; }

    const langId = document.languageId;
    const source = document.getText();
    let assignments: StringAssignment[];

    if (source.split('\n').length > config.largeFileThreshold) {
      assignments = this.regexFallback(source, langId);
    } else {
      assignments = await this.astParse(document, source, langId);
    }

    const detections = this.matchAssignments(assignments, config);
    this.diagnosticEmitter.set(document.uri, detections);
  }

  /**
   * 扫描单个文档并返回检测到的 Secret 列表（不发送诊断信息）。
   * 供 WorkspaceScanner 和其他批量扫描场景使用。
   */
  async scanDocumentForSecrets(
    document: vscode.TextDocument,
    config: ScanConfig
  ): Promise<SecretDetection[]> {
    console.log(`[Envify] scanDocumentForSecrets: ${document.uri.fsPath}, langId=${document.languageId}, scheme=${document.uri.scheme}`);

    if (!shouldScanDocument(document, config.excludePatterns, SUPPORTED_LANGUAGES)) {
      console.log(`[Envify] scanDocumentForSecrets: ${document.uri.fsPath} 被文件过滤器排除 (langId=${document.languageId})`);
      return [];
    }
    if (isProbablyBinary(document)) {
      console.log(`[Envify] scanDocumentForSecrets: ${document.uri.fsPath} 被识别为二进制文件`);
      return [];
    }

    const langId = document.languageId;
    const source = document.getText();

    console.log(`[Envify] scanDocumentForSecrets: 源码 (${source.length} 字符, ${source.split('\n').length} 行):`);
    console.log(source.slice(0, 600));

    let assignments: StringAssignment[];
    if (source.split('\n').length > config.largeFileThreshold) {
      assignments = this.regexFallback(source, langId);
      console.log(`[Envify] scanDocumentForSecrets: 大文件使用 regex，提取到 ${assignments.length} 个赋值`);
    } else {
      assignments = await this.astParse(document, source, langId);
      console.log(`[Envify] scanDocumentForSecrets: AST/regex 提取到 ${assignments.length} 个赋值`);
    }

    for (const a of assignments) {
      console.log(`[Envify] scanDocumentForSecrets: 赋值 → var="${a.variableName}", value="${a.stringValue.slice(0, 30)}...", line=${a.startLine + 1}`);
    }

    console.log(`[Envify] scanDocumentForSecrets: 已启用 Provider: [${config.enabledProviders.join(', ')}]`);
    return this.matchAssignments(assignments, config);
  }

  /**
   * 对提取到的 StringAssignment 列表执行 Pattern Matching。
   */
  private matchAssignments(assignments: StringAssignment[], config: ScanConfig): SecretDetection[] {
    const detections: SecretDetection[] = [];
    for (const assignment of assignments) {
      const detection = this.patternRegistry.match(
        assignment.stringValue,
        assignment.variableName,
        config.enabledProviders,
        {
          startLine: assignment.startLine,
          startChar: assignment.startChar,
          endLine: assignment.endLine,
          endChar: assignment.endChar,
        }
      );
      if (detection) { detections.push(detection); }
    }
    return detections;
  }

  /**
   * AST 解析（tree-sitter），失败时回退到 regex。
   */
  private async astParse(
    document: vscode.TextDocument,
    source: string,
    langId: string
  ): Promise<StringAssignment[]> {
    try {
      const tsLang = this.mapLanguageToTreeSitter(langId);
      if (!tsLang) {
        console.log(`[Envify] astParse: ${langId} 无 tree-sitter 支持，使用 regex fallback`);
        return this.regexFallback(source, langId);
      }

      const parser = await this.parserRegistry.getParser(tsLang);
      if (!parser) {
        console.log(`[Envify] astParse: ${tsLang} parser 不可用，使用 regex fallback`);
        return this.regexFallback(source, langId);
      }

      const tree = parser.parse(source);
      console.log(`[Envify] astParse: ${langId} tree-sitter 解析成功，根节点类型: ${tree.rootNode.type}`);
      const childTypes = tree.rootNode.children.map((c: any) => c.type).join(', ');
      console.log(`[Envify] astParse: 根节点子类型: [${childTypes}]`);

      let astResult: StringAssignment[];
      if (langId === 'python') {
        const language = parser.getLanguage();
        this.pyParser.compileQuery(language);
        astResult = this.pyParser.extractAssignments(tree, source);
      } else {
        const language = parser.getLanguage();
        this.jsParser.compileQuery(language);
        astResult = this.jsParser.extractAssignments(tree, source);
      }

      // 安全网：AST 返回 0 结果时回退到 regex
      if (astResult.length === 0) {
        console.log(`[Envify] astParse: tree-sitter query 返回 0 个结果，回退到 regex fallback`);
        return this.regexFallback(source, langId);
      }

      console.log(`[Envify] astParse: tree-sitter 成功提取 ${astResult.length} 个赋值`);
      return astResult;
    } catch (err) {
      console.warn(`[Envify] AST parse 失败 (${langId})，使用 regex fallback:`, err);
      return this.regexFallback(source, langId);
    }
  }

  /**
   * Regex 回退方案。
   *
   * 分两轮扫描：
   *   第一轮：变量赋值（variable = "string"）
   *   第二轮：函数调用中的字符串参数（func("arg", "secret")），
   *           覆盖 os.getenv("VAR", "default-secret") 等暴露模式
   */
  private regexFallback(source: string, langId: string): StringAssignment[] {
    const assignments: StringAssignment[] = [];
    const coveredRanges: Array<{ start: number; end: number }> = [];

    // 获取模式列表
    const patterns = this.getRegexPattern(langId);
    console.log(`[Envify] regexFallback: langId=${langId}, pattern 数量=${patterns.length}`);

    // 统一处理函数：将匹配转换为 StringAssignment
    const addAssignment = (
      match: RegExpExecArray,
      stringValue: string,
      variableName?: string
    ) => {
      // 跳过不可达的代码
      if (!stringValue || stringValue.length < 8) { return; }

      // 跳过三引号文档字符串（检查匹配位置前一个字符是否是同类型引号）
      const charBefore = match.index > 0 ? source[match.index - 1] : '';
      const matchQuote = match[0][0]; // " 或 '
      if (charBefore === matchQuote && match[0].length > stringValue.length + 2) {
        return; // 三引号包裹
      }

      // 跳过 f-string / 模板字符串（含 { 插值占位符）
      if (stringValue.includes('{') && stringValue.includes('}')) {
        return;
      }
      // 跳过 f"..." 或 f'...' 前缀的格式化字符串
      const prefixCheck = match.index > 0 ? source.slice(Math.max(0, match.index - 3), match.index + match[0].length) : match[0];
      if (/[a-z]?"/.test(prefixCheck.slice(0, 2)) && match[0][0] === '"') {
        // 检查是否是 f-string: 引号前有 f 或 F
        const charBeforeQuote = match.index > 0 ? source[match.index - 1] : '';
        if (charBeforeQuote === 'f' || charBeforeQuote === 'F') {
          return;
        }
      }

      // 跳过代码表达式：以 : 或 , 开头的非 Key 字符串
      if (/^[:,]\s/.test(stringValue)) { return; }
      // 跳过含函数调用语法的字符串: func(x, y)
      if (/\w+\([^)]*\)/.test(stringValue)) { return; }
      // 跳过自然语言文本（高空格占比 + 普通英文词汇特征）
      const spaceCount = (stringValue.match(/ /g) || []).length;
      if (spaceCount >= 4 && stringValue.length > 16) {
        if (/^[A-Z][a-z]+ [a-z]/.test(stringValue)) {
          return;
        }
      }

      // 跳过注释行中的字符串
      const lineStart = source.lastIndexOf('\n', match.index) + 1;
      const lineContent = source.slice(lineStart, source.indexOf('\n', match.index)).trim();
      if (lineContent.startsWith('#') || lineContent.startsWith('//')) {
        return;
      }

      const precedingText = source.slice(0, match.index);
      const startLine = precedingText.split('\n').length - 1;
      const lastNewline = precedingText.lastIndexOf('\n');
      const valueOffsetInMatch = match[0].indexOf(stringValue);
      const lineStartOffset = lastNewline + 1;
      const stringLiteralStartChar = match.index - lineStartOffset + valueOffsetInMatch - 1;
      const stringLiteralEndChar = stringLiteralStartChar + stringValue.length + 2;

      // 检查该位置是否已被之前的匹配覆盖
      const absStart = match.index + valueOffsetInMatch - 1;
      const absEnd = absStart + stringValue.length + 2;
      const alreadyCovered = coveredRanges.some(
        r => absStart >= r.start && absEnd <= r.end
      );
      if (alreadyCovered) { return; }

      coveredRanges.push({ start: absStart - 10, end: absEnd + 10 });

      assignments.push({
        variableName: variableName || this.guessVariableName(source, match.index),
        stringValue,
        startLine,
        startChar: stringLiteralStartChar,
        endLine: startLine,
        endChar: stringLiteralEndChar,
      });
    };

    // 第一轮：变量赋值
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(source)) !== null) {
        addAssignment(match, match[2], match[1]);
      }
    }

    // 第二轮：捕获所有 8 字符以上的字符串字面量（覆盖函数参数等非赋值位置）
    const allStringsRe = /["']([^"']{8,})["']/g;
    let strMatch: RegExpExecArray | null;
    while ((strMatch = allStringsRe.exec(source)) !== null) {
      const stringValue = strMatch[1];
      // 跳过太短的字符串
      if (stringValue.length < 8) { continue;
      }
      addAssignment(strMatch, stringValue, undefined);
    }

    console.log(`[Envify] regexFallback: 最终提取 ${assignments.length} 个字符串赋值`);
    return assignments;
  }

  /**
   * 当没有显式变量名时，尝试从上下文推断变量名。
   */
  private guessVariableName(source: string, matchIndex: number): string {
    // 取匹配位置前 300 个字符作为上下文
    const contextStart = Math.max(0, matchIndex - 300);
    const context = source.slice(contextStart, matchIndex);
    // 规范化空白符（换行→空格），便于正则跨行匹配
    const flatContext = context.replace(/\n\s*/g, ' ');

    // 优先：os.getenv("VAR_NAME", "secret") → 用环境变量名
    const getenvMatch = flatContext.match(/os\.(?:getenv|environ(?:\[["'][^"']+["']\]|\.get))\s*\(\s*["'](\w+)["']/);
    if (getenvMatch) { return getenvMatch[1]; }

    // 查找最近的赋值变量名（原始多行版本）
    const assignMatch = context.match(/(\w+)\s*=\s*.*$/s);
    if (assignMatch) { return assignMatch[1]; }

    // 查找关键字参数名
    const kwargMatch = context.match(/[(\s,](\w+)\s*=\s*["'][^"']*$/s);
    if (kwargMatch) { return kwargMatch[1]; }

    // 查找最近的函数名
    const funcMatch = context.match(/(\w+)\s*\([^)]*$/s);
    if (funcMatch) { return funcMatch[1] + '_arg'; }

    return '__string_literal__';
  }

  /**
   * 获取各语言对应的正则表达式模式。
   */
  private getRegexPattern(langId: string): RegExp[] {
    switch (langId) {
      case 'python':
        return [
          // 变量赋值: x = "string"
          /(\w+)\s*=\s*["']([^"']{8,})["']/g,
          // os.getenv("VAR", "secret") — 单行版本
          /os\.(?:getenv|environ(?:\.get)?)\s*\(\s*["'](\w+)["']\s*,\s*["']([^"']{8,})["']/g,
          // os.getenv(\n    "VAR",\n    "secret"\n) — 多行版本（200 字符内）
          /os\.(?:getenv|environ(?:\.get)?)\s*\(\s*["'](\w+)["']\s*,[\s\S]{0,200}?["']([^"']{8,})["']/g,
        ];
      case 'javascript':
      case 'typescript':
      case 'javascriptreact':
      case 'typescriptreact':
        return [
          // const/let/var x = "string"
          /(?:const|let|var)\s+(\w+)\s*=\s*["']([^"']{8,})["']/g,
          // x = "string"
          /(\w+)\s*=\s*["']([^"']{8,})["']/g,
          // 对象属性: key: "value"
          /['"]?(\w+)['"]?\s*:\s*["']([^"']{8,})["']/g,
          // process.env.X || "default"
          /process\.env\.(\w+)\s*\|\|\s*["']([^"']{8,})["']/g,
          // z.string().default("value") 等链式调用
          /\.default\s*\(\s*["']([^"']{8,})["']\s*\)/g,
        ];
      default:
        return [];
    }
  }

  /**
   * 扫描工作区中所有打开的文档。
   */
  async scanAllOpenDocuments(config: ScanConfig): Promise<void> {
    const documents = vscode.workspace.textDocuments;
    for (const document of documents) {
      await this.scanDocument(document, config);
    }
  }

  /**
   * 将 VS Code 语言 ID 映射为 tree-sitter 语言名。
   */
  private mapLanguageToTreeSitter(langId: string): string | null {
    switch (langId) {
      case 'python': return 'python';
      case 'javascript':
      case 'javascriptreact': return 'javascript';
      case 'typescript':
      case 'typescriptreact': return 'typescript';
      default: return null;
    }
  }
}

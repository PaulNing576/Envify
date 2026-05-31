import * as vscode from 'vscode';
import * as path from 'path';
import { ScanEngine, ScanConfig } from './scanEngine';
import { SecretDetection } from '../patterns/provider';
import { SUPPORTED_LANGUAGES } from './fileFilter';

/**
 * 工作区级别的文件扫描结果。
 */
export interface WorkspaceScanResult {
  /** 扫描的文件总数 */
  filesScanned: number;
  /** 发现的所有 Secret */
  detections: FileDetection[];
  /** 按 Provider 分组的统计 */
  summary: ProviderSummary[];
}

/**
 * 单个文件中检测到的 Secret。
 */
export interface FileDetection {
  /** 文件相对于工作区的路径 */
  relativePath: string;
  /** 文件绝对 URI */
  uri: vscode.Uri;
  /** 该文件中检测到的所有 Secret */
  secrets: SecretDetection[];
}

/**
 * 按 Provider 类型统计的摘要。
 */
export interface ProviderSummary {
  /** Provider 名称（如 "OpenAI"） */
  providerName: string;
  /** 该 Provider 检测到的数量 */
  count: number;
}

/**
 * 工作区扫描器。
 *
 * 使用 vscode.workspace.findFiles 发现所有支持的文件类型，
 * 然后复用 scanEngine 逐文件扫描，最后汇总结果。
 */
export class WorkspaceScanner {
  /** 支持扫描的文件扩展名 */
  private static readonly SCAN_GLOB = '**/*.{py,js,jsx,ts,tsx,mjs,cjs}';

  /**
   * 扫描整个工作区，返回聚合结果。
   *
   * @param scanEngine 已有的扫描引擎实例
   * @param config 扫描配置
   * @param progress 可选的进度报告回调
   */
  static async scanWorkspace(
    scanEngine: ScanEngine,
    config: ScanConfig,
    progress?: vscode.Progress<{ message?: string; increment?: number }>
  ): Promise<WorkspaceScanResult> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('没有打开的工作区');
    }

    // 第一步：发现所有匹配的文件
    const files = await vscode.workspace.findFiles(
      WorkspaceScanner.SCAN_GLOB,
      // 排除模式：与配置中的 excludePatterns 一致
      `{${config.excludePatterns.join(',')}}`
    );

    console.log(`[Envify] WorkspaceScanner: 发现 ${files.length} 个文件待扫描`);

    const detections: FileDetection[] = [];
    let filesScanned = 0;

    // 第二步：逐个文件扫描
    for (let i = 0; i < files.length; i++) {
      const fileUri = files[i];

      // 跳过非 file:// scheme 的文件
      if (fileUri.scheme !== 'file') {
        continue;
      }

      // 检查语言是否支持
      const langId = getLanguageId(fileUri);
      if (!langId || !SUPPORTED_LANGUAGES.has(langId)) {
        continue;
      }

      try {
        // 读取文件内容
        const document = await vscode.workspace.openTextDocument(fileUri);
        const source = document.getText();

        // 跳过过大的文件
        if (source.split('\n').length > config.largeFileThreshold) {
          console.log(`[Envify] WorkspaceScanner: 跳过超大文件 ${fileUri.fsPath}`);
          continue;
        }

        // 使用 AST 或 regex 提取字符串赋值
        // 直接调用 scanEngine，它会处理 AST/regex 两种路径
        console.log(`[Envify] WorkspaceScanner: 正在扫描 ${fileUri.fsPath} (${source.length} 字符, ${source.split('\n').length} 行)`);
        console.log(`[Envify] WorkspaceScanner: scanEngine 类型=${typeof scanEngine}, scanDocumentForSecrets=${typeof scanEngine?.scanDocumentForSecrets}`);
        console.log(`[Envify] WorkspaceScanner: config.enabledProviders=[${config.enabledProviders?.join(',')}], entropyThreshold=${config.entropyThreshold}`);
        const fileSecrets = await WorkspaceScanner.scanFile(
          scanEngine, document, config
        );
        console.log(`[Envify] WorkspaceScanner: ${fileUri.fsPath} → 发现 ${fileSecrets.length} 个 Secret`);

        if (fileSecrets.length > 0) {
          // 打印每个 match 的详细信息
          for (const secret of fileSecrets) {
            console.log(`[Envify] WorkspaceScanner: Match → ${secret.provider.name} | var: ${secret.variableName} | line: ${secret.range.startLine + 1} | value: ${secret.value.slice(0, 20)}...`);
          }

          const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
          const relativePath = workspaceFolder
            ? path.relative(workspaceFolder.uri.fsPath, fileUri.fsPath)
            : path.basename(fileUri.fsPath);

          detections.push({
            relativePath,
            uri: fileUri,
            secrets: fileSecrets,
          });

          console.log(`[Envify] WorkspaceScanner: ${relativePath} 中发现 ${fileSecrets.length} 个 Secret`);
        }

        filesScanned++;
      } catch (err) {
        console.warn(`[Envify] WorkspaceScanner: 无法扫描 ${fileUri.fsPath}:`, err);
      }

      // 更新进度
      if (progress) {
        progress.report({
          message: `扫描中... (${i + 1}/${files.length})`,
          increment: 100 / files.length,
        });
      }
    }

    // 第三步：汇总统计
    const summary = WorkspaceScanner.buildSummary(detections);

    console.log(`[Envify] WorkspaceScanner: 扫描完成，${filesScanned} 个文件，发现 ${detections.reduce((s, d) => s + d.secrets.length, 0)} 个 Secret`);

    return {
      filesScanned,
      detections,
      summary,
    };
  }

  /**
   * 扫描单个文件并返回检测结果。
   * 这是一个内部方法，用于绕过 DiagnosticEmitter（全工作区扫描不需要即时诊断）。
   */
  private static async scanFile(
    scanEngine: ScanEngine,
    document: vscode.TextDocument,
    config: ScanConfig
  ): Promise<SecretDetection[]> {
    // 临时禁用诊断输出（全工作区扫描场景，我们只关心结果）
    // 使用 scanEngine 的内部能力来提取 secrets
    return scanEngine.scanDocumentForSecrets(document, config);
  }

  /**
   * 根据所有检测结果生成按 Provider 分类的摘要。
   */
  private static buildSummary(detections: FileDetection[]): ProviderSummary[] {
    const countMap = new Map<string, number>();

    for (const fileDet of detections) {
      for (const secret of fileDet.secrets) {
        const name = secret.provider.name;
        countMap.set(name, (countMap.get(name) ?? 0) + 1);
      }
    }

    const summary: ProviderSummary[] = [];
    for (const [providerName, count] of countMap) {
      summary.push({ providerName, count });
    }

    // 按数量降序排列
    summary.sort((a, b) => b.count - a.count);

    return summary;
  }
}

/**
 * 根据文件扩展名推断 VS Code 语言 ID。
 */
function getLanguageId(uri: vscode.Uri): string | null {
  const ext = path.extname(uri.fsPath).toLowerCase();
  switch (ext) {
    case '.py':
      return 'python';
    case '.js':
    case '.mjs':
    case '.cjs':
      return 'javascript';
    case '.jsx':
      return 'javascriptreact';
    case '.ts':
      return 'typescript';
    case '.tsx':
      return 'typescriptreact';
    default:
      return null;
  }
}

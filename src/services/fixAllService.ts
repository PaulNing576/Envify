import * as vscode from 'vscode';
import { WorkspaceScanResult, FileDetection } from '../scanner/workspaceScanner';
import { SecretDetection } from '../patterns/provider';
import { getEnvVarExpression, getImportOsEdit } from '../codeActions/replaceWithEnvVar';
import { EnvFileGenerator } from '../codeActions/envFileGenerator';
import { GitignoreChecker } from '../codeActions/gitignoreChecker';

/**
 * Fix All 批量修复服务。
 *
 * 遍历所有扫描结果，自动：
 *   1. 替换所有硬编码 API Key 为环境变量读取
 *   2. 生成/更新 .env 文件（去重）
 *   3. 更新 .gitignore 确保 .env 不被提交
 *
 * 所有修改通过单一 WorkspaceEdit 提交，保证原子性和可撤销性。
 */
export class FixAllService {
  /**
   * 批量修复所有检测到的 Secret。
   *
   * @param scanResult 工作区扫描结果
   * @returns 修复摘要
   */
  static async fixAll(scanResult: WorkspaceScanResult): Promise<FixAllResult> {
    const edit = new vscode.WorkspaceEdit();
    let fixedCount = 0;
    const processedEnvVars = new Set<string>(); // 去重：已写入 .env 的变量名

    // 第一步：按文件分组，替换代码中的硬编码 Key
    for (const fileDet of scanResult.detections) {
      try {
        const document = await vscode.workspace.openTextDocument(fileDet.uri);
        const fileEditCount = FixAllService.fixFile(
          edit, document, fileDet, processedEnvVars
        );
        fixedCount += fileEditCount;
      } catch (err) {
        console.error(`[Envify] FixAll: 无法处理文件 ${fileDet.relativePath}:`, err);
      }
    }

    // 第二步：收集所有需要写入 .env 的变量（去重）
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      await FixAllService.writeEnvFile(edit, workspaceFolder, processedEnvVars, scanResult);
    }

    // 第三步：确保 .gitignore 包含 .env
    if (workspaceFolder) {
      await FixAllService.ensureGitignore(edit, workspaceFolder);
    }

    // 第四步：应用所有修改
    const success = await vscode.workspace.applyEdit(edit);
    console.log(`[Envify] FixAll: 已修复 ${fixedCount} 个 Secret，WorkspaceEdit 应用${success ? '成功' : '失败'}`);

    return {
      fixedCount,
      envVarsAdded: processedEnvVars.size,
      success,
    };
  }

  /**
   * 修复单个文件中的所有 Secret。
   *
   * 对文件中的每个 Secret：将字符串字面量替换为环境变量读取表达式。
   * 如果该 Secret 对应的 env var 尚未写入 .env，记录下来供后续写入。
   */
  private static fixFile(
    edit: vscode.WorkspaceEdit,
    document: vscode.TextDocument,
    fileDet: FileDetection,
    processedEnvVars: Set<string>
  ): number {
    let count = 0;
    const langId = document.languageId;

    for (const secret of fileDet.secrets) {
      const envVarName = secret.provider.envVarName;
      const diagnosticRange = new vscode.Range(
        secret.range.startLine,
        secret.range.startChar,
        secret.range.endLine,
        secret.range.endChar
      );

      // 替换为环境变量读取表达式
      const replacement = getEnvVarExpression(langId, envVarName);
      edit.replace(document.uri, diagnosticRange, replacement);

      // 记录需要写入 .env 的变量（去重用）
      processedEnvVars.add(envVarName);

      count++;
    }

    // 为 Python 文件添加 import os（如果缺失）
    const importEdit = getImportOsEdit(document);
    if (importEdit) {
      edit.insert(document.uri, importEdit.range.start, importEdit.newText);
    }

    return count;
  }

  /**
   * 将收集到的环境变量写入 .env 文件。
   *
   * 去重逻辑：
   *   - 相同的 env var name 只写入一次
   *   - 如果 .env 中已存在该变量，则跳过（保留用户已有的值）
   */
  private static async writeEnvFile(
    edit: vscode.WorkspaceEdit,
    workspaceFolder: vscode.WorkspaceFolder,
    envVars: Set<string>,
    scanResult: WorkspaceScanResult
  ): Promise<void> {
    // 收集每个 env var 对应的第一个 secret 值
    const envVarToValue = new Map<string, string>();
    for (const fileDet of scanResult.detections) {
      for (const secret of fileDet.secrets) {
        const name = secret.provider.envVarName;
        if (envVars.has(name) && !envVarToValue.has(name)) {
          envVarToValue.set(name, secret.value);
        }
      }
    }

    // 查找 .env 文件中已存在的变量
    const envUri = vscode.Uri.joinPath(workspaceFolder.uri, '.env');
    const existingEnvVars = await FixAllService.getExistingEnvVars(envUri);

    // 过滤掉 .env 中已存在的变量
    const newVars = new Map<string, string>();
    for (const [name, value] of envVarToValue) {
      if (!existingEnvVars.has(name)) {
        newVars.set(name, value);
      }
    }

    if (newVars.size === 0) {
      console.log('[Envify] FixAll: 所有环境变量已存在于 .env 中，无需写入');
      return;
    }

    // 构建 .env 文件内容
    let envContent = '';
    try {
      const existingDoc = await vscode.workspace.openTextDocument(envUri);
      envContent = existingDoc.getText();
    } catch {
      // .env 不存在 — 创建新文件
      edit.createFile(envUri, { overwrite: false });
    }

    const needsNewline = envContent.length > 0 && !envContent.endsWith('\n');
    const prefix = needsNewline ? '\n' : '';
    const insertLine = envContent.split('\n').length;

    const entries = Array.from(newVars.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('\n');

    edit.insert(envUri, new vscode.Position(insertLine, 0), `${prefix}${entries}\n`);
    console.log(`[Envify] FixAll: 向 .env 添加 ${newVars.size} 个新变量`);
  }

  /**
   * 确保 .gitignore 包含 .env。
   */
  private static async ensureGitignore(
    edit: vscode.WorkspaceEdit,
    workspaceFolder: vscode.WorkspaceFolder
  ): Promise<void> {
    const result = await GitignoreChecker.checkGitignore(workspaceFolder);
    if (result) {
      if (result.isNewFile) {
        edit.createFile(result.uri, { overwrite: false });
      }
      for (const textEdit of result.edits) {
        if (textEdit.range.isEmpty) {
          edit.insert(result.uri, textEdit.range.start, textEdit.newText);
        } else {
          edit.replace(result.uri, textEdit.range, textEdit.newText);
        }
      }
      console.log('[Envify] FixAll: 已更新 .gitignore');
    }
  }

  /**
   * 读取 .env 文件中已存在的变量名集合。
   */
  private static async getExistingEnvVars(envUri: vscode.Uri): Promise<Set<string>> {
    const vars = new Set<string>();
    try {
      const doc = await vscode.workspace.openTextDocument(envUri);
      const content = doc.getText();
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
        if (match) {
          vars.add(match[1]);
        }
      }
    } catch {
      // .env 不存在 — 返回空集合
    }
    return vars;
  }
}

/**
 * Fix All 操作的结果摘要。
 */
export interface FixAllResult {
  /** 修复的 Secret 数量 */
  fixedCount: number;
  /** 添加到 .env 的环境变量数量 */
  envVarsAdded: number;
  /** WorkspaceEdit 是否成功应用 */
  success: boolean;
}

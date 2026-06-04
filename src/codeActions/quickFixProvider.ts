import * as vscode from 'vscode';
import { SecretDetection } from '../patterns/provider';
import { getEnvVarExpression, getImportOsEdit, getSmartFixEdits } from './replaceWithEnvVar';
import { EnvFileGenerator } from './envFileGenerator';
import { GitignoreChecker } from './gitignoreChecker';
import { t } from '../i18n';

/**
 * Envify 的 Quick Fix 提供器。
 *
 * 注册到 Python、JS、TS、JSX、TSX 文件。
 * 当用户点击灯泡或按下 Ctrl+. 时，提供以下选项：
 *   1. "Replace with environment variable" — 完整修复（代码 + .env + .gitignore）
 *   2. "Replace only (skip .env)" — 仅替换代码（适用于已有 env 设置的用户）
 */
export class QuickFixProvider implements vscode.CodeActionProvider {
  static readonly providedCodeActionKinds = [
    vscode.CodeActionKind.QuickFix,
  ];

  async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext,
    _token: vscode.CancellationToken
  ): Promise<vscode.CodeAction[]> {
    const actions: vscode.CodeAction[] = [];

    // 筛选出 Envify 的诊断信息
    const envifyDiagnostics = context.diagnostics.filter(
      d => d.source === 'Envify'
    );

    for (const diagnostic of envifyDiagnostics) {
      const detection: SecretDetection | undefined = (diagnostic as any)._envifyDetection;
      if (!detection) {
        console.log('[Envify] QuickFix: no _envifyDetection found on diagnostic');
        continue;
      }

      const provider = detection.provider;
      const envVarName = provider.envVarName;

      console.log('[Envify] QuickFix: building actions for', envVarName, 'detection:', detection.variableName);

      // Action 1: 完整修复 —— 替换代码 + .env + .gitignore
      const fullFix = new vscode.CodeAction(
        t('quickfix.replaceWithEnv', { varName: envVarName }),
        vscode.CodeActionKind.QuickFix
      );
      fullFix.diagnostics = [diagnostic];
      fullFix.isPreferred = true;

      const workspaceEdit = await this.buildWorkspaceEdit(
        document,
        detection,
        envVarName,
        true,  // include .env
        true   // include .gitignore
      );
      fullFix.edit = workspaceEdit;
      // 不再附加 envify.scanWorkspace 命令，避免每次 Quick Fix 后自动弹出 Dashboard。
      // 文档变更会触发 onDidChangeTextDocument → debounced re-scan → diagnostics 自动更新。

      actions.push(fullFix);

      // Action 2: 仅替换代码（不更新 .env）
      const replaceOnly = new vscode.CodeAction(
        t('quickfix.replaceOnly', { expression: getEnvVarExpression(document.languageId, envVarName) }),
        vscode.CodeActionKind.QuickFix
      );
      replaceOnly.diagnostics = [diagnostic];

      const replaceOnlyEdit = await this.buildWorkspaceEdit(
        document,
        detection,
        envVarName,
        false,  // skip .env
        false   // skip .gitignore
      );
      replaceOnly.edit = replaceOnlyEdit;

      actions.push(replaceOnly);
    }

    console.log('[Envify] QuickFix: returning', actions.length, 'actions');
    return actions;
  }

  /**
   * 为 Quick Fix 构建 WorkspaceEdit。
   *
   * 关键修复：对于新文件（.env / .gitignore），必须使用 edit.createFile() 显式创建，
   * 因为 WorkspaceEdit.set() 不会自动创建不存在的文件。
   */
  private async buildWorkspaceEdit(
    document: vscode.TextDocument,
    detection: SecretDetection,
    envVarName: string,
    includeEnv: boolean,
    includeGitignore: boolean
  ): Promise<vscode.WorkspaceEdit> {
    const edit = new vscode.WorkspaceEdit();
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);

    console.log('[Envify] buildWorkspaceEdit: workspaceFolder =', workspaceFolder?.uri.fsPath ?? 'undefined');
    console.log('[Envify] buildWorkspaceEdit: includeEnv =', includeEnv, ', includeGitignore =', includeGitignore);

    // 1. 智能替换：检测 secret 是否已是 os.getenv() 的默认值 或 process.env 的后备值
    const smartFix = getSmartFixEdits(document, detection, envVarName);
    for (const textEdit of smartFix.edits) {
      // TextEdit.delete → newText is "" → use WorkspaceEdit.delete
      // TextEdit.replace → newText is non-empty → use WorkspaceEdit.replace
      if (textEdit.newText.length === 0) {
        edit.delete(document.uri, textEdit.range);
      } else {
        edit.replace(document.uri, textEdit.range, textEdit.newText);
      }
    }
    console.log(
      '[Envify] buildWorkspaceEdit: added code replacement for',
      document.uri.fsPath,
      smartFix.wasDefaultValue ? '(was default value — removed instead of wrapping)' : ''
    );

    // 2. 为 Python 文件添加 import os（如果缺失）
    //    注意：如果 secret 已是 os.getenv(default) 且删除了默认值，
    //    则 os 模块可能已经 import — getImportOsEdit 会正确处理
    const importEdit = getImportOsEdit(document);
    if (importEdit) {
      edit.insert(document.uri, importEdit.range.start, importEdit.newText);
      console.log('[Envify] buildWorkspaceEdit: added import os');
    }

    // 3. 更新 .env 文件
    if (includeEnv && workspaceFolder) {
      console.log('[Envify] buildWorkspaceEdit: calling envFileGenerator...');
      try {
        const envResult = await EnvFileGenerator.generateEnvEntry(
          workspaceFolder,
          envVarName,
          detection.value
        );
        console.log('[Envify] buildWorkspaceEdit: envResult edits =', envResult.edits.length, ', isNewFile =', envResult.isNewFile);

        if (envResult.edits.length > 0) {
          // 对于新文件，必须先显式创建
          if (envResult.isNewFile) {
            edit.createFile(envResult.uri, { overwrite: false });
            console.log('[Envify] buildWorkspaceEdit: createFile for .env');
          }

          // 应用 TextEdit：insert 和 replace 分别处理
          for (const textEdit of envResult.edits) {
            // 判断是 insert（range 为空）还是 replace（range 非空）
            if (textEdit.range.isEmpty) {
              edit.insert(envResult.uri, textEdit.range.start, textEdit.newText);
            } else {
              edit.replace(envResult.uri, textEdit.range, textEdit.newText);
            }
          }
          console.log('[Envify] buildWorkspaceEdit: applied .env edits to WorkspaceEdit');
        }
      } catch (err) {
        console.error('[Envify] buildWorkspaceEdit: envFileGenerator error:', err);
      }
    } else {
      console.log('[Envify] buildWorkspaceEdit: skipping .env (includeEnv=', includeEnv, ', workspaceFolder=', !!workspaceFolder, ')');
    }

    // 4. 确保 .gitignore 包含 .env
    if (includeGitignore && workspaceFolder) {
      console.log('[Envify] buildWorkspaceEdit: calling gitignoreChecker...');
      try {
        const gitignoreResult = await GitignoreChecker.checkGitignore(workspaceFolder);
        console.log('[Envify] buildWorkspaceEdit: gitignoreResult =', gitignoreResult ? `edits: ${gitignoreResult.edits.length}, isNewFile: ${gitignoreResult.isNewFile}` : 'null');

        if (gitignoreResult && gitignoreResult.edits.length > 0) {
          // 对于新文件，必须先显式创建
          if (gitignoreResult.isNewFile) {
            edit.createFile(gitignoreResult.uri, { overwrite: false });
            console.log('[Envify] buildWorkspaceEdit: createFile for .gitignore');
          }

          // 应用 TextEdit：insert 和 replace 分别处理
          for (const textEdit of gitignoreResult.edits) {
            if (textEdit.range.isEmpty) {
              edit.insert(gitignoreResult.uri, textEdit.range.start, textEdit.newText);
            } else {
              edit.replace(gitignoreResult.uri, textEdit.range, textEdit.newText);
            }
          }
          console.log('[Envify] buildWorkspaceEdit: applied .gitignore edits to WorkspaceEdit');
        }
      } catch (err) {
        console.error('[Envify] buildWorkspaceEdit: gitignoreChecker error:', err);
      }
    } else {
      console.log('[Envify] buildWorkspaceEdit: skipping .gitignore (includeGitignore=', includeGitignore, ', workspaceFolder=', !!workspaceFolder, ')');
    }

    console.log('[Envify] buildWorkspaceEdit: done');
    return edit;
  }
}

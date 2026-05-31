import * as vscode from 'vscode';

/**
 * 确保 .gitignore 中包含 .env 条目。
 *
 * 如果 .gitignore 存在但不包含 .env，则生成追加用的 TextEdit。
 * 如果 .gitignore 不存在，则创建它并以 .env 作为第一条目。
 */
export class GitignoreChecker {
  static readonly ENV_ENTRY = '.env';

  /**
   * 检查 .gitignore 是否包含 .env。
   *
   * @param workspaceFolder 要检查的工作区文件夹
   * @returns 用于将 .env 添加到 .gitignore 的结果，如果已存在则返回 null
   */
  static async checkGitignore(
    workspaceFolder: vscode.WorkspaceFolder
  ): Promise<{ edits: vscode.TextEdit[]; uri: vscode.Uri; isNewFile: boolean } | null> {
    const gitignoreUri = vscode.Uri.joinPath(workspaceFolder.uri, '.gitignore');

    let existingContent = '';
    let isNewFile = false;
    try {
      const existingDoc = await vscode.workspace.openTextDocument(gitignoreUri);
      existingContent = existingDoc.getText();
    } catch {
      // .gitignore 文件尚不存在
      isNewFile = true;
      console.log('[Envify] .gitignore file does not exist, will create new one');
    }

    // 检查 .env 是否已作为独立行在 .gitignore 中（不是作为其他路径的一部分）
    const lines = existingContent.split('\n');
    const hasEnv = lines.some(line => line.trim() === '.env');

    if (hasEnv) {
      console.log('[Envify] .env already in .gitignore, skipping');
      return null; // 已经列出
    }

    const edits: vscode.TextEdit[] = [];

    if (existingContent.length > 0) {
      // 追加到已有 .gitignore 文件末尾
      const needsNewline = !existingContent.endsWith('\n');
      const prefix = needsNewline ? '\n' : '';
      const insertLine = existingContent.split('\n').length;
      edits.push(vscode.TextEdit.insert(
        new vscode.Position(insertLine, 0),
        `${prefix}.env\n`
      ));
    } else {
      // 创建新的 .gitignore 文件
      edits.push(vscode.TextEdit.insert(
        new vscode.Position(0, 0),
        '.env\n'
      ));
    }

    console.log('[Envify] gitignoreChecker: generated', edits.length, 'edits, isNewFile:', isNewFile);
    return { edits, uri: gitignoreUri, isNewFile };
  }
}

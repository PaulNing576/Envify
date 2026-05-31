import * as vscode from 'vscode';

/**
 * 管理 .env 文件的创建和更新。
 *
 * 确保工作区根目录存在 .env 文件，并包含指定的环境变量条目。
 * 如果文件不存在则创建；如果变量已存在则更新其值。
 */
export class EnvFileGenerator {
  /**
   * 生成添加或更新 .env 文件中环境变量的 TextEdit。
   *
   * @param workspaceFolder 包含 .env 文件的工作区文件夹
   * @param varName 环境变量名（例如 "OPENAI_API_KEY"）
   * @param value 要写入的密钥值
   * @returns 包含 TextEdit 数组和 URI 的结果，以及文件是否为新文件
   */
  static async generateEnvEntry(
    workspaceFolder: vscode.WorkspaceFolder,
    varName: string,
    value: string
  ): Promise<{ edits: vscode.TextEdit[]; uri: vscode.Uri; isNewFile: boolean }> {
    const envUri = vscode.Uri.joinPath(workspaceFolder.uri, '.env');

    let existingContent = '';
    let isNewFile = false;
    try {
      const existingDoc = await vscode.workspace.openTextDocument(envUri);
      existingContent = existingDoc.getText();
    } catch {
      // .env 文件尚不存在
      isNewFile = true;
      console.log('[Envify] .env file does not exist, will create new one');
    }

    const edits: vscode.TextEdit[] = [];

    // 检查变量是否已存在于 .env 中
    const regex = new RegExp(`^${escapeRegex(varName)}=.*$`, 'm');
    const match = regex.exec(existingContent);

    if (match) {
      // 更新已有行
      const startPos = positionFromOffset(existingContent, match.index);
      const endPos = positionFromOffset(existingContent, match.index + match[0].length);

      edits.push(vscode.TextEdit.replace(
        new vscode.Range(startPos, endPos),
        `${varName}=${value}`
      ));
    } else if (existingContent.length > 0) {
      // 追加到已有 .env 文件末尾
      const needsNewline = !existingContent.endsWith('\n');
      const prefix = needsNewline ? '\n' : '';
      const insertLine = existingContent.split('\n').length;
      edits.push(vscode.TextEdit.insert(
        new vscode.Position(insertLine, 0),
        `${prefix}${varName}=${value}\n`
      ));
    } else {
      // 创建新的 .env 文件
      edits.push(vscode.TextEdit.insert(
        new vscode.Position(0, 0),
        `${varName}=${value}\n`
      ));
    }

    console.log('[Envify] envFileGenerator: generated', edits.length, 'edits, isNewFile:', isNewFile);
    return { edits, uri: envUri, isNewFile };
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function positionFromOffset(text: string, offset: number): vscode.Position {
  const before = text.slice(0, offset);
  const lines = before.split('\n');
  return new vscode.Position(lines.length - 1, lines[lines.length - 1].length);
}

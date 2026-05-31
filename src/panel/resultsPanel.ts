import * as vscode from 'vscode';
import { WorkspaceScanResult, FileDetection } from '../scanner/workspaceScanner';
import { t } from '../i18n';

/**
 * 扫描结果面板（WebviewPanel）。
 *
 * 显示工作区扫描的统计摘要和详细结果表格。
 * 提供 [Fix All] 按钮 —— 通过 postMessage 通知扩展执行批量修复。
 */
export class ResultsPanel {
  /** 当前打开的 Panel 实例（单例模式） */
  private static currentPanel: ResultsPanel | undefined;

  /** 面板引用 */
  private readonly panel: vscode.WebviewPanel;
  /** 清理 disposable */
  private readonly disposables: vscode.Disposable[] = [];

  /** 扫描结果数据 */
  private scanResult: WorkspaceScanResult;

  private constructor(
    scanResult: WorkspaceScanResult,
    private readonly onFixAll: () => void
  ) {
    this.scanResult = scanResult;

    this.panel = vscode.window.createWebviewPanel(
      'envifyResults',
      t('panel.title'),
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,       // 允许 JavaScript（Fix All 按钮需要）
        retainContextWhenHidden: true,
        localResourceRoots: [],
      }
    );

    this.panel.webview.html = this.buildHtml();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // 监听 Webview 消息
    this.panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case 'fixAll':
            this.onFixAll();
            // 更新面板状态
            this.panel.webview.postMessage({ command: 'fixInProgress' });
            return;
          case 'close':
            this.panel.dispose();
            return;
        }
      },
      null,
      this.disposables
    );
  }

  /**
   * 打开或复用结果面板。
   */
  static show(scanResult: WorkspaceScanResult, onFixAll: () => void): void {
    if (ResultsPanel.currentPanel) {
      // 复用已有面板：更新数据并刷新 HTML
      ResultsPanel.currentPanel.scanResult = scanResult;
      ResultsPanel.currentPanel.panel.webview.html = ResultsPanel.currentPanel.buildHtml();
      ResultsPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    ResultsPanel.currentPanel = new ResultsPanel(scanResult, onFixAll);
  }

  /**
   * 通知面板修复已完成。
   */
  static notifyFixComplete(): void {
    if (ResultsPanel.currentPanel) {
      ResultsPanel.currentPanel.panel.webview.postMessage({ command: 'fixComplete' });
      // 延迟关闭面板，让用户看到成功提示
      setTimeout(() => {
        ResultsPanel.currentPanel?.panel.dispose();
      }, 2000);
    }
  }

  /**
   * 构建面板 HTML。
   */
  private buildHtml(): string {
    const { filesScanned, detections, summary } = this.scanResult;
    const totalSecrets = detections.reduce((s, d) => s + d.secrets.length, 0);

    const summaryRows = summary
      .map(s => `<tr><td>${escapeHtml(s.providerName)}</td><td>${s.count}</td></tr>`)
      .join('');

    const detailRows = detections
      .flatMap(fd => fd.secrets.map(s => ({ fileDetection: fd, secret: s })))
      .map(({ fileDetection, secret }) => {
        const filePath = fileDetection.relativePath;
        const lineNum = secret.range.startLine + 1; // 转为 1-based
        const provider = secret.provider.name;
        const envVar = secret.provider.envVarName;
        const maskedValue = maskValue(secret.value);
        return `<tr>
          <td class="file-cell">${escapeHtml(filePath)}</td>
          <td>${lineNum}</td>
          <td>${escapeHtml(provider)}</td>
          <td><code>${escapeHtml(envVar)}</code></td>
          <td class="value-cell">${escapeHtml(maskedValue)}</td>
        </tr>`;
      })
      .join('');

    const lang = vscode.env.language.startsWith('zh') ? 'zh-CN' : 'en';

    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(t('panel.title'))}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--vscode-font-family, -apple-system, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      padding: 20px;
    }
    .header { margin-bottom: 20px; }
    .header h1 { font-size: 20px; margin-bottom: 4px; }
    .header .subtitle { color: var(--vscode-descriptionForeground); font-size: 12px; }
    .stats {
      display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap;
    }
    .stat-card {
      background: var(--vscode-textBlockQuote-background);
      border-radius: 6px; padding: 12px 16px; min-width: 120px;
    }
    .stat-card .number { font-size: 28px; font-weight: 700; color: var(--vscode-charts-yellow); }
    .stat-card .label { font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 2px; }
    .stat-card.danger .number { color: var(--vscode-errorForeground); }
    .stat-card.success .number { color: var(--vscode-charts-green); }
    .actions { display: flex; gap: 8px; margin-bottom: 20px; }
    button {
      padding: 8px 20px; border: none; border-radius: 4px; cursor: pointer;
      font-size: 13px; font-weight: 600; transition: opacity 0.15s;
    }
    button:hover { opacity: 0.85; }
    .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
    .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .section-title { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
    table {
      width: 100%; border-collapse: collapse; margin-bottom: 20px;
      font-size: 12px;
    }
    th, td {
      text-align: left; padding: 6px 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    th {
      font-weight: 600; color: var(--vscode-descriptionForeground);
      text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;
    }
    .file-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .value-cell { font-family: monospace; font-size: 11px; color: var(--vscode-descriptionForeground); }
    code { font-family: var(--vscode-editor-font-family, monospace); }
    .empty-state { text-align: center; padding: 40px; color: var(--vscode-descriptionForeground); }
    .toast {
      position: fixed; top: 16px; right: 16px; padding: 12px 24px;
      border-radius: 6px; font-weight: 600; display: none; z-index: 100;
    }
    .toast.success { background: var(--vscode-charts-green); color: #fff; }
    .toast.show { display: block; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(t('panel.title'))}</h1>
    <div class="subtitle">${escapeHtml(t('panel.subtitle'))}</div>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="number">${filesScanned}</div>
      <div class="label">${escapeHtml(t('panel.filesScanned'))}</div>
    </div>
    <div class="stat-card danger">
      <div class="number">${totalSecrets}</div>
      <div class="label">${escapeHtml(t('panel.secretsFound'))}</div>
    </div>
    ${summary.slice(0, 4).map(s =>
      `<div class="stat-card">
        <div class="number">${s.count}</div>
        <div class="label">${escapeHtml(s.providerName)}</div>
      </div>`
    ).join('')}
  </div>

  <div class="actions">
    <button class="btn-primary" id="btn-fix-all" onclick="fixAll()"
      ${totalSecrets === 0 ? 'disabled' : ''}>
      ${escapeHtml(t('panel.fixAllBtn', { count: totalSecrets }))}
    </button>
    <button class="btn-secondary" onclick="closePanel()">${escapeHtml(t('panel.closeBtn'))}</button>
  </div>

  ${totalSecrets === 0 ? `
    <div class="empty-state">
      <p style="font-size: 48px;">🎉</p>
      <p style="font-size: 16px; font-weight: 600;">${escapeHtml(t('panel.allClean.title'))}</p>
      <p>${escapeHtml(t('panel.allClean.subtitle'))}</p>
    </div>
  ` : `
    <div class="section-title">${escapeHtml(t('panel.detailTitle'))}</div>
    <table>
      <thead>
        <tr>
          <th>${escapeHtml(t('panel.table.file'))}</th>
          <th>${escapeHtml(t('panel.table.line'))}</th>
          <th>${escapeHtml(t('panel.table.type'))}</th>
          <th>${escapeHtml(t('panel.table.envVar'))}</th>
          <th>${escapeHtml(t('panel.table.value'))}</th>
        </tr>
      </thead>
      <tbody>
        ${detailRows}
      </tbody>
    </table>
  `}

  <div id="toast" class="toast"></div>

  <script>
    const vscode = acquireVsCodeApi();

    function fixAll() {
      const btn = document.getElementById('btn-fix-all');
      btn.disabled = true;
      btn.textContent = '修复中...';
      vscode.postMessage({ command: 'fixAll' });
    }

    function closePanel() {
      vscode.postMessage({ command: 'close' });
    }

    // 监听来自扩展的消息
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'fixComplete') {
        showToast('${t('panel.toast.fixComplete')}');
      } else if (message.command === 'fixInProgress') {
        showToast('${t('panel.toast.fixing')}');
      }
    });

    function showToast(msg) {
      const toast = document.getElementById('toast');
      toast.textContent = msg;
      toast.className = 'toast success show';
      setTimeout(() => { toast.className = 'toast'; }, 3000);
    }
  </script>
</body>
</html>`;
  }

  private dispose(): void {
    ResultsPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()!.dispose();
    }
  }
}

/** HTML 转义 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 掩码显示密钥值 */
function maskValue(value: string): string {
  if (value.length <= 8) return value.slice(0, 2) + '***';
  return value.slice(0, 4) + '***' + value.slice(-4);
}

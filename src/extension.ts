import * as vscode from 'vscode';
import { ParserRegistry } from './parser/parserRegistry';
import { PatternRegistry } from './patterns/patternRegistry';
import { ApiProvider } from './patterns/provider';
import { DiagnosticEmitter } from './diagnostics/diagnosticEmitter';
import { ScanEngine, ScanConfig } from './scanner/scanEngine';
import { WorkspaceScanner, WorkspaceScanResult } from './scanner/workspaceScanner';
import { ResultsPanel } from './panel/resultsPanel';
import { FixAllService } from './services/fixAllService';
import { QuickFixProvider } from './codeActions/quickFixProvider';
import { createClearableDebouncer } from './scanner/debounce';
import { setupEnvFileWatcher } from './watchers/envFileWatcher';
import { setupGitignoreWatcher } from './watchers/gitignoreWatcher';
import { getScanConfig, isEnabled } from './config/settings';
import { t } from './i18n';

// ── 全局状态 ──────────────────────────────────────────────────────────────────

let scanEngine: ScanEngine;
let parserRegistry: ParserRegistry;
let patternRegistry: PatternRegistry;
let diagnosticEmitter: DiagnosticEmitter;
let statusBarItem: vscode.StatusBarItem;
let debouncer: { debounce: (key: string, arg: vscode.TextDocument) => void; clear: () => void };
let lastScanResult: WorkspaceScanResult | null = null;

// ── 激活 ──────────────────────────────────────────────────────────────────────

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log(`[Envify] ${t('activation.start')}`);

  // 1. 初始化核心服务
  parserRegistry = new ParserRegistry(context);
  diagnosticEmitter = new DiagnosticEmitter();
  patternRegistry = new PatternRegistry(getScanConfig().entropyThreshold);
  syncCustomPatterns();
  scanEngine = new ScanEngine(parserRegistry, patternRegistry, diagnosticEmitter);

  // 2. 初始化 tree-sitter（异步，非阻塞）
  parserRegistry.init().catch(err => {
    console.warn(`[Envify] ${t('activation.treeSitterFailed')}:`, err);
  });

  // 3. 注册事件处理器
  debouncer = createClearableDebouncer<vscode.TextDocument>(
    (_key: string, document: vscode.TextDocument) => {
      const config = getScanConfig();
      scanEngine.scanDocument(document, config);
    },
    500
  );

  context.subscriptions.push(
    vscode.workspace.onDidOpenTextDocument(async (document) => {
      if (!isEnabled()) { return; }
      const config = getScanConfig();
      await scanEngine.scanDocument(document, config);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (!isEnabled()) { return; }
      debouncer.debounce(event.document.uri.toString(), event.document);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (document) => {
      if (!isEnabled()) { return; }
      const config = getScanConfig();
      await scanEngine.scanDocument(document, config);
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('envify')) {
        console.log('[Envify] 配置变更，重新扫描...');
        syncCustomPatterns();
        patternRegistry.setEntropyThreshold(getScanConfig().entropyThreshold);
        scanEngine.scanAllOpenDocuments(getScanConfig());
      }
    })
  );

  // 4. 注册 Quick Fix Provider
  const quickFixLanguages = [
    'python', 'javascript', 'typescript', 'typescriptreact', 'javascriptreact',
  ];
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      quickFixLanguages.map(lang => ({ scheme: 'file', language: lang })),
      new QuickFixProvider(),
      { providedCodeActionKinds: QuickFixProvider.providedCodeActionKinds }
    )
  );

  // 5. 注册命令

  // ── 命令 1：全工作区扫描 ──
  context.subscriptions.push(
    vscode.commands.registerCommand('envify.scanWorkspace', async () => {
      if (!isEnabled()) {
        vscode.window.showInformationMessage(t('scan.disabled'));
        return;
      }

      const scanResult = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: t('scan.progress'),
          cancellable: true,
        },
        async (progress, token) => {
          const config = getScanConfig();
          const result = await WorkspaceScanner.scanWorkspace(scanEngine, config, progress);
          if (token.isCancellationRequested) { return null; }
          return result;
        }
      );

      if (!scanResult) { return; }
      lastScanResult = scanResult;
      const totalSecrets = scanResult.detections.reduce((s, d) => s + d.secrets.length, 0);
      updateStatusBarFromResult(scanResult);

      ResultsPanel.show(scanResult, () => {
        vscode.commands.executeCommand('envify.fixAllSecrets');
      });

      if (totalSecrets > 0) {
        vscode.window.showInformationMessage(
          t('scan.result', { files: scanResult.filesScanned, secrets: totalSecrets }),
          t('menu.viewResults.desc'),
          t('fixAll.confirm.button')
        ).then(selection => {
          if (selection === t('fixAll.confirm.button')) {
            vscode.commands.executeCommand('envify.fixAllSecrets');
          }
        });
      } else {
        vscode.window.showInformationMessage(
          t('scan.noSecrets', { files: scanResult.filesScanned })
        );
      }
    })
  );

  // ── 命令 2：Fix All Secrets ──
  context.subscriptions.push(
    vscode.commands.registerCommand('envify.fixAllSecrets', async () => {
      if (!lastScanResult) {
        vscode.window.showWarningMessage(t('fixAll.needScanFirst'));
        return;
      }

      const totalSecrets = lastScanResult.detections.reduce((s, d) => s + d.secrets.length, 0);
      if (totalSecrets === 0) {
        vscode.window.showInformationMessage(t('fixAll.noResults'));
        return;
      }

      const confirm = await vscode.window.showWarningMessage(
        t('fixAll.confirm.title', { count: totalSecrets }) + '\n\n' + t('fixAll.confirm.body'),
        { modal: true },
        t('fixAll.confirm.button')
      );

      if (confirm !== t('fixAll.confirm.button')) { return; }

      const fixResult = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: t('fixAll.progress'),
          cancellable: false,
        },
        async () => await FixAllService.fixAll(lastScanResult!)
      );

      if (fixResult.success) {
        ResultsPanel.notifyFixComplete();
        updateStatusBar();
        vscode.window.showInformationMessage(
          t('fixAll.success', { fixed: fixResult.fixedCount, envVars: fixResult.envVarsAdded })
        );
      } else {
        vscode.window.showErrorMessage(t('fixAll.failed'));
      }
    })
  );

  // ── 命令 3：Quick Menu（工具栏按钮）──
  context.subscriptions.push(
    vscode.commands.registerCommand('envify.quickMenu', async () => {
      const items: vscode.QuickPickItem[] = [
        {
          label: t('menu.scanWorkspace'),
          description: t('menu.scanWorkspace.desc'),
          detail: t('menu.scanWorkspace.detail'),
        },
        {
          label: t('menu.fixAll'),
          description: t('menu.fixAll.desc'),
          detail: t('menu.fixAll.detail'),
        },
        {
          label: t('menu.viewResults'),
          description: t('menu.viewResults.desc'),
          detail: lastScanResult
            ? t('menu.viewResults.data', { count: lastScanResult.detections.reduce((s, d) => s + d.secrets.length, 0) })
            : t('menu.viewResults.noData'),
        },
        {
          label: t('menu.settings'),
          description: t('menu.settings.desc'),
        },
      ];

      const selection = await vscode.window.showQuickPick(items, {
        placeHolder: t('menu.placeholder'),
        matchOnDescription: true,
        matchOnDetail: true,
      });

      if (!selection) { return; }

      if (selection.label.includes('$(search)')) {
        vscode.commands.executeCommand('envify.scanWorkspace');
      } else if (selection.label.includes('$(zap)')) {
        vscode.commands.executeCommand('envify.fixAllSecrets');
      } else if (selection.label.includes('$(list-tree)')) {
        if (lastScanResult) {
          ResultsPanel.show(lastScanResult, () => vscode.commands.executeCommand('envify.fixAllSecrets'));
        } else {
          vscode.window.showInformationMessage(t('fixAll.needScanFirst'));
        }
      } else if (selection.label.includes('$(gear)')) {
        // 打开 VS Code 设置并搜索 envify
        // 注意：F5 开发模式下 @ext: 过滤器可能不生效，使用纯文本搜索
        vscode.commands.executeCommand('workbench.action.openSettings', { query: 'envify' });
      }
    })
  );

  // ── 命令 4：生成 .env 文件 ──
  context.subscriptions.push(
    vscode.commands.registerCommand('envify.generateEnvFile', async () => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        vscode.window.showErrorMessage(t('envfile.noWorkspace'));
        return;
      }
      const envUri = vscode.Uri.joinPath(workspaceFolder.uri, '.env');
      try {
        await vscode.workspace.fs.stat(envUri);
        vscode.window.showInformationMessage(t('envfile.alreadyExists'));
      } catch {
        await vscode.workspace.fs.writeFile(envUri, Buffer.from('# 环境变量 / Environment Variables\n'));
        const doc = await vscode.workspace.openTextDocument(envUri);
        await vscode.window.showTextDocument(doc);
      }
    })
  );

  // ── 命令 5：忽略当前 Secret ──
  context.subscriptions.push(
    vscode.commands.registerCommand('envify.ignoreSecret', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { return; }
      const line = editor.selection.active.line;
      const suppressComment = getSuppressComment(editor.document.languageId);
      await editor.edit(editBuilder => {
        editBuilder.insert(new vscode.Position(line, 0), suppressComment + '\n');
      });
    })
  );

  // 6. 设置文件监听器
  context.subscriptions.push(setupEnvFileWatcher(scanEngine, getScanConfig));
  context.subscriptions.push(setupGitignoreWatcher());

  // 7. 状态栏
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBarItem.command = 'envify.scanWorkspace';
  statusBarItem.text = t('statusBar.clean');
  statusBarItem.tooltip = t('statusBar.tooltip');
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  if (isEnabled()) {
    scanEngine.scanAllOpenDocuments(getScanConfig()).then(() => updateStatusBar());
  }

  console.log(`[Envify] ${t('activation.complete')}`);
}

// ── 停用 ──────────────────────────────────────────────────────────────────────

export function deactivate(): void {
  console.log('[Envify] Deactivating...');
  debouncer?.clear();
  diagnosticEmitter?.dispose();
  parserRegistry?.dispose();
  statusBarItem?.dispose();
}

// ── 辅助函数 ─────────────────────────────────────────────────────────────────

function updateStatusBar(): void {
  if (!statusBarItem) { return; }
  const collection = diagnosticEmitter.getCollection();
  let totalSecrets = 0;
  collection.forEach((_uri, diagnostics) => { totalSecrets += diagnostics.length; });
  if (totalSecrets > 0) {
    statusBarItem.text = t('statusBar.warning', { count: totalSecrets });
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else {
    statusBarItem.text = t('statusBar.clean');
    statusBarItem.backgroundColor = undefined;
  }
}

function updateStatusBarFromResult(result: WorkspaceScanResult): void {
  if (!statusBarItem) { return; }
  const totalSecrets = result.detections.reduce((s, d) => s + d.secrets.length, 0);
  if (totalSecrets > 0) {
    statusBarItem.text = t('statusBar.warning', { count: totalSecrets });
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
  } else {
    statusBarItem.text = t('statusBar.clean');
    statusBarItem.backgroundColor = undefined;
  }
}

function syncCustomPatterns(): void {
  const config = vscode.workspace.getConfiguration('envify');
  const customPatterns = config.get<any[]>('customPatterns', []);
  // 防御：万一配置返回了非数组值（例如用户手动编辑 settings.json 写错了类型）
  if (!Array.isArray(customPatterns)) {
    console.warn('[Envify] customPatterns 配置不是数组，已忽略');
    patternRegistry.setCustomProviders([]);
    return;
  }
  const customProviders: ApiProvider[] = customPatterns.map((p, i) => {
    let regex: RegExp;
    try {
      regex = new RegExp(p.regex);
    } catch (err) {
      vscode.window.showWarningMessage(`Envify: 自定义模式 "${p.name || `#${i}`}" 正则无效: ${err}`);
      regex = /(?!)/;
    }
    return {
      name: p.name || `Custom-${i}`,
      diagnosticCode: `envify.custom-${i}`,
      envVarName: p.envVarName || 'CUSTOM_SECRET',
      patterns: [regex],
      minLength: 8,
    };
  });
  patternRegistry.setCustomProviders(customProviders);
}

function getSuppressComment(languageId: string): string {
  switch (languageId) {
    case 'python': return '# envify:ignore-next-line';
    case 'javascript':
    case 'typescript':
    case 'javascriptreact':
    case 'typescriptreact': return '// envify:ignore-next-line';
    default: return '# envify:ignore-next-line';
  }
}

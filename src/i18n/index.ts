import * as vscode from 'vscode';
import * as zhCN from '../../i18n/zh-cn.json';
import * as en from '../../i18n/en.json';

/**
 * Envify i18n 国际化模块。
 *
 * 根据 VS Code 的显示语言自动选择翻译文件。
 * 使用 `t('key', { var1: 'value1' })` 获取翻译文本。
 * 支持 `{variable}` 占位符替换。
 *
 * 添加新语言：
 *   1. 在 i18n/ 目录创建翻译 JSON 文件
 *   2. 在此文件中 import 并注册到 translations map
 */
type TranslationMap = Record<string, string>;

const translations: Record<string, TranslationMap> = {
  'zh-cn': zhCN as TranslationMap,
  'en': en as TranslationMap,
};

/**
 * 获取当前实际使用的语言代码。
 * 优先读取 envify.language 设置，若为 "auto" 则跟随 VS Code 界面语言。
 */
function getEffectiveLanguage(): string {
  const config = vscode.workspace.getConfiguration('envify');
  const setting = config.get<string>('language', 'auto');

  if (setting === 'auto') {
    return vscode.env.language.toLowerCase();
  }
  return setting.toLowerCase();
}

/**
 * 获取当前语言对应的翻译映射。
 * 默认回退到英文。
 */
function getCurrentTranslations(): TranslationMap {
  const locale = getEffectiveLanguage();

  // 精确匹配优先
  if (translations[locale]) {
    return translations[locale];
  }

  // 短代码匹配（zh-cn, zh-tw, zh → zh-cn; en, en-us → en）
  const shortCode = locale.split('-')[0];
  for (const [key, value] of Object.entries(translations)) {
    if (key.startsWith(shortCode)) {
      return value;
    }
  }

  // 回退到英文
  return translations['en'] || {};
}

/**
 * 获取翻译文本。
 *
 * @param key 翻译键
 * @param params 占位符替换参数，例如 `{ count: 5 }` 替换 `{count}`
 * @returns 翻译后的文本
 *
 * @example
 *   t('scan.result', { files: 10, secrets: 3 })
 *   // → "在 10 个文件中发现 3 个 Secret"
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const map = getCurrentTranslations();
  let text = map[key];

  if (text === undefined) {
    // 回退到英文翻译
    const enMap = translations['en'] || {};
    text = enMap[key];
  }

  if (text === undefined) {
    // 最终回退：返回 key 本身
    console.warn(`[Envify] 缺少翻译键: ${key}`);
    return key;
  }

  // 替换占位符 {varName}
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
    }
  }

  return text;
}

/**
 * 获取当前语言代码。
 */
export function getCurrentLanguage(): string {
  return vscode.env.language.toLowerCase();
}

/**
 * 检查当前是否为简体中文环境。
 */
export function isZhCN(): boolean {
  const lang = getCurrentLanguage();
  return lang === 'zh-cn' || lang === 'zh';
}

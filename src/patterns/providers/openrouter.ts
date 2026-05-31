import { ApiProvider } from '../provider';

/**
 * OpenRouter API Key 模式。
 *
 * OpenRouter 提供对多种 LLM 的统一 API 访问。
 * Key 以 sk-or- 开头。
 *
 * 参考：https://openrouter.ai/docs/api-reference/authentication
 */
export const openrouterProvider: ApiProvider = {
  name: 'OpenRouter',
  diagnosticCode: 'envify.openrouter-key',
  envVarName: 'OPENROUTER_API_KEY',
  prefixHint: 'sk-or-',
  minLength: 35,
  patterns: [
    // sk-or-v1- 后面跟 32+ 位 base64 字符
    /^sk-or-v1-[A-Za-z0-9_-]{32,}$/,
    // sk-or- 后面跟 32+ 位字符（兼容旧格式）
    /^sk-or-[A-Za-z0-9_-]{32,}$/,
  ],
};

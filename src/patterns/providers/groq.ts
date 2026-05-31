import { ApiProvider } from '../provider';

/**
 * Groq API Key 模式。
 *
 * Groq 提供高速 LLM 推理服务。
 * Key 以 gsk_ 开头。
 *
 * 参考：https://console.groq.com/docs/authentication
 */
export const groqProvider: ApiProvider = {
  name: 'Groq',
  diagnosticCode: 'envify.groq-key',
  envVarName: 'GROQ_API_KEY',
  prefixHint: 'gsk_',
  minLength: 30,
  patterns: [
    // gsk_ 后面跟 30+ 位字母数字字符
    /^gsk_[A-Za-z0-9]{30,}$/,
  ],
};

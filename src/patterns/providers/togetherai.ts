import { ApiProvider } from '../provider';

/**
 * Together AI API Key 模式。
 *
 * Together AI 提供开源模型的推理服务。
 * Key 格式多样，常见模式包括较长的字母数字字符串。
 *
 * 参考：https://docs.together.ai/docs/introduction
 */
export const togetheraiProvider: ApiProvider = {
  name: 'Together AI',
  diagnosticCode: 'envify.togetherai-key',
  envVarName: 'TOGETHER_API_KEY',
  minLength: 32,
  patterns: [
    // 常见格式：32 位以上的字母数字字符串（可能含 - 和 _）
    /^[A-Za-z0-9_-]{32,}$/,
  ],
};

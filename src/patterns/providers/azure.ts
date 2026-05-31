import { ApiProvider } from '../provider';

/**
 * Azure / Azure OpenAI API Key 模式。
 *
 * Azure API Key 通常是 32 位 hex 字符串。
 * 以通用的 32 位 hex 模式匹配，通过变量名上下文（如 AZURE_OPENAI_KEY）提高准确度。
 *
 * 参考：https://learn.microsoft.com/en-us/azure/ai-services/openai/
 */
export const azureProvider: ApiProvider = {
  name: 'Azure',
  diagnosticCode: 'envify.azure-key',
  envVarName: 'AZURE_OPENAI_KEY',
  minLength: 32,
  patterns: [
    // 32 位 hex 字符串
    /^[a-f0-9]{32}$/i,
  ],
};

import { ApiProvider } from '../provider';

/**
 * DeepSeek API Key patterns.
 *
 * DeepSeek keys start with sk- followed by 32 lowercase hex characters.
 *
 * References:
 *   https://platform.deepseek.com/api-docs
 */
export const deepseekProvider: ApiProvider = {
  name: 'DeepSeek',
  diagnosticCode: 'envify.deepseek-key',
  envVarName: 'DEEPSEEK_API_KEY',
  prefixHint: 'sk-',
  minLength: 34,
  patterns: [
    // sk- followed by 32 lowercase hex characters
    /^sk-[a-f0-9]{32}$/,
  ],
};

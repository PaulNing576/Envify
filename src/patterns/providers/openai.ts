import { ApiProvider } from '../provider';

/**
 * OpenAI API Key patterns.
 *
 * OpenAI has several key formats:
 *   - Standard: sk-... (legacy, 20+ alphanumeric after sk-)
 *   - Project v2: sk-proj-... (32+ chars after prefix)
 *   - Service Account: sk-svcacct-...
 *   - Admin: sk-admin-...
 *
 * References:
 *   https://platform.openai.com/docs/api-reference/authentication
 */
export const openaiProvider: ApiProvider = {
  name: 'OpenAI',
  diagnosticCode: 'envify.openai-key',
  envVarName: 'OPENAI_API_KEY',
  prefixHint: 'sk-',
  minLength: 25,
  patterns: [
    // Project key v2: sk-proj- followed by 32+ alphanumeric, dash, underscore
    /^sk-proj-[A-Za-z0-9_-]{32,}$/,
    // Service account: sk-svcacct- followed by 32+ alphanumeric, dash, underscore
    /^sk-svcacct-[A-Za-z0-9_-]{32,}$/,
    // Admin key: sk-admin- followed by 32+ alphanumeric, dash, underscore
    /^sk-admin-[A-Za-z0-9_-]{32,}$/,
    // Standard/legacy key: sk- (NOT followed by ant- or or-) followed by 20+ characters
    // Using negative lookahead to exclude Anthropic (sk-ant-) and OpenRouter (sk-or-)
    /^sk-(?!ant-)(?!or-)[A-Za-z0-9_-]{20,}$/,
  ],
};

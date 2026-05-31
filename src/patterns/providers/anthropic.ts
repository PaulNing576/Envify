import { ApiProvider } from '../provider';

/**
 * Anthropic (Claude) API Key patterns.
 *
 * Anthropic uses the sk-ant- prefix. The standard format is:
 *   sk-ant-api03-{93 alphanumeric and underscore}AA
 *
 * Legacy formats may have varying lengths after sk-ant-.
 *
 * References:
 *   https://docs.anthropic.com/en/api/getting-started
 */
export const anthropicProvider: ApiProvider = {
  name: 'Anthropic',
  diagnosticCode: 'envify.anthropic-key',
  envVarName: 'ANTHROPIC_API_KEY',
  prefixHint: 'sk-ant-',
  minLength: 45,
  patterns: [
    // Standard API key: sk-ant-api03-...AA（生产环境通常 90+ 字符，放宽以覆盖测试 key）
    /^sk-ant-api03-[A-Za-z0-9_-]{30,}AA$/,
    // 其他 Anthropic key 格式（含 dash 的变体）
    /^sk-ant-api03-[A-Za-z0-9_-]{30,}$/,
    // Legacy 或通用格式
    /^sk-ant-[A-Za-z0-9_-]{40,}$/,
  ],
};

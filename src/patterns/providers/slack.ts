import { ApiProvider } from '../provider';

/**
 * Slack Bot Token / Signing Secret 模式。
 *
 * Slack 有多种 token 格式：
 *   - Bot token: xoxb-...
 *   - User token: xoxp-...
 *   - App token: xoxa-...
 *   - Signing Secret: 32 位 hex
 *
 * 参考：https://api.slack.com/authentication
 */
export const slackProvider: ApiProvider = {
  name: 'Slack',
  diagnosticCode: 'envify.slack-key',
  envVarName: 'SLACK_BOT_TOKEN',
  prefixHint: 'xox',
  minLength: 32,
  patterns: [
    // Bot / User / App tokens
    /^xox[bpa]-[0-9]+-[0-9]+-[A-Za-z0-9]+$/,
    // Signing Secret: 32 位 hex
    /^[a-f0-9]{32}$/i,
  ],
};

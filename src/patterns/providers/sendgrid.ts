import { ApiProvider } from '../provider';

/**
 * SendGrid API Key 模式。
 *
 * SendGrid key 以 SG. 开头。
 *
 * 参考：https://docs.sendgrid.com/ui/account-and-settings/api-keys
 */
export const sendgridProvider: ApiProvider = {
  name: 'SendGrid',
  diagnosticCode: 'envify.sendgrid-key',
  envVarName: 'SENDGRID_API_KEY',
  prefixHint: 'SG.',
  minLength: 40,
  patterns: [
    /^SG\.[A-Za-z0-9_-]{40,}$/,
  ],
};

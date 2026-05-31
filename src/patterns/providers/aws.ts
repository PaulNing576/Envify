import { ApiProvider } from '../provider';

/**
 * AWS Access Key / Secret Key 模式。
 *
 * AWS 密钥格式：
 *   - Access Key ID: AKIA... 或 ASIA...（20 位字母数字）
 *   - Secret Access Key: 40 位字母数字 + / + 特殊字符
 *
 * 参考：https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html
 */
export const awsProvider: ApiProvider = {
  name: 'AWS',
  diagnosticCode: 'envify.aws-key',
  envVarName: 'AWS_ACCESS_KEY_ID',
  prefixHint: 'AKIA',
  minLength: 20,
  patterns: [
    // Access Key ID: AKIA + 16 位字母数字
    /^AKIA[A-Z0-9]{16}$/,
    // 临时凭证: ASIA + 16 位字母数字
    /^ASIA[A-Z0-9]{16}$/,
    // Secret Access Key: 40 位混合字符
    /^[A-Za-z0-9\/+]{40}$/,
  ],
};

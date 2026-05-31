import { SecretDetection } from '../patterns/provider';
import { t } from '../i18n';

/**
 * 掩码显示密钥值，防止完整密钥在诊断信息中泄露。
 */
export function maskSecret(value: string): string {
  if (value.length <= 8) {
    return value.slice(0, 2) + '***' + value.slice(-2);
  }
  return value.slice(0, 4) + '***' + value.slice(-4);
}

/**
 * 格式化检测到的 Secret 的诊断信息。
 */
export function formatDiagnosticMessage(detection: SecretDetection): string {
  const { provider, variableName, confidence } = detection;
  const maskedValue = maskSecret(detection.value);

  const key = confidence === 'high'
    ? 'diagnostic.format'
    : 'diagnostic.format.possible';

  return t(key, {
    provider: provider.name,
    var: variableName,
    value: maskedValue,
    envVar: provider.envVarName,
  });
}

/**
 * 格式化悬停消息。
 */
export function formatHoverMessage(detection: SecretDetection): string {
  const { provider, variableName } = detection;
  const maskedValue = maskSecret(detection.value);

  return t('diagnostic.hover', {
    provider: provider.name,
    var: variableName,
    value: maskedValue,
    envVar: provider.envVarName,
  });
}

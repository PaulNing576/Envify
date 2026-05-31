import { ApiProvider } from '../provider';

/**
 * Replicate API Token 模式。
 *
 * Replicate 提供模型托管和推理服务。
 * Token 以 r8_ 开头。
 *
 * 参考：https://replicate.com/docs/reference/http#authentication
 */
export const replicateProvider: ApiProvider = {
  name: 'Replicate',
  diagnosticCode: 'envify.replicate-key',
  envVarName: 'REPLICATE_API_TOKEN',
  prefixHint: 'r8_',
  minLength: 40,
  patterns: [
    // r8_ 后面跟 40+ 位字母数字字符
    /^r8_[A-Za-z0-9]{40,}$/,
  ],
};

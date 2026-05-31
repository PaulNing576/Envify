import { ApiProvider } from '../provider';

/**
 * Pinecone API Key 模式。
 *
 * Pinecone 是向量数据库服务。
 * Key 格式为 UUID v4 风格的 36 位字符串。
 *
 * 参考：https://docs.pinecone.io/guides/getting-started/authentication
 */
export const pineconeProvider: ApiProvider = {
  name: 'Pinecone',
  diagnosticCode: 'envify.pinecone-key',
  envVarName: 'PINECONE_API_KEY',
  minLength: 36,
  patterns: [
    // pcsk_ 前缀 + 32 位字母数字
    /^pcsk_[A-Za-z0-9]{32,}$/,
    // UUID v4 格式：xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i,
  ],
};

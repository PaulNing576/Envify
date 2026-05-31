import { ApiProvider } from '../provider';

/**
 * Supabase API Key 模式。
 *
 * Supabase 提供后端即服务平台。
 * Key 以 eyJ 开头（JWT token 格式）或 sbp_ 格式（service role key）。
 * 这里检测 anon key 和 service role key。
 *
 * 参考：https://supabase.com/docs/guides/api/api-keys
 */
export const supabaseProvider: ApiProvider = {
  name: 'Supabase',
  diagnosticCode: 'envify.supabase-key',
  envVarName: 'SUPABASE_ANON_KEY',
  minLength: 40,
  patterns: [
    // service_role key: sbp_ 前缀或 eyJ 开头的 JWT
    /^eyJ[A-Za-z0-9_-]{50,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}$/,
    // supabase key: sbp_ 前缀（较新格式）
    /^sbp_[a-f0-9]{40,}$/,
  ],
};

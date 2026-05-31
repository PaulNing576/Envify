import { ApiProvider } from '../provider';

/**
 * GitHub Personal Access Token 模式。
 *
 * GitHub 有多种 token 格式：
 *   - 经典 PAT: ghp_...（40 位）
 *   - Fine-grained PAT: github_pat_...（82+ 位）
 *   - OAuth: gho_...
 *   - User-to-server: ghu_...
 *   - Server-to-server: ghs_...
 *
 * 参考：https://docs.github.com/en/authentication
 */
export const githubProvider: ApiProvider = {
  name: 'GitHub',
  diagnosticCode: 'envify.github-token',
  envVarName: 'GITHUB_TOKEN',
  prefixHint: 'gh',
  minLength: 30,
  patterns: [
    // Fine-grained PAT
    /^github_pat_[A-Za-z0-9_]{70,}$/,
    // 经典 PAT
    /^ghp_[A-Za-z0-9]{36,}$/,
    // OAuth / App tokens
    /^gho_[A-Za-z0-9]{36,}$/,
    /^ghu_[A-Za-z0-9]{36,}$/,
    /^ghs_[A-Za-z0-9]{36,}$/,
  ],
};

import { ApiProvider } from '../provider';

/**
 * Stripe API Key 模式。
 *
 * Stripe 有多种 key 格式：
 *   - Secret key: sk_live_... / sk_test_...
 *   - Publishable key: pk_live_... / pk_test_...
 *   - Restricted key: rk_live_... / rk_test_...
 *
 * 参考：https://docs.stripe.com/keys
 */
export const stripeProvider: ApiProvider = {
  name: 'Stripe',
  diagnosticCode: 'envify.stripe-key',
  envVarName: 'STRIPE_SECRET_KEY',
  prefixHint: 'sk_live_',
  minLength: 30,
  patterns: [
    // Secret key (live / test)
    /^sk_live_[A-Za-z0-9]{24,}$/,
    /^sk_test_[A-Za-z0-9]{24,}$/,
    // Publishable key
    /^pk_live_[A-Za-z0-9]{24,}$/,
    /^pk_test_[A-Za-z0-9]{24,}$/,
    // Restricted key
    /^rk_live_[A-Za-z0-9]{24,}$/,
    /^rk_test_[A-Za-z0-9]{24,}$/,
  ],
};

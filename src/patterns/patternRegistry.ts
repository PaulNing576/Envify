import { ApiProvider, MatchResult, SecretDetection } from './provider';
import { shannonEntropy } from './entropy';
import { openaiProvider } from './providers/openai';
import { anthropicProvider } from './providers/anthropic';
import { geminiProvider } from './providers/gemini';
import { deepseekProvider } from './providers/deepseek';
import { openrouterProvider } from './providers/openrouter';
import { groqProvider } from './providers/groq';
import { togetheraiProvider } from './providers/togetherai';
import { replicateProvider } from './providers/replicate';
import { pineconeProvider } from './providers/pinecone';
import { supabaseProvider } from './providers/supabase';
import { awsProvider } from './providers/aws';
import { githubProvider } from './providers/github';
import { stripeProvider } from './providers/stripe';
import { slackProvider } from './providers/slack';
import { sendgridProvider } from './providers/sendgrid';
import { azureProvider } from './providers/azure';

/**
 * Central registry for API key pattern matching.
 *
 * Architecture:
 *   1. Phase 1 — Exact match against built-in and custom provider patterns
 *   2. Phase 2 — Entropy-based fallback for unknown high-entropy strings
 *      that are assigned to suspicious variable names
 */
export class PatternRegistry {
  private builtInProviders: Map<string, ApiProvider> = new Map();
  private customProviders: ApiProvider[] = [];
  private entropyThreshold: number;

  constructor(entropyThreshold: number = 4.5) {
    this.entropyThreshold = entropyThreshold;
    this.registerBuiltInProviders();
  }

  /**
   * Register a custom provider from user configuration.
   */
  registerCustomProvider(provider: ApiProvider): void {
    this.customProviders.push(provider);
  }

  /**
   * Clear and reset custom providers (e.g., on configuration change).
   */
  setCustomProviders(providers: ApiProvider[]): void {
    this.customProviders = [...providers];
  }

  /**
   * Set the entropy threshold.
   */
  setEntropyThreshold(threshold: number): void {
    this.entropyThreshold = threshold;
  }

  /**
   * Get only the providers that are currently enabled.
   */
  getEnabledProviders(enabledNames: string[]): ApiProvider[] {
    const providers: ApiProvider[] = [];
    for (const name of enabledNames) {
      const provider = this.builtInProviders.get(name.toLowerCase());
      if (provider) {
        providers.push(provider);
      }
    }
    // Always include custom providers
    providers.push(...this.customProviders);
    return providers;
  }

  /**
   * Given a string value and its variable name, attempt to match it against
   * all enabled providers. Returns a detection if matched, or null.
   */
  match(
    value: string,
    variableName: string,
    enabledNames: string[],
    range: { startLine: number; startChar: number; endLine: number; endChar: number }
  ): SecretDetection | null {
    const providers = this.getEnabledProviders(enabledNames);

    // Phase 1: Exact pattern match against known providers
    const exactMatch = this.exactMatch(value, providers);
    if (exactMatch) {
      return {
        provider: exactMatch.provider,
        value,
        variableName,
        confidence: exactMatch.confidence,
        range,
      };
    }

    // Phase 2: Entropy fallback for unknown high-entropy strings
    const entropyMatch = this.entropyMatch(value, variableName, range);
    if (entropyMatch) {
      return entropyMatch;
    }

    return null;
  }

  /**
   * Phase 1: Try to match the value against exact provider patterns.
   */
  private exactMatch(value: string, providers: ApiProvider[]): MatchResult | null {
    for (const provider of providers) {
      // Fast pre-filtering by prefix
      if (provider.prefixHint && !value.startsWith(provider.prefixHint)) {
        continue;
      }

      // Fast pre-filtering by length
      if (provider.minLength && value.length < provider.minLength) {
        continue;
      }

      // Test each pattern
      for (const pattern of provider.patterns) {
        if (pattern.test(value)) {
          return { provider, confidence: 'high' };
        }
      }
    }

    return null;
  }

  /**
   * Phase 2: Entropy-based fallback detection for unknown keys.
   *
   * Flags strings that:
   *   - Have high Shannon entropy (≥ threshold)
   *   - Are long enough to be meaningful (≥ 20 chars)
   *   - Are assigned to variables with suspicious names (api_key, token, etc.)
   */
  private entropyMatch(
    value: string,
    variableName: string,
    range: SecretDetection['range']
  ): SecretDetection | null {
    // 最小长度要求（放宽到 16 个字符，覆盖更多短 key）
    if (value.length < 16) {
      return null;
    }

    // 计算熵值
    const entropy = shannonEntropy(value);
    if (entropy < this.entropyThreshold) {
      return null;
    }

    // 变量名可疑模式（扩展匹配范围）
    const suspiciousNames = /(api[_-]?key|token|secret|password|auth|credential|private[_-]?key|access[_-]?key|pat|bearer|endpoint[_-]?key)/i;
    if (!suspiciousNames.test(variableName)) {
      return null;
    }

    // Create a synthetic provider for unknown secrets
    const unknownProvider: ApiProvider = {
      name: 'Unknown Secret',
      diagnosticCode: 'envify.unknown-secret',
      envVarName: this.guessEnvVarName(variableName),
      patterns: [],
    };

    return {
      provider: unknownProvider,
      value,
      variableName,
      confidence: 'medium',
      range,
    };
  }

  /**
   * Guess an environment variable name from the variable name.
   * e.g., "api_key" → "API_KEY", "mySecretToken" → "MY_SECRET_TOKEN"
   */
  private guessEnvVarName(variableName: string): string {
    // If already SCREAMING_SNAKE_CASE, just return it
    if (/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(variableName)) {
      return variableName;
    }

    // Convert camelCase / snake_case to SCREAMING_SNAKE_CASE
    return variableName
      .replace(/([a-z])([A-Z])/g, '$1_$2') // camelCase → snake_case
      .replace(/[-]/g, '_')                  // kebab-case → snake_case
      .replace(/__+/g, '_')                  // collapse multiple underscores
      .toUpperCase();
  }

  /**
   * Compatibility wrapper for callers that don't need range info.
   */
  matchValue(
    value: string,
    variableName: string,
    enabledNames: string[]
  ): { provider: ApiProvider; confidence: 'high' | 'medium' } | null {
    const result = this.match(value, variableName, enabledNames, {
      startLine: 0,
      startChar: 0,
      endLine: 0,
      endChar: 0,
    });
    if (!result) {
      return null;
    }
    return { provider: result.provider, confidence: result.confidence };
  }

  private registerBuiltInProviders(): void {
    const builtIns = [
      openaiProvider, anthropicProvider, geminiProvider, deepseekProvider,
      openrouterProvider, groqProvider, togetheraiProvider,
      replicateProvider, pineconeProvider, supabaseProvider,
      awsProvider, githubProvider, stripeProvider, slackProvider, sendgridProvider,
      azureProvider,
    ];
    for (const provider of builtIns) {
      this.builtInProviders.set(provider.name.toLowerCase(), provider);
    }
  }
}

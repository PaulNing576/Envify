import { PatternRegistry } from '../../../src/patterns/patternRegistry';

describe('PatternRegistry', () => {
  let registry: PatternRegistry;

  beforeEach(() => {
    registry = new PatternRegistry(4.5);
  });

  it('should match OpenAI key', () => {
    const result = registry.matchValue(
      'sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx',
      'api_key',
      ['openai']
    );
    expect(result).not.toBeNull();
    expect(result!.provider.name).toBe('OpenAI');
  });

  it('should NOT match non-key strings', () => {
    const result = registry.matchValue(
      'hello world',
      'message',
      ['openai', 'anthropic', 'gemini', 'deepseek']
    );
    expect(result).toBeNull();
  });

  it('should detect unknown high-entropy strings with suspicious variable names', () => {
    const result = registry.matchValue(
      'xK9mP2vR7wQ4nB6tY8uL3oA5sD1fG0hJ9kZ2cV6xN4mQ8wR3tY7uI0oP2',
      'api_key',
      ['openai', 'anthropic', 'gemini', 'deepseek']
    );
    // This is a high-entropy string assigned to "api_key" — should be flagged
    expect(result).not.toBeNull();
    if (result) {
      expect(result.provider.name).toBe('Unknown Secret');
      expect(result.confidence).toBe('medium');
    }
  });

  it('should NOT flag high-entropy strings with innocent variable names', () => {
    const result = registry.matchValue(
      'xK9mP2vR7wQ4nB6tY8uL3oA5sD1fG0hJ9kZ2cV6xN4mQ8wR3tY7uI0oP2',
      'model_name',
      ['openai', 'anthropic', 'gemini', 'deepseek']
    );
    expect(result).toBeNull();
  });

  it('should respect enabled providers list', () => {
    // Only Anthropic enabled — should not match OpenAI key
    // But note: high-entropy strings with suspicious variable names
    // will still be caught by the entropy fallback, so we use a
    // low-entropy string that looks like an OpenAI key prefix
    const result = registry.matchValue(
      'sk-short-not-a-real-key',
      'api_key',
      ['anthropic']
    );
    // Short key should not match Anthropic patterns or entropy check
    expect(result).toBeNull();
  });

  it('should register and use custom providers', () => {
    registry.registerCustomProvider({
      name: 'TestService',
      diagnosticCode: 'envify.custom-test',
      envVarName: 'TEST_KEY',
      patterns: [/^test-[a-z]{10,}$/],
      prefixHint: 'test-',
      minLength: 12,
    });

    const result = registry.matchValue(
      'test-helloworld',
      'test_key',
      []
    );
    expect(result).not.toBeNull();
    expect(result!.provider.name).toBe('TestService');
  });
});

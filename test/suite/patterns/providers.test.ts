import { openaiProvider } from '../../../src/patterns/providers/openai';
import { anthropicProvider } from '../../../src/patterns/providers/anthropic';
import { geminiProvider } from '../../../src/patterns/providers/gemini';
import { deepseekProvider } from '../../../src/patterns/providers/deepseek';

describe('OpenAI Provider', () => {
  const provider = openaiProvider;

  it('should match standard OpenAI project key', () => {
    const key = 'sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx';
    expect(provider.patterns.some(p => p.test(key))).toBe(true);
  });

  it('should match service account key', () => {
    const key = 'sk-svcacct-abc123def456ghi789jkl012mno345pqr678stu901vwx';
    expect(provider.patterns.some(p => p.test(key))).toBe(true);
  });

  it('should match admin key', () => {
    const key = 'sk-admin-abc123def456ghi789jkl012mno345pqr678stu901vwx';
    expect(provider.patterns.some(p => p.test(key))).toBe(true);
  });

  it('should NOT match Anthropic keys', () => {
    const key = 'sk-ant-api03-abc123def456ghi789jkl012mno345pqr678stu901vwxAAAbbbCCCdddEEEfffGGGhhhIIIjjjKKKlllMMMnnnOOO';
    expect(provider.patterns.some(p => p.test(key))).toBe(false);
  });

  it('should NOT match short strings', () => {
    expect(provider.patterns.some(p => p.test('sk-short'))).toBe(false);
  });

  it('should pre-filter by prefix', () => {
    expect('sk-proj-abc'.startsWith(provider.prefixHint!)).toBe(true);
    expect('not-a-key'.startsWith(provider.prefixHint!)).toBe(false);
  });
});

describe('Anthropic Provider', () => {
  const provider = anthropicProvider;

  it('should match standard Anthropic key', () => {
    // Real Anthropic keys are longer; this is a valid-format example
    const key = 'sk-ant-api03-' + 'A'.repeat(90) + 'AA';
    expect(provider.patterns.some(p => p.test(key))).toBe(true);
  });

  it('should NOT match non-Anthropic sk- keys', () => {
    const key = 'sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx';
    expect(provider.patterns.some(p => p.test(key))).toBe(false);
  });
});

describe('Gemini Provider', () => {
  const provider = geminiProvider;

  it('should match valid Gemini key format', () => {
    const key = 'AIzaSy' + 'A'.repeat(33);
    expect(provider.patterns.some(p => p.test(key))).toBe(true);
  });

  it('should NOT match shorter strings', () => {
    expect(provider.patterns.some(p => p.test('AIzaSyShort'))).toBe(false);
  });
});

describe('DeepSeek Provider', () => {
  const provider = deepseekProvider;

  it('should match valid DeepSeek key format', () => {
    const key = 'sk-' + 'a'.repeat(32); // 32 lowercase hex chars
    expect(provider.patterns.some(p => p.test(key))).toBe(true);
  });

  it('should NOT match keys with uppercase', () => {
    const key = 'sk-' + 'A'.repeat(32);
    expect(provider.patterns.some(p => p.test(key))).toBe(false);
  });
});

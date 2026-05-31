import { shannonEntropy, isHighEntropy } from '../../../src/patterns/entropy';

describe('shannonEntropy', () => {
  it('should return 0 for empty string', () => {
    expect(shannonEntropy('')).toBe(0);
  });

  it('should return 0 for string with all same characters', () => {
    expect(shannonEntropy('aaaaaa')).toBe(0);
  });

  it('should return high entropy for random-like strings', () => {
    // A truly random-like Base64 string (high charset diversity)
    const randomish = 'xK9mP2vR7wQ4nB6tY8uL3oA5sD1fG0hJ9kZ2cV6xN4mQ8wR3tY7uI0oP2sF3d';
    const entropy = shannonEntropy(randomish);
    // This should be at least 4.5 bits/char for a Base64-like random string
    expect(entropy).toBeGreaterThan(4.5);
  });

  it('should return low entropy for English text', () => {
    const english = 'The quick brown fox jumps over the lazy dog';
    const entropy = shannonEntropy(english);
    // English text typically has entropy around 3.5-4.0 bits/char
    expect(entropy).toBeLessThan(4.5);
  });

  it('should return moderate entropy for hex strings', () => {
    const hex = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6';
    const entropy = shannonEntropy(hex);
    // Hex strings (0-9a-f) have ~4 bits/char max
    expect(entropy).toBeLessThan(4.5);
    expect(entropy).toBeGreaterThan(3.0);
  });

  it('should identify high entropy strings with default threshold', () => {
    // This is a simulated API key (Base64-like)
    const apiKey = 'sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx';
    const entropy = shannonEntropy(apiKey);
    // This API key format should have relatively high entropy
    expect(entropy).toBeGreaterThan(3.5);
  });
});

describe('isHighEntropy', () => {
  it('should return false for English text with default threshold', () => {
    expect(isHighEntropy('hello world this is a sentence')).toBe(false);
  });

  it('should return true for random Base64 string with default threshold', () => {
    const b64 = 'xK9mP2vR7wQ4nB6tY8uL3oA5sD1fG0hJ9kZ2cV6xN4mQ8wR3tY7uI0oP2';
    expect(isHighEntropy(b64)).toBe(true);
  });

  it('should respect custom threshold', () => {
    const moderate = 'abc123def456';
    // With very low threshold, everything is "high entropy"
    expect(isHighEntropy(moderate, 0.5)).toBe(true);
    // With very high threshold, nothing is
    expect(isHighEntropy(moderate, 6.0)).toBe(false);
  });
});

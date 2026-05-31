/**
 * Shannon entropy calculator for detecting high-entropy (random-looking) strings.
 *
 * High entropy is a strong signal that a string may be a cryptographic key,
 * API token, or other secret — even when it doesn't match a known provider pattern.
 *
 * Industry standard threshold: 4.5 bits/character (used by truffleHog, GitGuardian).
 */

/**
 * Compute the Shannon entropy of a string in bits per character.
 *
 * Shannon entropy H = -Σ (p_i × log₂(p_i))
 * where p_i is the probability (frequency) of each unique character.
 *
 * Higher values indicate more randomness:
 *   - ~3.5-4.0: English text
 *   - ~4.5+:   likely a random key/token
 *   - ~5.0+:   very likely a secret (Base64-like encoding)
 *   - ~6.0:    maximum for 64-character alphabet (Base64)
 */
export function shannonEntropy(str: string): number {
  if (!str || str.length === 0) {
    return 0;
  }

  const freq = new Map<string, number>();
  for (const ch of str) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }

  let entropy = 0;
  const len = str.length;
  for (const count of freq.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

/**
 * Returns true if the string has entropy >= the given threshold.
 * Default threshold of 4.5 bits/char is the industry standard.
 */
export function isHighEntropy(str: string, threshold: number = 4.5): boolean {
  return shannonEntropy(str) >= threshold;
}

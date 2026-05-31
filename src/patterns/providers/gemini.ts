import { ApiProvider } from '../provider';

/**
 * Google Gemini API Key patterns.
 *
 * Gemini keys use the AIzaSy prefix (standard Google API key format)
 * with a fixed length of 39 characters total.
 *
 * References:
 *   https://ai.google.dev/gemini-api/docs/api-key
 */
export const geminiProvider: ApiProvider = {
  name: 'Google Gemini',
  diagnosticCode: 'envify.gemini-key',
  envVarName: 'GEMINI_API_KEY',
  prefixHint: 'AIzaSy',
  minLength: 39,
  patterns: [
    // Standard Google API key format: AIzaSy + 33 alphanumeric/dash/underscore
    /^AIzaSy[A-Za-z0-9_-]{33}$/,
  ],
};

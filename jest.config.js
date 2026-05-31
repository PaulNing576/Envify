/**
 * Jest configuration for unit tests.
 *
 * Unit tests (everything except integration tests that need VS Code Extension Host)
 * run via Jest for fast feedback.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/test'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/*.test.ts',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  // Integration tests (test/suite/) need VS Code Extension Host — skip in Jest
  testPathIgnorePatterns: [
    '/node_modules/',
    '/out/',
    '/test/suite/integration/',
    '/test/runTest\\.ts$',
  ],
};

/**
 * Test runner for VS Code extension integration tests.
 *
 * Uses @vscode/test-electron to launch a VS Code Extension Host,
 * runs the test suite, and reports results.
 */
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  try {
    // The folder containing the Extension Manifest package.json
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the test suite
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // Download VS Code, unzip it, and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: ['--disable-extensions'],
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();

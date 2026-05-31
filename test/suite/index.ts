/**
 * Test suite entry point.
 *
 * Uses Mocha to discover and run all tests in the suite directory.
 */
import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

// NOTE: Since we use Jest for unit tests, this Mocha-based runner is for
// integration tests that need the full VS Code Extension Host.
// For now, the primary test framework is Jest (see jest.config.js).

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 10000,
  });

  const testsRoot = path.resolve(__dirname);

  return new Promise<void>((resolve, reject) => {
    glob('**/**.test.js', { cwd: testsRoot }, (err: Error | null, files: string[]) => {
      if (err) {
        return reject(err);
      }

      // Add each file to the mocha test suite
      files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

      try {
        // Run the mocha tests
        mocha.run((failures: number) => {
          if (failures > 0) {
            reject(new Error(`${failures} tests failed.`));
          } else {
            resolve();
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}

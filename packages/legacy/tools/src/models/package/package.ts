import glob from 'glob';
import path from 'path';

import { Jest, Karma, Mocha } from '../../utils';

import PackageFile from '../package-file';

import CONSTANTS from './package.constants';
import type { BuildConfig, Data, TestConfig } from './package.types';

/**
 * The Package class, which represents an entire local JavaScript package.
 *
 * @remarks
 * This class is used to manage any action against a specific package.
 *
 * @example
 * ```js
 * const { Package } = require('@webex/legacy-tools');
 *
 * const pack = new Package();
 *
 * pack.build(config).then(() => {});
 * ```
 *
 * @public
 */
class Package {
  /**
   * Locally stored Data Object for this Package instance.
   */
  protected data: Data;

  /**
   * Construct a new Package instance.
   */
  public constructor() {
    this.data = {
      packageRoot: process.cwd(),
    };
  }

  /**
   * Build this Package instance.
   *
   * @remarks
   * This will require the following localized dependencies to build:
   * `babel`-[`@babel/*`, `babel.config-json`]
   *
   * @param config - Build configuration Object.
   * @returns - Promise resolving to this Package instance.
   */
  public build(config: BuildConfig): Promise<this> {
    const {
      destination,
      generateSourceMaps,
      javascript,
      source,
      typescript,
    } = config;

    const inputPath = path.join(this.data.packageRoot, source);

    const javascriptFileCollector = javascript
      ? Package.getFiles({ location: inputPath, pattern: CONSTANTS.PATTERNS.JAVASCRIPT, targets: undefined })
      : Promise.resolve([]);

    const typescriptFileCollector = typescript
      ? Package.getFiles({ location: inputPath, pattern: CONSTANTS.PATTERNS.TYPESCRIPT, targets: undefined })
      : Promise.resolve([]);

    return Promise.all([javascriptFileCollector, typescriptFileCollector])
      .then(([javascriptFiles, typescriptFiles]) => {
        const sourceFiles = [...javascriptFiles, ...typescriptFiles];

        const files = sourceFiles.map((file) => new PackageFile({
          directory: source,
          location: file.replace(inputPath, ''),
          packageRoot: this.data.packageRoot,
        }));

        return Promise.all(files.map((file) => file.build({
          destination,
          generateSourceMap: !!generateSourceMaps,
        })));
      })
      .then(() => this);
  }

  /**
   * Test this Package instance.
   *
   * @remarks
   * This will require the following localized dependencies for each type of
   * test: `unit`-[`jest`, `jest.config.js`]::`integration`-[`@babel/*`, `babel.config.json`]
   *
   * @param config - Test configuration Object.
   * @returns - Promise resolving to this Package instance.
   */
  public test(config: TestConfig): Promise<this> {
    const testDirectory = path.join(this.data.packageRoot, CONSTANTS.TEST_DIRECTORIES.ROOT);

    const unitTestFileCollectorInSrc = config.unit
      ? Package.getFiles({
        location: path.join(this.data.packageRoot, CONSTANTS.TEST_DIRECTORIES.SRC),
        pattern: CONSTANTS.PATTERNS.BYODS,
        targets: config.targets,
      })
      : Promise.resolve([]);

    const unitTestFileCollector = config.unit
      ? Package.getFiles({
        location: path.join(testDirectory, CONSTANTS.TEST_DIRECTORIES.UNIT),
        pattern: CONSTANTS.PATTERNS.TEST,
        targets: config.targets,
      })
      : Promise.resolve([]);

    const integrationTestFileCollector = config.integration
      ? Package.getFiles({
        location: path.join(testDirectory, CONSTANTS.TEST_DIRECTORIES.INTEGRATION),
        pattern: CONSTANTS.PATTERNS.TEST,
        targets: config.targets,
      })
      : Promise.resolve([]);

    return Promise.all([unitTestFileCollector, integrationTestFileCollector, unitTestFileCollectorInSrc])
      .then(async ([unitFiles, integrationFiles, srcUnitFiles]) => {
        if (config.runner === 'jest') {
          const testFiles = [...unitFiles, ...srcUnitFiles];

          if (testFiles.length > 0) {
            await Jest.test({ files: testFiles });
          }
        }

        if (config.runner === 'mocha') {
          const testFiles = [...unitFiles, ...integrationFiles];

          if (testFiles.length > 0) {
            await Mocha.test({ files: testFiles });
          }
        }

        if (config.runner === 'karma') {
          const testFiles = [...unitFiles, ...integrationFiles];

          if (testFiles.length > 0) {
            await Karma.test({
              browsers: config.karmaBrowsers,
              debug: config.karmaDebug,
              files: testFiles,
              port: config.karmaPort,
            });
          }
        }

        return this;
      });
  }

  /**
   * Get an Array of file paths based on a provided pattern and location.
   *
   * @param options - Options for getting files.
   * @returns - Promise resolving to an Array of file paths.
   */
  protected static getFiles({ location, pattern, targets }:
  { location: string, pattern: string, targets: string | undefined }): Promise<Array<string>> {
    let target;
    if (!targets) {
      target = path.join(location, pattern);
    } else {
      target = path.join(location, targets);
    }

    return glob.glob(target);
  }

  public static get CONSTANTS() {
    return CONSTANTS;
  }
}

export default Package;

import glob from 'glob';
import path from 'path';

import PackageFile from '../package-file';

import CONSTANTS from './package.constants';
import type { BuildConfig, Data } from './package.types';

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
      ? Package.getFiles({ location: inputPath, pattern: CONSTANTS.PATTERNS.JAVASCRIPT })
      : Promise.resolve([]);

    const typescriptFileCollector = typescript
      ? Package.getFiles({ location: inputPath, pattern: CONSTANTS.PATTERNS.TYPESCRIPT })
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
   * Get an Array of file paths based on a provided pattern and location.
   *
   * @param options - Options for getting files.
   * @returns - Promise resolving to an Array of file paths.
   */
  protected static getFiles({ location, pattern }: { location: string, pattern: string }): Promise<Array<string>> {
    const target = path.join(location, pattern);

    return glob.glob(target);
  }
}

export default Package;

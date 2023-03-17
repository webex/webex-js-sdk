import { transformFileAsync } from '@babel/core';
import fs from 'fs/promises';
import fsExtra from 'fs-extra';
import path from 'path';
import type { BabelFileResult } from '@babel/core';

import type { Config } from './package-file.types';

/**
 * The PackageFile class, which represents a single file within a package.
 *
 * @remarks
 * This class is used to manage any actions against a specific file.
 *
 * @example
 * ```js
 * const { PackageFile } = require('@webex/legacy-tools');
 *
 * const packFile = new PackageFile(fileConfig);
 *
 * packFile.build(buildConfig).then(() => {});
 * ```
 *
 * @public
 */
class PackageFile {
  /**
   * Locally stored configuration object for this PackageFile instance.
   */
  protected config: Config;

  /**
   * Construct a new PackageFile instance.
   *
   * @param config - Configuration Object.
   */
  public constructor(config: Config) {
    this.config = config;
  }

  /**
   * Build this PackageFile instance.
   *
   * @param options - Options for this PackageFile instance's build workflow.
   * @returns - This PackageFile instance.
   */
  public build({ destination, generateSourceMap }: { destination: string, generateSourceMap: boolean }): Promise<this> {
    const { directory, location, packageRoot } = this.config;

    return PackageFile.transform({ location: path.join(packageRoot, directory, location) })
      .then(({ code, map }) => {
        const outputPath = path.join(packageRoot, destination, location).replace('.ts', '.js');

        const mutatedCode = generateSourceMap
          ? `${code}\n//# sourceMappingURL=${path.basename(outputPath)}.map\n`
          : code;

        const codeWrite = code
          ? PackageFile.write({
            data: mutatedCode as string,
            destination: outputPath,
          })
          : Promise.resolve();

        const mapWrite = code && generateSourceMap
          ? PackageFile.write({
            data: JSON.stringify(map),
            destination: `${outputPath}.map`,
          })
          : Promise.resolve();

        return Promise.all([codeWrite, mapWrite]);
      })
      .then(() => this);
  }

  /**
   * Transform the file data at a target location.
   *
   * @param options - Options for transforming a file.
   * @returns - The results of the transformed file.
   */
  protected static transform({ location }: { location: string }): Promise<BabelFileResult> {
    return transformFileAsync(location) as Promise<BabelFileResult>;
  }

  /**
   * Write file data to a target location.
   *
   * @param options - Options for writing file data to a target location.
   * @returns - Nothing.
   */
  protected static write({ data, destination }: { data: string, destination: string }): Promise<void> {
    return new Promise((resolve, reject) => {
      fsExtra.mkdirp(path.dirname(destination), (error) => {
        if (error) {
          reject(error);
        }

        resolve(undefined);
      });
    })
      .then(() => fs.writeFile(destination, data))
      .then(() => undefined);
  }
}

export default PackageFile;

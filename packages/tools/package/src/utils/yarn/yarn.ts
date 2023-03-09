import { Executor } from '@webex/cli-tools';

import CONSTANTS from './yarn.constants';
import type { ListConfig, ViewConfig } from './yarn.types';

/**
 * Yarn class to be used as a static interface with the Yarn CLI Service.
 *
 * @remarks
 * This class is designed to help streamline various functions of the Yarn
 * toolkit within a consuming project.
 *
 * @example
 * ```js
 * const { Yarn } = require('@webex/package-tools');
 *
 * Yarn.list(config)
 *  .then((results) => { console.log(results); });
 * ```
 *
 * @public
 */
class Yarn {
  /**
   * List packages based on the provided config using `yarn list`.
   *
   * @param config - `Yarn.list()` configuration Object.
   * @returns - Promise resolving in the results of the `yarn list` execution.
   */
  public static list(config: ListConfig = {}): Promise<any> {
    const mergedConfig = { ...CONSTANTS.LIST_CONFIG, ...config };

    const params = [
      mergedConfig.json ? '--json' : '',
      mergedConfig.noPrivate ? '--no-private' : '',
      mergedConfig.recursive ? '--recursive' : '',
      mergedConfig.since ? `--since="${mergedConfig.since}"` : '',
      mergedConfig.verbose ? '--verbose' : '',
    ]
      .filter((item) => item.length !== 0)
      .join(' ');

    return Executor.execute(`${CONSTANTS.COMMANDS.LIST} ${params}`)
      .then((results) => JSON.parse(`[${results.trim().replaceAll('\n', ',')}]`));
  }

  /**
   * View the details of the provided, or all, packages based on the provided
   * configuration Object using `yarn npm view`.
   *
   * @param config - Yarn.view() configuration Object.
   * @returns - Promise resolving in the results of the `yarn npm view` execution.
   */
  public static view(config: ViewConfig): Promise<any> {
    const mergedConfig = { ...CONSTANTS.VIEW_CONFIG, ...config };

    const params = [
      mergedConfig.package ? mergedConfig.package : '',
      mergedConfig.version ? 'version' : '',
      mergedConfig.distTags ? 'dist-tags' : '',
      mergedConfig.json ? '--json' : '',
    ]
      .filter((item) => item.length !== 0)
      .join(' ');

    return Executor.execute(`${CONSTANTS.COMMANDS.VIEW} ${params}`)
      .then((results) => JSON.parse(results))
      .catch(() => ({}));
  }

  /**
   * Constants associated with the Yarn class.
   */
  public static get CONSTANTS() {
    return CONSTANTS;
  }
}

export default Yarn;

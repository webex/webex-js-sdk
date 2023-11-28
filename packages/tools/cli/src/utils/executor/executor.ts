import shell from 'shelljs';

import CONSTANTS from './executor.constants';
import type { Config } from './executor.types';

/**
 * The Executor class.
 *
 * @remarks
 * This class is used to execute a shell command on any platform.
 *
 * @example
 * ```js
 * const { Executor } = require('@webex/cli-tools');
 *
 * Executor.execute(command, configuration)
 *   .then((results) => { console.log(results); });
 * ```
 *
 * @public
 */
class Executor {
  /**
   * Execute a command within the local shell.
   *
   * @param command - Command to execute within the shell.
   * @param config - Configuration of the shell.
   * @returns - Promise resolving to the results of the shell command.
   */
  public static execute(command: string, config: Config = {}): Promise<string> {
    const mergedConfig = { ...CONSTANTS.CONFIG, ...config };

    shell.config.silent = mergedConfig.silent as boolean;

    return new Promise((resolve, reject) => {
      shell.exec(command, (code, results, error) => {
        if (shell.config.silent) {
          shell.config.silent = false;
        }

        if (code !== 0) {
          reject(new Error(`[ code: ${code} ] -- ${error}`));

          return;
        }

        resolve(results);
      });
    });
  }

  /**
   * Constants associated with the Executor class.
   */
  public static get CONSTANTS() {
    return CONSTANTS;
  }
}

export default Executor;

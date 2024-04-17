import Babel from '@babel/register';
import '@webex/env-config-legacy';
import MochaRunner from 'mocha';
import { startServer, stopServer } from '../server';

import CONSTANTS from './mocha.constants';

/**
 * Mocha test runner utility methods.
 *
 * @public
 */
class Mocha {
  /**
   * Run Mocha tests against the provided files.
   *
   * @param options - Options object.
   * @returns - Empty Promise.
   */
  public static test({ files }: { files: Array<string> }) {
    Babel({
      only: ['../../**/*.js', '../../**/*.ts'],
      extensions: ['.js', '.ts'],
      sourceMaps: true,
    });

    const config = CONSTANTS.CONFIG;

    const mochaRunner = new MochaRunner(config);

    files.forEach((file) => mochaRunner.addFile(file));

    return new Promise((resolve) => {
      startServer();
      mochaRunner.run((failures) => {
        if (failures !== 0) {
          process.exit(1);
        }
        stopServer();
        resolve(undefined);
      });
    });
  }

  /**
   * Constants associated with the Mocha class.
   */
  public static get CONSTANTS() {
    return CONSTANTS;
  }
}

export default Mocha;

import '@babel/register';
import '@webex/env-config-legacy';

import MochaRunner from 'mocha';

import CONSTANTS from './mocha.constants';

/**
 * Mocha test runner utility methods.
 *
 * @public
 */
class Mocha {
  /**
   * Run Jest tests against the provided files.
   *
   * @param options - Options object.
   * @returns - Empty Promise.
   */
  public static test({ files }: { files: Array<string> }) {
    const config = CONSTANTS.CONFIG;

    const mochaRunner = new MochaRunner(config);

    files.forEach((file) => mochaRunner.addFile(file));

    return new Promise((resolve) => {
      mochaRunner.run(resolve);
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

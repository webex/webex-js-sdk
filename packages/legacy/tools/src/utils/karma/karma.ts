import '@babel/register';
import '@webex/env-config-legacy';

import KarmaRunner from 'karma';
import { startServer, stopServer } from '../server';

import Browsers from './browsers';

import CONSTANTS from './karma.constants';

/**
 * Karma test runner utility methods.
 *
 * @public
 */
class Karma {
  /**
   * Run Karma tests against the provided files.
   *
   * @param options - Options object.
   * @returns - Empty Promise.
   */
  public static async test({
    browsers, debug, files, port,
  }: { browsers?: Array<string>, debug?: boolean, files: Array<string>, port?: string }): Promise<any> {
    const browserConfigs = Browsers.get({ browsers, debug });
    const config: any = {
      ...Karma.CONSTANTS.CONFIG,
      browsers: Object.keys(browserConfigs),
      customLaunchers: browserConfigs,
      files,
      port: port ? parseInt(port, 10) : Karma.CONSTANTS.CONFIG.port,
      singleRun: !debug,
    };

    config.browserify.watch = debug;
    config.proxies['/fixtures/'] = `http://localhost:${config.port - 1}`;
    config.proxies['/upload'] = `http://localhost:${config.port - 1}/upload`;

    return KarmaRunner.config.parseConfig(null, config, { promiseConfig: true, throwErrors: true })
      .then((parsedConfig: any) => new Promise((resolve, reject) => {
        const server = new KarmaRunner.Server(parsedConfig, (code: number) => {
          if (code !== 0) {
            reject();
          }

          resolve(undefined);
        });

        if (files && files[0].includes('@webex')) {
          server.on('run_start', async () => {
            console.log('Tests run started');
            await startServer();
          });

          server.on('run_complete', async () => {
            console.log('Test run complete');
            await stopServer();
          });
        }

        server.start();
        resolve(server);
      }));
  }

  /**
   * Browsers class object.
   */
  public static get Browsers() {
    return Browsers;
  }

  /**
   * Constants associated with this Karma class.
   */
  public static get CONSTANTS() {
    return CONSTANTS;
  }
}

export default Karma;

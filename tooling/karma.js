/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable no-console */

const debug = require('debug')('monorepo:test:karma');
const {readFile} = require('fs-extra');
const {stopper} = require('karma');
const ps = require('ps-node');

module.exports = {
  /**
   * Periodically checks that the sauce process is still running and kills the
   * test suite if it is not
   * @param {Object} server
   * @param {Object} cfg
   */
  watchSauce: async function watchSauce(server, cfg) {
    try {
      debug('reading sauce pid');
      const pid = parseInt(await readFile(process.env.SC_PID_FILE), 10);

      debug(`sauce pid is ${pid}`);

      let done = false;

      server.once('run_complete', () => {
        debug('run complete');
        done = true;
      });

      const delay = 1000;

      // eslint-disable-next-line no-unmodified-loop-condition
      while (!done) {
        debug(`waiting ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        debug(`waited ${delay}ms`);
        await new Promise((resolve, reject) => {
          debug(`checking if ${pid} is running`);
          ps.lookup({
            psargs: '-A',
            pid
          }, (err, resultList) => {
            if (err) {
              debug('ps-node produced an error', err);
              reject(err);

              return;
            }

            if (resultList.length === 0) {
              debug(`pid ${pid} is not running`);
              reject(new Error(`pid ${pid} is not running`));

              return;
            }

            debug(`pid ${pid} is running`);
            resolve();
          });
        });
      }
    }
    catch (err) {
      console.error(err);
      console.error('Sauce Tunnel is not running, stopping server and exiting');
      stopper.stop(cfg);
      // so, this is a bit harsh, but due to karma's api,there's no great way to
      // communicate back to test.js that karma failed because the tunnel
      // disappeared. By exiting here, cmd.sh should restart sauce and run the
      // suite again
      //  eslint-disable-next-line no-process-exit
      process.exit(65);
    }
  }
};

/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import WebexCore from '../webex-core';

/**
 * @class
 */
const Auth = (base) =>
  class extends base {
    /**
     * @instance
     * @memberof WebexCore
     * @param {[type]} args
     * @returns {[type]}
     */
    refresh(...args) {
      return this.credentials.refresh(...args);
    }

    /**
     *
     * Check if access token is correctly formated and correct if it's not
     * Warn user if token string has errors in it
     * @param {string} token
     * @returns {string}
     */
    bearerValidator(token) {
      if (token.includes('Bearer') && token.split(' ').length - 1 === 0) {
        console.warn(
          `Your access token does not have a space between 'Bearer' and the token, please add a space to it or replace it with this already fixed version:\n\n${token
            .replace('Bearer', 'Bearer ')
            .replace(/\s+/g, ' ')}`
        );
        console.info(
          "Tip: You don't need to add 'Bearer' to the access_token field. The token by itself is fine"
        );

        return token.replace('Bearer', 'Bearer ').replace(/\s+/g, ' ');
      }
      // Allow elseIf return
      // eslint-disable-next-line  no-else-return
      else if (token.split(' ').length - 1 > 1) {
        console.warn(
          `Your access token has ${
            token.split(' ').length - 2
          } too many spaces, please use this format:\n\n${token.replace(/\s+/g, ' ')}`
        );
        console.info(
          "Tip: You don't need to add 'Bearer' to the access_token field, the token by itself is fine"
        );

        return token.replace(/\s+/g, ' ');
      }

      return token.replace(/\s+/g, ' '); // Clean it anyway (just in case)
    }

    /**
     * Invokes all `onBeforeLogout` handlers in the scope of their plugin, clears
     * all stores, and revokes the access token
     * Note: If you're using the sdk in a server environment, you may be more
     * interested in {@link `webex.internal.mercury.disconnect()`| Mercury#disconnect()}
     * and {@link `webex.internal.device.unregister()`|Device#unregister()}
     * or {@link `webex.phone.unregister()`|Phone#unregister}
     * @instance
     * @memberof WebexCore
     * @param {Object} options Passed as the first argument to all
     * `onBeforeLogout` handlers
     * @returns {Promise}
     */
    logout(options, ...rest) {
      // prefer the refresh token, but for clients that don't have one, fallback
      // to the access token
      const token =
        this.credentials.supertoken &&
        (this.credentials.supertoken.refresh_token || this.credentials.supertoken.access_token);

      options = {token, ...options};

      // onBeforeLogout should be executed in the opposite order in which handlers
      // were registered. In that way, wdm unregister() will be above mercury
      // disconnect(), but disconnect() will execute first.
      // eslint-disable-next-line arrow-body-style
      return this.config.onBeforeLogout
        .reverse()
        .reduce(
          (promise, {plugin, fn}) =>
            promise.then(() => {
              return (
                Promise.resolve(
                  Reflect.apply(fn, this[plugin] || this.internal[plugin], [options, ...rest])
                )
                  // eslint-disable-next-line max-nested-callbacks
                  .catch((err) => {
                    this.logger.warn(`onBeforeLogout from plugin ${plugin}: failed`, err);
                  })
              );
            }),
          Promise.resolve()
        )
        .then(() => Promise.all([this.boundedStorage.clear(), this.unboundedStorage.clear()]))
        .then(() => this.credentials.invalidate(...rest))
        .then(
          () =>
            this.authorization &&
            this.authorization.logout &&
            this.authorization.logout(options, ...rest)
        )
        .then(() => this.emit('client:logout'));
    }
  };

export default Auth;

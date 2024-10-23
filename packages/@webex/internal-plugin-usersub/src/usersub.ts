/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';

import {WebexPlugin} from '@webex/webex-core';
import {safeSetTimeout} from '@webex/common-timers';
import {EXPIRATION_OFFSET, USERSUB_SERVICE_NAME} from './constants';

/**
 * @class
 * @extends WebexPlugin
 */
const Usersub = WebexPlugin.extend({
  namespace: 'Usersub',

  session: {
    crossClientState: {
      type: 'object',
      /**
       * Returns a new Map instance as the default value for crossClientState.
       * @returns {Map}
       */
      default() {
        return new Map();
      },
    },

    refreshTimer: {
      default: undefined,
      type: 'any',
    },
  },

  /**
   * Sets the value for answer-calls-on-wxcc for the calling application.
   * @param {boolean} enable - The state will be enabled/disabled.
   * @param {string} appName - The app setting the state.
   * @param {number} ttl - Time To Live for the event in seconds.
   * @returns {Promise}
   */
  updateAnswerCallsCrossClient(enable: boolean, appName: string, ttl: number) {
    if (typeof enable !== 'boolean') {
      return Promise.reject(new Error('Enable parameter must be a boolean'));
    }

    if (!appName) {
      return Promise.reject(new Error('An appName is required'));
    }

    if (ttl <= 0) {
      return Promise.reject(new Error('A positive ttl is required'));
    }

    const jsonData = {
      users: [this.webex.internal.device.userId],
      compositions: [
        {
          type: 'cross-client-state',
          ttl,
          composition: {
            devices: [
              {
                deviceId: this._extractIdFromUrl(this.webex.internal.device.url),
                appName,
                state: {
                  'answer-calls-on-wxcc': enable,
                },
              },
            ],
          },
        },
      ],
    };

    return this.webex
      .request({
        method: 'POST',
        service: USERSUB_SERVICE_NAME,
        resource: 'publish',
        body: jsonData,
      })
      .then((response) => {
        this.crossClientState.set(appName, enable);
        this._startRefreshTimer(appName, ttl);

        return response.body;
      })
      .catch((error) => {
        this.logger.error(
          `userSub: updateAnswerCallsCrossClient failed with error: ${error.message}`
        );

        return Promise.reject(error);
      });
  },

  /**
   * Starts the refresh timer for the cross-client state.
   * @private
   * @param {string} appName - The app setting the state.
   * @param {number} ttl - Time To Live for the event in seconds.
   * @returns {void}
   */
  _startRefreshTimer(appName: string, ttl: number): void {
    this._stopRefreshTimer();
    const answerCallsState = this.crossClientState.get(appName);
    if (answerCallsState) {
      const refreshTime = ttl * 1000 - EXPIRATION_OFFSET;
      if (refreshTime <= 0) {
        this.logger.warn('Refresh time is non-positive, skipping timer setup.');

        return;
      }
      this.refreshTimer = safeSetTimeout(
        () => this.updateAnswerCallsCrossClient(answerCallsState, appName, ttl),
        refreshTime
      );
    }
  },

  /**
   * Stops the refresh timer for the cross-client state.
   * @private
   * @returns {void}
   */
  _stopRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
  },

  /**
   * Extracts the device ID from a given URL.
   * @param {string} url - The URL to extract the device ID from.
   * @returns {string | null} The extracted device ID or null if not found.
   */
  _extractIdFromUrl(url: string): string {
    if (url) {
      const regex = /\/devices\/([^/?]+)/;
      const match = url.match(regex);

      return match ? match[1] : '';
    }

    return '';
  },
});

export default Usersub;

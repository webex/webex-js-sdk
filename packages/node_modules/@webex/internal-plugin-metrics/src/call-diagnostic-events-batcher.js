/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import Batcher from './batcher';

const CallDiagnosticEventsBatcher = Batcher.extend({
  namespace: 'Metrics',

  /**
   * @param {string} webClientDomain
   * @returns {string}
  */
  getBuildType(webClientDomain) {
    if (
      webClientDomain?.includes('teams.webex.com') ||
      webClientDomain?.includes('localhost') ||
      webClientDomain?.includes('127.0.0.1') ||
      process.env.NODE_ENV !== 'production'
    ) {
      return 'test';
    }

    return process.env.NODE_ENV === 'production' ? 'prod' : 'test';
  },

  prepareItem(item) {
    // networkType should be a enum value: `wifi`, `ethernet`, `cellular`, or `unknown`.
    // Browsers cannot provide such information right now. However, it is a required field.
    const origin = {
      buildType: this.getBuildType(item.event?.eventData?.webClientDomain),
      networkType: 'unknown'
    };

    item.eventPayload.origin = Object.assign(origin, item.eventPayload.origin);

    return Promise.resolve(item);
  },

  prepareRequest(queue) {
    // Add sent timestamp
    queue.forEach((item) => {
      item.eventPayload.originTime = item.eventPayload.originTime || {};
      item.eventPayload.originTime.sent = new Date().toISOString();
    });

    return Promise.resolve(queue);
  },

  submitHttpRequest(payload) {
    return this.webex.request({
      method: 'POST',
      service: 'metrics',
      resource: 'clientmetrics',
      body: {
        metrics: payload
      }
    });
  }
});

export default CallDiagnosticEventsBatcher;

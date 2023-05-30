/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */

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

  /**
   *
   * @param item
   * @returns
   */
  prepareItem(item) {
    // networkType should be a enum value: `wifi`, `ethernet`, `cellular`, or `unknown`.
    // Browsers cannot provide such information right now. However, it is a required field.
    const origin = {
      // TODO: suspect this is wrong, it was event.eventData.... it should be item.eventPayload.eventData.webClientDomain
      buildType: this.getBuildType(item.eventPayload?.eventData?.webClientDomain),
      // network type is supported in chrome.
      networkType: 'unknown',
    };

    item.eventPayload.origin = Object.assign(origin, item.eventPayload.origin);

    return Promise.resolve(item);
  },

  /**
   *
   * @param queue
   * @returns
   */
  prepareRequest(queue) {
    // Add sent timestamp
    queue.forEach((item) => {
      item.eventPayload.originTime = item.eventPayload.originTime || {};
      item.eventPayload.originTime.sent = new Date().toISOString();
    });

    return Promise.resolve(queue);
  },

  /**
   *
   * @param payload
   * @returns
   */
  submitHttpRequest(payload) {
    return this.webex.request({
      method: 'POST',
      service: 'metrics',
      resource: 'clientmetrics',
      body: {
        metrics: payload,
      },
    });
  },
});

export default CallDiagnosticEventsBatcher;

/* eslint-disable class-methods-use-this */
/* eslint-disable valid-jsdoc */

import Batcher from '../batcher';

const CallDiagnosticEventsBatcher = Batcher.extend({
  namespace: 'Metrics',

  /**
   * @param webClientDomain
   * @returns
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
   * Prepare item
   * @param item
   * @returns
   */
  prepareItem(item) {
    const origin = {
      buildType: this.getBuildType(item.event?.eventData?.webClientDomain),
      networkType: 'unknown',
    };

    item.eventPayload.origin = Object.assign(origin, item.eventPayload.origin);

    return Promise.resolve(item);
  },

  /**
   * Prepare request, add time sensitive date etc.
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

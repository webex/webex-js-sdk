import uuid from 'uuid';

import LoggerProxy from './logger-proxy';

/**
 * @class LogsRequest
 */
export default class LogsRequest {
  webex: any;

  /**
   *
   * @param {Object} options
   * @param {Object} options.webex Webex SDK instance
   * @param {ClientMetrics} metrics
   */
  constructor(options: {webex: object}) {
    this.webex = options.webex;
  }

  /**
   * Uploads logs to the support server
   *
   * @param {Object} [options={}]
   * @param {String} [options.feedbackId=uuid.v4] ID used for tracking
   * @param {String} [options.locusId]
   * @param {String} [options.correlationId]
   * @param {String} [options.callStart] Call Start Time
   * @param {String} [options.meetingId] webex meeting ID
   * @returns {Promise.<String>} Feedback ID
   * @memberof LogsRequest
   */
  async uploadLogs(
    options: {
      feedbackId?: string;
      locusId?: string;
      correlationId?: string;
      callStart?: string;
      meetingId?: string;
    } = {}
  ) {
    const id = options.feedbackId || uuid.v4();
    const {locusId, correlationId, meetingId, callStart} = options;

    LoggerProxy.logger.info(
      `Logs:request#uploadLogs --> uploading user logs for feedbackId: ${id}`
    );

    try {
      await this.webex.internal.support.submitLogs({
        feedbackId: id,
        locusId,
        correlationId,
        meetingId,
        callStart,
      });
    } catch (error) {
      LoggerProxy.logger.error('Logs:request#uploadLogs --> uploading user logs failed', error);

      return Promise.reject(error);
    }

    return id;
  }
}

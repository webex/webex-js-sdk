/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * @description Metrics handles all the call metrics events
 * @export
 * @class Metrics
 */
class Metrics {
  static instance: Metrics;
  webex: any;

  /**
   * Create Metrics Object
   * @constructor
   * @public
   * @memberof Meetings
   */
  constructor() {
    if (!Metrics.instance) {
      /**
       * @instance
       * @type {Metrics}
       * @private
       * @memberof Metrics
       */
      Metrics.instance = this;
    }

    // eslint-disable-next-line no-constructor-return
    return Metrics.instance;
  }

  /**
   * Initializes the Metrics singleton with a meeting Collection.
   *
   * @param {Object} webex  webex SDK object
   *
   * @returns {void}
   */
  initialSetup(webex: object) {
    this.webex = webex;
  }

  /**
   * Uploads given metric to the Metrics service as an Behavioral metric.
   * Metadata about the environment such as browser, OS, SDK and their versions
   * are automatically added when the metric is sent.
   *
   * The Metrics service will send an Behavioral metric to InfluxDB for
   * aggregation.
   * See https://confluence-eng-gpk2.cisco.com/conf/display/WBXT/Getting+started+with+Metrics+Service.
   *
   * @param {string} metricName  Name of the metric (measurement) to send
   * @param {Object} metricFields  Key-valye pairs of data or values about this metric
   * @param {Object} metricTags  Key-value pairs of metric metadata
   *
   * @returns {void}
   */
  sendBehavioralMetric(metricName: string, metricFields: object = {}, metricTags: object = {}) {
    this.webex.internal.metrics.submitClientMetrics(metricName, {
      type: this.webex.config.metrics.type,
      fields: metricFields,
      tags: metricTags,
    });
  }
}

// Export Metrics singleton ---------------------------------------------------
const instance = new Metrics();

export default instance;

const TEMP_METRICS_URL = 'https://sj1-utsa.webex.com/metric/v2';
const appId = 'FFB51ED5-4319-4C55-8303-B1F2FCCDE231';

/**
 * Rtc Metrics
 */
export default class RtcMetrics {
  /**
   * Array of MetricData items to be sent to the metrics service.
   */
  metricsQueue = [];

  intervalId: number;

  webex: any;

  correlationId: string;

  /**
   * Initialize the interval.
   *
   * @param {object} webex - The main `webex` object.
   * @param {string} correlationId - Correlation id used for debugging.
   */
  constructor(webex, correlationId) {
    this.intervalId = setInterval(this.checkMetrics.bind(this), 60 * 1000);
    this.correlationId = correlationId;
    this.webex = webex;
  }

  /**
   * Check to see if the metrics queue has any items.
   *
   * @returns {void}
   */
  private checkMetrics() {
    if (this.metricsQueue.length) {
      this.sendMetrics();
      this.metricsQueue = [];
    }
  }

  /**
   * Add metrics items to the metrics queue.
   *
   * @param {object} data - An object with a payload array of metrics items.
   *
   * @returns {void}
   */
  addMetrics(data) {
    if (data.payload.length) {
      this.metricsQueue.push(data);
    }
  }

  /**
   * Clear the metrics interval.
   *
   * @returns {void}
   */
  closeMetrics() {
    clearInterval(this.intervalId);
  }

  /**
   * Send metrics to the metrics service.
   *
   * @returns {void}
   */
  private sendMetrics() {
    this.webex.request({
      method: 'POST',
      // TODO: use service instead of uri when added to u2c catalog
      // service: 'unifiedTelemetry',
      // resource: 'metric/v2',
      uri: TEMP_METRICS_URL,
      headers: {
        'Content-Type': 'application/json',
        // NOTE: authorization is automatic in `webex.request()`
        // Authorization: `Bearer ${this.token}`,
        trackingId: this.correlationId,
        type: 'webrtcMedia',
        appId,
      },
      body: {
        metrics: this.metricsQueue,
      },
    });
  }
}

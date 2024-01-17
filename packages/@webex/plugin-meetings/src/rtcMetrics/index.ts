import anonymizeIP from 'ip-anonymize';
import RTC_METRICS from './constants';

/**
 * Anonymize identifiable information. For now, only IP addresses.
 *
 * @param {array} stats - An RTCStatsReport organized into an array of strings.
 * @returns {void}
 */
const removePii = (stats: string[]): string[] => {
  return stats.map((statLine) => {
    const data = JSON.parse(statLine);
    // on local and remote candidates, anonymize the last 4 bits.
    if (data.type === 'local-candidate' || data.type === 'remote-candidate') {
      data.ip = anonymizeIP(data.ip, 28, 96) || undefined;
      data.address = anonymizeIP(data.address, 28, 96) || undefined;
      data.relatedAddress = anonymizeIP(data.relatedAddress, 28, 96) || undefined;
    }

    return JSON.stringify(data);
  });
};

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

  meetingId: string;

  correlationId: string;

  /**
   * Initialize the interval.
   *
   * @param {object} webex - The main `webex` object.
   * @param {string} meetingId - The meeting id.
   * @param {string} correlationId - The correlation id.
   */
  constructor(webex, meetingId, correlationId) {
    // `window` is used to prevent typescript from returning a NodeJS.Timer.
    this.intervalId = window.setInterval(this.sendMetricsInQueue.bind(this), 30 * 1000);
    this.meetingId = meetingId;
    this.webex = webex;
    this.correlationId = correlationId;
    // Send the first set of metrics at 5 seconds in the case of a user leaving the call shortly after joining.
    setTimeout(this.sendMetricsInQueue.bind(this), 5 * 1000);
  }

  /**
   * Check to see if the metrics queue has any items.
   *
   * @returns {void}
   */
  public sendMetricsInQueue() {
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
      if (data.name === 'stats-report') {
        data.payload = removePii(data.payload);
      }
      this.metricsQueue.push(data);
    }
  }

  /**
   * Clear the metrics interval.
   *
   * @returns {void}
   */
  closeMetrics() {
    this.sendMetricsInQueue();
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
      service: 'unifiedTelemetry',
      resource: 'metric/v2',
      headers: {
        type: 'webrtcMedia',
        appId: RTC_METRICS.APP_ID,
      },
      body: {
        metrics: [
          {
            type: 'webrtc',
            version: '1.0.1',
            userId: this.webex.internal.device.userId,
            meetingId: this.meetingId,
            correlationId: this.correlationId,
            data: this.metricsQueue,
          },
        ],
      },
    });
  }
}

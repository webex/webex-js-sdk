/* eslint-disable class-methods-use-this */
import {CallDiagnosticUtils} from '@webex/internal-plugin-metrics';
import uuid from 'uuid';
import RTC_METRICS from './constants';

const parseJsonPayload = (payload: any[]): any | null => {
  try {
    if (payload && payload[0]) {
      return JSON.parse(payload[0]);
    }

    return null;
  } catch (_) {
    return null;
  }
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

  connectionId: string;

  shouldSendMetricsOnNextStatsReport: boolean;

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
    this.resetConnection();
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
   * Forces sending metrics when we get the next stats-report
   *
   * This is useful for cases when something important happens that affects the media connection,
   * for example when we move from lobby into the meeting.
   *
   * @returns {void}
   */
  public sendNextMetrics() {
    this.shouldSendMetricsOnNextStatsReport = true;
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
        data.payload = data.payload.map(this.anonymizeIp);
      }

      this.metricsQueue.push(data);

      if (this.shouldSendMetricsOnNextStatsReport && data.name === 'stats-report') {
        // this is the first useful set of data (WCME gives it to us after 5s), send it out immediately
        // in case the user is unhappy and closes the browser early
        this.sendMetricsInQueue();
        this.shouldSendMetricsOnNextStatsReport = false;
      }

      try {
        // If a connection fails, send the rest of the metrics in queue and get a new connection id.
        const parsedPayload = parseJsonPayload(data.payload);
        if (
          data.name === 'onconnectionstatechange' &&
          parsedPayload &&
          parsedPayload.value === 'failed'
        ) {
          this.sendMetricsInQueue();
          this.resetConnection();
        }
      } catch (e) {
        console.error(e);
      }
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
   * Anonymize IP addresses.
   *
   * @param {array} stats - An RTCStatsReport organized into an array of strings.
   * @returns {string}
   */
  anonymizeIp(stats: string): string {
    const data = JSON.parse(stats);
    // on local and remote candidates, anonymize the last 4 bits.
    if (data.type === 'local-candidate' || data.type === 'remote-candidate') {
      data.ip = CallDiagnosticUtils.anonymizeIPAddress(data.ip) || undefined;
      data.address = CallDiagnosticUtils.anonymizeIPAddress(data.address) || undefined;
      data.relatedAddress =
        CallDiagnosticUtils.anonymizeIPAddress(data.relatedAddress) || undefined;
    }

    return JSON.stringify(data);
  }

  /**
   * Set a new connection id.
   *
   * @returns {void}
   */
  private resetConnection() {
    this.connectionId = uuid.v4();
    this.shouldSendMetricsOnNextStatsReport = true;
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
            version: '1.1.0',
            userId: this.webex.internal.device.userId,
            meetingId: this.meetingId,
            correlationId: this.correlationId,
            connectionId: this.connectionId,
            data: this.metricsQueue,
          },
        ],
      },
    });
  }
}

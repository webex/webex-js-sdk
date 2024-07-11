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
  metricsQueue: Record<string, any>[] = [];

  intervalId: number;

  webex: any;

  meetingId: string;

  correlationId: string;

  connectionId: string | undefined;

  /**
   * Initialize the interval.
   *
   * @param {object} webex - The main `webex` object.
   * @param {string} meetingId - The meeting id.
   * @param {string} correlationId - The correlation id.
   */
  constructor(webex: Record<string, any>, meetingId: string, correlationId: string) {
    // `window` is used to prevent typescript from returning a NodeJS.Timer.
    this.intervalId = window.setInterval(this.sendMetricsInQueue.bind(this), 30 * 1000);
    this.meetingId = meetingId;
    this.webex = webex;
    this.correlationId = correlationId;
    this.setNewConnectionId();
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
  addMetrics(data: Record<string, any>) {
    if (data.payload.length) {
      if (data.name === 'stats-report') {
        data.payload = data.payload.map(this.anonymizeIp);
      }

      this.metricsQueue.push(data);

      try {
        // If a connection fails, send the rest of the metrics in queue and get a new connection id.
        const parsedPayload = parseJsonPayload(data.payload);
        if (
          data.name === 'onconnectionstatechange' &&
          parsedPayload &&
          parsedPayload.value === 'failed'
        ) {
          this.sendMetricsInQueue();
          this.setNewConnectionId();
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
  private setNewConnectionId() {
    this.connectionId = uuid.v4();
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

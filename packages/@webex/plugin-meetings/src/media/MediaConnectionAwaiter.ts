import {Defer} from '@webex/common';
import {ConnectionState, MediaConnectionEventNames} from '@webex/internal-media-core';
import LoggerProxy from '../common/logs/logger-proxy';
import {ICE_AND_DTLS_CONNECTION_TIMEOUT} from '../constants';
import BEHAVIORAL_METRICS from '../metrics/constants';
import Metrics from '../metrics';

export interface MediaConnectionAwaiterProps {
  webrtcMediaConnection: any;
  correlationId: string;
}

/**
 * @class MediaConnectionAwaiter
 */
export default class MediaConnectionAwaiter {
  private webrtcMediaConnection: any;
  private timer: any;
  private defer: Defer;
  private retried: boolean;
  private iceConnected: boolean;
  private correlationId: string;
  private onTimeoutCallback: () => void;
  private peerConnectionStateCallback: () => void;
  private iceConnectionStateCallback: () => void;
  private iceGatheringStateCallback: () => void;

  /**
   * @param {MediaConnectionAwaiterProps} mediaConnectionAwaiterProps
   */
  constructor({webrtcMediaConnection, correlationId}: MediaConnectionAwaiterProps) {
    this.webrtcMediaConnection = webrtcMediaConnection;
    this.defer = new Defer();
    this.retried = false;
    this.iceConnected = false;
    this.correlationId = correlationId;
    this.onTimeoutCallback = this.onTimeout.bind(this);
    this.peerConnectionStateCallback = this.peerConnectionStateHandler.bind(this);
    this.iceConnectionStateCallback = this.iceConnectionStateHandler.bind(this);
    this.iceGatheringStateCallback = this.iceGatheringStateHandler.bind(this);
  }

  /**
   * Returns true if the connection is connected, false otherwise.
   *
   * @returns {boolean}
   */
  private isConnected(): boolean {
    return this.webrtcMediaConnection.getConnectionState() === ConnectionState.Connected;
  }

  /**
   * Returns true if the connection is in an unrecoverable "failed" state
   *
   * @returns {boolean}
   */
  private isFailed(): boolean {
    return this.webrtcMediaConnection.getConnectionState() === ConnectionState.Failed;
  }

  /**
   * Returns true if the ICE Gathering is completed, false otherwise.
   *
   * @returns {boolean}
   */
  private isIceGatheringCompleted(): boolean {
    return this.webrtcMediaConnection.getIceGatheringState() === 'complete';
  }

  /**
   * Clears the callbacks.
   *
   * @returns {void}
   */
  private clearCallbacks(): void {
    this.webrtcMediaConnection.off(
      MediaConnectionEventNames.ICE_GATHERING_STATE_CHANGED,
      this.iceGatheringStateCallback
    );
    this.webrtcMediaConnection.off(
      MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED,
      this.peerConnectionStateCallback
    );
    this.webrtcMediaConnection.off(
      MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED,
      this.iceConnectionStateCallback
    );
  }

  /**
   * On connection state change.
   *
   * @returns {void}
   */
  connectionStateChange(): void {
    LoggerProxy.logger.log(
      `Media:MediaConnectionAwaiter#connectionStateChange --> connection state: ${this.webrtcMediaConnection.getConnectionState()}`
    );

    if (this.isFailed()) {
      LoggerProxy.logger.warn(
        'Media:MediaConnectionAwaiter#connectionStateChange --> ICE failed, rejecting'
      );
      this.clearCallbacks();

      this.defer.reject({
        iceConnected: this.iceConnected,
      });
    }

    if (!this.isConnected()) {
      return;
    }

    clearTimeout(this.timer);

    this.clearCallbacks();

    LoggerProxy.logger.warn('Media:MediaConnectionAwaiter#connectionStateChange --> Resolving');

    this.defer.resolve();
  }

  /**
   * Listener for peer connection state change.
   *
   * @returns {void}
   */
  peerConnectionStateHandler(): void {
    const peerConnectionState = this.webrtcMediaConnection.getPeerConnectionState();

    LoggerProxy.logger.log(
      `Media:MediaConnectionAwaiter#peerConnectionStateHandler --> Peer connection state change -> ${peerConnectionState}`
    );

    this.connectionStateChange();
  }

  /**
   * Listener for ICE connection state change.
   *
   * @returns {void}
   */
  iceConnectionStateHandler(): void {
    const iceConnectionState = this.webrtcMediaConnection.getIceConnectionState();

    LoggerProxy.logger.log(
      `Media:MediaConnectionAwaiter#iceConnectionStateHandler --> ICE connection state change -> ${iceConnectionState}`
    );

    if (iceConnectionState === 'connected' && !this.iceConnected) {
      this.iceConnected = true;
    }

    this.connectionStateChange();
  }

  /**
   * Listener for ICE gathering state change.
   *
   * @returns {void}
   */
  iceGatheringStateHandler(): void {
    const iceGatheringState = this.webrtcMediaConnection.getIceGatheringState();

    LoggerProxy.logger.log(
      `Media:MediaConnectionAwaiter#iceGatheringStateHandler --> ICE gathering state change -> ${iceGatheringState}`
    );

    if (!this.isIceGatheringCompleted()) {
      return;
    }

    if (this.isConnected()) {
      return;
    }

    clearTimeout(this.timer);

    this.timer = setTimeout(this.onTimeoutCallback, ICE_AND_DTLS_CONNECTION_TIMEOUT);
  }

  /**
   * sends a metric with some additional info that might help debugging
   * issues where browser doesn't update the RTCPeerConnection's iceConnectionState or connectionState
   *
   * @returns {void}
   */
  async sendMetric() {
    const stats = await this.webrtcMediaConnection.getStats();

    // in theory we can end up with more than one transport report in the stats,
    // but for the purpose of this metric it's fine to just use the first one
    const transportReports = Array.from(
      stats.values().filter((report) => report.type === 'transport')
    ) as Record<string, number | string>[];

    Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MEDIA_STILL_NOT_CONNECTED, {
      correlation_id: this.correlationId,
      numTransports: transportReports.length,
      dtlsState: transportReports[0]?.dtlsState,
      iceState: transportReports[0]?.iceState,
      packetsSent: transportReports[0]?.packetsSent,
      packetsReceived: transportReports[0]?.packetsReceived,
      dataChannelState: this.webrtcMediaConnection.multistreamConnection?.dataChannel?.readyState,
    });
  }

  /**
   * Function called when the timeout is reached.
   *
   * @returns {void}
   */
  onTimeout(): void {
    if (this.isConnected()) {
      this.clearCallbacks();

      this.defer.resolve();

      return;
    }

    this.sendMetric();

    if (!this.isIceGatheringCompleted()) {
      if (!this.retried) {
        LoggerProxy.logger.warn(
          'Media:MediaConnectionAwaiter#onTimeout --> ICE gathering did not complete within the timeout for the first time, retrying once'
        );

        // retry once if ICE gathering is not completed
        this.retried = true;
        clearTimeout(this.timer);
        this.timer = setTimeout(this.onTimeoutCallback, ICE_AND_DTLS_CONNECTION_TIMEOUT);

        return;
      }

      LoggerProxy.logger.warn(
        'Media:MediaConnectionAwaiter#onTimeout --> ICE gathering did not complete within the timeout for the second time, rejecting'
      );
    } else {
      LoggerProxy.logger.warn(
        'Media:MediaConnectionAwaiter#onTimeout --> ICE gathering completed, but connection state is not connected, rejecting'
      );
    }

    this.clearCallbacks();

    this.defer.reject({
      iceConnected: this.iceConnected,
    });
  }

  /**
   * Waits for the webrtc media connection to be connected.
   *
   * @returns {Promise}
   */
  waitForMediaConnectionConnected(): Promise<void> {
    if (this.isConnected()) {
      LoggerProxy.logger.log(
        'Media:MediaConnectionAwaiter#waitForMediaConnectionConnected --> Already connected'
      );

      return Promise.resolve();
    }
    LoggerProxy.logger.log(
      'Media:MediaConnectionAwaiter#waitForMediaConnectionConnected --> Waiting for media connection to be connected'
    );

    this.webrtcMediaConnection.on(
      MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED,
      this.peerConnectionStateCallback
    );

    this.webrtcMediaConnection.on(
      MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED,
      this.iceConnectionStateCallback
    );

    this.webrtcMediaConnection.on(
      MediaConnectionEventNames.ICE_GATHERING_STATE_CHANGED,
      this.iceGatheringStateCallback
    );

    this.timer = setTimeout(this.onTimeoutCallback, ICE_AND_DTLS_CONNECTION_TIMEOUT);

    return this.defer.promise;
  }
}

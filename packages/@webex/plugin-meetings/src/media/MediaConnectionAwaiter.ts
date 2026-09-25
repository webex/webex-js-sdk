import {Defer} from '@webex/common';
import {ConnectionState, MediaConnectionEventNames} from '@webex/internal-media-core';
import LoggerProxy from '../common/logs/logger-proxy';
import {DTLS_CONNECTION_TIMEOUT, ICE_CONNECTION_TIMEOUT} from '../constants';
import BEHAVIORAL_METRICS from '../metrics/constants';
import Metrics from '../metrics';

export interface MediaConnectionAwaiterProps {
  webrtcMediaConnection: any;
  correlationId: string;
}

export interface FailureResult {
  iceConnected: boolean;
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
   * Returns true if ICE connection state indicates connectivity.
   *
   * @returns {boolean}
   */
  private isIceConnected(): boolean {
    const state = this.webrtcMediaConnection.getIceConnectionState();

    return state === 'connected' || state === 'completed';
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
      } satisfies FailureResult);
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

    if (this.isIceConnected() && !this.iceConnected) {
      this.iceConnected = true;

      // ICE has just connected, so only the DTLS handshake remains. That is
      // normally very quick (1-3s), so switch to the shorter DTLS timeout.
      if (!this.isConnected()) {
        this.startDtlsTimer();
      }
    }

    this.connectionStateChange();
  }

  /**
   * Starts the (shorter) DTLS timeout, used once ICE is connected and only the
   * DTLS handshake remains before the connection is fully connected.
   *
   * @returns {void}
   */
  private startDtlsTimer(): void {
    LoggerProxy.logger.log(
      'Media:MediaConnectionAwaiter#startDtlsTimer --> ICE connected, waiting for DTLS with the shorter timeout'
    );

    clearTimeout(this.timer);

    this.timer = setTimeout(this.onTimeoutCallback, DTLS_CONNECTION_TIMEOUT);
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

    if (this.iceConnected) {
      // ICE is already connected, so we are waiting for DTLS with the shorter
      // DTLS timeout - don't restart it with the longer ICE timeout.
      return;
    }

    clearTimeout(this.timer);

    this.timer = setTimeout(this.onTimeoutCallback, ICE_CONNECTION_TIMEOUT);
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

    if (!this.isIceGatheringCompleted() && !this.retried) {
      LoggerProxy.logger.warn(
        'Media:MediaConnectionAwaiter#onTimeout --> ICE gathering did not complete within the timeout for the first time, retrying once'
      );

      // retry once if ICE gathering is not completed, keeping the current phase's
      // timeout (shorter DTLS timeout if ICE is already connected)
      this.retried = true;
      clearTimeout(this.timer);
      this.timer = setTimeout(
        this.onTimeoutCallback,
        this.iceConnected ? DTLS_CONNECTION_TIMEOUT : ICE_CONNECTION_TIMEOUT
      );

      return;
    }

    if (this.iceConnected) {
      // ICE connected, but the DTLS handshake did not complete within the
      // shorter DTLS timeout, so there is nothing left to retry - reject.
      LoggerProxy.logger.warn(
        'Media:MediaConnectionAwaiter#onTimeout --> ICE connected but DTLS did not complete within the timeout, rejecting'
      );
    } else if (!this.isIceGatheringCompleted()) {
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
    } satisfies FailureResult);
  }

  /**
   * Waits for the webrtc media connection to be connected.
   *
   * @returns {Promise<void>} In case of failure, the promise is rejected with FailureResult
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

    this.iceConnected = this.isIceConnected();

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

    // if ICE is already connected, only the DTLS handshake remains, so use the
    // shorter DTLS timeout, otherwise use the longer ICE timeout
    this.timer = setTimeout(
      this.onTimeoutCallback,
      this.iceConnected ? DTLS_CONNECTION_TIMEOUT : ICE_CONNECTION_TIMEOUT
    );

    return this.defer.promise;
  }
}

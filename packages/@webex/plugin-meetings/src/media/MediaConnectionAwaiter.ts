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
  iceConnectedAtLeastOnce: boolean;
}

type ConnectionPhase = 'ice' | 'dtls';

/**
 * @class MediaConnectionAwaiter
 */
export default class MediaConnectionAwaiter {
  private webrtcMediaConnection: any;
  private timer?: ReturnType<typeof setTimeout>;
  private defer: Defer;
  private gatheringTimeoutRetried = false;
  private iceConnectedAtLeastOnce = false;
  private phase?: ConnectionPhase;
  private started = false;
  private settled = false;
  private callbacksRegistered = false;
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
    this.correlationId = correlationId;
    this.onTimeoutCallback = this.onTimeout.bind(this);
    this.peerConnectionStateCallback = this.peerConnectionStateHandler.bind(this);
    this.iceConnectionStateCallback = this.iceConnectionStateHandler.bind(this);
    this.iceGatheringStateCallback = this.iceGatheringStateHandler.bind(this);
  }

  /**
   * Returns whether ICE currently indicates connectivity.
   * @returns {boolean}
   */
  private isIceConnected(): boolean {
    const state = this.webrtcMediaConnection.getIceConnectionState();

    return state === 'connected' || state === 'completed';
  }

  /**
   * Returns whether ICE gathering has completed.
   * @returns {boolean}
   */
  private isIceGatheringCompleted(): boolean {
    return this.webrtcMediaConnection.getIceGatheringState() === 'complete';
  }

  /**
   * Removes the registered state listeners.
   * @returns {void}
   */
  private clearCallbacks(): void {
    if (!this.callbacksRegistered) {
      return;
    }
    this.callbacksRegistered = false;
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
   * Settles the wait and releases its timer and listeners exactly once.
   * @param {FailureResult} [failure] - Failure details, or undefined to resolve
   * @returns {void}
   */
  private settle(failure?: FailureResult): void {
    if (this.settled) {
      return;
    }
    this.settled = true;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.clearCallbacks();

    if (failure) {
      this.defer.reject(failure);
    } else {
      this.defer.resolve();
    }
  }

  /**
   * Captures current and historical ICE connectivity for failures and metrics.
   * @returns {FailureResult}
   */
  private getConnectivity(): FailureResult {
    const iceConnected = this.isIceConnected();
    this.iceConnectedAtLeastOnce ||= iceConnected;

    return {iceConnected, iceConnectedAtLeastOnce: this.iceConnectedAtLeastOnce};
  }

  /**
   * Starts a fresh deadline for the current phase.
   * @param {string} reason - Why the timer is being started or restarted
   * @returns {void}
   */
  private startTimer(reason: string): void {
    const timeout = this.phase === 'dtls' ? DTLS_CONNECTION_TIMEOUT : ICE_CONNECTION_TIMEOUT;

    LoggerProxy.logger.log(
      `Media:MediaConnectionAwaiter#startTimer --> starting ${this.phase} timeout (${timeout}ms): ${reason}`
    );

    if (this.timer !== undefined) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(this.onTimeoutCallback, timeout);
  }

  /**
   * Evaluates terminal states and synchronizes the timeout with current ICE connectivity.
   * @param {string} trigger - Callback or operation that triggered the evaluation
   * @returns {boolean} Whether a new phase deadline was started
   */
  connectionStateChange(trigger: string): boolean {
    const state = this.webrtcMediaConnection.getConnectionState();

    LoggerProxy.logger.log(
      `Media:MediaConnectionAwaiter#connectionStateChange --> triggered by ${trigger}, connection state: ${state}, peer connection state: ${this.webrtcMediaConnection.getPeerConnectionState()}, ICE connection state: ${this.webrtcMediaConnection.getIceConnectionState()}, ICE gathering state: ${this.webrtcMediaConnection.getIceGatheringState()}, settled: ${
        this.settled
      }`
    );

    if (this.settled) {
      return false;
    }

    const connectivity = this.getConnectivity();

    if (state === ConnectionState.Connected) {
      this.settle();

      return false;
    }
    if (state === ConnectionState.Failed || state === ConnectionState.Closed) {
      this.settle(connectivity);

      return false;
    }

    const phase: ConnectionPhase = connectivity.iceConnected ? 'dtls' : 'ice';
    if (phase === this.phase) {
      return false;
    }

    const previousPhase = this.phase;
    this.phase = phase;
    this.startTimer(
      `${trigger}: ${
        previousPhase
          ? `phase changed from ${previousPhase} to ${phase}`
          : 'initial connection phase'
      }`
    );

    return true;
  }

  /**
   * Listener for peer connection state changes.
   * @returns {void}
   */
  peerConnectionStateHandler(): void {
    this.connectionStateChange('peerConnectionStateHandler');
  }

  /**
   * Listener for ICE connection state changes.
   * @returns {void}
   */
  iceConnectionStateHandler(): void {
    this.connectionStateChange('iceConnectionStateHandler');
  }

  /**
   * Restarts the ICE deadline when gathering completes, without extending DTLS.
   * @returns {void}
   */
  iceGatheringStateHandler(): void {
    const phaseChanged = this.connectionStateChange('iceGatheringStateHandler');

    if (!this.settled && !phaseChanged && this.phase === 'ice' && this.isIceGatheringCompleted()) {
      this.startTimer('iceGatheringStateHandler: ICE gathering completed');
    }
  }

  /**
   * Sends connectivity diagnostics when a connection deadline expires.
   * @returns {Promise<void>}
   */
  async sendMetric(): Promise<void> {
    // Capture connectivity before awaiting stats, which may finish after another state change.
    const connectivity = this.getConnectivity();
    const stats = await this.webrtcMediaConnection.getStats();

    // There may be multiple transport reports; the first is sufficient for this metric.
    const transportReports = Array.from(
      stats.values().filter((report) => report.type === 'transport')
    ) as Record<string, number | string>[];

    Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MEDIA_STILL_NOT_CONNECTED, {
      correlation_id: this.correlationId,
      ...connectivity,
      numTransports: transportReports.length,
      dtlsState: transportReports[0]?.dtlsState,
      iceState: transportReports[0]?.iceState,
      packetsSent: transportReports[0]?.packetsSent,
      packetsReceived: transportReports[0]?.packetsReceived,
      dataChannelState: this.webrtcMediaConnection.multistreamConnection?.dataChannel?.readyState,
    });
  }

  /**
   * Rechecks state before applying the deadline or the single gathering retry.
   * @returns {void}
   */
  onTimeout(): void {
    const phaseChanged = this.connectionStateChange('onTimeout');
    if (this.settled || phaseChanged) {
      return;
    }

    this.sendMetric().catch((error) => {
      LoggerProxy.logger.warn('Media:MediaConnectionAwaiter#onTimeout --> metric failed', error);
    });

    if (!this.isIceGatheringCompleted() && !this.gatheringTimeoutRetried) {
      this.gatheringTimeoutRetried = true;
      LoggerProxy.logger.warn(
        'Media:MediaConnectionAwaiter#onTimeout --> ICE gathering incomplete, retrying once'
      );
      this.startTimer('onTimeout: retrying once because ICE gathering is incomplete');

      return;
    }

    LoggerProxy.logger.warn(
      `Media:MediaConnectionAwaiter#onTimeout --> ${this.phase} timeout, rejecting`
    );
    this.settle(this.getConnectivity());
  }

  /**
   * Waits for ICE and DTLS connectivity, rejecting terminal states immediately.
   * @returns {Promise<void>} Rejects with FailureResult on failure
   */
  waitForMediaConnectionConnected(): Promise<void> {
    if (this.started) {
      return this.defer.promise;
    }
    this.started = true;

    const state = this.webrtcMediaConnection.getConnectionState();
    if (
      state !== ConnectionState.Connected &&
      state !== ConnectionState.Failed &&
      state !== ConnectionState.Closed
    ) {
      this.callbacksRegistered = true;
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
    }

    this.connectionStateChange('waitForMediaConnectionConnected');

    return this.defer.promise;
  }
}

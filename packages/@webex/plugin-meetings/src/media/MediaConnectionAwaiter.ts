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

type State =
  | {name: 'idle'}
  | {name: 'ice'; gatheringRetried: boolean}
  | {name: 'dtls'}
  | {name: 'connected'}
  | {name: 'failed'; result: FailureResult};

type ActiveState = Extract<State, {name: 'ice' | 'dtls'}>;
type EnteredState = Exclude<State, {name: 'idle'}>;

const PHASE_TIMEOUT: Record<ActiveState['name'], number> = {
  ice: ICE_CONNECTION_TIMEOUT,
  dtls: DTLS_CONNECTION_TIMEOUT,
};

/**
 * Waits for ICE and DTLS connectivity using explicit lifecycle states.
 */
export default class MediaConnectionAwaiter {
  private props: MediaConnectionAwaiterProps;
  private state: State = {name: 'idle'};
  private timer?: ReturnType<typeof setTimeout>;
  private iceConnectedAtLeastOnce = false;
  private defer = new Defer();

  /**
   * @param {MediaConnectionAwaiterProps} props
   */
  constructor(props: MediaConnectionAwaiterProps) {
    this.props = props;
  }

  /**
   * Registers listeners and starts the wait once, settling terminal connections immediately.
   * @returns {Promise<void>} Rejects with FailureResult on failure
   */
  waitForMediaConnectionConnected(): Promise<void> {
    if (this.state.name === 'idle') {
      this.registerCallbacks();
      this.evaluate('waitForMediaConnectionConnected');
    }

    return this.defer.promise;
  }

  /**
   * Applies a transition to a new state and owns its deadline or terminal settlement.
   * @param {EnteredState} next - State to enter; an active wait cannot return to idle
   * @param {string} reason - Trigger or reason for the transition
   * @returns {void}
   */
  private enter(next: EnteredState, reason: string): void {
    if (this.isTerminal()) {
      return;
    }

    LoggerProxy.logger.log(
      `Media:MediaConnectionAwaiter#enter --> ${this.state.name} -> ${next.name}: ${reason}`
    );
    this.state = next;

    switch (next.name) {
      case 'ice':
      case 'dtls':
        this.armTimer(next, reason);
        break;
      case 'connected':
        this.teardown();
        this.defer.resolve();
        break;
      case 'failed':
        this.teardown();
        this.defer.reject(next.result);
        break;
    }
  }

  /**
   * Returns whether the promise has settled.
   * @returns {boolean}
   */
  private isTerminal(): boolean {
    return this.state.name === 'connected' || this.state.name === 'failed';
  }

  /**
   * Returns the current state only if it owns a connection deadline.
   * @returns {ActiveState | undefined}
   */
  private getActiveState(): ActiveState | undefined {
    const {state} = this;

    return state.name === 'ice' || state.name === 'dtls' ? state : undefined;
  }

  /**
   * Logs current browser state and transitions when connectivity or phase changes.
   * @param {string} trigger - Callback or operation that triggered evaluation
   * @returns {boolean} Whether a state transition occurred
   */
  private evaluate(trigger: string): boolean {
    const connection = this.props.webrtcMediaConnection;
    const connectionState = connection.getConnectionState();

    LoggerProxy.logger.log(
      `Media:MediaConnectionAwaiter#evaluate --> triggered by ${trigger}, connection state: ${connectionState}, peer connection state: ${connection.getPeerConnectionState()}, ICE connection state: ${connection.getIceConnectionState()}, ICE gathering state: ${connection.getIceGatheringState()}, awaiter state: ${
        this.state.name
      }`
    );

    if (this.isTerminal()) {
      return false;
    }

    const connectivity = this.getConnectivity();
    if (connectionState === ConnectionState.Connected) {
      this.enter({name: 'connected'}, trigger);

      return true;
    }
    if (connectionState === ConnectionState.Failed || connectionState === ConnectionState.Closed) {
      this.enter({name: 'failed', result: connectivity}, trigger);

      return true;
    }

    const phase = connectivity.iceConnected ? 'dtls' : 'ice';
    if (this.state.name === phase) {
      return false;
    }

    this.enter(phase === 'ice' ? {name: 'ice', gatheringRetried: false} : {name: 'dtls'}, trigger);

    return true;
  }

  /**
   * Listener for peer connection state changes.
   * @returns {void}
   */
  peerConnectionStateHandler = (): void => {
    this.evaluate('peerConnectionStateHandler');
  };

  /**
   * Listener for ICE connection state changes.
   * @returns {void}
   */
  iceConnectionStateHandler = (): void => {
    this.evaluate('iceConnectionStateHandler');
  };

  /**
   * Restarts only an unchanged ICE phase when gathering completes.
   * @returns {void}
   */
  iceGatheringStateHandler = (): void => {
    const changed = this.evaluate('iceGatheringStateHandler');
    if (!changed && this.state.name === 'ice' && this.isIceGatheringCompleted()) {
      this.armTimer(this.state, 'iceGatheringStateHandler: ICE gathering completed');
    }
  };

  /**
   * Rechecks connectivity before applying the deadline or the ICE gathering retry.
   * @returns {void}
   */
  onTimeout = (): void => {
    if (this.evaluate('onTimeout')) {
      return;
    }

    const state = this.getActiveState();
    if (!state) {
      return;
    }

    this.sendMetric().catch((error) => {
      LoggerProxy.logger.warn('Media:MediaConnectionAwaiter#onTimeout --> metric failed', error);
    });

    if (state.name === 'ice' && !state.gatheringRetried && !this.isIceGatheringCompleted()) {
      this.enter(
        {...state, gatheringRetried: true},
        'onTimeout: ICE gathering incomplete, retrying once'
      );

      return;
    }

    this.enter({name: 'failed', result: this.getConnectivity()}, `${state.name} timeout`);
  };

  /**
   * Arms an active phase's deadline and logs every start or restart.
   * @param {ActiveState} state - Active state whose deadline is being started
   * @param {string} reason - Why the deadline is being started or restarted
   * @returns {void}
   */
  private armTimer(state: ActiveState, reason: string): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
    }
    const timeout = PHASE_TIMEOUT[state.name];
    this.timer = setTimeout(this.onTimeout, timeout);
    LoggerProxy.logger.log(
      `Media:MediaConnectionAwaiter#armTimer --> ${state.name} (${timeout}ms): ${reason}`
    );
  }

  /**
   * Releases the deadline and registered listeners on either terminal transition.
   * @returns {void}
   */
  private teardown(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.unregisterCallbacks();
  }

  /**
   * Registers each callback once with a stable function reference.
   * @returns {void}
   */
  private registerCallbacks(): void {
    const connection = this.props.webrtcMediaConnection;
    connection.on(
      MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED,
      this.peerConnectionStateHandler
    );
    connection.on(
      MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED,
      this.iceConnectionStateHandler
    );
    connection.on(
      MediaConnectionEventNames.ICE_GATHERING_STATE_CHANGED,
      this.iceGatheringStateHandler
    );
  }

  /**
   * Removes callbacks when the wait reaches a terminal state.
   * @returns {void}
   */
  private unregisterCallbacks(): void {
    const connection = this.props.webrtcMediaConnection;
    connection.off(
      MediaConnectionEventNames.ICE_GATHERING_STATE_CHANGED,
      this.iceGatheringStateHandler
    );
    connection.off(
      MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED,
      this.peerConnectionStateHandler
    );
    connection.off(
      MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED,
      this.iceConnectionStateHandler
    );
  }

  /**
   * Returns whether ICE gathering has completed.
   * @returns {boolean}
   */
  private isIceGatheringCompleted(): boolean {
    return this.props.webrtcMediaConnection.getIceGatheringState() === 'complete';
  }

  /**
   * Captures current and historical ICE connectivity for failures and metrics.
   * @returns {FailureResult}
   */
  private getConnectivity(): FailureResult {
    const iceState = this.props.webrtcMediaConnection.getIceConnectionState();
    const iceConnected = iceState === 'connected' || iceState === 'completed';
    this.iceConnectedAtLeastOnce ||= iceConnected;

    return {iceConnected, iceConnectedAtLeastOnce: this.iceConnectedAtLeastOnce};
  }

  /**
   * Sends connectivity diagnostics when a deadline expires.
   * @returns {Promise<void>}
   */
  private async sendMetric(): Promise<void> {
    // Capture connectivity before awaiting stats, which may finish after another state change.
    const connectivity = this.getConnectivity();
    const connection = this.props.webrtcMediaConnection;
    const stats = await connection.getStats();

    // There may be multiple transport reports; the first is sufficient for this metric.
    const transportReports = Array.from(
      stats.values().filter((report) => report.type === 'transport')
    ) as Record<string, number | string>[];

    Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MEDIA_STILL_NOT_CONNECTED, {
      correlation_id: this.props.correlationId,
      ...connectivity,
      numTransports: transportReports.length,
      dtlsState: transportReports[0]?.dtlsState,
      iceState: transportReports[0]?.iceState,
      packetsSent: transportReports[0]?.packetsSent,
      packetsReceived: transportReports[0]?.packetsReceived,
      dataChannelState: connection.multistreamConnection?.dataChannel?.readyState,
    });
  }
}

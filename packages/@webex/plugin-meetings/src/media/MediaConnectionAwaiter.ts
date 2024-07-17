import {Defer} from '@webex/common';
import {ConnectionState, Event} from '@webex/internal-media-core';
import LoggerProxy from '../common/logs/logger-proxy';
import {ICE_AND_DTLS_CONNECTION_TIMEOUT} from '../constants';

export interface MediaConnectionAwaiterProps {
  webrtcMediaConnection: any;
}

/**
 * @class MediaConnectionAwaiter
 */
export default class MediaConnectionAwaiter {
  private webrtcMediaConnection: any;
  private timer: any;
  private defer: Defer;
  private retried: boolean;
  private onTimeoutCallback: () => void;
  private connectionStateCallback: () => void;
  private iceGatheringStateCallback: () => void;

  /**
   * @param {MediaConnectionAwaiterProps} mediaConnectionAwaiterProps
   */
  constructor({webrtcMediaConnection}: MediaConnectionAwaiterProps) {
    this.webrtcMediaConnection = webrtcMediaConnection;
    this.defer = new Defer();
    this.retried = false;
    this.onTimeoutCallback = this.onTimeout.bind(this);
    this.connectionStateCallback = this.connectionStateListenerCallback.bind(this);
    this.iceGatheringStateCallback = this.iceGatheringStateListenerCallback.bind(this);
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
      Event.ICE_GATHERING_STATE_CHANGED,
      this.iceGatheringStateCallback
    );
    this.webrtcMediaConnection.off(Event.CONNECTION_STATE_CHANGED, this.connectionStateCallback);
  }

  /**
   * Listener for connection state change.
   *
   * @returns {void}
   */
  connectionStateListenerCallback(): void {
    LoggerProxy.logger.log(
      `Media:MediaConnectionAwaiter#connectionStateListenerCallback --> connection state: ${this.webrtcMediaConnection.getConnectionState()}`
    );

    if (!this.isConnected()) {
      return;
    }

    clearTimeout(this.timer);

    this.clearCallbacks();

    this.defer.resolve();
  }

  /**
   * Listener for ICE gathering state change.
   *
   * @returns {void}
   */
  iceGatheringStateListenerCallback(): void {
    const iceGatheringState = this.webrtcMediaConnection.getIceGatheringState();

    LoggerProxy.logger.log(
      `Media:MediaConnectionAwaiter#iceGatheringStateListenerCallback --> ICE gathering state change -> ${iceGatheringState}`
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

    this.defer.reject();
  }

  /**
   * Waits for the webrtc media connection to be connected.
   *
   * @returns {Promise}
   */
  waitForMediaConnectionConnected(): Promise<void> {
    if (this.isConnected()) {
      return Promise.resolve();
    }

    this.webrtcMediaConnection.on(Event.CONNECTION_STATE_CHANGED, this.connectionStateCallback);

    this.webrtcMediaConnection.on(
      Event.ICE_GATHERING_STATE_CHANGED,
      this.iceGatheringStateCallback
    );

    this.timer = setTimeout(this.onTimeoutCallback, ICE_AND_DTLS_CONNECTION_TIMEOUT);

    return this.defer.promise;
  }
}

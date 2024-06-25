import {Event, ConnectionState} from '@webex/internal-media-core';
import {EventEmitter} from 'events';

export enum ConnectionStateEvent {
  CONNECTION_STATE_CHANGED = 'connectionState:changed',
}

export interface ConnectionStateChangedEvent {
  state: ConnectionState; // current overall connection state
}

/**
 * @class ConnectionStateHandler
 */
export class ConnectionStateHandler extends EventEmitter {
  private webrtcMediaConnection: any;

  private mediaConnectionState: ConnectionState;

  /**
   * @param {WebRTCMeeting} webrtcMediaConnection
   */
  constructor(webrtcMediaConnection) {
    super();

    this.webrtcMediaConnection = webrtcMediaConnection;

    this.webrtcMediaConnection.on(
      Event.PEER_CONNECTION_STATE_CHANGED,
      this.handleConnectionStateChange.bind(this)
    );

    this.webrtcMediaConnection.on(
      Event.ICE_CONNECTION_STATE_CHANGED,
      this.handleConnectionStateChange.bind(this)
    );
  }

  /**
   * Handler for connection state change.
   *
   * @returns {void}
   */
  private handleConnectionStateChange(): void {
    const newConnectionState = this.webrtcMediaConnection.getConnectionState();

    if (newConnectionState !== this.mediaConnectionState) {
      this.mediaConnectionState = newConnectionState;
      this.emit(ConnectionStateEvent.CONNECTION_STATE_CHANGED, {state: this.mediaConnectionState});
    }
  }
}

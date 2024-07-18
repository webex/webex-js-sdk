import {Event, ConnectionState} from '@webex/internal-media-core';
import EventsScope from '../common/events/events-scope';
import {Enum} from '../constants';

export const ConnectionStateEvent = {
  stateChanged: 'connectionState:changed',
} as const;

export type ConnectionStateEvent = Enum<typeof ConnectionStateEvent>;

export interface ConnectionStateChangedEvent {
  /**
   * Current overall connection state
   */
  state: ConnectionState;
}

/**
 * @class ConnectionStateHandler
 */
export class ConnectionStateHandler extends EventsScope {
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
      this.emit(
        {
          file: 'connectionStateHandler',
          function: 'handleConnectionStateChange',
        },
        ConnectionStateEvent.stateChanged,
        {state: this.mediaConnectionState}
      );
    }
  }
}

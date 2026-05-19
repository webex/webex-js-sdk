/**
 * WebSocket connection ready states.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState
 */
export const SOCKET_READY_STATE = Object.freeze({
  /** Connection is being established */
  CONNECTING: 0,
  /** Connection is open and ready to communicate */
  OPEN: 1,
  /** Connection is in the process of closing */
  CLOSING: 2,
  /** Connection is closed */
  CLOSED: 3,
});

/**
 * Message type identifiers for socket communications.
 */
export const MESSAGE_TYPES = Object.freeze({
  /** Authentication message type */
  AUTH: 'auth',
  /** Event acknowledgment message type */
  EVENT_ACK: 'event_ack',
});

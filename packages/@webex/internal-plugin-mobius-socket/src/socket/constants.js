export const SOCKET_READY_STATE = Object.freeze({
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
});

export const MESSAGE_TYPES = Object.freeze({
  AUTH: 'auth',
  AUTH_RESPONSE: 'auth.response',
  EVENT_ACK: 'event_ack',
});

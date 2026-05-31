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

/**
 * Event payload for a 4001 event from Mobius.
 * This is defined this way as mobius requires 4001 code to be handled the same way as a registration.down event.
 */
export const MOBIUS_SOCKET_4001_EVENT = {
  type: 'async_event',
  trackingId: '4001-event',
  eventId: '4001-event-id',
  data: {
    eventType: 'registration.down',
    deviceInfo: {
      userId: '4001-user-id',
      device: {
        deviceId: '4001-device-id',
        uri: '4001-device-uri',
        status: 'inactive',
      },
    },
  },
};

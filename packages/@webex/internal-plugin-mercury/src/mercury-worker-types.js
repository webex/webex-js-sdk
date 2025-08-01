/**
 * Message types for Mercury web worker communication
 */
export const MercuryWorkerMessageType = {
  // Main thread to worker
  CONNECT: 'CONNECT',
  DISCONNECT: 'DISCONNECT',
  SEND_MESSAGE: 'SEND_MESSAGE',

  // Worker to main thread
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  MESSAGE_RECEIVED: 'MESSAGE_RECEIVED',
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  SEQUENCE_MISMATCH: 'SEQUENCE_MISMATCH',
  PING_PONG_LATENCY: 'PING_PONG_LATENCY',
  AUTHORIZATION_COMPLETE: 'AUTHORIZATION_COMPLETE',
};

/**
 * Message structure for Mercury worker communication
 */
export class MercuryWorkerMessage {
  constructor(type, data = {}) {
    this.type = type;
    this.data = data;
    this.timestamp = Date.now();
  }
}

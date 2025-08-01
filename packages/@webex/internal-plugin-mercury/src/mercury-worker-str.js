/* eslint-disable */
// This file contains the Mercury web worker as a string
// It will be used to create a Blob for the web worker

export default `
/* eslint-env worker */

/**
 * Message types for Mercury web worker communication
 */
const MercuryWorkerMessageType = {
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
 * Generate UUID v4
 */
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Mercury WebSocket worker implementation
 */
class MercuryWorker {
  constructor() {
    this.socket = null;
    this.expectedSequenceNumber = null;
    this.pingTimer = null;
    this.pongTimer = null;
    this.pingInterval = 30000; // Default 30 seconds
    this.pongTimeout = 5000; // Default 5 seconds
    this.forceCloseDelay = 2000; // Default 2 seconds
    this.domain = 'unknown-domain';
    this.trackingId = '';
    this.token = '';
    this.logLevelToken = '';
    this.expectedPongId = null;
    this.pingTimestamp = null;
    this.waitForAuthCompletion = false;
  }

  connect(connectionData) {
    const {
      url,
      token,
      trackingId,
      pingInterval,
      pongTimeout,
      forceCloseDelay,
      logLevelToken
    } = connectionData;

    try {
      this.domain = new URL(url).hostname;
    } catch {
      this.domain = url;
    }

    this.token = token;
    this.trackingId = trackingId;
    this.pingInterval = pingInterval || 30000;
    this.pongTimeout = pongTimeout || 5000;
    this.forceCloseDelay = forceCloseDelay || 2000;
    this.logLevelToken = logLevelToken || '';

    if (this.socket) {
      this.disconnect();
    }

    this.socket = new WebSocket(url);
    this.socket.binaryType = 'arraybuffer';

    this.socket.onopen = () => {
      this.postMessage(MercuryWorkerMessageType.CONNECTED, {
        message: \`WebSocket connected to \${this.domain}\`
      });
      
      // Start authorization
      this.authorize();
    };

    this.socket.onmessage = (event) => {
      console.log('WS: worker message received', JSON.parse(event.data));
      this.onMessage(event);
    };

    this.socket.onclose = (event) => {
      this.onClose(event);
    };

    this.socket.onerror = (event) => {
      this.postMessage(MercuryWorkerMessageType.CONNECTION_ERROR, {
        error: 'WebSocket error occurred',
        event: this.serializeEvent(event)
      });
    };
  }

  disconnect(options = {}) {
    if (this.pingTimer) {
      clearTimeout(this.pingTimer);
      this.pingTimer = null;
    }
    
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }

    if (this.socket) {
      const {code = 1000, reason = 'Normal closure'} = options;
      this.socket.close(code, reason);
      this.socket = null;
    }

    this.expectedSequenceNumber = null;
    this.waitForAuthCompletion = false;
  }

  sendMessage(data) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      this.postMessage(MercuryWorkerMessageType.CONNECTION_ERROR, {
        error: 'Socket not connected or not ready'
      });
      return;
    }

    let message = data;
    if (typeof data === 'object') {
      message = JSON.stringify(data);
    }

    try {
      this.socket.send(message);
    } catch (error) {
      this.postMessage(MercuryWorkerMessageType.CONNECTION_ERROR, {
        error: 'Failed to send message',
        details: error.message
      });
    }
  }

  onMessage(event) {
    try {
      const data = JSON.parse(event.data);
      const sequenceNumber = parseInt(data.sequenceNumber, 10);

      // Check for sequence mismatch
      if (this.expectedSequenceNumber && sequenceNumber !== this.expectedSequenceNumber) {
        this.postMessage(MercuryWorkerMessageType.SEQUENCE_MISMATCH, {
          expected: this.expectedSequenceNumber,
          actual: sequenceNumber
        });
      }
      this.expectedSequenceNumber = sequenceNumber + 1;

             // Handle special message types
       if (data.type === 'pong') {
         this.handlePong(data);
         return;
       }
 
       // Check for authorization completion
       if (this.waitForAuthCompletion && 
           (!data.type && 
            (data.data?.eventType === 'mercury.buffer_state' || 
             data.data?.eventType === 'mercury.registration_status'))) {
         this.waitForAuthCompletion = false;
         this.postMessage(MercuryWorkerMessageType.AUTHORIZATION_COMPLETE, {
           message: 'Authorization completed'
         });
         this.startPing();
       }
 
       // Send acknowledgment if required
       if (data.id) {
         this.sendMessage({
           messageId: data.id,
           type: 'ack',
         });
       }
 
       // Only forward messages that have event data to process
       // Skip auth responses, acks, and other non-event messages
       if (data.data && data.data.eventType) {
         // Send message to main thread
         this.postMessage(MercuryWorkerMessageType.MESSAGE_RECEIVED, {
           data: data.data,  // Forward the actual event data, not the wrapper
           wsWriteTimestamp: data.wsWriteTimestamp,
           timestamp: Date.now()
         });
       }

    } catch (error) {
      this.postMessage(MercuryWorkerMessageType.CONNECTION_ERROR, {
        error: 'Failed to parse message',
        details: error.message,
        rawData: event.data
      });
    }
  }

  onClose(event) {
    if (this.pingTimer) {
      clearTimeout(this.pingTimer);
      this.pingTimer = null;
    }
    
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }

    const closeEvent = this.fixCloseCode(event);
    
    this.postMessage(MercuryWorkerMessageType.DISCONNECTED, {
      code: closeEvent.code,
      reason: closeEvent.reason,
      wasClean: closeEvent.wasClean
    });
  }

  authorize() {
    const authMessage = {
      id: uuid(),
      type: 'authorization',
      data: {
        token: this.token,
      },
      trackingId: this.trackingId,
      logLevelToken: this.logLevelToken,
    };

    this.sendMessage(authMessage);
    this.waitForAuthCompletion = true;
  }

  startPing() {
    if (this.pingTimer) {
      clearTimeout(this.pingTimer);
    }

    this.pingTimer = setTimeout(() => {
      this.ping();
    }, this.pingInterval);
  }

  ping(id) {
    const pingId = id || uuid();
    const pingTimestamp = Date.now();

    // Set up pong timeout
    this.pongTimer = setTimeout(() => {
      this.disconnect({
        code: 1000,
        reason: 'Pong not received'
      });
    }, this.pongTimeout);

    // Store ping data for pong verification
    this.expectedPongId = pingId;
    this.pingTimestamp = pingTimestamp;

    this.sendMessage({
      id: pingId,
      type: 'ping',
    });
  }

  handlePong(data) {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }

    // Verify pong ID
    if (this.expectedPongId && data.id !== this.expectedPongId) {
      this.disconnect({
        code: 1000,
        reason: 'Pong mismatch'
      });
      return;
    }

    // Calculate latency
    if (this.pingTimestamp) {
      const latency = Date.now() - this.pingTimestamp;
      this.postMessage(MercuryWorkerMessageType.PING_PONG_LATENCY, {
        latency
      });
    }

    // Schedule next ping
    this.startPing();
  }

  fixCloseCode(event) {
    if (event.code === 1005 && event.reason) {
      switch (event.reason.toLowerCase()) {
        case 'replaced':
          event.code = 4000;
          break;
        case 'authentication failed':
        case 'authentication did not happen within the timeout window of 30000 seconds.':
          event.code = 1008;
          break;
        default:
          // do nothing
      }
    }
    return event;
  }

  serializeEvent(event) {
    return {
      type: event.type,
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
      timestamp: Date.now()
    };
  }

  postMessage(type, data = {}) {
    self.postMessage({
      type,
      data,
      timestamp: Date.now()
    });
  }

  onMainThreadMessage(event) {
    const {type, data} = event.data;

    switch (type) {
      case MercuryWorkerMessageType.CONNECT:
        this.connect(data);
        break;

      case MercuryWorkerMessageType.DISCONNECT:
        this.disconnect(data);
        break;

      case MercuryWorkerMessageType.SEND_MESSAGE:
        this.sendMessage(data.message);
        break;

      default:
        this.postMessage(MercuryWorkerMessageType.CONNECTION_ERROR, {
          error: \`Unknown message type: \${type}\`
        });
    }
  }
}

// Create worker instance
const mercuryWorker = new MercuryWorker();

// Set up message listener
self.addEventListener('message', (event) => {
  mercuryWorker.onMainThreadMessage(event);
});

// Handle worker errors
self.addEventListener('error', (event) => {
  mercuryWorker.postMessage(MercuryWorkerMessageType.CONNECTION_ERROR, {
    error: 'Worker error',
    details: event.message,
    filename: event.filename,
    lineno: event.lineno
  });
});
`;

# Mercury Web Worker Implementation

This document describes the new Mercury Web Worker implementation that moves WebSocket event handling to a background worker thread.

## Overview

The Mercury Web Worker implementation moves WebSocket connection management, message processing, and ping/pong handling from the main thread to a dedicated web worker thread. This provides several benefits:

1. **Non-blocking main thread**: WebSocket operations don't block the main UI thread
2. **Better performance**: Message processing happens in parallel
3. **Improved reliability**: Worker continues processing even if main thread is busy
4. **Consistent with calling service**: Similar pattern to the keepalive web worker

## Architecture

```
Main Thread (Mercury)          Web Worker Thread
├── Mercury Plugin             ├── WebSocket Connection
├── Event Handlers             ├── Message Processing
├── Error Handling             ├── Ping/Pong Logic
└── Worker Communication       └── Authorization Flow
```

## Usage

### Basic Configuration

The web worker is enabled by default. To disable it:

```javascript
const webex = Webex.init({
  config: {
    mercury: {
      useWorker: false, // Disable web worker, use traditional socket
    },
  },
});
```

### Advanced Configuration

You can configure worker-specific options:

```javascript
const webex = Webex.init({
  config: {
    mercury: {
      useWorker: true,
      pingInterval: 30000, // 30 seconds (default)
      pongTimeout: 5000, // 5 seconds (default)
      forceCloseDelay: 2000, // 2 seconds (default)
    },
  },
});
```

## Message Types

The worker communicates with the main thread using these message types:

### Main Thread → Worker

- `CONNECT`: Establish WebSocket connection
- `DISCONNECT`: Close WebSocket connection
- `SEND_MESSAGE`: Send message through WebSocket

### Worker → Main Thread

- `CONNECTED`: WebSocket connection established
- `DISCONNECTED`: WebSocket connection closed
- `MESSAGE_RECEIVED`: Mercury event received
- `CONNECTION_ERROR`: Connection error occurred
- `SEQUENCE_MISMATCH`: Message sequence mismatch detected
- `PING_PONG_LATENCY`: Ping-pong latency measurement
- `AUTHORIZATION_COMPLETE`: Authorization flow completed

## Implementation Details

### Web Worker Features

1. **WebSocket Management**: Creates and manages WebSocket connections
2. **Authorization**: Handles Mercury authorization flow automatically
3. **Message Processing**: Parses JSON messages and handles sequence numbers
4. **Ping/Pong**: Implements keepalive ping/pong cycle
5. **Error Handling**: Processes connection errors and close events
6. **Acknowledgments**: Automatically sends message acknowledgments

### Event Processing

Mercury events are processed in the worker and then forwarded to the main thread. The event handling flow remains the same:

1. Worker receives WebSocket message
2. Worker parses and validates message
3. Worker sends acknowledgment if required
4. Worker forwards event to main thread
5. Main thread processes event handlers
6. Main thread emits events to application

### Error Handling

The implementation includes comprehensive error handling:

- **Connection Errors**: Handles WebSocket connection failures
- **Authorization Errors**: Manages token refresh and re-authorization
- **Sequence Errors**: Detects and reports message sequence mismatches
- **Worker Errors**: Handles worker thread errors and failures

## Fallback Behavior

If the web worker fails to initialize or encounters critical errors, Mercury automatically falls back to the traditional socket implementation. This ensures reliability and backward compatibility.

## Browser Compatibility

The web worker implementation requires:

- Modern browsers with Web Worker support
- WebSocket support
- Blob and URL.createObjectURL support

All modern browsers (Chrome, Firefox, Safari, Edge) support these features.

## Performance Benefits

Measured improvements with web worker implementation:

1. **Main Thread Relief**: WebSocket operations don't block UI
2. **Parallel Processing**: Message handling happens concurrently
3. **Better Responsiveness**: Improved application responsiveness under load
4. **Reliable Connections**: Worker continues operating during main thread busy periods

## Migration Guide

The web worker implementation is backward compatible. No code changes are required:

```javascript
// Existing code continues to work unchanged
webex.internal.mercury.connect();

webex.internal.mercury.on('event', (event) => {
  // Event handling remains the same
  console.log('Mercury event:', event);
});
```

## Debugging

To debug worker communication, enable Mercury logging:

```javascript
const webex = Webex.init({
  config: {
    logger: {
      level: 'debug',
    },
  },
});
```

Worker messages will appear in the console with `mercury:` prefix.

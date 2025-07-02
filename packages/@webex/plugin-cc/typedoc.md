# Webex JS SDK: Contact Center Plugin

Welcome to **@webex/plugin-cc**, a plugin for the [Webex JS SDK](https://github.com/webex/webex-js-sdk). This package enables integration with Webex Contact Center, providing APIs for agent management, task handling, and real-time communications.

## Features

- Agent lifecycle (login, state, profile)
- Task operations (calls, chats, media)
- Event-driven updates
- WebRTC browser calling
- TypeScript support

## Installation

```bash
npm install @webex/plugin-cc
```

## Initialization

Initialize the Contact Center plugin with the Webex SDK. The `config` parameter is optional, but you can pass any of the following options for `cc`:

```javascript
import Webex from '@webex/plugin-cc';

const config = {
  credentials: {
    access_token: 'your-access-token', // Required for authentication
  },
  logger: {
    level: 'debug',        // Enhanced logging for development
    bufferLogLevel: 'log'  // Log level for uploaded logs
  },
  cc: {
    // Agent session management
    allowMultiLogin: false,        // Prevent multiple agent sessions
    allowAutomatedRelogin: true,   // Auto reconnect on disconnection

    // Connection settings
    clientType: 'WebexCCSDK',      // Identify client type
    isKeepAliveEnabled: false,     // Websocket keep-alive
    force: true,                   // Force connection parameters

    // Metrics configuration
    metrics: {
      clientName: 'WEBEX_JS_SDK',
      clientType: 'WebexCCSDK'
    }
  }
};

const webex = Webex.init({ config }); // config is optional
const cc = webex.cc;

webex.once('ready', () => {
  // Safe to use cc and other plugins here
});
```

## Core Classes

### ContactCenter Class

The [ContactCenter](./classes/ContactCenter.html) class is your primary interface for agent operations. Key capabilities include:

1. **Session Management**:
   - Agent registration and initialization
   - Connection management
   - Event handling

2. **Agent Operations**:
   - Station login/logout
   - State management (Available/Idle)
   - Profile updates

3. **Task Management**:
   - Inbound task handling
   - Outbound calling
   - Queue operations

Example workflow:

```javascript
// Initialize agent session
async function initializeAgent() {
  try {
    // 1. Register with contact center
    const profile = await cc.register();
    
    // 2. Login with browser-based calling
    await cc.stationLogin({
      teamId: profile.teams[0].teamId,
      loginOption: 'BROWSER'
    });
    
    // 3. Set availability state
    await cc.setAgentState({
      state: 'Available',
      auxCodeId: '0'
    });
    
    console.log('Agent initialized and ready');
  } catch (error) {
    console.error('Initialization failed:', error);
  }
}
```

### Task Class

The [Task](./classes/Task.html) class represents an interaction (call, chat, etc.) and provides methods for:

1. **Media Control**:
   - Mute/unmute
   - Hold/resume
   - Recording controls

2. **Call Flow**:
   - Accept/decline tasks
   - Transfer operations
   - Consultation features

3. **Task Completion**:
   - End interaction
   - Wrap-up handling
   - Disposition updates

Example task handling:

```javascript
// Set up task event handlers
cc.on('task:incoming', async (task) => {
  try {
    // 1. Accept the task
    await task.accept();
    
    // 2. Set up media handling (for voice)
    task.on('task:media', (track) => {
      const audio = document.getElementById('remote-audio');
      audio.srcObject = new MediaStream([track]);
    });
    
    // 3. Handle task states
    task.on('task:hold', () => {
      console.log('Task placed on hold');
    });
    
    task.on('task:end', async () => {
      if (task.data.wrapUpRequired) {
        await task.wrapup({
          auxCodeId: 'RESOLVED',
          wrapUpReason: 'Customer issue resolved'
        });
      }
    });
    
  } catch (error) {
    console.error('Task handling failed:', error);
  }
});
```

## Configuration Reference

| Option                     | Type      | Default          | Description                                          |
| -------------------------- | --------- | ---------------- | ---------------------------------------------------- |
| `credentials.access_token` | `string`  | Required         | Webex authentication token                           |
| `logger.level`             | `string`  | `'info'`         | Log level (`'debug'`, `'info'`, `'warn'`, `'error'`) |
| `logger.bufferLogLevel`    | `string`  | `'log'`          | Buffered logging level for diagnostics               |
| `cc.allowMultiLogin`       | `boolean` | `false`          | Allow multiple concurrent logins                     |
| `cc.allowAutomatedRelogin` | `boolean` | `true`           | Auto-reconnect on connection loss                    |
| `cc.clientType`            | `string`  | `'WebexCCSDK'`   | Client identifier                                    |
| `cc.isKeepAliveEnabled`    | `boolean` | `false`          | Enable websocket keep-alive                          |
| `cc.force`                 | `boolean` | `true`           | Force connection parameters                          |
| `cc.metrics.clientName`    | `string`  | `'WEBEX_JS_SDK'` | Client name for metrics                              |
| `cc.metrics.clientType`    | `string`  | `'WebexCCSDK'`   | Client type for metrics                              |

## Events

The SDK uses an event-driven model to notify about various state changes:

### Agent Events

- `agent:stateChange` - Agent's state has changed (Available, Idle, etc.)
- `agent:stateChangeSuccess` - Agent state change was successful
- `agent:stateChangeFailed` - Agent state change failed
- `agent:stationLoginSuccess` - Agent login was successful
- `agent:stationLoginFailed` - Agent login failed
- `agent:logoutSuccess` - Agent logout was successful
- `agent:logoutFailed` - Agent logout failed
- `agent:dnRegistered` - Agent's device number registered
- `agent:multiLogin` - Multiple logins detected
- `agent:reloginSuccess` - Agent relogin was successful

### Task Events

- `task:incoming` - New task is being offered
- `task:assigned` - Task assigned to agent
- `task:unassigned` - Task unassigned from agent
- `task:media` - Media track received (voice, etc.)
- `task:hold` - Task placed on hold
- `task:unhold` - Task resumed from hold
- `task:end` - Task completed
- `task:ended` - Task/call has ended
- `task:wrapup` - Task in wrap-up state
- `task:wrappedup` - Task wrap-up completed
- `task:rejected` - Task was rejected
- `task:hydrate` - Task data has been updated
- `task:offerContact` - Contact offered to agent
- `task:consultEnd` - Consultation ended
- `task:consultQueueCancelled` - Queue consultation cancelled
- `task:consultQueueFailed` - Queue consultation failed
- `task:consultAccepted` - Consultation accepted
- `task:consulting` - Consulting in progress
- `task:consultCreated` - Consultation created
- `task:offerConsult` - Consultation offered
- `task:established` - Task/call has been connected
- `task:error` - An error occurred during task handling
- `task:ringing` - Task/call is ringing
- `task:recordingPaused` - Recording paused
- `task:recordingPauseFailed` - Failed to pause recording
- `task:recordingResumed` - Recording resumed
- `task:recordingResumeFailed` - Failed to resume recording

### Media Events

- `task:media` - Media track received
- `task:hold` - Task placed on hold
- `task:unhold` - Task resumed

## Support

For issues and feature requests, please visit the [GitHub repository](https://github.com/webex/webex-js-sdk/issues).

For access token generation and authentication details, refer to the [Webex Developer Portal](https://developer.webex.com/meeting/docs/getting-started).

---

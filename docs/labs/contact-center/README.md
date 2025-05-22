# Contact Center SDK Lab Documentation

This lab demonstrates how to use the Webex Contact Center SDK, showing both simple direct usage and robust implementation patterns.

## File Structure

```
docs/labs/contact-center/
├── lab.html              # Main lab file with interactive examples
├── index.js             # Main entry point and coordination
├── auth.js              # Authentication functionality
├── registration.js      # Agent registration 
├── station-login.js     # Station login/logout
├── state-change.js      # Agent state management
├── task-manager.js      # Task and call handling
└── cleanup.js           # Cleanup operations
```

## Simple vs Robust Implementation

### Authentication

```javascript
// Simple Usage
window.webex = Webex.init({
    credentials: { 
        access_token: token 
    }
});

// Robust Implementation (auth.js)
const webex = await initWithAccessToken(token);
// Includes: timeout handling, ready events, token refresh
```

### Registration

```javascript
// Simple Usage
const response = await window.webex.cc.register();

// Robust Implementation (registration.js)
const response = await register(webex);
handleRegistrationResponse(response);
// Includes: UI population, state tracking, error handling
```

### Station Login

```javascript
// Simple Usage
await window.webex.cc.stationLogin({
    teamId: 'team_id',
    loginOption: 'BROWSER'
});

// Robust Implementation (station-login.js)
await handleStationLogin(webex);
setupStationEventListeners(webex);
// Includes: validation, multi-login handling, device tracking
```

### State Management

```javascript
// Simple Usage
await window.webex.cc.setAgentState({
    state: 'WellbeingBreak',
    auxCodeId: 'aux_code_id'
});

// Robust Implementation (state-change.js)
await setAgentState(webex, stateParams);
setupStateEventListeners(webex);
// Includes: validation, event handling, UI sync
```

### Task Management

```javascript
// Simple Usage
webex.cc.on('task:new', (task) => {
    await task.accept();
});

// Robust Implementation (task-manager.js)
handleIncomingTask(webex, async (task) => {
    await acceptTask(task);
    if (task.isVoice()) await setupVoiceTask(task);
});
// Includes: media setup, error handling, state tracking
```

### Call Controls

```javascript
// Simple Usage
await task.hold();
task.toggleMute();

// Robust Implementation (task-manager.js)
await toggleHold(task);  // Includes state validation
await toggleMute(task);  // Includes error handling
```

## Key Features

### Simple Implementation

- Direct use of `window.webex` object
- Minimal code required
- Quick to implement
- Good for prototypes and testing

### Robust Implementation

- Error handling
- State management
- Event handling
- Input validation
- UI synchronization
- Resource cleanup

## Usage

1. Choose implementation style:

```javascript
// Simple: Direct SDK usage
window.webex = Webex.init(...);

// Robust: Use our implementation
const webex = await initWithAccessToken(token);
```

2. Follow the flow:
   - Authentication
   - Registration
   - Station Login
   - State Management
   - Task Handling

## Error Handling

The robust implementation includes:

- Input validation
- Network error handling
- State conflict resolution
- Resource cleanup
- Event error handling

## Best Practices

1. Authentication
   - Handle token refresh
   - Manage OAuth flow
   - Track ready state

2. Registration
   - Store registration data
   - Handle reregistration
   - Track capabilities

3. Station Login
   - Validate inputs
   - Handle device states
   - Manage sessions

4. State Management
   - Validate state changes
   - Handle state conflicts
   - Track current state

5. Task Management
   - Handle all task types
   - Manage media setup
   - Track task lifecycle

6. Resource Cleanup
   - Handle page unload
   - Clean up media
   - Clear state

## Development

1. Clone the repository
2. Install dependencies
3. Open lab.html in browser
4. Use developer token or OAuth
5. Follow the steps in UI

## Learn More

- [Official SDK Documentation](https://developer.webex.com/)
- [Contact Center API Reference](https://developer.webex.com/docs/contact-center)
- [WebRTC Integration Guide](https://developer.webex.com/docs/contact-center-webrtc)

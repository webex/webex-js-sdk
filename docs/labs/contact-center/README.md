# Contact Center SDK Lab Documentation

This lab demonstrates how to use the Webex Contact Center SDK to build agent desktop applications using a single, modular implementation pattern. It provides a step-by-step guide to essential contact center functionalities with working examples.

## Prerequisites

1. Configured Webex Contact Center environment
2. Completed Labs 0-3 from [official documentation](https://webexcc.github.io/)
3. Agent credentials
4. Entry point phone number for testing

## Key Concepts & Terminology

### Authentication

- **Personal Access Token (PAT)**: A temporary token used for development and testing
- **OAuth Flow**: The recommended authentication method for production applications
- **Webex SDK Initialization**: Creates a `webex` object that serves as the foundation for all SDK operations

### Agent Registration

- **Agent Profile**: Contains vital information returned after registration including:
  - Teams the agent belongs to
  - Available login voice options
  - Possible agent states
  - Auxiliary codes for not-ready states
  - Wrapup codes for task completion

### Station Login

- **Station**: Represents the agent's workstation configuration
- **Login Options**:
  - Browser WebRTC: Uses browser for voice calls
  - Agent DN: Uses agent's direct number
  - Extension: Uses a telephony extension
- **Device ID**: Unique identifier for the logged-in station, needed for logout

### Agent States

- **Available**: Ready to receive tasks
- **Idle/Not Ready**: Not available for tasks
- **Auxiliary Codes**: Reasons for being in not-ready state (e.g., Lunch, Training)
- **State Change Events**: Notifications for successful/failed state transitions

### Task Management

- **Task Object**: Core entity representing an interaction (call, chat, etc.)
- **Task Events**:
  - `task:incoming`: New task offered to agent
  - `task:hydrate`: Task state restored after page refresh
  - `task:assigned`: Task successfully assigned to agent
  - `task:media`: Audio stream available for voice calls
  - `task:end`: Task has ended

### Call Controls

- **Media Operations**:
  - Hold/Resume: Pause and resume media
  - Mute/Unmute: Control audio transmission
  - Recording Controls: Pause/resume call recording
- **Task States**: Tracked via events (hold, resume, end, etc.)

### Task Wrapup

- **Wrapup Process**: Post-task work required for task completion
- **Wrapup Codes**: Predefined reasons for task outcome
- **Wrapup Events**: Track wrapup state (`task:wrapup`, `task:wrappedup`)

### Event-Driven Architecture

The lab implements an event-driven approach where:

- SDK emits events for state changes
- Task objects emit their own events
- UI updates based on event responses
- Error handling via event listeners

## File Structure

```
docs/labs/contact-center/
├── index.html           # Main lab file with interactive examples
├── index.js             # Main entry point and coordination
├── auth.js              # Authentication functionality
├── registration.js      # Agent registration 
├── station-login.js     # Station login/logout
├── state-change.js      # Agent state management
├── task-manager.js      # Task and call handling
├── task-consult.js      # Task consultation functionality
└── cleanup.js           # Cleanup operations
```

## Understanding the Lab: Step-by-Step Implementation Guide (`lab.html`)

This guide walks you through the `lab.html` file, explaining how to use the Webex Contact Center SDK for key agent desktop functionalities. It highlights how data flows between different SDK calls and UI elements, referencing the more detailed explanations and simplified code snippets now present in `lab.html`.

**Prerequisite:** Open `lab.html` in your browser. The Webex SDK (`webex.min.js`) is loaded via CDN. The lab's logic is primarily in `index.js`, which orchestrates calls to other modules like `auth.js`, `registration.js`, etc. Each step below corresponds to a section in `lab.html`.

### Step 1: Authentication (Login)

- **Goal:** Initialize the Webex SDK to establish an authenticated session.
- **How it works in `lab.html`:**
  - The user provides a Personal Access Token (PAT) or initiates an OAuth flow.
  - `index.js` calls functions in `auth.js` (like `initWithAccessToken` or `initOauth`).
- **SDK Core:** `Webex.init({ credentials: { ... } })` is called.
- **Key Output/Value Passed:**
  - An initialized `webex` object (e.g., stored as `window.webex`). This object is the foundation for all subsequent SDK operations.
- **Refer to `lab.html` "Step 1: Authentication" for detailed code comments and flow.**

### Step 2: Agent Registration

- **Goal:** Register the authenticated agent with the Webex Contact Center.
- **How it works in `lab.html`:**
  - After successful authentication, the "Register Agent" button is clicked.
  - `index.js` calls `register(window.webex)` from `registration.js`.
- **SDK Core:** `window.webex.cc.register()` is called.
- **Key Output/Value Passed:**
  - An `agentProfile` object is returned by `register()`.
  - This `agentProfile` contains:
    - `teams`: Used to populate the "Select Team" dropdown.
    - `loginVoiceOptions`: Used to populate the "Agent Login" dropdown.
    - `agentStates` / `idleCodes`: Used to populate the "Choose State" dropdown.
    - `wrapupCodes`: Used to populate the "Choose Wrapup Code" dropdown for Step 7.
  - These details are essential for configuring the UI and for subsequent SDK calls.
- **Refer to `lab.html` "Step 2: Agent Registration" for detailed code comments and flow.**

### Step 3: Station Login

- **Goal:** Log the agent into a specific station (device and team combination).
- **How it works in `lab.html`:**
  - The agent selects a team, login method (Browser, DN, Extension), and provides a dial number if needed. These UI elements were populated using data from `agentProfile` (Step 2).
  - `index.js` calls `handleStationLogin(window.webex)` which uses functions from `station-login.js`.
- **SDK Core:** `window.webex.cc.stationLogin({ teamId, loginOption, dialNumber })` is called.
- **Key Output/Value Passed:**
  - `teamId` (from dropdown selection).
  - `loginOption` (from dropdown selection).
  - `dialNumber` (from input field, if applicable).
  - The call returns a response, including a `deviceId` which is stored (e.g., `window.deviceId`) for operations like station logout.
- **Refer to `lab.html` "Step 3: Station Login" for detailed code comments and flow.**

### Step 4: Agent State Management

- **Goal:** Allow the agent to set their availability state (e.g., Available, Idle with an aux code).
- **How it works in `lab.html`:**
  - The agent selects a state from the "Choose State" dropdown (populated using `agentProfile.agentStates` from Step 2).
  - `index.js` calls `handleStateChange(window.webex)` which uses functions from `state-change.js`.
- **SDK Core:** `window.webex.cc.setAgentState({ state, auxCodeId })` is called.
- **Key Output/Value Passed:**
  - `state` (derived from dropdown selection).
  - `auxCodeId` (derived from dropdown selection, if applicable).
  - The SDK also emits an `agent:stateChange` event, which `state-change.js` listens for to confirm the change and update the UI. The event data includes the new `state` and `auxCodeId`.
- **Refer to `lab.html` "Step 4: Agent State Management" for detailed code comments and flow.**

### Step 5: Task Management - Receiving Tasks

- **Goal:** Handle incoming tasks (e.g., calls, chats) offered to the agent.
- **How it works in `lab.html`:**
  - `index.js` calls `setupTaskEventListeners(window.webex)` from `task-manager.js`.
  - This sets up listeners for SDK events, primarily `task:incoming` and `task:hydrate`.
- **SDK Core Events:**
  - `webex.cc.on('task:incoming', (task) => { ... })`
  - `webex.cc.on('task:hydrate', (task) => { ... })`
- **Key Output/Value Passed:**
  - When a task is offered, the event handler receives a `task` object.
  - This `task` object is crucial. It contains all data for the interaction (ID, media type, customer info) and methods to control it (accept, decline, hold, end, etc.).
  - This `task` object is typically stored (e.g., `window.currentTask`) and passed to functions in Step 6 and 7.
  - The `task` object itself also emits events (e.g., `task:assigned`, `task:media`, `task:end`) which `task-manager.js` uses to manage the task lifecycle.
- **Refer to `lab.html` "Step 5: Task Management - Receiving Tasks" for detailed code comments and flow.**

### Step 6: Call Controls - Managing Active Tasks

- **Goal:** Perform actions on an active task, such as accepting, declining, holding, or ending it.
- **How it works in `lab.html`:**
  - Buttons like "Accept Current Task", "Hold Call", "End Call" trigger functions in `index.js` which then call corresponding functions in `task-manager.js` (e.g., `acceptTask`, `toggleHold`, `endTask`).
- **SDK Core Methods (called on the `task` object from Step 5):**
  - `task.accept()`
  - `task.decline()`
  - `task.hold()` / `task.resume()`
  - `task.toggleMute()`
  - `task.pauseRecording()` / `task.resumeRecording()`
  - `task.end()`
  - `task.consult()`, `task.transfer()`, etc.
- **Key Input/Value Passed:**
  - All control functions operate on the specific `task` object obtained in Step 5.
  - The state of the task (e.g., `task.data.media.isHold`) is updated by these actions and reflected through events emitted by the `task` object.
  - For voice calls, the `task:media` event (on the `task` object) provides the `MediaStreamTrack` to play audio.
- **Refer to `lab.html` "Step 6: Call Controls - Managing Active Tasks" for detailed code comments and flow.**

### Step 7: Task Wrapup

- **Goal:** Allow the agent to complete post-task work by selecting a wrapup code.
- **How it works in `lab.html`:**
  - The `task:end` event (on the `task` object from Step 5) indicates if `wrapUpRequired` is true.
  - If wrapup is needed, the agent selects a code from the "Choose Wrapup Code" dropdown (populated using `agentProfile.wrapupCodes` from Step 2).
  - Clicking "Submit Wrapup" triggers `submitWrapup(currentTask)` in `task-manager.js`.
- **SDK Core Method (called on the `task` object from Step 5 & 6):**
  - `task.wrapup({ auxCodeId, wrapUpReason })`
- **Key Input/Value Passed:**
  - The `task` object that just ended.
  - `auxCodeId` (the ID of the selected wrapup code from the dropdown).
- **Refer to `lab.html` "Step 7: Task Wrapup" for detailed code comments and flow.**

This revised guide in the README now aligns with the more detailed explanations provided directly within `lab.html`, ensuring consistency and a clear path for understanding the SDK's usage.

## Core SDK Usage Examples (from `lab.html`)

The following snippets illustrate the SDK calls for key functionalities, as presented in the `lab.html` examples. The lab's accompanying `.js` files (`auth.js`, `registration.js`, `task-manager.js`, etc.) provide modular functions that build upon these core calls with additional logic for UI interaction, error handling, and state management.

### Authentication (Token-based)

```javascript
// From lab.html Step 1
const accessToken = document.getElementById('access-token').value;
const webex = Webex.init({
  credentials: {
    access_token: accessToken
  }
});
// Wait for the SDK to emit a 'ready' event before proceeding with registration or other operations.
webex.once('ready', () => {
  // Safe to proceed with registration and other SDK calls here.
});
```

**Note:** Always wait for the `ready` event before making further SDK calls. This ensures the SDK is fully initialized and avoids race conditions.

### Agent Registration

```javascript
// From lab.html Step 2
// Assuming 'webex' is the initialized SDK object:
async function registerAgent(webexInstance) {
    const agentProfile = await webexInstance.cc.register();
    // agentProfile contains teams, agentStates, wrapupCodes, etc.
    // This data is used to populate UI dropdowns.
    return agentProfile;
}
```

### Station Login (WebRTC Example)

```javascript
// From lab.html Step 3
// Assuming 'webex', 'selectedTeamId', 'selectedLoginOption':
async function loginToStation(webexInstance, selectedTeamId, selectedLoginOption, inputDialNumber) {
    const stationLoginPayload = {
        teamId: selectedTeamId,
        loginOption: selectedLoginOption // e.g., "BROWSER"
    };
    if (selectedLoginOption === 'AGENT_DN' || selectedLoginOption === 'EXTENSION') {
        stationLoginPayload.dialNumber = inputDialNumber;
    }
    const response = await webexInstance.cc.stationLogin(stationLoginPayload);
    // response.deviceId is important for logout.
    return response;
}
```

### Agent State Management

```javascript
// From lab.html Step 4
// Assuming 'webex', 'targetState', 'targetAuxCodeId':
async function changeAgentState(webexInstance, targetState, targetAuxCodeId) {
    const response = await webexInstance.cc.setAgentState({
        state: targetState,
        auxCodeId: targetAuxCodeId, // Optional
        lastStateChangeReason: 'User Initiated'
    });
    return response;
}
// Listen for confirmation:
// webexInstance.cc.on('agent:stateChange', (eventData) => { /* Update UI */ });
```

### Task Management (Receiving Tasks)

```javascript
// From lab.html Step 5
// Assuming 'webex':
function setupTaskEventListeners(webexInstance) {
    webexInstance.cc.on('task:incoming', (task) => {
        // 'task' is the key object for this interaction.
        console.log('New task received:', task.data.interactionId);
        // Store 'task' (e.g., window.currentTask = task) for use in call controls.
        // UI should be updated to allow accepting/declining.
        // Task-specific event handlers (e.g., task.on('task:media')) are set up on this 'task' object.
    });
}
```

### Call Controls (Accepting and Ending a Task)

```javascript
// From lab.html Step 6
// Assuming 'currentTask' is the task object from 'task:incoming':
async function acceptCurrentTask(currentTask) {
    await currentTask.accept();
    // For voice, expect 'task:media' event on currentTask.
}

async function endCurrentTask(currentTask) {
    await currentTask.end();
    // Expect 'task:end' event on currentTask. If wrapUpRequired, proceed to wrapup.
}
// Other controls like task.hold(), task.resume(), task.toggleMute() follow similar patterns.
```

### Task Wrapup

```javascript
// From lab.html Step 7
// Assuming 'taskToEndAndWrapup' is the task that just ended and 'selectedWrapupCodeId' is from UI:
async function completeTaskWrapup(taskToEndAndWrapup, selectedWrapupCodeId) {
    await taskToEndAndWrapup.wrapup({
        auxCodeId: selectedWrapupCodeId
        // wrapUpReason: "Optional text reason"
    });
}
// The need for wrapup is known from task.on('task:end', (data) => data.wrapUpRequired).
// Wrapup codes dropdown is populated from agentProfile.wrapupCodes (from Step 2).
```

## Key Features

The lab demonstrates a modular implementation approach with:

- Authentication & Session Management
- Agent Registration & Profile Management
- Task Lifecycle Management
- Call Controls
- State Management

## Usage

1. **Initialization & Authentication:**
    - The application starts by initializing the Webex SDK (`Webex.init()`) with credentials (PAT or OAuth). This is handled in `auth.js` and orchestrated by `index.js`.
    - The resulting `webex` object is fundamental for all subsequent operations.

2. **Agent Lifecycle & UI Interaction:**
    - **Registration (`registration.js`):** Calls `webex.cc.register()`. The `agentProfile` response is used to populate UI elements (teams, states, wrapup codes).
    - **Station Login (`station-login.js`):** Calls `webex.cc.stationLogin()` using selections from the UI.
    - **State Management (`state-change.js`):** Calls `webex.cc.setAgentState()` based on UI choices and listens for `agent:stateChange` events to keep UI synchronized.
    - **Task Handling (`task-manager.js`):**
        - Listens for `webex.cc.on('task:incoming', ...)` to receive new tasks.
        - The received `task` object is then used for all interaction controls (accept, hold, end, wrapup, etc.) by calling methods directly on it (e.g., `task.accept()`, `task.wrapup()`).
        - Manages task-specific events (e.g., `task.on('task:media', ...)`).
    - **Consultation (`task-consult.js`):** Handles consult-specific SDK calls and events.
    - **Cleanup (`cleanup.js`):** Manages deregistration and station logout on page unload or tab hide.

3. **Event-Driven Updates:**
    - The application heavily relies on SDK events (e.g., `agent:stateChange`, `task:incoming`, `task:media`, `task:end`) to update the UI and manage application state. These event listeners are primarily set up in the respective JavaScript modules.

4. Follow the flow in `lab.html` and `index.js` to see how these modules are interconnected:
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

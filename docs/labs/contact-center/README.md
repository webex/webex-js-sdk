# Contact Center Lab

This lab guides you through building a functional contact center agent interface using the Webex Contact Center SDK. You'll learn how to implement key features like authentication, agent registration, task handling, and call controls.

## Prerequisites

- Node.js installed on your machine
- A Webex developer account
- Access to the Webex Contact Center SDK
- Basic knowledge of HTML, CSS, and JavaScript

## Lab Structure

The lab code is divided into multiple sections, each focusing on a specific aspect of the contact center functionality:

1. **Authentication** (`auth.js`)
   - How to authenticate using access token or OAuth
   - Initializing the Webex SDK
   - Configuring the contact center plugin

2. **Agent Registration** (`registration.js`)
   - Registering the agent
   - Setting up WebSocket connection
   - Error handling and logging

3. **Task Management** (`task-manager.js`)
   - Handling incoming tasks (voice, chat, email)
   - Task controls (answer, decline, wrap-up)
   - Task event listeners

4. **Call Controls** (`call-controls.js`)
   - Hold/Resume functionality
   - Mute/Unmute capability
   - Transfer and consultation features
   - Recording controls

5. **Agent State** (`agent-state.js`)
   - Managing agent availability states
   - Handling idle codes
   - Profile and device type updates

6. **Digital Channels** (`digital-channels.js`)
   - Chat integration
   - Email handling
   - Social media interactions

## Step-by-Step Guide

### 1. Project Setup

1. Create a new directory for your project:
\`\`\`bash
mkdir contact-center-app
cd contact-center-app
\`\`\`

2. Initialize a new npm project:
\`\`\`bash
npm init -y
\`\`\`

3. Install dependencies:
\`\`\`bash
npm install @webex/sdk
\`\`\`

### 2. Authentication Setup

Create an authentication module that handles both access token and OAuth flows:

\`\`\`javascript
// auth.js
function initOauth() {
  let redirectUri = `${window.location.protocol}//${window.location.host}`;

  // Reference: <https://developer.webex-cx.com/documentation/integrations>
  const ccMandatoryScopes = [
    "cjp:config_read",
    "cjp:config_write",
    "cjp:config",
    "cjp:user",
  ];

  const webRTCCallingScopes = [
    "spark:webrtc_calling",
    "spark:calls_read",
    "spark:calls_write",
    "spark:xsi"
  ];

  const additionalScopes = [
    "spark:kms"
  ];

  const requestedScopes = Array.from(
    new Set(ccMandatoryScopes.concat(webRTCCallingScopes).concat(additionalScopes))
  ).join(' ');

  const webex = Webex.init({
    config: {
      credentials: {
        client_id: 'YOUR_CLIENT_ID',
        redirect_uri: redirectUri,
        scope: requestedScopes
      }
    }
  });

  return webex;
}
\`\`\`

### 3. Agent Registration

Implement agent registration with WebSocket connection:

\`\`\`javascript
// registration.js
async function register(webex) {
  try {
    // Register the agent
    const profile = await webex.cc.register();
    console.log('Registration successful:', profile);

    // Set up WebSocket event listeners
    webex.cc.on('task:incoming', (task) => {
      handleIncomingTask(task);
    });

    return profile;
  } catch (error) {
    console.error('Registration failed:', error);
    throw error;
  }
}
\`\`\`

### 4. Task Handling

Create task management functions:

\`\`\`javascript
// task-manager.js
function handleIncomingTask(task) {
  // Enable answer/decline buttons
  const answerBtn = document.getElementById('answer');
  const declineBtn = document.getElementById('decline');
  
  answerBtn.disabled = false;
  declineBtn.disabled = false;

  // Display task details
  const taskDetails = document.getElementById('task-details');
  taskDetails.textContent = \`Incoming \${task.data.interaction.mediaType} from \${task.data.interaction.callAssociatedDetails?.ani}\`;
}

async function answerTask(task) {
  try {
    await task.accept();
    console.log('Task accepted successfully');
    setupCallControls(task);
  } catch (error) {
    console.error('Failed to accept task:', error);
  }
}
\`\`\`

### 5. Call Controls

Set up call control functionality:

\`\`\`javascript
// call-controls.js
function setupCallControls(task) {
  const holdBtn = document.getElementById('hold-resume');
  const muteBtn = document.getElementById('mute-unmute');
  const endBtn = document.getElementById('end');

  holdBtn.onclick = () => toggleHold(task);
  muteBtn.onclick = () => toggleMute(task);
  endBtn.onclick = () => endCall(task);
}

async function toggleHold(task) {
  const holdBtn = document.getElementById('hold-resume');
  try {
    if (holdBtn.textContent === 'Hold') {
      await task.hold();
      holdBtn.textContent = 'Resume';
    } else {
      await task.resume();
      holdBtn.textContent = 'Hold';
    }
  } catch (error) {
    console.error('Hold/Resume failed:', error);
  }
}
\`\`\`

### 6. Agent State Management

Implement agent state controls:

\`\`\`javascript
// agent-state.js
async function setAgentState(webex, state, auxCodeId) {
  try {
    await webex.cc.setAgentState({
      state,
      auxCodeId,
      lastStateChangeReason: state
    });
    console.log('Agent state updated successfully');
  } catch (error) {
    console.error('Failed to update agent state:', error);
  }
}
\`\`\`

## Deployment and Testing

1. Bundle your application:
\`\`\`bash
npm run build
\`\`\`

2. Test locally:
\`\`\`bash
npm start
\`\`\`

3. Verify functionality:
   - Test authentication flow
   - Check agent registration
   - Handle incoming tasks
   - Test call controls
   - Verify state changes

## Common Issues and Troubleshooting

1. Authentication Issues
   - Verify client ID and scopes
   - Check redirect URI configuration

2. WebSocket Connection
   - Ensure proper registration
   - Check network connectivity
   - Verify WebSocket event listeners

3. Task Handling
   - Validate task event listeners
   - Check media handling setup
   - Verify call control operations

## Best Practices

1. Error Handling
   - Implement comprehensive error handling
   - Provide user feedback for failures
   - Log errors for debugging

2. State Management
   - Maintain consistent agent states
   - Handle state transitions properly
   - Update UI based on state changes

3. Resource Cleanup
   - Properly handle task completion
   - Clean up event listeners
   - Handle session termination

## Additional Resources

- [Webex Contact Center SDK Documentation](https://developer.webex-cx.com/documentation/guides)
- [API Reference](https://developer.webex-cx.com/documentation/references)
- [Sample Code Repository](https://github.com/webex/webex-contact-center-sdk)

## Support

For issues and questions:

- Submit issues on GitHub
- Contact Webex Developer Support
- Visit the Developer Community Forum

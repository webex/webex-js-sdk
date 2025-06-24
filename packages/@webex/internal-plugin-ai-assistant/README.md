# @webex/internal-plugin-ai-assistant

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Plugin for AI Assistant functionality

The AI assistant provides AI related features for webex, both in and out of meetings.

This is an internal Cisco Webex plugin. As such, it does not strictly adhere to semantic versioning. Use at your own risk. If you're not working on one of our first party clients, please look at our [developer api](https://developer.webex.com/) and stick to our public plugins.

- [Install](#install)
- [Usage](#usage)
- [Maintainers](#maintainers)
- [Contribute](#contribute)
- [License](#license)

## Install

```bash
npm install --save @webex/internal-plugin-ai-assistant
```

## Usage

The responses from the AI assistant service are delivered asynchronously via mercury. The methods in this plugin return a stream ID which can then be used to listen to the updates for a given request. The service will return preliminary versions of a response. The latest response for a given request should be used.

The data used for the arguments to the methods in this plugin is obtained from either Locus or the Meeting Container.
```js
import '@webex/internal-plugin-ai-assistant';

import WebexCore from '@webex/webex-core';

const webex = new WebexCore();

// Namespace.
webex.internal.aiAssistant

// Register the plugin (connects to mercury).
webex.internal.aiAssistant.register()
  .then(() => {}) // On successful registration.
  .catch(() => {}); // On failed registration.

// Unregister the plugin (disconnects from mercury).
webex.internal.aiAssistant.unregister()
  .then(() => {}) // On successful unregistration.
  .catch(() => {}); // On failed unregistration.

// Methods

// Get a summary of a meeting
webex.internal.aiAssistant.summarizeMeeting({
  meetingInstanceId: '<meeting-instance-id>',
  meetingSite: 'company.webex.com',
  sessionId: '<session-id>', // Optional for first request
  encryptionKeyUrl: '<encryption-key-url>',
  lastMinutes: 30 // Optional: summarize only last 30 minutes
}).then((response) => {
  const { requestId, sessionId, streamEventName } = response;
  
  // Listen for streaming responses
  webex.internal.aiAssistant.on(streamEventName, (data) => {
    console.log('AI Response:', data.message);
    if (data.finished) {
      console.log('Summary complete');
    }
  });
});

// Check if your name was mentioned in a meeting
webex.internal.aiAssistant.wasMyNameMentioned({
  meetingInstanceId: '<meeting-instance-id>',
  meetingSite: 'company.webex.com',
  sessionId: '<session-id>', // Optional for first request
  encryptionKeyUrl: '<encryption-key-url>'
}).then((response) => {
  const { requestId, sessionId, streamEventName } = response;
  
  // Listen for streaming responses
  webex.internal.aiAssistant.on(streamEventName, (data) => {
    console.log('Mention check result:', data.message);
    if (data.finished) {
      console.log('Check complete');
    }
  });
});

// Get all action items from a meeting
webex.internal.aiAssistant.showAllActionItems({
  meetingInstanceId: '<meeting-instance-id>',
  meetingSite: 'company.webex.com',
  sessionId: '<session-id>', // Optional for first request
  encryptionKeyUrl: '<encryption-key-url>'
}).then((response) => {
  const { requestId, sessionId, streamEventName } = response;
  
  // Listen for streaming responses
  webex.internal.aiAssistant.on(streamEventName, (data) => {
    console.log('Action items:', data.message);
    if (data.finished) {
      console.log('Action items retrieval complete');
    }
  });
});

// Ask any question about the meeting content
webex.internal.aiAssistant.askMeAnything({
  meetingInstanceId: '<meeting-instance-id>',
  meetingSite: 'company.webex.com',
  sessionId: '<session-id>', // Optional for first request
  encryptionKeyUrl: '<encryption-key-url>',
  question: 'What were the main decisions made in this meeting?'
}).then((response) => {
  const { requestId, sessionId, streamEventName } = response;
  
  // Listen for streaming responses
  webex.internal.aiAssistant.on(streamEventName, (data) => {
    console.log('AI Answer:', data.message);
    if (data.finished) {
      console.log('Question answered');
    }
    if (data.errorMessage) {
      console.error('Error:', data.errorMessage);
    }
  });
});
```

### Response Format

All AI Assistant methods return a Promise that resolves with:
- `requestId`: Unique identifier for the request
- `sessionId`: Session identifier for maintaining conversation context
- `streamEventName`: Event name to listen for streaming responses

### Stream Events

Listen to the returned `streamEventName` for real-time AI responses:

```js
webex.internal.aiAssistant.on(streamEventName, (data) => {
  console.log(data.message);     // Current message content
  console.log(data.finished);    // Boolean indicating if response is complete
  console.log(data.requestId);   // Request identifier
  console.log(data.errorMessage); // Error message if any
  console.log(data.errorCode);   // Error code if any
});
```

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2025 Cisco and/or its affiliates. All Rights Reserved.
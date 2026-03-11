# AI Assistant Enable Request

The AI Assistant Enable Request feature provides support for requesting and approving the enablement of AI assistant capabilities during a meeting. This feature implements a permission-based workflow where one participant can request to enable the AI assistant, and another participant (typically the host or a cohost) can accept or decline that request.

### Structure

The AI Enable Request plugin manages the approval workflow for enabling AI assistant functionality in meetings. It handles sending requests, receiving approval events, and processing responses.

### Events

The plugin emits events when approval requests are received:

```javascript
// Listen for approval request events
meeting.aiEnableRequest.on('approval-request-arrived', (event) => {
  const {actionType, isApprover, isInitiator, initiatorId, approverId, url} = event;

  if (isApprover) {
    // This participant received a request
    console.log(`Received ${actionType} from ${initiatorId}`);
  }

  if (isInitiator) {
    // This participant sent a request that was processed
    console.log(`Your ${actionType} request was processed`);
  }
});
```

### Initiator (requester) functionality

The following method is available to participants who want to request AI assistant enablement:

```javascript
// Request to enable AI assistant, specifying the approver's participant ID
meeting.aiEnableRequest.requestEnableAIAssistant({
  approverId: 'approver-participant-id',
});
```

### Approver functionality

The following methods are available to participants who receive AI assistant enable requests:

```javascript
// Accept an AI assistant enable request
// url and initiatorId come from the 'approval-request-arrived' event
meeting.aiEnableRequest.acceptEnableAIAssistantRequest({
  url: approvalUrl,
  initiatorId,
});

// Decline an AI assistant enable request
meeting.aiEnableRequest.declineEnableAIAssistantRequest({
  url: approvalUrl,
  initiatorId,
});

// Decline all pending AI assistant enable requests
meeting.aiEnableRequest.declineAllEnableAIAssistantRequests({
  url: approvalUrl,
  initiatorId,
});
```

### Example workflow

```javascript
// Participant A requests to enable AI assistant
await meeting.aiEnableRequest.requestEnableAIAssistant({
  approverId: participantB.id,
});

// Participant B receives the request via event
meeting.aiEnableRequest.on('approval-request-arrived', async (event) => {
  if (event.isApprover && event.actionType === 'REQUESTED') {
    // User can now choose to accept or decline
    await meeting.aiEnableRequest.acceptEnableAIAssistantRequest({
      url: event.url,
      initiatorId: event.initiatorId,
    });
  }
});
```

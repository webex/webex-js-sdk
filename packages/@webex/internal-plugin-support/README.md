# @webex/internal-plugin-support

[![standard-readme compliant](https://img.shields.io/badge/readme%20style-standard-brightgreen.svg?style=flat-square)](https://github.com/RichardLitt/standard-readme)

> Plugin for Support-related endpoints

This is an internal Cisco Webex plugin. As such, it does not strictly adhere to semantic versioning. Use at your own risk. If you're not working on one of our first party clients, please look at our [developer api](https://developer.webex.com/) and stick to our public plugins.

- [Install](#install)
- [Usage](#usage)
- [Contribute](#contribute)
- [Maintainers](#maintainers)
- [License](#license)

## Install

```bash
npm install --save @webex/internal-plugin-support
```

## Usage

### Registering the plugin

```js
import '@webex/internal-plugin-support';
import WebexCore from '@webex/webex-core';

const webex = new WebexCore({
  config: {
    support: {
      appType: 'my-app',          // (string) Your app identifier
      appVersion: '1.2.3',        // (string) App version reported in feedback + log metadata
      languageCode: 'en-US',      // (string) Language code used for support/feedback URLs
      incrementalLogs: true       // (boolean) Enables diff (incremental) log uploads by default
    }
  }
});

// Example: fetch a localized end‑user support URL
const supportUrl = await webex.internal.support.getSupportUrl();

// Example: fetch a feedback (survey) URL with optional overrides
const feedbackUrl = await webex.internal.support.getFeedbackUrl({
  appVersion: '1.2.3-hotfix',     // override default
  feedbackId: 'custom-feedback-id' // if omitted a uuid.v4() is generated
});
```

### Submitting Logs

`submitLogs(metadata, logs?, options?) -> Promise<object>`

Uploads diagnostic logs to the Client Logs service via a three‑phase (initialize / upload / finalize) flow handled internally.

```js
// Submit incremental (diff) logs based on config.support.incrementalLogs (true)
const result1 = await webex.internal.support.submitLogs({
  locusId: '<locus-id>',
  callStart: Date.now(),
  correlationId: 'corr-123',
  productAreaTag: 'calling',
  issueTypeTag: 'media-quality',
  issueDescTag: 'One way audio',
  surveySessionId: 'survey-session-abc'
});

// Force a FULL log upload (ignores incrementalLogs config)
const result2 = await webex.internal.support.submitLogs(
  {feedbackId: 'fb-001'},
  undefined,
  {type: 'full'}
);

// Provide your own prepared log lines (bypasses internal buffers + diff logic)
const customLogs = ['[t=0] App started', '[t=20] Error X'];
const result3 = await webex.internal.support.submitLogs(
  {feedbackId: 'fb-002'},
  customLogs
);
```

Returned object shape depends on the service response, but the SDK ensures a `userId` is present (taken from the device if the service omits it).

#### Log Selection Logic

If you do not pass the `logs` parameter:

- The plugin checks internal buffers: `webex.logger.sdkBuffer`, `clientBuffer`, and `buffer`.
- It calls `webex.logger.formatLogs({diff: D})` where `D` is determined by:
  - If `options.type` is provided: `diff = (options.type === 'diff')`
  - Else: `diff = config.support.incrementalLogs`
- `type: 'full'` forces a complete log set; `type: 'diff'` forces incremental since last upload.

If you pass a `logs` array:

- Your array is uploaded verbatim (no diff logic applied).

#### Upload API sequence

The diff (incremental) vs full selection only affects the log payload returned by `webex.logger.formatLogs({diff: ...})`. The network flow and endpoints are identical:

1. Initialize: `POST {CLIENT_LOGS_SERVICE_URL}/logs/urls`  
   Body: `{ file: "<proposed-filename>.txt" }`  
   Response supplies a `tempURL` (pre-signed object storage URL), `logFilename`, and possibly `userId`.

2. Upload: `PUT tempURL` (exact method depends on the pre-signed URL; the SDK just streams the file bytes).  
   In code: `uploadOptions.phases.upload.$uri = (session) => session.tempURL`.

3. Finalize: `POST {CLIENT_LOGS_SERVICE_URL}/logs/meta`  
   Body (built in `finalize` phase):  

   ```json
   {
     "filename": "<session.logFilename>",
     "data": [ { "key": "...", "value": "..." }, ... ],   // metadata array from _constructFileMetadata
     "userId": "<device.userId || session.userId>"
   }
   ```

Environment / discovery:

- Base URL resolved from service catalog service name `clientLogs`.
- Can be overridden with env var `CLIENT_LOGS_SERVICE_URL` (default `https://client-logs-a.wbx2.com/api/v1`).
- Initialize endpoint path: `/logs/urls`
- Finalize endpoint path: `/logs/meta`

Filename logic (same for diff & full):

- If `metadata.locusId` & `metadata.callStart` present: `<locusId>_<callStart>.txt`
- Else: `<webex.sessionId>.txt`

Code reference: `src/support.js` inside `submitLogs()` where `initalOpts` (`logs/urls`) and `finalOpts` (`logs/meta`) are defined and combined into `uploadOptions`.

#### Metadata

The following keys (if provided in the `metadata` object) are converted into an array of `{key,value}` pairs and sent during finalize:
`locusId, appVersion, callStart, feedbackId, correlationId, meetingId, surveySessionId, productAreaTag, issueTypeTag, issueDescTag, locussessionid, autoupload`

Additional automatically added keys (when available):

- `trackingId` (from `webex.sessionId`)
- `appVersion` (from `config.support.appVersion` if not already provided)
- `userId` (from `webex.internal.device.userId`)
- `orgId` (from `webex.internal.device.orgId`)

File naming:

- If both `metadata.locusId` and `metadata.callStart` exist: `<locusId>_<callStart>.txt`
- Else: `<webex.sessionId>.txt`

#### Authentication

The plugin attempts `webex.credentials.getUserToken()`, falling back to `getClientToken()` on failure, and uses the resulting token for the upload sequence.

### Fetching Support / Feedback URLs

```js
const supportUrl = await webex.internal.support.getSupportUrl();
// GET conversation/users/deskSupportUrl?languageCode=<config.support.languageCode>

const feedbackUrl = await webex.internal.support.getFeedbackUrl({
  appVersion: '1.2.3',
  appType: 'desktop',
  languageCode: 'en-US',
  feedbackId: 'optional-explicit-id'
});
// POST conversation/users/deskFeedbackUrl (generates feedbackId if omitted)
```

### Configuration Reference

`config.support` fields:

- `appType` (string) – included in feedback payloads.
- `appVersion` (string) – included in feedback & log metadata (also auto‑added if not in metadata).
- `languageCode` (string) – used for URL localization.
- `incrementalLogs` (boolean) – default behavior for `submitLogs` when `options.type` not provided.

Service discovery / endpoints (pre‑discovery) can be overridden with env variables:

- `ATLAS_SERVICE_URL` (defaults `https://atlas-a.wbx2.com/admin/api/v1`)
- `CLIENT_LOGS_SERVICE_URL` (defaults `https://client-logs-a.wbx2.com/api/v1`)

### Periodic Log Upload Manager

The support plugin now includes a shared LogUploadManager that provides automated periodic log uploads for other Webex SDK plugins. This eliminates duplicate timer logic across plugins and ensures consistent behavior.

#### Plugin Integration

Other plugins can use the shared log upload functionality by initializing it with plugin-specific configuration:

```js
// In plugin constructor or initialization
webex.internal.support.initPeriodicLogUpload({
  enablePeriodicUpload: true,
  intervals: [0.1, 15, 30, 60], // minutes - progressive intervals
  multiplicationFactor: 1,
  isActiveSessionCheck: () => this.hasActiveSession(), // plugin-specific logic
  metadata: {
    plugin: 'plugin-name',
    version: '1.0.0'
  }
});

// Start periodic uploads (when session becomes active)
webex.internal.support.startPeriodicLogUpload();

// Trigger manual upload with metadata
webex.internal.support.submitLogs({
  correlationId: 'error-123',
  method: 'methodName',
  triggerType: 'error',
  timestamp: new Date().toISOString(),
  sdkVersion: webex.version || 'unknown'
});

// Stop periodic uploads (when session ends)
webex.internal.support.stopPeriodicLogUpload();
```

#### Plugin-Specific Active Session Examples

Each plugin defines what constitutes an "active session" to prevent unnecessary log uploads:

**Plugin-CC (Contact Center):**

```js
isActiveSessionCheck: () => {
  return this.agentConfig?.isAgentLoggedIn && 
         (this.taskManager?.hasActiveTasks() || this.agentConfig?.lastStateAuxCodeId === '0');
}
```

**Calling SDK:**

```js
isActiveSessionCheck: () => {
  const activeCalls = this.getActiveCalls();
  return Object.keys(activeCalls).length > 0;
}
```

**Meetings Plugin:**

```js
isActiveSessionCheck: () => {
  return !!this.mediaProperties.webrtcMediaConnection;
}
```

#### Configuration Options

```js
{
  enablePeriodicUpload: true,        // Whether to enable periodic uploads
  intervals: [0.1, 15, 30, 60],     // Progressive intervals in minutes
  multiplicationFactor: 1,          // Multiply intervals by this factor
  isActiveSessionCheck: () => true, // Function to check if session is active
  metadata: {                       // Default metadata included in uploads
    plugin: 'plugin-name',
    environment: 'production'
  }
}
```

#### LogUploadManager Methods

| Method                             | Purpose                                       |
| ---------------------------------- | --------------------------------------------- |
| `initPeriodicLogUpload(config)`    | Initialize with plugin-specific configuration |
| `startPeriodicLogUpload()`         | Start progressive timer-based uploads         |
| `stopPeriodicLogUpload()`          | Stop all timers and cleanup                   |
| `getLogUploadStatus()`             | Get current status for debugging              |
| `updateLogUploadConfig(newConfig)` | Update configuration during runtime           |

#### Simplified Design: Direct submitLogs Usage

The LogUploadManager uses the existing `submitLogs()` method directly, eliminating the need for wrapper methods or event systems. This provides a cleaner, more maintainable architecture:

```js
// Periodic upload (triggered by timer internally) - uses incremental logs for efficiency
await webex.internal.support.submitLogs({
  ...pluginMetadata,
  triggerType: 'periodic',
  intervalIndex: 2,
  intervalMinutes: 30,
  autoupload: true,
  timestamp: new Date().toISOString(),
  sdkVersion: webex.version || 'unknown'
}, undefined, { type: 'diff' }); // Automatic incremental to prevent bandwidth waste

// Manual upload with full control
const result = await webex.internal.support.submitLogs({
  correlationId: 'abc123',
  feedbackId: 'feedback-456'
}, customLogs, { type: 'full' });
```

#### Important: Full Logs During Periodic Upload Operations

**When periodic uploads are active and you need comprehensive logs** (e.g., for error analysis, debugging, or support cases), **always explicitly pass `type: 'full'`**:

```js
// ✅ CORRECT: Force full logs during error scenarios
try {
  // Some operation that might fail
  await someRiskyOperation();
} catch (error) {
  await webex.internal.support.submitLogs({
    correlationId: 'error-' + Date.now(),
    triggerType: 'error',
    errorMessage: error.message,
    stackTrace: error.stack,
    timestamp: new Date().toISOString()
  }, undefined, { type: 'full' }); // Ensures complete diagnostic context
}

// ✅ CORRECT: Force full logs for support cases
await webex.internal.support.submitLogs({
  feedbackId: 'support-case-123',
  issueType: 'call-quality',
  userReport: 'Audio cutting out during meeting'
}, undefined, { type: 'full' }); // Complete logs for support analysis
```

```js
// ❌ WRONG: Don't rely on defaults during periodic uploads
await webex.internal.support.submitLogs({
  correlationId: 'error-123',
  triggerType: 'error'
}); // May only send incremental logs, missing error context!
```

**Why `type: 'full'` is Critical**:

- **Periodic uploads use incremental logs** for efficiency
- **Manual uploads default to config behavior** (incremental if enabled)
- **Error scenarios need complete context** for proper diagnosis
- **Support cases require full logs** for comprehensive analysis

This approach eliminates redundancy and provides direct access to all `submitLogs` capabilities while ensuring critical uploads always have complete log context.

#### Benefits

- **Code Reuse**: Single implementation across all plugins
- **Consistency**: Standardized behavior and timing
- **Flexibility**: Plugin-specific active session detection
- **Maintainability**: Central location for updates
- **Event-Driven**: Uses existing Webex SDK event system (`REQUEST_UPLOAD_LOGS`)

### Summary of Public Methods

| Method                                  | Purpose                                                           |
| --------------------------------------- | ----------------------------------------------------------------- |
| `getSupportUrl()`                       | Retrieve localized support portal URL                             |
| `getFeedbackUrl(options)`               | Retrieve feedback / survey URL (generates `feedbackId` if absent) |
| `submitLogs(metadata, logs?, options?)` | Upload diagnostic logs (type: 'diff' \| 'full')                   |
| `initPeriodicLogUpload(config)`         | Initialize shared log upload manager for plugins                  |
| `startPeriodicLogUpload()`              | Start periodic log uploads                                        |
| `stopPeriodicLogUpload()`               | Stop periodic log uploads                                         |
| `getLogUploadStatus()`                  | Get log upload manager status                                     |
| `updateLogUploadConfig(newConfig)`      | Update log upload configuration during runtime                    |

> NOTE: This is an INTERNAL plugin; interfaces may change without a major version bump.

## Maintainers

This package is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md) for more details.

## License

© 2016-2020 Cisco and/or its affiliates. All Rights Reserved.

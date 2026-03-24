# @webex/internal-plugin-call-ai-summary

Internal Webex JS SDK plugin for retrieving AI-generated call summaries, notes, action items, and transcripts from completed calls.

## Overview

This plugin resolves AI summary containers via the **Pragya** service and fetches encrypted summary content from URLs returned by Pragya. All AI-generated content is decrypted using KMS keys provided in the container response.

**Discovery flow:**

1. **Janus** (call history) returns `extensionPayload.callingContainerIds` per call session
2. **Pragya** resolves a container ID into metadata including content URLs and encryption key
3. **Plugin** fetches content from those URLs and decrypts using `@webex/internal-plugin-encryption`

## Install

This plugin is part of the Webex JS SDK monorepo. It self-registers when imported — no changes to `packages/webex` are needed.

```bash
# From the SDK monorepo root
yarn
```

To use in a consuming application:

```javascript
// Importing the plugin auto-registers it on webex.internal.aisummary
import '@webex/internal-plugin-call-ai-summary';
```

## Prerequisites

- An authenticated Webex SDK instance with a registered device
- `@webex/internal-plugin-encryption` (pulled in automatically as a dependency)
- A valid Pragya container ID (obtained from Janus call history `extensionPayload.callingContainerIds`)

## API

All methods are accessible via `webex.internal.aisummary`.

### `getContainer({ containerId })`

Resolves a Pragya container by ID. Returns container metadata with summary content URLs and the KMS encryption key.

The raw Pragya response nests URLs under `summaryData.data` — this method flattens it so you can access `summaryData.summaryUrl` directly.

```typescript
const container = await webex.internal.aisummary.getContainer({
  containerId: '34125120-13b5-11f1-9b36-adb685725098',
});

// container.summaryData.summaryUrl    — full summary URL
// container.summaryData.transcriptUrl — transcript URL
// container.summaryData.status        — "Active" when ready
// container.encryptionKeyUrl          — KMS key for decryption
```

**Returns:** `Promise<PragyaContainerResponse>`

### `getSummary({ containerInfo })`

Fetches and decrypts all summary content (note, short note, and action items) in a single request via `summaryUrl?fields=note,shortnote,actionitems`.

This is the **recommended** method for retrieving summary content.

```typescript
const summary = await webex.internal.aisummary.getSummary({
  containerInfo: container,
});

console.log(summary.note);       // Decrypted full note
console.log(summary.shortNote);  // Decrypted short note
summary.actionItems.forEach((item) => {
  console.log(item.aiGeneratedContent);  // Decrypted action item
});
```

**Returns:** `Promise<SummaryContent>` — `{ id, note, shortNote, actionItems, feedbackUrl? }`

### `getNotes({ containerInfo })`

Fetches and decrypts notes from the standalone `notesUrl` endpoint. Only available if `notesUrl` is present in the Pragya response.

```typescript
const notes = await webex.internal.aisummary.getNotes({
  containerInfo: container,
});

console.log(notes.content);  // Decrypted notes
```

**Returns:** `Promise<SummaryNotes>` — `{ id, content, feedbackUrl? }`

### `getActionItems({ containerInfo })`

Fetches and decrypts action items from the standalone `actionItemsUrl` endpoint. Only available if `actionItemsUrl` is present in the Pragya response.

```typescript
const actionItems = await webex.internal.aisummary.getActionItems({
  containerInfo: container,
});

actionItems.snippets.forEach((snippet) => {
  console.log(snippet.aiGeneratedContent);  // Decrypted
  console.log(snippet.editedContent);       // User-edited version (if any)
});
```

**Returns:** `Promise<SummaryActionItems>` — `{ id?, snippets[], feedbackUrl? }`

### `getTranscriptUrl({ containerInfo })`

Returns the transcript URL string without fetching or decrypting. Use this when you need the URL for downstream processing.

```typescript
const url = webex.internal.aisummary.getTranscriptUrl({
  containerInfo: container,
});
```

**Returns:** `string`

### `getTranscript({ containerInfo })`

Fetches and decrypts the full call transcript.

```typescript
const transcript = await webex.internal.aisummary.getTranscript({
  containerInfo: container,
});

transcript.snippets.forEach((snippet) => {
  console.log(`[${snippet.startTime}] ${snippet.speaker?.speakerName}: ${snippet.content}`);
});
```

**Returns:** `Promise<TranscriptContent>` — `{ id, totalCount, snippets[] }`

## Full Usage Example

```typescript
import '@webex/internal-plugin-call-ai-summary';

// 1. Get call history (existing SDK API)
const callHistory = await callHistoryInstance.getCallHistoryData(10, 50);
const sessions = callHistory.data.userSessions;

// 2. Find a session with AI summary
const session = sessions.find(
  (s) => s.extensionPayload?.callingContainerIds?.length > 0
);
if (!session) return;

// 3. Resolve the container
const containerId = session.extensionPayload.callingContainerIds[0];
const container = await webex.internal.aisummary.getContainer({ containerId });

if (container.summaryData.status !== 'Active') {
  console.log('Summary not ready yet');
  return;
}

// 4. Fetch all summary content in one call
const summary = await webex.internal.aisummary.getSummary({ containerInfo: container });
console.log('Note:', summary.note);
console.log('Short Note:', summary.shortNote);
summary.actionItems.forEach((item, i) => {
  console.log(`Action ${i + 1}: ${item.aiGeneratedContent}`);
});

// 5. Fetch transcript
const transcript = await webex.internal.aisummary.getTranscript({ containerInfo: container });
transcript.snippets.forEach((s) => {
  console.log(`[${s.startTime}] ${s.speaker?.speakerName}: ${s.content}`);
});
```

## Manual Testing

A manual integration test is provided for verifying against live APIs:

```bash
cd packages/@webex/internal-plugin-call-ai-summary

# Provide a fresh token and container ID
WEBEX_TOKEN='<token>' CONTAINER_ID='<id>' node src/manual-integration-test.js
```

This script registers a device (WDM), resolves the Pragya service via the SDK service catalog, fetches the container, decrypts summary content via KMS, and prints the results.

## Error Handling

| Error | Cause | Recovery |
|-------|-------|----------|
| `containerId is required and must be a non-empty string` | Empty or missing containerId | Validate input before calling |
| `containerInfo with valid summaryData and encryptionKeyUrl is required` | Missing container info or URL field | Call `getContainer()` first |
| `Container not found` | 404 from Pragya | Verify containerId from Janus |
| `Summary content not available or expired` | 404 from content endpoint | Content may have been deleted |
| `Access denied: User not authorized to view this summary` | 403 | Check user permissions / org AI settings |
| `Authentication failed: Invalid or expired token` | 401 | Re-authenticate the user |

## Encryption

All AI-generated content (`aiGeneratedContent` fields) is encrypted with KMS. The plugin decrypts automatically using:

- **Key source:** `encryptionKeyUrl` from the Pragya container response, with fallback to `keyUrl` from the content response body
- **Decryption method:** `webex.internal.encryption.decryptText(keyUrl, ciphertext)`

This is the same pattern used by `@webex/internal-plugin-ai-assistant` and `@webex/internal-plugin-task`.

## Development

```bash
cd packages/@webex/internal-plugin-call-ai-summary

# Build
yarn build

# Lint
yarn test:style

# Unit tests
yarn test:unit

# All checks
yarn test
```

## Package Structure

```
src/
  index.ts          # Self-registration via registerInternalPlugin('aisummary', ...)
  ai-summary.ts     # Plugin implementation (WebexPlugin.extend)
  config.ts         # Plugin config
  constants.ts      # Service name, error messages
  types.ts          # TypeScript interfaces
test/
  unit/
    spec/
      ai-summary.ts # Unit tests (26 tests)
    data/
      responses.ts  # Mock API response fixtures
ai-docs/
  ARCHITECTURE.md   # Detailed architecture document
```

## Dependencies

| Package | Purpose |
|---------|---------|
| `@webex/webex-core` | Plugin infrastructure (`WebexPlugin`, `registerInternalPlugin`) |
| `@webex/internal-plugin-encryption` | KMS content decryption via `decryptText()` |

## Architecture

See [ai-docs/ARCHITECTURE.md](ai-docs/ARCHITECTURE.md) for the full architecture document covering data flows, API request/response details, DTOs, security considerations, and testing strategy.

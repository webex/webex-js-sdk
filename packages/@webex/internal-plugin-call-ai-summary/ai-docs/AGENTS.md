# @webex/internal-plugin-call-ai-summary

This is an internal Cisco Webex plugin. As such, it does not strictly adhere to semantic versioning. Use at your own risk. If you're not working on one of our first party clients, please look at our developer api and stick to our public plugins.
Internal Webex JS SDK plugin for retrieving AI-generated call summaries, notes, action items, and transcript URLs from the Pragya and AI Bridge services.

## Overview

This plugin provides methods to:

1. Resolve a **Pragya container** by ID (returns metadata, summary URLs, and encryption key)
2. Fetch and decrypt **AI-generated summaries** (note, short note, action items) in a single call
3. Fetch and decrypt **AI-generated notes** via a dedicated notes endpoint
4. Fetch and decrypt **AI-generated action items** via a dedicated action items endpoint
5. Retrieve the **transcript URL** for a call

All AI-generated content is **JWE-encrypted** and decrypted via the KMS (Key Management Service) using `@webex/internal-plugin-encryption`.

## Architecture

```
Pragya Service                     AI Bridge Service
(container metadata)               (summary content)
       |                                  |
  getContainer()                   getSummary() / getNotes() / getActionItems()
       |                                  |
       v                                  v
  PragyaContainerResponse          Encrypted JWE content
  (summaryData, encryptionKeyUrl)         |
                                          v
                                   KMS Decryption
                                   (internal-plugin-encryption)
                                          |
                                          v
                                   Decrypted plaintext (HTML)
```

**Note:** The Pragya API returns summary URLs nested under `summaryData.data`. The `getContainer()` method normalizes this automatically, flattening `summaryData.data` into `summaryData` so consumers can access `summaryData.summaryUrl` directly.

## Registration

The plugin registers itself as `aisummary` on the internal namespace:

```typescript
import '@webex/internal-plugin-call-ai-summary';

// Accessed via:
webex.internal.aisummary.getContainer({ containerId: '...' });
```

## Source Files

| File | Description |
|------|-------------|
| `src/index.ts` | Entry point. Registers the plugin via `registerInternalPlugin('aisummary', ...)`. |
| `src/ai-summary.ts` | Main plugin class extending `WebexPlugin`. Contains all public and private methods. |
| `src/types.ts` | TypeScript interfaces for request/response DTOs. |
| `src/constants.ts` | Service name, resource path, and error message constants. |
| `src/config.ts` | Plugin configuration (currently empty). |

## API Reference

### `getContainer(options: GetContainerOptions): Promise<PragyaContainerResponse>`

Resolves a Pragya container by ID. Returns container metadata including summary URLs and the KMS encryption key URL. Normalizes the response by flattening `summaryData.data` into `summaryData`.

```typescript
const container = await webex.internal.aisummary.getContainer({
  containerId: '34125120-13b5-11f1-9b36-adb685725098',
});

// After normalization, URLs are directly on summaryData:
console.log(container.summaryData.summaryUrl);    // https://aibridge-.../summaries/...
console.log(container.summaryData.transcriptUrl); // https://aibridge-.../transcripts/...
```

**Request**: `GET {pragya-service}/containers/{containerId}`

**Response fields**:
- `summaryData` — Contains summary URLs (`summaryUrl`, `transcriptUrl`, `status`, `summarizeAfterCall`)
- `encryptionKeyUrl` — KMS key URL for decrypting content (e.g., `kms://kms-aore.wbx2.com/keys/...`)
- `kmsResourceObjectUrl`, `aclUrl`, `forkSessionId`, `callSessionId`, `ownerUserId`, `orgId`, `start`, `end`

### `getSummary(options: GetSummaryContentOptions): Promise<SummaryContent>`

Fetches all AI-generated summary content (note, short note, and action items) from a single request to the summary URL, and decrypts each field via KMS. This is the primary method for retrieving summary content.

```typescript
const summary = await webex.internal.aisummary.getSummary({
  containerInfo: container,
});

console.log(summary.note);        // Decrypted full note (HTML)
console.log(summary.shortNote);   // Decrypted short note (HTML)
console.log(summary.actionItems); // Array of decrypted action item snippets
console.log(summary.feedbackUrl); // Feedback URL from links (if available)
```

**Request**: `GET {summaryUrl}?fields=note,shortnote,actionitems`

**Response structure** (from AI Bridge, before decryption):
```json
{
  "id": "...",
  "keyUrl": "kms://...",
  "note": { "aiGeneratedContent": "<JWE>" },
  "shortnote": { "aiGeneratedContent": "<JWE>" },
  "actionitems": {
    "snippets": [
      { "id": "...", "aiGeneratedContent": "<JWE>" }
    ]
  },
  "links": [
    { "rel": "feedback", "href": "https://..." }
  ]
}
```

**Return type** (`SummaryContent`):
- `id` — Summary identifier
- `note` — Decrypted full note (HTML string)
- `shortNote` — Decrypted short note (HTML string)
- `actionItems` — Array of `ActionItemSnippet` objects
- `feedbackUrl` — Extracted from `links` array (`rel: "feedback"`), if available

### `getNotes(options: GetSummaryContentOptions): Promise<SummaryNotes>`

Fetches AI-generated notes from the dedicated notes endpoint and decrypts via KMS. Requires `notesUrl` to be present in the container's `summaryData`.

```typescript
const notes = await webex.internal.aisummary.getNotes({
  containerInfo: container,
});

console.log(notes.content); // Decrypted notes content
```

**Request**: `GET {notesUrl}`

> **Note:** The `notesUrl` may not be present in all API versions. Prefer `getSummary()` which returns notes, short notes, and action items in a single call.

### `getActionItems(options: GetSummaryContentOptions): Promise<SummaryActionItems>`

Fetches AI-generated action items from the dedicated action items endpoint and decrypts each snippet via KMS. Requires `actionItemsUrl` to be present in the container's `summaryData`.

```typescript
const actionItems = await webex.internal.aisummary.getActionItems({
  containerInfo: container,
});

actionItems.snippets.forEach((item) => {
  console.log(item.aiGeneratedContent); // Decrypted action item
});
```

**Request**: `GET {actionItemsUrl}`

> **Note:** The `actionItemsUrl` may not be present in all API versions. Prefer `getSummary()` which returns notes, short notes, and action items in a single call.

### `getTranscriptUrl(options: GetSummaryContentOptions): string`

Returns the transcript URL from the container info. Does not fetch or decrypt content.

```typescript
const transcriptUrl = webex.internal.aisummary.getTranscriptUrl({
  containerInfo: container,
});
```

## Types

### Request Types

```typescript
interface GetContainerOptions {
  containerId: string; // Pragya container ID
}

interface GetSummaryContentOptions {
  containerInfo: PragyaContainerResponse; // Resolved container from getContainer()
}
```

### Response Types

```typescript
interface PragyaContainerResponse {
  summaryData: PragyaSummaryData;
  encryptionKeyUrl: string;
  kmsResourceObjectUrl: string;
  aclUrl: string;
  forkSessionId: string;
  callSessionId: string;
  ownerUserId: string;
  orgId: string;
  start: string;
  end: string;
}

interface PragyaSummaryData {
  status: string;
  summaryUrl: string;
  transcriptUrl: string;
  summarizeAfterCall: boolean;
  notesUrl?: string;       // May not be present in all API versions
  actionItemsUrl?: string; // May not be present in all API versions
}

interface SummaryContent {
  id: string;
  note: string;           // Decrypted full note (HTML)
  shortNote: string;      // Decrypted short note (HTML)
  actionItems: ActionItemSnippet[];
  feedbackUrl?: string;   // From links array (rel="feedback")
}

interface SummaryNotes {
  id: string;
  content: string;        // Decrypted notes content
  feedbackUrl?: string;
}

interface SummaryActionItems {
  id: string;
  snippets: ActionItemSnippet[];
  feedbackUrl?: string;
}

interface ActionItemSnippet {
  id: string;
  editedContent?: string;      // User-edited version (if available)
  aiGeneratedContent: string;  // Decrypted AI-generated content
}
```

## Error Handling

The plugin normalizes HTTP errors into descriptive messages:

| Status Code | Error Message |
|-------------|---------------|
| 401 | `Authentication failed: Invalid or expired token` |
| 403 | `Access denied: User not authorized to view this summary` |
| 404 | `Container not found` |
| Other | `{methodName} failed: {error.message}` |

Validation errors are thrown synchronously:
- Missing or empty `containerId` throws `containerId is required and must be a non-empty string`
- Missing `containerInfo`, `summaryData` URL, or `encryptionKeyUrl` throws `containerInfo with valid summaryData and encryptionKeyUrl is required`

## Encryption / Decryption

All AI-generated content from the AI Bridge service is JWE-encrypted. Decryption uses:

```
webex.internal.encryption.decryptText(encryptionKeyUrl, encryptedContent)
```

This requires:
1. A registered device (`webex.internal.device.register()`)
2. Mercury WebSocket connection (initiated automatically during KMS key fetch)
3. ECDHE key exchange with KMS
4. Key retrieval from KMS using the `encryptionKeyUrl`

The SDK handles steps 1-4 automatically when `decryptText` is called.

## Dependencies

- `@webex/webex-core` — Base plugin class, request handling, auth interceptor
- `@webex/internal-plugin-encryption` — KMS decryption

## Token Requirements

The Pragya and AI Bridge APIs require a valid Webex access token. The SDK's auth interceptor automatically attaches the token for URLs in the service catalog or on allowed domains (e.g., `wbx2.com`, `webex.com`).

## Manual Testing

Two manual test scripts are provided in `src/`:

### `manual-pragya-api-test.js`
Validates the Pragya container response structure (34 checks).

```bash
cd packages/@webex/internal-plugin-call-ai-summary
WEBEX_TOKEN='<token>' node src/manual-pragya-api-test.js
```

### `manual-integration-test.js`
Tests the full end-to-end flow using the SDK service catalog:
1. Device registration (WDM) to populate the service catalog
2. `getContainer` via plugin (resolves `service: 'pragya'` from the catalog)
3. `getSummary` via plugin (fetches + decrypts note, short note, and action items via KMS)
4. `getTranscriptUrl` via plugin
5. Transcript content fetch

```bash
cd packages/@webex/internal-plugin-call-ai-summary
WEBEX_TOKEN='<token>' CONTAINER_ID='<id>' node src/manual-integration-test.js
```

Both scripts require a valid Webex access token. Set `WEBEX_TOKEN` and optionally `CONTAINER_ID` as environment variables, or update the placeholder values in the scripts.

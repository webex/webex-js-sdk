# AI Call Summary Architecture

## 1. Overview

The Webex JS SDK will provide AI-generated call summary retrieval capabilities through a new **`internal-plugin-call-ai-summary`** internal plugin. This document describes the architecture for retrieving AI-generated notes, action items, and transcripts from completed calls.

### 1.1 Summary Discovery Flow

AI summary content is discovered through a two-step lookup: **Janus** (call history) provides container IDs, and **Pragya** (AI container service) resolves those IDs into direct URLs for summary content.

**Step 1: Get container IDs from Janus call history**

The Janus `UserSession` response includes an `extensionPayload` field containing container IDs for AI artifacts related to a call:

```typescript
export type UserSession = {
  id: string;
  sessionId: string;
  disposition: Disposition;
  startTime: string;
  endTime: string;
  url: string;
  durationSeconds: number;
  joinedDurationSeconds: number;
  participantCount: number;
  isDeleted: boolean;
  isPMR: boolean;
  correlationIds: string[];
  links: CallRecordLink;
  self: CallRecordSelf;
  other: CallRecordListOther;
  sessionType: SessionType;
  direction: string;
  callingSpecifics?: { redirectionDetails: RedirectionDetails };
  extensionPayload?: {
    callingContainerIds?: string[];
  };
};
```

> **Note:** The `extensionPayload.callingContainerIds` field is already present in the Janus API response but is not yet in the SDK's `UserSession` type definition at `packages/calling/src/Events/types.ts`. However, this plugin does **not** modify that type. It accepts a plain `containerId` string as input, keeping the plugin self-contained. The `UserSession` type update can be handled separately by the calling package team when convenient.

**Step 2: Resolve container IDs via Pragya**

For each `containerId`, call the Pragya container API:

```
GET https://{pragya-host}/pragya/api/v1/containers/{containerId}
```

**Pragya response:**

> **Note:** The raw Pragya response nests summary URLs under `summaryData.data`. The plugin's `getContainer()` method flattens this so consumers can access `summaryData.summaryUrl` directly.

```json
{
  "id": "34125120-13b5-11f1-9b36-adb685725098",
  "objectType": "callingAIContainer",
  "memberships": {
    "items": [
      { "id": "...", "roles": ["OWNER"], "objectType": "containerMembership" }
    ]
  },
  "summaryData": {
    "extensionId": "...",
    "objectType": "extension",
    "extensionType": "callingAISummary",
    "data": {
      "id": "...",
      "objectType": "callingAISummary",
      "status": "Active",
      "summaryUrl": "https://aibridge-url/summaries/c635e870-7b3b-4b3b-8b3b-7b3b7b3b7b3c",
      "transcriptUrl": "https://aibridge-url/summaries/c635e870-7b3b-4b3b-8b3b-7b3b7b3b7b3c/transcripts",
      "summarizeAfterCall": true,
      "aclUrl": "https://acl-a.wbx2.com/...",
      "kmsResourceObjectUrl": "kms://kms-cisco.wbx2.com/resources/...",
      "contentRetention": { ... }
    }
  },
  "encryptionKeyUrl": "kms://kms-cisco.wbx2.com/keys/897e4d2d-6219-433d-be77-7ec73fe1c0db",
  "kmsResourceObjectUrl": "kms://kms-cisco.wbx2.com/resources/f7316435-2147-4d23-bf4a-762d831cb58c",
  "aclUrl": "https://acl-a.wbx2.com/acl/api/v1/acls/78c4cd90-f880-11ee-96e9-3932dce37910",
  "forkSessionId": "123e4567-e89b-12d3-a456-426614174000",
  "callSessionId": "123e4567-e89b-12d3-a456-426614174000",
  "ownerUserId": "123e4567-e89b-12d3-a456-426614174000",
  "orgId": "123e4567-e89b-12d3-a456-426614174000",
  "start": "2023-10-01T12:00:00Z",
  "end": "2023-10-01T12:00:00Z"
}
```

**Step 3: Fetch summary content from the URLs**

The `summaryData` object provides direct, region-correct URLs to each content type. The plugin fetches content from these URLs and decrypts it using the `encryptionKeyUrl` from the same Pragya response.

### 1.2 Key Design Decisions

- **Self-contained plugin with zero changes to existing packages.** The plugin owns all of its types, constants, and logic. It does not modify `UserSession`, `CallHistory`, or any other existing code. Consumers pass a `containerId` string; how they obtain it (Janus, Mercury event, hard-coded for testing) is their concern.
- **No separate service discovery for summary endpoints.** Pragya returns fully-qualified URLs that already include the correct regional host. The SDK fetches from these URLs directly using `uri:` rather than `service:` + `resource:`.
- **Pragya is the source of truth** for both the content URLs and the encryption key.
- **Pragya is discoverable via U2C** as `serviceName: "pragya"` (validated: e.g., load-us resolves to `https://pragya-loada.ciscospark.com/pragya/api/v1`).

### 1.3 Goals

- Resolve AI summary container IDs from Janus call history via Pragya
- Retrieve AI-generated notes (full notes) for a call
- Retrieve AI-generated action items for a call
- Retrieve transcript download URLs for a call
- Handle encrypted content decryption via KMS
- Maintain consistency with existing Webex JS SDK internal plugin patterns
- Provide type-safe interfaces for all operations
- Support both browser and Node.js environments

### 1.4 Non-Goals

- Start/stop AI assistant during active calls (handled by Pragya start/stop APIs, out of scope)
- Generate or regenerate summaries (backend-managed during/after calls)
- Provide real-time in-call AI responses
- Handle recording storage or deletion
- Implement feedback UI components

### 1.5 Prerequisites

1. Janus API already returns `extensionPayload.callingContainerIds` in the response
2. Testing environment with AI-enabled calls that generate summaries

## 2. High-Level Design

### 2.1 Component Architecture

```
+---------------------------------------------------------------+
|                     Client Application                         |
+-------------------------------+-------------------------------+
                                |
                                | webex.internal.aisummary.*
                                |
+-------------------------------v-------------------------------+
|                internal-plugin-call-ai-summary                      |
|                   (Internal Plugin)                            |
|  +----------------------------------------------------------+ |
|  |  Public API Methods                                       | |
|  |  - getContainer(containerId)                              | |
|  |  - getSummary(containerInfo)                              | |
|  |  - getNotes(containerInfo)                                | |
|  |  - getActionItems(containerInfo)                          | |
|  |  - getTranscriptUrl(containerInfo)                        | |
|  +----------------------------+-----------------------------+  |
|                               |                                |
|  +----------------------------v-----------------------------+  |
|  |  Internal Logic                                          |  |
|  |  - Input validation                                      |  |
|  |  - Content decryption (KMS via encryptionKeyUrl)         |  |
|  |  - Response normalization                                |  |
|  |  - Error handling & mapping                              |  |
|  +----------------------------+-----------------------------+  |
+-------------------------------+-------------------------------+
                                |
              +-----------------+-----------------+
              |                                   |
+-------------v--------------+  +-----------------v--------------+
|     Pragya Service         |  |   Summary Content URLs         |
|  (U2C: serviceName:pragya) |  |  (Direct URLs from Pragya)     |
|  GET /containers/{id}      |  |  GET {summaryUrl}              |
+----------------------------+  |  GET {notesUrl}                |
                                |  GET {actionItemsUrl}           |
                                +--------------------------------+
                                            |
                                +-----------v--------------------+
                                |  internal-plugin-encryption    |
                                |  decryptText(keyUrl, cipher)   |
                                +--------------------------------+
```

### 2.2 Key Components

| Component | Responsibility |
|-----------|----------------|
| `internal-plugin-call-ai-summary` | Internal plugin; resolves Pragya containers, fetches and decrypts summary content |
| `internal-plugin-encryption` | KMS integration for decrypting AI-generated content using `encryptionKeyUrl` |
| `http-core` | HTTP transport; adds authorization headers, handles retries |
| Pragya Service | Container metadata; provides content URLs and encryption key |
| Summary Content Endpoints | Serve encrypted AI-generated content (notes, action items, transcripts) |

## 3. Data Flow

### 3.1 End-to-End Summary Retrieval Flow

```
Client
  |
  |  1. Get call history
  +-> callHistory.getCallHistoryData()
  |     +-> Janus API: GET /history/userSessions
  |           +-> Response includes extensionPayload.callingContainerIds
  |
  |  2. Resolve container
  +-> webex.internal.aisummary.getContainer(containerId)
  |     +-> Pragya API: GET /pragya/api/v1/containers/{containerId}
  |           +-> Response: { summaryData: { summaryUrl, notesUrl, ... }, encryptionKeyUrl }
  |
  |  3. Fetch all summary content in one call
  +-> webex.internal.aisummary.getSummary({ containerInfo: container })
        +-> HTTP GET {summaryUrl}?fields=note,shortnote,actionitems
              +-> Response: { note: {...}, shortnote: {...}, actionitems: {...} }
                    +-> Decrypt note, shortNote, and all action item snippets
                          +-> Return { id, note, shortNote, actionItems, feedbackUrl }
```

### 3.2 Get Container Info Flow

```
Client
  +-> webex.internal.aisummary.getContainer({ containerId })
        +-> Validate containerId (non-empty string)
            +-> webex.request({
                  method: 'GET',
                  service: 'pragya',
                  resource: `containers/${containerId}`,
                })
                +-> Flatten: if body.summaryData.data exists, set body.summaryData = body.summaryData.data
                    +-> Return PragyaContainerResponse (with flat summaryData)
```

### 3.3 Get Notes Flow

```
Client
  +-> webex.internal.aisummary.getNotes(containerInfo)
        +-> Validate containerInfo has summaryData.notesUrl and encryptionKeyUrl
            +-> webex.request({
                  method: 'GET',
                  uri: containerInfo.summaryData.notesUrl,
                })
                +-> Response: { id, aiGeneratedContent: "<encrypted>", feedbackUrl?, keyUrl }
                    +-> Decrypt aiGeneratedContent using containerInfo.encryptionKeyUrl
                        +-> Return decrypted SummaryNotes
```

### 3.4 Get Action Items Flow

```
Client
  +-> webex.internal.aisummary.getActionItems(containerInfo)
        +-> Validate containerInfo has summaryData.actionItemsUrl and encryptionKeyUrl
            +-> webex.request({
                  method: 'GET',
                  uri: containerInfo.summaryData.actionItemsUrl,
                })
                +-> Response: [{ id, keyUrl, snippets: [{ id, content, aiGeneratedContent }] }]
                    +-> Decrypt all aiGeneratedContent fields using containerInfo.encryptionKeyUrl
                        +-> Return decrypted SummaryActionItems
```

## 4. SDK Method Interfaces

### 4.1 Internal API Methods

```typescript
/**
 * AISummary namespace accessible via webex.internal.aisummary
 */
interface AISummary {
  /**
   * Resolve a Pragya container by ID to get summary URLs and encryption key.
   */
  getContainer(options: GetContainerOptions): Promise<PragyaContainerResponse>;

  /**
   * Get AI-generated full summary for a call.
   * Fetches from summaryUrl with ?fields=note,shortnote,actionitems and decrypts all content.
   * Returns note, shortNote, and actionItems in a single response.
   */
  getSummary(options: GetSummaryContentOptions): Promise<SummaryContent>;

  /**
   * Get AI-generated notes for a call.
   * Fetches from containerInfo.summaryData.notesUrl and decrypts content.
   * Only available if notesUrl is present in the Pragya response.
   */
  getNotes(options: GetSummaryContentOptions): Promise<SummaryNotes>;

  /**
   * Get AI-generated action items for a call.
   * Fetches from containerInfo.summaryData.actionItemsUrl and decrypts content.
   * Only available if actionItemsUrl is present in the Pragya response.
   */
  getActionItems(options: GetSummaryContentOptions): Promise<SummaryActionItems>;

  /**
   * Get the transcript URL for a call.
   * Returns the URL from containerInfo.summaryData.transcriptUrl.
   * Does not fetch or decrypt - the consumer uses this URL directly.
   */
  getTranscriptUrl(options: GetSummaryContentOptions): string;

  /**
   * Get decrypted transcript for a call.
   * Fetches from containerInfo.summaryData.transcriptUrl and decrypts each snippet.
   */
  getTranscript(options: GetSummaryContentOptions): Promise<TranscriptContent>;
}
```

## 5. Data Transfer Objects (DTOs)

### 5.1 Request DTOs

```typescript
/**
 * Options for resolving a Pragya container
 */
export interface GetContainerOptions {
  /** Pragya container ID from Janus extensionPayload.callingContainerIds */
  containerId: string;
}

/**
 * Options for fetching summary content.
 * Requires the resolved Pragya container info.
 */
export interface GetSummaryContentOptions {
  /** The resolved Pragya container response */
  containerInfo: PragyaContainerResponse;
}
```

### 5.2 Pragya Response DTOs

```typescript
/**
 * Summary data URLs from a Pragya container
 */
export interface PragyaSummaryData {
  /** Status of the summary (e.g., "Active") */
  status: string;
  /** Full summary URL (AI Bridge) */
  summaryUrl: string;
  /** Transcript URL (AI Bridge) */
  transcriptUrl: string;
  /** Whether summarization runs after call ends */
  summarizeAfterCall: boolean;
  /** Notes-specific URL (may not be present in all API versions) */
  notesUrl?: string;
  /** Action items URL (may not be present in all API versions) */
  actionItemsUrl?: string;
}

/**
 * Complete Pragya container response
 */
export interface PragyaContainerResponse {
  /** Summary data with content URLs */
  summaryData: PragyaSummaryData;
  /** KMS encryption key URL for decrypting content */
  encryptionKeyUrl: string;
  /** KMS resource object URL */
  kmsResourceObjectUrl: string;
  /** ACL URL for access control */
  aclUrl: string;
  /** Fork session ID */
  forkSessionId: string;
  /** Call session ID */
  callSessionId: string;
  /** Owner user ID */
  ownerUserId: string;
  /** Organization ID */
  orgId: string;
  /** Call start time */
  start: string;
  /** Call end time */
  end: string;
}
```

### 5.3 Summary Response DTOs

```typescript
/**
 * Decrypted AI-generated summary content.
 * Contains all three content types returned by the summary API.
 */
export interface SummaryContent {
  /** Unique identifier */
  id: string;
  /** Decrypted full note content */
  note: string;
  /** Decrypted short note content */
  shortNote: string;
  /** Decrypted action item snippets */
  actionItems: ActionItemSnippet[];
  /** Feedback URL (if available) */
  feedbackUrl?: string;
}

/**
 * Decrypted AI-generated notes
 */
export interface SummaryNotes {
  /** Unique identifier */
  id: string;
  /** Decrypted notes content */
  content: string;
  /** Feedback URL (if available) */
  feedbackUrl?: string;
}

/**
 * Single action item snippet
 */
export interface ActionItemSnippet {
  /** Unique identifier */
  id: string;
  /** User-edited version (if available) */
  editedContent?: string;
  /** Decrypted AI-generated content */
  aiGeneratedContent: string;
}

/**
 * Decrypted AI-generated action items
 */
export interface SummaryActionItems {
  /** Unique identifier (absent when no action items exist) */
  id?: string;
  /** Array of action item snippets */
  snippets: ActionItemSnippet[];
  /** Feedback URL (if available) */
  feedbackUrl?: string;
}

/**
 * Single decrypted transcript snippet
 */
export interface TranscriptSnippet {
  /** Start time in milliseconds */
  startTime: string;
  /** End time in milliseconds */
  endTime: string;
  /** Decrypted transcript content */
  content: string;
  /** Audio CSI identifier */
  audioCSI?: string;
  /** Speaker information */
  speaker?: {
    speakerName: string;
    speakerId: string;
  };
}

/**
 * Decrypted transcript response
 */
export interface TranscriptContent {
  /** Unique identifier */
  id: string;
  /** Total number of snippets */
  totalCount: number;
  /** Decrypted transcript snippets */
  snippets: TranscriptSnippet[];
}
```

## 6. Low-Level Design & Pseudo Code

### 6.1 Plugin Registration

```typescript
// packages/@webex/internal-plugin-call-ai-summary/src/index.ts

import '@webex/internal-plugin-encryption';
import {registerInternalPlugin} from '@webex/webex-core';

import AISummary from './ai-summary';
import config from './config';

registerInternalPlugin('aisummary', AISummary, {config});

export {default} from './ai-summary';
```

### 6.2 Config

```typescript
// packages/@webex/internal-plugin-call-ai-summary/src/config.ts

export default {
  aisummary: {},
};
```

### 6.3 Constants

```typescript
// packages/@webex/internal-plugin-call-ai-summary/src/constants.ts

export const AI_SUMMARY_SERVICE = 'pragya';
export const AI_SUMMARY_CONTAINERS_RESOURCE = 'containers';

export const SUMMARY_STATUSES = {
  ACTIVE: 'Active',
} as const;

export const ERROR_MESSAGES = {
  INVALID_CONTAINER_ID: 'containerId is required and must be a non-empty string',
  INVALID_CONTAINER_INFO: 'containerInfo with valid summaryData and encryptionKeyUrl is required',
  CONTAINER_NOT_FOUND: 'Container not found',
  CONTENT_NOT_FOUND: 'Summary content not available or expired',
  ACCESS_DENIED: 'Access denied: User not authorized to view this summary',
  AUTHENTICATION_FAILED: 'Authentication failed: Invalid or expired token',
} as const;
```

### 6.4 Plugin Implementation

```typescript
// packages/@webex/internal-plugin-call-ai-summary/src/ai-summary.ts

import {WebexPlugin} from '@webex/webex-core';

import {AI_SUMMARY_SERVICE, AI_SUMMARY_CONTAINERS_RESOURCE, ERROR_MESSAGES} from './constants';
import type {
  GetContainerOptions,
  GetSummaryContentOptions,
  PragyaContainerResponse,
  SummaryContent,
  SummaryNotes,
  SummaryActionItems,
  TranscriptContent,
} from './types';

const AISummary = WebexPlugin.extend({
  namespace: 'AISummary',

  /**
   * Resolve a Pragya container by ID.
   * Flattens the nested summaryData.data structure for consumer convenience.
   */
  getContainer(options: GetContainerOptions): Promise<PragyaContainerResponse> {
    const {containerId} = options;
    this._validateContainerId(containerId);

    return this.webex
      .request({
        method: 'GET',
        service: AI_SUMMARY_SERVICE,
        resource: `${AI_SUMMARY_CONTAINERS_RESOURCE}/${containerId}`,
      })
      .then(({body}) => {
        // Pragya API nests summary URLs under summaryData.data — flatten
        if (body.summaryData?.data) {
          body.summaryData = body.summaryData.data;
        }
        return body;
      })
      .catch((error) => {
        this.logger.error('AISummary->getContainer failed', {error, containerId});
        throw this._handleError(error, 'getContainer');
      });
  },

  /**
   * Get AI-generated full summary for a call.
   * Fetches note, shortNote, and actionItems in a single request via
   * summaryUrl?fields=note,shortnote,actionitems, then decrypts all content.
   */
  async getSummary(options: GetSummaryContentOptions): Promise<SummaryContent> {
    const {containerInfo} = options;
    this._validateContainerInfo(containerInfo, 'summaryUrl');

    try {
      const {body} = await this.webex.request({
        method: 'GET',
        uri: `${containerInfo.summaryData.summaryUrl}?fields=note,shortnote,actionitems`,
      });

      const keyUrl = body.keyUrl || containerInfo.encryptionKeyUrl;
      const decryptedNote = await this._decryptContent(body.note.aiGeneratedContent, keyUrl);
      const decryptedShortNote = await this._decryptContent(
        body.shortnote.aiGeneratedContent, keyUrl
      );

      const decryptedSnippets = await Promise.all(
        (body.actionitems?.snippets || []).map(async (snippet: any) => {
          const decryptedAiContent = await this._decryptContent(
            snippet.aiGeneratedContent, keyUrl
          );
          return {
            id: snippet.id,
            editedContent: snippet.content || undefined,
            aiGeneratedContent: decryptedAiContent,
          };
        })
      );

      const feedbackLink = (body.links || []).find((link: any) => link.rel === 'feedback');

      return {
        id: body.id,
        note: decryptedNote,
        shortNote: decryptedShortNote,
        actionItems: decryptedSnippets,
        feedbackUrl: feedbackLink?.href,
      };
    } catch (error) {
      this.logger.error('AISummary->getSummary failed', {error});
      throw this._handleError(error, 'getSummary');
    }
  },

  /**
   * Get AI-generated notes for a call (standalone endpoint).
   * Uses body.keyUrl as decryption key with fallback to containerInfo.encryptionKeyUrl.
   */
  async getNotes(options: GetSummaryContentOptions): Promise<SummaryNotes> {
    const {containerInfo} = options;
    this._validateContainerInfo(containerInfo, 'notesUrl');

    try {
      const {body} = await this.webex.request({
        method: 'GET',
        uri: containerInfo.summaryData.notesUrl,
      });

      const keyUrl = body.keyUrl || containerInfo.encryptionKeyUrl;
      const decryptedContent = await this._decryptContent(body.aiGeneratedContent, keyUrl);

      return { id: body.id, content: decryptedContent, feedbackUrl: body.feedbackUrl };
    } catch (error) {
      this.logger.error('AISummary->getNotes failed', {error});
      throw this._handleError(error, 'getNotes');
    }
  },

  /**
   * Get AI-generated action items for a call (standalone endpoint).
   * Response is an array; takes the first element and decrypts all snippets.
   */
  async getActionItems(options: GetSummaryContentOptions): Promise<SummaryActionItems> {
    const {containerInfo} = options;
    this._validateContainerInfo(containerInfo, 'actionItemsUrl');

    try {
      const {body} = await this.webex.request({
        method: 'GET',
        uri: containerInfo.summaryData.actionItemsUrl,
      });

      const actionItemsData = Array.isArray(body) ? body[0] : body;
      if (!actionItemsData) return {id: undefined, snippets: []};

      const keyUrl = actionItemsData.keyUrl || containerInfo.encryptionKeyUrl;
      const decryptedSnippets = await Promise.all(
        (actionItemsData.snippets || []).map(async (snippet: any) => {
          const decryptedAiContent = await this._decryptContent(
            snippet.aiGeneratedContent, keyUrl
          );
          return {
            id: snippet.id,
            editedContent: snippet.content || undefined,
            aiGeneratedContent: decryptedAiContent,
          };
        })
      );

      return {
        id: actionItemsData.id,
        snippets: decryptedSnippets,
        feedbackUrl: actionItemsData.feedbackUrl,
      };
    } catch (error) {
      this.logger.error('AISummary->getActionItems failed', {error});
      throw this._handleError(error, 'getActionItems');
    }
  },

  /** Returns the transcript URL string from the container info. */
  getTranscriptUrl(options: GetSummaryContentOptions): string {
    const {containerInfo} = options;
    this._validateContainerInfo(containerInfo, 'transcriptUrl');
    return containerInfo.summaryData.transcriptUrl;
  },

  /** Fetches and decrypts the full transcript, returning all snippets. */
  async getTranscript(options: GetSummaryContentOptions): Promise<TranscriptContent> {
    const {containerInfo} = options;
    this._validateContainerInfo(containerInfo, 'transcriptUrl');

    try {
      const {body} = await this.webex.request({
        method: 'GET',
        uri: containerInfo.summaryData.transcriptUrl,
      });

      const keyUrl = body.keyUrl || containerInfo.encryptionKeyUrl;
      const decryptedSnippets = await Promise.all(
        (body.transcriptSnippetList || []).map(async (snippet: any) => {
          const decryptedContent = await this._decryptContent(snippet.content, keyUrl);
          return {
            startTime: snippet.startTime,
            endTime: snippet.endTime,
            content: decryptedContent,
            audioCSI: snippet.audioCSI,
            speaker: snippet.speaker,
          };
        })
      );

      return { id: body.id, totalCount: body.totalCount, snippets: decryptedSnippets };
    } catch (error) {
      this.logger.error('AISummary->getTranscript failed', {error});
      throw this._handleError(error, 'getTranscript');
    }
  },

  // --- Private helpers ---

  _validateContainerId(containerId: string): void { /* ... */ },
  _validateContainerInfo(containerInfo: PragyaContainerResponse, urlField: string): void { /* ... */ },
  _decryptContent(encryptedContent: string, encryptionKeyUrl: string): Promise<string> {
    return this.webex.internal.encryption.decryptText(encryptionKeyUrl, encryptedContent);
  },
  _handleError(error: any, methodName: string): Error {
    if (error.statusCode === 404) {
      const msg = methodName === 'getContainer'
        ? ERROR_MESSAGES.CONTAINER_NOT_FOUND
        : ERROR_MESSAGES.CONTENT_NOT_FOUND;
      return new Error(msg);
    }
    if (error.statusCode === 403) return new Error(ERROR_MESSAGES.ACCESS_DENIED);
    if (error.statusCode === 401) return new Error(ERROR_MESSAGES.AUTHENTICATION_FAILED);
    return new Error(`${methodName} failed: ${error.message || 'Unknown error'}`);
  },
});

export default AISummary;
```

### 6.5 Usage Examples

```typescript
// Step 1: Get call history (existing SDK API)
const callHistory = await callHistoryInstance.getCallHistoryData(10, 50);
const sessions = callHistory.data.userSessions;

// Step 2: Find sessions with AI summaries
const sessionWithSummary = sessions.find(
  (session) => session.extensionPayload?.callingContainerIds?.length > 0
);

if (!sessionWithSummary) {
  console.log('No AI summaries available');
  return;
}

// Step 3: Resolve the container (plugin flattens summaryData.data automatically)
const containerId = sessionWithSummary.extensionPayload.callingContainerIds[0];
const container = await webex.internal.aisummary.getContainer({ containerId });

// Check if summary is available
if (container.summaryData.status !== 'Active') {
  console.log('Summary is not yet ready');
  return;
}

// Step 4: Fetch all summary content (note + shortNote + actionItems) in one call
const summary = await webex.internal.aisummary.getSummary({ containerInfo: container });
console.log('Note:', summary.note);
console.log('Short Note:', summary.shortNote);
summary.actionItems.forEach((item, i) => {
  console.log(`Action Item ${i + 1}: ${item.aiGeneratedContent}`);
});

// Step 5: Get transcript URL (or fetch full transcript)
const transcriptUrl = webex.internal.aisummary.getTranscriptUrl({ containerInfo: container });
console.log('Transcript URL:', transcriptUrl);

// Step 6: Fetch and decrypt full transcript
const transcript = await webex.internal.aisummary.getTranscript({ containerInfo: container });
transcript.snippets.forEach((snippet) => {
  console.log(`[${snippet.startTime}] ${snippet.speaker?.speakerName}: ${snippet.content}`);
});
```

## 7. API Request/Response Details

### 7.1 Pragya Container Lookup

**Request:**
```http
GET /pragya/api/v1/containers/{containerId} HTTP/1.1
Authorization: Bearer {user_access_token}
Accept: application/json
```

**Success Response (200 OK):**

> The raw response nests URLs under `summaryData.data`. The plugin's `getContainer()` flattens this automatically.

```json
{
  "id": "34125120-13b5-11f1-9b36-adb685725098",
  "objectType": "callingAIContainer",
  "memberships": {
    "items": [{ "id": "...", "roles": ["OWNER"], "objectType": "containerMembership" }]
  },
  "summaryData": {
    "extensionId": "...",
    "objectType": "extension",
    "extensionType": "callingAISummary",
    "data": {
      "id": "...",
      "objectType": "callingAISummary",
      "status": "Active",
      "summaryUrl": "https://aibridge-url/summaries/c635e870-...",
      "transcriptUrl": "https://aibridge-url/summaries/c635e870-.../transcripts",
      "summarizeAfterCall": true,
      "aclUrl": "https://acl-a.wbx2.com/...",
      "kmsResourceObjectUrl": "kms://kms-cisco.wbx2.com/resources/..."
    }
  },
  "encryptionKeyUrl": "kms://kms-cisco.wbx2.com/keys/897e4d2d-...",
  "kmsResourceObjectUrl": "kms://kms-cisco.wbx2.com/resources/f7316435-...",
  "aclUrl": "https://acl-a.wbx2.com/acl/api/v1/acls/78c4cd90-...",
  "forkSessionId": "123e4567-...",
  "callSessionId": "123e4567-...",
  "ownerUserId": "123e4567-...",
  "orgId": "123e4567-...",
  "start": "2023-10-01T12:00:00Z",
  "end": "2023-10-01T12:00:00Z"
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or expired token
- `403 Forbidden` - User not authorized to access this container
- `404 Not Found` - Container not found

### 7.2 Summary Content (fetched via summaryUrl with fields query)

The primary way to fetch all summary content is via `getSummary()`, which appends `?fields=note,shortnote,actionitems` to the `summaryUrl`.

**Request:**
```http
GET {summaryData.summaryUrl}?fields=note,shortnote,actionitems HTTP/1.1
Authorization: Bearer {user_access_token}
Accept: application/json
```

**Success Response (200 OK):**
```json
{
  "id": "10293-dk93-ddie-odir-did932j3kdde",
  "keyUrl": "kms://kms-us-int.wbx2.com/keys/f19d4d28-...",
  "note": {
    "aiGeneratedContent": "<encrypted_note_content>"
  },
  "shortnote": {
    "aiGeneratedContent": "<encrypted_short_note_content>"
  },
  "actionitems": {
    "snippets": [
      {
        "id": "394r0087-...",
        "content": "edited version",
        "aiGeneratedContent": "<encrypted_ai_generated_content>"
      }
    ]
  },
  "links": [
    { "rel": "feedback", "href": "https://summarizer-r.wbx2.com/summarizer/api/v1/feedback/..." }
  ]
}
```

### 7.3 Notes (standalone, fetched via notesUrl)

**Request:**
```http
GET {summaryData.notesUrl} HTTP/1.1
Authorization: Bearer {user_access_token}
Accept: application/json
```

**Success Response (200 OK):**
```json
{
  "id": "10293-dk93-ddie-odir-did932j3kdde",
  "aiGeneratedContent": "<encrypted_content>",
  "feedbackUrl": "https://summarizer-r.wbx2.com/summarizer/api/v1/feedback/report/...",
  "keyUrl": "kms://kms-us-int.wbx2.com/keys/f19d4d28-..."
}
```

### 7.4 Action Items (standalone, fetched via actionItemsUrl)

**Request:**
```http
GET {summaryData.actionItemsUrl} HTTP/1.1
Authorization: Bearer {user_access_token}
Accept: application/json
```

**Success Response (200 OK):**
```json
[
  {
    "id": "1234-dk93-ddie-odir-dk93dj33",
    "keyUrl": "kms://kms-us-int.wbx2.com/keys/f19d4d28-...",
    "snippets": [
      {
        "id": "394r0087-...",
        "content": "edited version",
        "aiGeneratedContent": "<encrypted_ai_generated_content>"
      }
    ]
  }
]
```

## 8. Encryption & Decryption

### 8.1 Content Encryption

All AI-generated content is encrypted using KMS (Key Management Service):

- **Encryption Key**: The `encryptionKeyUrl` from the Pragya container response (format: `kms://kms-{region}.wbx2.com/keys/{key-id}`)
- **Encrypted Fields**: `aiGeneratedContent` in notes and action item snippets
- **Decryption**: Uses `@webex/internal-plugin-encryption` via `decryptText()`

### 8.2 Decryption Pattern

The SDK uses the existing `@webex/internal-plugin-encryption` plugin:

```typescript
// Decrypt using the encryptionKeyUrl from the Pragya container response
const decryptedContent = await this.webex.internal.encryption.decryptText(
  containerInfo.encryptionKeyUrl,
  body.aiGeneratedContent
);
```

This is the same pattern used by existing plugins:

**AI Assistant Plugin** (`internal-plugin-ai-assistant/src/utils.ts`):
```typescript
const decryptedValue = await webex.internal.encryption.decryptText(
  encryptionKeyUrl,
  encryptedValue
);
```

**Task Plugin** (`internal-plugin-task/src/helpers/decrypt.helper.js`):
```javascript
ctx.webex.internal.encryption.decryptText(key.uri || key, object[name])
```

## 9. Error Handling

### 9.1 Error Scenarios

| Error Type | HTTP Status | SDK Error Message | Recovery Action |
|------------|-------------|-------------------|-----------------|
| Invalid Container ID | N/A (client) | "containerId is required and must be a non-empty string" | Validate input |
| Invalid Container Info | N/A (client) | "containerInfo with valid summaryData and encryptionKeyUrl is required" | Ensure getContainer was called first |
| Authentication Failed | 401 | "Authentication failed: Invalid or expired token" | Re-authenticate user |
| Access Denied | 403 | "Access denied: User not authorized to view this summary" | Check user permissions |
| Container Not Found | 404 | "Container not found" | Verify containerId from Janus |
| Content Not Found | 404 (non-getContainer) | "Summary content not available or expired" | Content may have been deleted or expired |
| Summary Not Ready | N/A | summaryData.status !== "Active" | Retry after delay |

## 10. Security Considerations

### 10.1 Authentication
- All API calls (Pragya and content URLs) require a valid user bearer token
- Token is automatically attached by the SDK's HTTP layer

### 10.2 Authorization
- Only call participants or authorized users can access containers and summaries
- Org-level AI features must be enabled
- Per-call consent: AI assistant must have been enabled during the call

### 10.3 Content Protection
- All AI-generated content is encrypted at rest with KMS
- `encryptionKeyUrl` from Pragya container is the decryption key
- HTTPS required for all API calls

## 11. Testing Strategy

### 11.1 Unit Tests

```typescript
import {assert, expect} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import AISummary from '@webex/internal-plugin-call-ai-summary';
import config from '@webex/internal-plugin-call-ai-summary/src/config';

describe('internal-plugin-call-ai-summary', () => {
  let webex;

  beforeEach(() => {
    webex = MockWebex({
      children: {
        aisummary: AISummary,
      },
    });
    webex.config.aisummary = config.aisummary;
    webex.internal.encryption = {
      decryptText: sinon.stub().resolves('decrypted content'),
    };
  });

  describe('#getContainer', () => {
    it('should resolve a Pragya container by ID', async () => {
      const mockContainer = {
        summaryData: {
          status: 'Active',
          summaryUrl: 'https://aibridge-url/summaries/abc123',
          notesUrl: 'https://aibridge-url/summaries/abc123/notes',
          actionItemsUrl: 'https://aibridge-url/summaries/abc123/action-items',
          transcriptUrl: 'https://aibridge-url/summaries/abc123/transcripts',
          summarizeAfterCall: true,
        },
        encryptionKeyUrl: 'kms://kms.url/keys/key-id',
      };

      webex.request = sinon.stub().resolves({body: mockContainer});

      const result = await webex.internal.aisummary.getContainer({
        containerId: 'container-123',
      });

      expect(result.summaryData.status).to.equal('Active');
      assert.calledWith(webex.request, sinon.match({
        method: 'GET',
        service: 'pragya',
        resource: 'containers/container-123',
      }));
    });

    it('should throw for empty containerId', async () => {
      await expect(
        webex.internal.aisummary.getContainer({containerId: ''})
      ).to.be.rejectedWith('containerId is required');
    });
  });

  describe('#getNotes', () => {
    const mockContainerInfo = {
      summaryData: {
        notesUrl: 'https://aibridge-url/summaries/abc123/notes',
      },
      encryptionKeyUrl: 'kms://kms.url/keys/key-id',
    };

    it('should fetch and decrypt notes', async () => {
      webex.request = sinon.stub().resolves({
        body: {
          id: 'note-id',
          aiGeneratedContent: 'encrypted-notes',
          feedbackUrl: 'https://feedback.url',
        },
      });

      const result = await webex.internal.aisummary.getNotes({
        containerInfo: mockContainerInfo,
      });

      expect(result.id).to.equal('note-id');
      expect(result.content).to.equal('decrypted content');
      expect(result.feedbackUrl).to.equal('https://feedback.url');
      assert.calledWith(
        webex.internal.encryption.decryptText,
        'kms://kms.url/keys/key-id',
        'encrypted-notes'
      );
    });

    it('should throw when containerInfo is missing notesUrl', async () => {
      await expect(
        webex.internal.aisummary.getNotes({containerInfo: {summaryData: {}}})
      ).to.be.rejectedWith('containerInfo with valid summaryData');
    });
  });

  describe('#getActionItems', () => {
    const mockContainerInfo = {
      summaryData: {
        actionItemsUrl: 'https://aibridge-url/summaries/abc123/action-items',
      },
      encryptionKeyUrl: 'kms://kms.url/keys/key-id',
    };

    it('should fetch and decrypt all action item snippets', async () => {
      webex.request = sinon.stub().resolves({
        body: [{
          id: 'action-items-id',
          keyUrl: 'kms://kms.url/keys/key-id',
          snippets: [
            {id: 's1', aiGeneratedContent: 'encrypted-1'},
            {id: 's2', content: 'edited', aiGeneratedContent: 'encrypted-2'},
          ],
        }],
      });

      webex.internal.encryption.decryptText
        .onFirstCall().resolves('Decrypted item 1')
        .onSecondCall().resolves('Decrypted item 2');

      const result = await webex.internal.aisummary.getActionItems({
        containerInfo: mockContainerInfo,
      });

      expect(result.snippets).to.have.lengthOf(2);
      expect(result.snippets[0].aiGeneratedContent).to.equal('Decrypted item 1');
      expect(result.snippets[1].aiGeneratedContent).to.equal('Decrypted item 2');
      expect(result.snippets[1].editedContent).to.equal('edited');
    });
  });

  describe('#getTranscriptUrl', () => {
    it('should return the transcript URL', () => {
      const containerInfo = {
        summaryData: {
          transcriptUrl: 'https://aibridge-url/summaries/abc123/transcripts',
        },
        encryptionKeyUrl: 'kms://kms.url/keys/key-id',
      };

      const url = webex.internal.aisummary.getTranscriptUrl({containerInfo});

      expect(url).to.equal('https://aibridge-url/summaries/abc123/transcripts');
    });
  });
});
```

## 12. Modularity & Existing Code Impact

### 12.1 Zero Changes to Existing Packages

This plugin is fully self-contained. It does **not** require modifications to any existing package:

| Concern | Approach |
|---------|----------|
| `UserSession` type in `@webex/calling` | **Not modified.** The plugin accepts a plain `containerId: string`. Consumers extract it from the Janus response at the application layer. The `UserSession` type update is a separate, optional task for the calling package team. |
| `packages/webex` bundle | **Not modified.** Consumers import `@webex/internal-plugin-call-ai-summary` directly, which self-registers via `registerInternalPlugin()`. No changes to the webex package index are needed. |
| `@webex/internal-plugin-encryption` | **Not modified.** Used as a runtime dependency via `this.webex.internal.encryption.decryptText()`. |

### 12.2 Plugin Package Structure

```
packages/@webex/internal-plugin-call-ai-summary/
  src/
    index.ts          # registerInternalPlugin('aisummary', ...)
    ai-summary.ts     # WebexPlugin.extend({...})
    config.ts         # { aisummary: {} }
    constants.ts      # Service name, error messages
    types.ts          # All TypeScript interfaces
  test/
    unit/
      spec/
        ai-summary.ts
      data/
        responses.ts  # Mock Pragya and content responses
  package.json
  jest.config.js
  babel.config.js
  .eslintrc.js
```

## 13. Dependencies

### 13.1 Internal Dependencies

| Package | Purpose |
|---------|---------|
| `@webex/webex-core` | Plugin infrastructure (`WebexPlugin`, `registerInternalPlugin`) |
| `@webex/internal-plugin-encryption` | Content decryption via `decryptText()` |

### 13.2 External Service Dependencies

| Service | Purpose | Discovery |
|---------|---------|-----------|
| **Janus** | Call history; provides `extensionPayload.callingContainerIds` | U2C: `serviceName: "janus"` |
| **Pragya** | Container metadata; provides content URLs and encryption key | U2C: `serviceName: "pragya"` |
| **Summary Content Endpoints** | Serve encrypted AI-generated content | Direct URLs from Pragya response |
| **KMS** | Encryption key management | Via `encryptionKeyUrl` from Pragya |

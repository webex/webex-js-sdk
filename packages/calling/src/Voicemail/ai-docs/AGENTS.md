# Voicemail Module

## AI Agent Routing Instructions

**If you are an AI assistant or automated tool:**

Do **not** use this file as your only entry point for reasoning or code generation.

- **How to proceed:**
  - For changes within the `Voicemail/` directory, use this file as your primary reference.
  - For WXC-specific logic, refer to `WxCallBackendConnector.ts`.
  - For Broadworks-specific logic, refer to `BroadworksBackendConnector.ts`.
  - For UCM-specific logic, refer to `UcmBackendConnector.ts`.
  - For metric submission integration, refer to `Metrics/types.ts` and `Metrics/index.ts`.
- **Important:** Load this module-specific doc first, then drill into backend connector source files as needed.

---

## Overview

The `Voicemail` module provides APIs for managing voicemail messages across multiple calling backends. It supports listing voicemails, retrieving voicemail content and transcripts, marking messages as read/unread, deleting messages, fetching voicemail summaries, and resolving caller contact information. The module uses a **strategy pattern** to delegate operations to backend-specific connectors (WXC, Broadworks, UCM) and automatically submits metrics for all operations.

**Package:** `@webex/calling`

**Entry point:** `packages/calling/src/Voicemail/Voicemail.ts`

**Factory:** `createVoicemailClient(webex, logger) -> IVoicemail`

---

### Key Capabilities

| Capability | Description |
| ----------- | ----------- |
| **Initialize** | Initializes the voicemail connector, resolving XSI endpoints and authentication for the selected backend. |
| **List Voicemails** | Retrieves paginated, sorted voicemail lists. WXC/BWRKS use XSI VoiceMessagingMessages API; UCM uses VG Gateway API. |
| **Voicemail Content** | Fetches the audio content (media type + base64 content) for a specific voicemail message. |
| **Voicemail Summary** | Retrieves quantitative summary (new, old, urgent message counts) via XSI `MessageSummary` endpoint. Only supported on WXC; BWRKS and UCM return `null`. |
| **Mark Read/Unread** | Updates the read status of a voicemail message. |
| **Delete Voicemail** | Deletes a voicemail message by its messageId. |
| **Voicemail Transcript** | Retrieves the text transcript of a voicemail via XSI. Only supported on WXC; BWRKS and UCM return `null`. |
| **Contact Resolution** | Resolves caller identity from `CallingPartyInfo` using `userExternalId` (SCIM query) and `name` (People search API). Only supported on WXC; BWRKS and UCM return `null`. |
| **Metrics Integration** | Automatically submits success/error metrics for every voicemail operation via MetricManager. |
| **Multi-Backend Support** | Delegates to WXC, Broadworks, or UCM connectors based on user entitlements. |

---

## Public API

### IVoicemail Interface

| Method | Signature | Description |
| ------ | --------- | ----------- |
| `init` | `(): VoicemailResponseEvent \| Promise<VoicemailResponseEvent>` | Initialize the voicemail connector |
| `getVoicemailList` | `(offset: number, offsetLimit: number, sort: SORT, refresh?: boolean): Promise<VoicemailResponseEvent>` | Fetch paginated voicemail list |
| `getVoicemailContent` | `(messageId: string): Promise<VoicemailResponseEvent>` | Fetch voicemail audio content |
| `getVoicemailSummary` | `(): Promise<VoicemailResponseEvent \| null>` | Fetch voicemail counts summary |
| `voicemailMarkAsRead` | `(messageId: string): Promise<VoicemailResponseEvent>` | Mark voicemail as read |
| `voicemailMarkAsUnread` | `(messageId: string): Promise<VoicemailResponseEvent>` | Mark voicemail as unread |
| `deleteVoicemail` | `(messageId: string): Promise<VoicemailResponseEvent>` | Delete a voicemail |
| `getVMTranscript` | `(messageId: string): Promise<VoicemailResponseEvent \| null>` | Fetch voicemail transcript |
| `resolveContact` | `(callingPartyInfo: CallingPartyInfo): Promise<DisplayInformation \| null>` | Resolve caller contact info |
| `getSDKConnector` | `(): ISDKConnector` | Returns the SDK connector |

### Key Types

#### VoicemailResponseEvent

```typescript
type VoicemailResponseEvent = {
  statusCode: number;
  data: {
    voicemailList?: MessageInfo[];
    voicemailContent?: { type: string | null; content: string | null };
    voicemailSummary?: SummaryInfo;
    voicemailTranscript?: string | null;
    error?: string;
  };
  message: string | null;
};
```

#### SummaryInfo

```typescript
type SummaryInfo = {
  newMessages: number;
  oldMessages: number;
  newUrgentMessages: number;
  oldUrgentMessages: number;
};
```

#### MessageInfo (voicemail list item)

```typescript
type ResponseString$ = { $: string };
type ResponseNumber$ = { $: number };

type MessageInfo = {
  duration: ResponseString$;
  callingPartyInfo: CallingPartyInfo;
  time: ResponseNumber$;
  messageId: ResponseString$;
  read: ResponseString$ | object;  // empty object {} means read=true (UCM convention)
};
```

Note: Fields use `ResponseString$`/`ResponseNumber$` wrapper types with a `$` property to match the XSI JSON format. Access values as `message.messageId.$`, `message.time.$`, etc.

#### CallingPartyInfo

```typescript
type CallingPartyInfo = {
  name: ResponseString$;
  userId?: ResponseString$;
  address: ResponseString$;
  userExternalId?: ResponseString$;
};
```

### Backend Feature Matrix

| Feature | WXC | Broadworks | UCM |
|---------|-----|------------|-----|
| getVoicemailList | Yes | Yes | Yes |
| getVoicemailContent | Yes | Yes | Yes (async with Mercury event) |
| getVoicemailSummary | Yes | null | null |
| voicemailMarkAsRead | Yes | Yes | Yes |
| voicemailMarkAsUnread | Yes | Yes | Yes |
| deleteVoicemail | Yes | Yes | Yes |
| getVMTranscript | Yes | null | null |
| resolveContact | Yes | null | null |

---

## Configuration

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `webex` | `WebexSDK` | Yes | Initialized Webex SDK instance |
| `logger` | `LoggerInterface` | Yes | Logger interface with a `level` property |

---

## Examples and Use Cases

### Create and Initialize Voicemail Client

```typescript
import {createVoicemailClient, SORT} from '@webex/calling';

const voicemail = createVoicemailClient(webex, {level: 'info'});
await voicemail.init();
```

### Fetch Voicemail List

```typescript
const response = await voicemail.getVoicemailList(0, 10, SORT.DESC, true);
if (response.statusCode === 200) {
  console.log('Voicemails:', response.data.voicemailList);
}
```

### Get Voicemail Content

```typescript
const content = await voicemail.getVoicemailContent(messageId);
console.log('Type:', content.data.voicemailContent?.type);
console.log('Content:', content.data.voicemailContent?.content);
```

### Mark as Read and Delete

```typescript
await voicemail.voicemailMarkAsRead(messageId);
await voicemail.deleteVoicemail(messageId);
```

### Get Summary and Transcript

```typescript
const summary = await voicemail.getVoicemailSummary();
console.log('New messages:', summary?.data.voicemailSummary?.newMessages);

const transcript = await voicemail.getVMTranscript(messageId);
console.log('Transcript:', transcript?.data.voicemailTranscript);
```

---

## Implementation Notes

### HTTP Client Usage

WXC and UCM use `this.webex.request()`. Broadworks voicemail operations (`getVoicemailList`, `getVoicemailContent`, mark read/unread, delete) use browser `fetch` with `Authorization: Bearer {bwtoken}` headers, while Broadworks bootstrap/auth discovery still uses `this.webex.request()`.

| Backend | Auth Mechanism | Notes |
| ------- | -------------- | ----- |
| WXC | FedRAMP: `Authorization` header via `getUserToken()`; otherwise: none | Auth headers cached at `init()` time |
| Broadworks | BW token fetched from `broadworksIdpProxy` service, used as `Bearer {bwtoken}` | Token decoded to extract userId |
| UCM | Implicit SDK auth | Adds `orgId`, `deviceUrl`, `mercuryHostname` headers for content requests |

### WXC messageId Path Convention

In WXC/BWRKS, the `messageId` returned from `getVoicemailList` is a **full XSI path** (e.g., `/v2.0/user/{userId}/VoiceMessagingMessages/{id}`). Operations concatenate it directly to `xsiEndpoint`:

```typescript
// Content:  {xsiEndpoint}{messageId}
// Mark read: {xsiEndpoint}{messageId}/MarkAsRead
// Delete:   {xsiEndpoint}{messageId} (DELETE method)
// Transcript: {xsiEndpoint}{messageId}/transcript
```

### WXC Pagination (Client-Side Caching)

WXC fetches the **entire** voicemail list from XSI on `refresh=true`, sorts it, and stores it in `sessionStorage` (base64-encoded) keyed by a random `context` string. Subsequent calls paginate from this session-scoped cache using `fetchVoicemailList(context, offset, limit)`. The list response returns status 204 whenever there are no additional pages (`moreVMAvailable=false`), including cases where the current page still contains messages.

### UCM Pagination (Server-Side)

UCM passes `offset`, `limit`, and `sortOrder` as query parameters to the VG Gateway, which handles pagination server-side.

### Metrics Integration

The facade submits metrics for every operation via `MetricManager`:
- Success (2xx): `METRIC_EVENT.VOICEMAIL` with `METRIC_TYPE.BEHAVIORAL`
- Failure (non-2xx): `METRIC_EVENT.VOICEMAIL_ERROR` with status code and error message

Metric actions: `get_voicemails`, `get_voicemail_content`, `get_voicemail_summary`, `mark_read`, `mark_unread`, `delete`, `transcript`

---

## Dependencies

### Runtime Dependencies

| Package | Purpose |
| ------- | ------- |
| `webex` (SDK) | HTTP requests via `webex.request()`, Mercury WebSocket event subscription |

### Internal Dependencies

| Module | Purpose |
| ------ | ------- |
| `SDKConnector` | Singleton bridge to Webex SDK, Mercury listener registration/unregistration (UCM content) |
| `Eventing<T>` | Typed event emitter base class (Voicemail extends `Eventing<VoicemailEventTypes>`) |
| `MetricManager` | Submits voicemail success/error metrics via `getMetricManager(webex)` |
| `Logger` | Structured logging with file/method context |
| `getCallingBackEnd` | Determines calling backend (WXC, UCM, BWRKS) |
| `getXsiActionEndpoint` | Resolves XSI Actions endpoint (WXC, BWRKS) |
| `getVgActionEndpoint` | Resolves VG Gateway endpoint (UCM) |
| `getSortedVoicemailList` | Sorts voicemail messages by time |
| `storeVoicemailList` / `fetchVoicemailList` | Client-side pagination cache for WXC/BWRKS |
| `resolveContact` | Contact resolution utility (WXC only) |
| `serviceErrorCodeHandler` | Standardized error response formatting |
| `uploadLogs` | Uploads diagnostic logs on errors |

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md) — Component overview, data flows, sequence diagrams

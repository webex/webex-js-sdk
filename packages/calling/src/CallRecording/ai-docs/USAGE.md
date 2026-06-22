# Call Recording — Usage (dev-portal / w4d-docs style)

> Source-of-truth content for porting to the external `dev-portal` and `w4d-docs` repositories.
> Covers method signatures, parameters, response examples, events, and error scenarios for the
> `CallRecording` client in `@webex/calling`.

## Setup

```javascript
import {createCallRecordingClient} from '@webex/calling';

const callRecording = createCallRecordingClient(webex, {level: 'info'});
```

Or, via the top-level `webex` package:

```javascript
const calling = await Calling.init({
  webexConfig,
  callingConfig: {
    clientConfig: {callRecording: true},
    logger: {level: 'info'},
  },
});

calling.on('ready', () => {
  const callRecording = calling.callRecordingClient;
});
```

Requires the `hydraDeveloperApi` service (the Webex public developer API, e.g.
`https://integration.webexapis.com/v1`) to be present in the org's u2c catalog. The base URL is
resolved directly from the catalog and recording Mercury events are subscribed to directly by the
client — no dedicated recording plugin is required.

> **Backend support:** The client is supported **only for the Webex Calling (`WXC`) backend**. For
> non-WXC backends (`BWRKS`, `UCM`, or an unidentified backend) the constructor/factory throws
> `Error('Calling backend is not identified, exiting....')`, so no client is created. Guard creation
> for non-Webex-Calling users (e.g. `try/catch` around `createCallRecordingClient`, or only enable
> `clientConfig.callRecording` for Webex Calling users).

---

## Methods

Reads go through a single `getCallRecording` method. The request `type`
(a `RecordingRequestType`) selects the operation and the response type is inferred per request:

```typescript
getCallRecording<T extends GetCallRecordingRequest>(request: T): Promise<RecordingResponseFor<T>>
```

| `request.type` | Request shape | Resolves with |
| -------------- | ------------- | ------------- |
| `RecordingRequestType.LIST` | `{type, options?}` | `RecordingListResponse` |
| `RecordingRequestType.DETAIL` | `{type, recordingId}` | `RecordingResponse` |
| `RecordingRequestType.METADATA` | `{type, recordingId}` | `RecordingMetadataResponse` |
| `RecordingRequestType.BY_CALL_SESSION` | `{type, callSessionId, options?}` | `RecordingListResponse` |

Permanent deletion stays a separate method (`deleteRecording`) — see below.

### `LIST` — list recordings

Lists the current user's converged recordings.

**Signature**

```typescript
callRecording.getCallRecording({type: RecordingRequestType.LIST, options?: GetRecordingsOptions})
  // => Promise<RecordingListResponse>
```

**Parameters** (`options`)

| Name | Type | Required | Description | Default |
| ---- | ---- | -------- | ----------- | ------- |
| `options.from` | `string` (ISO-8601) | No | Inclusive start of the time window | `now - days` |
| `options.to` | `string` (ISO-8601) | No | Inclusive end of the time window | `now` |
| `options.days` | `number` | No | Lookback window used to derive `from` when `from` is omitted (API max window is 30 days) | `30` |
| `options.status` | `RecordingStatus` | No | Filter by status (`available`, `deleted`) | `available` |
| `options.max` | `number` | No | Maximum number of records to return per page | `30` |
| `options.serviceType` | `string` | No | Filter by producing service (e.g. `calling`); sent only when provided | _(unset)_ |
| `options.format` | `string` | No | Filter by media format (e.g. `MP3`, `MP4`); sent only when provided | _(unset)_ |
| `options.ownerType` | `string` | No | Filter by owner type (e.g. `user`); sent only when provided | _(unset)_ |
| `options.storageRegion` | `string` | No | Filter by storage region (e.g. `US`); sent only when provided | _(unset)_ |
| `options.locationId` | `string` | No | Filter by location id; sent only when provided | _(unset)_ |
| `options.topic` | `string` | No | Filter by recording topic; sent only when provided | _(unset)_ |
| `options.webexUserRequest` | `boolean` | No | Sends `WebexUserRequest: true` header (rate-limit bypass) | `false` |

> A `from` lower bound is always sent (like CallHistory's mandatory `from` date) so the API returns
> results. When `from` is omitted it is derived as `now - days`.

**Request**

```
GET {recordingServiceUrl}/convergedRecordings?from={now-days}&to={now}&status=available&max=30
```

The raw API returns `{ "items": [ ... ] }`; the client maps `items` to `data.recordings`.

**Success response**

```json
{
  "statusCode": 200,
  "data": {
    "recordings": [
      {
        "id": "8a0dfbf9-ca9c-4445-b34f-1f73de3c2427",
        "topic": "Call with Alice",
        "createTime": "2026-05-19T02:09:33Z",
        "timeRecorded": "2026-05-19T02:07:18Z",
        "ownerId": "716360ac-b556-4f1b-9080-1358be2b4c19",
        "ownerType": "user",
        "ownerEmail": "alice@example.com",
        "format": "MP3",
        "durationSeconds": 1,
        "sizeBytes": 7741,
        "serviceType": "calling",
        "storageRegion": "US",
        "status": "available",
        "serviceData": {
          "locationId": "8a14496b-51bd-4711-8952-0c108cc7fad5",
          "callSessionId": "d71e22df-0319-466b-9f3f-51346faa2f40"
        }
      }
    ]
  },
  "message": "SUCCESS"
}
```

---

### `DETAIL` — get a single recording

Fetches a single recording (including download/playback links).

**Signature**

```typescript
callRecording.getCallRecording({type: RecordingRequestType.DETAIL, recordingId: string})
  // => Promise<RecordingResponse>
```

| Field | Type | Required | Description |
| ---- | ---- | -------- | ----------- |
| `recordingId` | `string` | Yes | The recording id (`id`) |

**Request**

```
GET {recordingServiceUrl}/convergedRecordings/{recordingId}
```

**Success response**

```json
{
  "statusCode": 200,
  "data": {
    "recording": {
      "id": "8a0dfbf9-ca9c-4445-b34f-1f73de3c2427",
      "topic": "Call with Alice",
      "status": "available",
      "format": "MP3",
      "durationSeconds": 1,
      "serviceData": {
        "callSessionId": "d71e22df-0319-466b-9f3f-51346faa2f40"
      },
      "temporaryDirectDownloadLinks": {
        "audioDownloadLink": "https://.../audio",
        "transcriptDownloadLink": "https://.../transcript"
      }
    }
  },
  "message": "SUCCESS"
}
```

---

### `BY_CALL_SESSION` — get recordings by call session id

Returns all recordings tied to a call session id. Filtered client-side on
`serviceData.callSessionId` (no confirmed server-side filter). The scan is bounded by the list
query, so it only searches the default time window/status and first `max` records unless `options`
are provided. Pass `options` (e.g. a wider `days`/`from`–`to` window, a different `status`, or a
larger `max`) when the target session may fall outside the defaults.

**Signature**

```typescript
callRecording.getCallRecording({
  type: RecordingRequestType.BY_CALL_SESSION,
  callSessionId: string,
  options?: GetRecordingsOptions,
}) // => Promise<RecordingListResponse>
```

| Field | Type | Required | Description |
| ---- | ---- | -------- | ----------- |
| `callSessionId` | `string` | Yes | The call session id to filter by |
| `options` | `GetRecordingsOptions` | No | List query used to widen the scanned set |

**Success response (no matches)**

```json
{
  "statusCode": 200,
  "data": {"recordings": []},
  "message": "SUCCESS"
}
```

---

### `METADATA` — get recording metadata

Fetches the metadata document for a recording.

**Signature**

```typescript
callRecording.getCallRecording({type: RecordingRequestType.METADATA, recordingId: string})
  // => Promise<RecordingMetadataResponse>
```

| Field | Type | Required | Description |
| ---- | ---- | -------- | ----------- |
| `recordingId` | `string` | Yes | The recording id (`id`) |

**Request**

```
GET {recordingServiceUrl}/convergedRecordings/{recordingId}/metadata
```

**Success response**

```json
{
  "statusCode": 200,
  "data": {
    "metadata": {
      "id": "8a0dfbf9-ca9c-4445-b34f-1f73de3c2427",
      "callSessionId": "d71e22df-0319-466b-9f3f-51346faa2f40",
      "owner": {"ownerEmail": "bob@example.com"},
      "participants": [
        {"name": "Bob", "joinTime": "...", "leaveTime": "..."},
        {"name": "Alice", "joinTime": "...", "leaveTime": "..."}
      ],
      "serviceData": {
        "personality": "originator",
        "callingParty": {
          "actor": {"type": "USER", "id": "716360ac-b556-4f1b-9080-1358be2b4c19", "email": "bob@example.com"},
          "number": "9902",
          "name": "Bob"
        },
        "calledParty": {
          "actor": {"type": "USER", "id": "1f13bcd1-b4dc-42b2-8726-6f77a3a9de1f", "email": "alice@example.com"},
          "number": "9903",
          "name": "Alice"
        }
      }
    }
  },
  "message": "SUCCESS"
}
```

#### Resolving avatar / presence (the remote party)

The `LIST` response only carries `serviceData.locationId`/`callSessionId` and `ownerId` (the
recording owner — usually the current user), so it is **not** enough to show who the call was with.
The other party's identity lives on the **metadata** `serviceData` (`personality` +
`callingParty`/`calledParty`). Use `getRemotePartyId` to resolve the remote party's Webex person
UUID, which is the id accepted by the avatar (`@webex/internal-plugin-avatar`) and presence (DSS)
services:

```typescript
import {getRemotePartyId, getRemoteParty, RecordingRequestType} from '@webex/calling';

const {data} = await callRecording.getCallRecording({
  type: RecordingRequestType.METADATA,
  recordingId,
});

const remotePartyId = getRemotePartyId(data.metadata?.serviceData);
if (remotePartyId) {
  // feed remotePartyId to the avatar + presence services
} else {
  // external/PSTN party (no Webex user) — fall back to initials
  const name = getRemoteParty(data.metadata?.serviceData)?.name;
}
```

> Because the party details are only on the metadata document, resolving avatar/presence for a list
> requires a `METADATA` call per recording. Fetch them lazily for visible rows and cache by
> `recordingId` to avoid N requests on list load.

### `deleteRecording(recordingId, options?)`

Permanently deletes a recording. Per the API the deleted recording **cannot be recovered**; when a
Compliance Officer deletes another user's recording it is purged from Webex and becomes inaccessible
to all parties. Requires the **`spark-compliance:recordings_write`** scope on the access token.

> This is **not** the recycle-bin (recoverable) delete. Moving a recording to the recycle bin is a
> separate `POST` endpoint (*Move Recordings into the Recycle Bin*) not yet wired into this client.

**Signature**

```typescript
deleteRecording(recordingId: string, options?: DeleteRecordingOptions): Promise<RecordingDeleteResponse>
```

| Name | Type | Required | Description |
| ---- | ---- | -------- | ----------- |
| `recordingId` | `string` | Yes | The recording id (`id`) to delete |
| `options.reason` | `string` | No | Reason for deletion; only required for a Compliance Officer deleting another user's recording (e.g. `audit`) |
| `options.comment` | `string` | No | Compliance Officer's explanation (max 255 chars) |

**Request**

```
DELETE {recordingServiceUrl}/convergedRecordings/{recordingId}
```

`reason`/`comment` are sent as a JSON request body only when provided:

```json
{ "reason": "audit", "comment": "Maintain data privacy" }
```

**Success response**

```json
{
  "statusCode": 200,
  "data": {},
  "message": "SUCCESS"
}
```

> After deletion the recording no longer appears in a `LIST` request result.

---

## Events

```javascript
// A new recording is available (also fires when a trashed recording is RESTORE'd) -> add to list
callRecording.on('callRecording:created', (event) => {
  // event.data.activity.object: { id, topic, durationSeconds, sizeBytes, playbackUrl, callSessionID, ... }
});

// In-place update -> refresh detail
callRecording.on('callRecording:updated', (event) => {
  if (event.data.eventSubType === 'SUMMARY_CREATE') {
    // AI summary / transcript now available
  }
});

// A recording was removed -> drop from list / decrement badge
callRecording.on('callRecording:deleted', (event) => {
  // Fires for a soft delete (eventSubType 'TRASH') AND a permanent purge ('PURGE').
  // Inspect event.data.eventSubType if you need to distinguish them (e.g. TRASH is recoverable).
});
```

> **The SDK normalizes the backend's `updated`-driven lifecycle for you.** The backend does NOT send
> a dedicated `convergedRecordings.deleted` event — a delete arrives as `convergedRecordings.updated`
> with `eventSubType: TRASH` (verified in production). The client maps `TRASH`/`PURGE` to
> `callRecording:deleted` and `RESTORE` to `callRecording:created`, so you can subscribe to the
> intuitive event names. The original `eventSubType` is preserved on `event.data` for finer-grained
> handling.
>
> Tip: when your own app calls `deleteRecording()` and gets a 200, update the UI optimistically
> rather than waiting for the `callRecording:deleted` event — reserve the event for deletes performed
> elsewhere (another device or a Compliance Officer).

`RecordingEvent` payload shape:

```json
{
  "id": "event-id",
  "data": {
    "eventType": "convergedRecordings.updated",
    "eventSubType": "SUMMARY_CREATE",
    "activity": {
      "verb": "update",
      "object": {"id": "9f1d...c4", "callSessionId": "call-session-123", "topic": "Call with Alice"}
    }
  },
  "timestamp": 1717230000000,
  "trackingId": "..."
}
```

> There are no separate `transcriptAvailable`/`summaryAvailable` events; AI artifact availability
> arrives as `callRecording:updated` with `eventSubType: SUMMARY_CREATE`.

---

## Error Scenarios

All methods **return** (never throw) an error envelope. The shape matches the success envelope with
`data.error` populated and a non-`SUCCESS` message.

| Scenario | `statusCode` | Notes |
| -------- | ------------ | ----- |
| Bad/invalid request | `400` | Malformed parameters |
| Unauthorized / expired token | `401` | Re-authenticate |
| Forbidden | `403` | Caller lacks access to the recording |
| Recording not found | `404` | Unknown `recordingId` |
| Rate limited | `429` | Retry later, or use `webexUserRequest: true` for explicit end-user actions |
| Server error | `500`+ | Transient backend failure |

**Example error response**

```json
{
  "statusCode": 401,
  "data": {"error": "User is unauthorised, possible token expiry"},
  "message": "FAILURE"
}
```

**Recommended handling**

```javascript
const response = await callRecording.getCallRecording({
  type: RecordingRequestType.DETAIL,
  recordingId,
});

if (response.statusCode !== 200) {
  console.error(`Failed (${response.statusCode}): ${response.data.error}`);
  return;
}

// use response.data.recording
```

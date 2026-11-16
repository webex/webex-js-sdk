# CallRecording Module

> Canonical SDD target: [`src/CallRecording/ai-docs/call-recording-spec.md`](call-recording-spec.md). This legacy document is retained as migration source; use the canonical target for current lifecycle work.

## Overview

The `CallRecording` module provides read access to **Post Call Recordings** (recordings, transcripts,
summaries, and action items) produced for Webex Calling sessions through a single
`getCallRecording` method, moves a recording to the recycle bin via `deleteRecording`, and forwards recording
lifecycle events received over Mercury as typed SDK events.

Recordings are fetched from **User Hub** — catalog service `webex-user-hub-service`, path
`webappng/api/v1/hub/convergedRecordings`. The base URL is resolved from the u2c catalog. URL
resolution and the underlying Mercury subscriptions are owned by the WXC backend connector, while
the `CallRecording` facade exposes a typed, ergonomic API. Calling recordings do not send a
`siteurl` query. A wrong site name makes User Hub return 500.

**Architecture:** `CallRecording` uses the same **backend-connector (strategy) pattern** as
Voicemail. `CallRecording` is a thin, backend-agnostic facade; the actual REST/Mercury work lives in
a backend-specific connector. Today the only connector is `WxcCallRecordingConnector`
(`WxcCallRecordingConnector.ts`). The facade selects the connector based on the resolved calling
backend, delegates all read/delete calls to it, and re-emits the connector's recording events.
Adding a future backend (e.g. UCM/Broadworks, once a recording API exists for it) is a drop-in new
connector plus a `case` in the facade — no consumer-facing changes.

**Backend support:** Post Call Recording is a Webex Calling cloud capability and is therefore
supported **only for the Webex Calling (`WXC`) backend**. The facade resolves the user's backend via
`getCallingBackEnd(webex)` in its constructor and **throws `Error('Calling backend is not identified,
exiting....')`** for any other backend (`BWRKS`, `UCM`, `INVALID`) — the same convention used by the
`Voicemail` and `CallSettings` clients. As a result, `createCallRecordingClient` only yields a usable
client for Webex Calling users; for non-WXC users the factory/constructor throws and no client is
created.

**Package:** `@webex/calling`

**Entry point:** `packages/calling/src/CallRecording/CallRecording.ts`

**Factory:** `createCallRecordingClient(webex, logger) -> ICallRecording`

---

### Key Capabilities

| Capability | Description |
| ----------- | ----------- |
| **List Recordings** | Retrieves the current user's calling recordings (`status`, `limit` from `max`; ordered by `appCreateTime` DESC). |
| **Get Recording** | Fetches a single recording by its `id`, including `recordingPlaybackLinks` (transcript and audio) and `aiAssistantData.suggestedNoteUrl`. The SDK returns those URLs; it does not download the transcript or summary. |
| **Get By Call Session** | Returns all recordings tied to a call session id (`serviceData.callSessionId`), filtered client-side from the same list. |
| **Get Metadata** | Reads the same User Hub detail as Get Recording and returns only `id`, owner, `callSessionId`, and `serviceData`. |
| **Real-Time Recording Events** | Re-emits Mercury `convergedRecordings.*` events as typed `callRecording:*` events. |
| **Error Handling & Logging** | Standardized error handling via `serviceErrorCodeHandler` with automatic log upload on failure. |

---

## Public API

### ICallRecording Interface

All reads go through a **single** `getCallRecording` method, which dispatches on the request
`type` (a `RecordingRequestType`) and infers the concrete response type per request via
`RecordingResponseFor<T>`. Permanent deletion stays a separate method (different verb + scope).

| Method | Signature | Description |
| ------ | --------- | ----------- |
| `getCallRecording` | `<T extends GetCallRecordingRequest>(request: T): Promise<RecordingResponseFor<T>>` | Reads recordings; the `request.type` selects LIST / DETAIL / METADATA / BY_CALL_SESSION |
| `deleteRecording` | `(recordingId: string, options?: DeleteRecordingOptions): Promise<RecordingDeleteResponse>` | Moves a recording to the recycle bin via `POST /convergedRecordings/softDelete`; needs `spark:recordings_write`. `options` is deprecated and ignored |

### Helpers (exported from `@webex/calling`)

| Helper | Signature | Description |
| ------ | --------- | ----------- |
| `getRemoteParty` | `(serviceData?: RecordingServiceData): RecordingParty \| undefined` | Resolves the *other* party of the call from `serviceData` using `personality` (`originator` → `calledParty`, `terminator` → `callingParty`). Use `getRemoteParty(serviceData)?.actor?.id` for the Webex person UUID (avatar/presence); `undefined` for list-only `serviceData` or external/PSTN parties (fall back to `?.name`). |

> User Hub `callingData` is mapped onto `serviceData` for both the list and the detail, including
> `personality`, `callingParty`, and `calledParty`. `getRemoteParty(serviceData)` works on a list row
> when those parties are present. `METADATA` returns that same party block plus the owner; it does
> not call a separate `/metadata` URL.

#### `getCallRecording` request types

| `request.type` (`RecordingRequestType`) | Request shape | Maps to | Resolves with |
| --- | --- | --- | --- |
| `LIST` | `{type, options?}` | `GET {userhub}/webappng/api/v1/hub/convergedRecordings` | `RecordingListResponse` |
| `DETAIL` | `{type, recordingId}` | `GET {userhub}/webappng/api/v1/hub/convergedRecordings/{id}` | `RecordingResponse` |
| `METADATA` | `{type, recordingId}` | same detail URL, mapped to owner + `serviceData` | `RecordingMetadataResponse` |
| `BY_CALL_SESSION` | `{type, callSessionId, options?}` | client-side filter over the list | `RecordingListResponse` |

### Inherited from Eventing\<CallRecordingEventTypes\>

| Method | Signature | Description |
| ------ | --------- | ----------- |
| `on` | `(event, handler)` | Subscribe to an event |
| `off` | `(event, handler)` | Unsubscribe from an event |
| `emit` | `(event, data)` | Emit an event |

### Events Emitted

| Event | Enum Key | Payload | Description |
| ----- | -------- | ------- | ----------- |
| `callRecording:created` | `COMMON_EVENT_KEYS.CALL_RECORDING_CREATED` | `RecordingEvent` | A new recording was created (or restored from trash) |
| `callRecording:updated` | `COMMON_EVENT_KEYS.CALL_RECORDING_UPDATED` | `RecordingEvent` | A recording was updated (e.g. `SUMMARY_CREATE`) |
| `callRecording:deleted` | `COMMON_EVENT_KEYS.CALL_RECORDING_DELETED` | `RecordingEvent` | A recording was soft-deleted (`TRASH`) or permanently purged (`PURGE`) |

> **Important — the backend expresses the lifecycle through `updated` + `eventSubType`, not via
> distinct event types.** Verified against production: a delete in the Webex client arrives as
> `convergedRecordings.updated` with `eventSubType: TRASH` (NOT `convergedRecordings.deleted`), and AI
> summary/transcript availability arrives as `convergedRecordings.updated` with
> `eventSubType: SUMMARY_CREATE`. The connector therefore **routes `convergedRecordings.updated`
> events by `eventSubType`** into the intuitive typed event, while always forwarding the full event
> (so consumers can still read `data.eventSubType` to distinguish a soft `TRASH` from a permanent
> `PURGE`):
>
> | Mercury `eventType` | `eventSubType` | Emitted typed event |
> | ------------------- | -------------- | ------------------- |
> | `convergedRecordings.created` | — | `callRecording:created` |
> | `convergedRecordings.updated` | `TRASH` (soft delete) | `callRecording:deleted` |
> | `convergedRecordings.updated` | `PURGE` (permanent) | `callRecording:deleted` |
> | `convergedRecordings.updated` | `RESTORE` (from trash) | `callRecording:created` |
> | `convergedRecordings.updated` | `SUMMARY_CREATE` / other | `callRecording:updated` |
> | `convergedRecordings.deleted` | — | `callRecording:deleted` (subscribed for completeness; not observed in practice) |

### Key Types

| Type | Description |
| ---- | ----------- |
| `RecordingRequestType` | Discriminant enum for `getCallRecording`: `LIST`, `DETAIL`, `METADATA`, `BY_CALL_SESSION` |
| `GetCallRecordingRequest` | Discriminated union of the read requests passed to `getCallRecording` (`ListRecordingsRequest` \| `DetailRecordingRequest` \| `MetadataRecordingRequest` \| `CallSessionRecordingsRequest`) |
| `RecordingResponseFor<T>` | Maps a request member to its response type so `getCallRecording` infers the return per request |
| `Recording` | Mapped User Hub recording. Key fields: `id` (`recordUUID`), `topic` (`title`), `createTime`, `timeRecorded`, `status` (`Active` → `available`), `serviceType` (`calling`), `durationSeconds`, `sizeBytes`, `ownerId`, `ownerEmail`, `serviceData`, `recordingPlaybackLinks`, `aiAssistantData` |
| `RecordingServiceData` | Mapped from User Hub `callingData`: `locationId`, `callSessionId`, `personality`, `callingParty`, `calledParty` |
| `RecordingPersonality` | Which side the owner was on: `'originator'` (remote = `calledParty`) \| `'terminator'` (remote = `callingParty`) |
| `RecordingParty` | A call party: `actor` (`{type, id, email}`), `number`, `name`. `actor.id` is the person UUID for avatar/presence |
| `RecordingActor` | The acting entity behind a party: `type`, `id` (person UUID for Webex users), `email` |
| `RecordingMetadata` | Metadata document: `owner`, `session`, `participants`, `mediaStreams`, `extensionData`, `serviceData` (with the call parties) |
| `GetRecordingsOptions` | `status` and `max` are sent (`status`, `limit`). `days`, `from`, `to`, and the older filters are accepted and not sent. There is no `siteUrl`. |
| `RecordingStatus` | Enum: `available`, `deleted` |
| `RecordingListResponse` | `{statusCode, data: {recordings?, error?}, message}` |
| `RecordingResponse` | `{statusCode, data: {recording?, error?}, message}` |
| `RecordingMetadataResponse` | `{statusCode, data: {metadata?, error?}, message}` |
| `RecordingDeleteResponse` | `{statusCode, data: {error?}, message}` |
| `DeleteRecordingOptions` | `{reason?, comment?}` — **deprecated**, ignored by `deleteRecording` |
| `RecordingEvent` | Mercury event envelope: `{id?, data: {activity, eventType, eventSubType?}, timestamp?, trackingId?}` |

### Field Mapping Notes

| Concept | Field |
| ------- | ----- |
| Recording id (for `DETAIL` / `METADATA` requests) | `id`, mapped from User Hub `recordUUID` |
| Call session id (for the `BY_CALL_SESSION` request) | `serviceData.callSessionId`, mapped from `callingData.callSessionID` |
| Location | `serviceData.locationId` |
| Owner | `ownerId` / `ownerEmail` |
| Remote party (avatar / presence) | `getRemoteParty(recording.serviceData)?.actor?.id` |
| Transcript URL | `recordingPlaybackLinks.transcriptPlaybackLink` on `DETAIL` |
| Summary URL | `aiAssistantData.suggestedNoteUrl` on `DETAIL` when `suggestedNoteStatus` is `Success` |

---

## Configuration

The `CallRecording` constructor accepts:

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `webex` | `WebexSDK` | Yes | An initialized Webex SDK instance (with `webex-user-hub-service` in its u2c catalog) |
| `logger` | `LoggerInterface` | Yes | Logger interface with a `level` property |

### List Options (`GetRecordingsOptions`)

These apply to the `LIST` and `BY_CALL_SESSION` requests (passed as `request.options`).

| Field | Type | Sent on the list | Description |
| ----- | ---- | --------------- | ----------- |
| `status` | `RecordingStatus` | yes, default `available` | Query `status` |
| `max` | `number` | yes, default `30` | Query `limit` |
| `days` | `number` | no | Accepted so existing callers keep compiling. The list orders by `appCreateTime` |
| `from`, `to`, `serviceType`, `format`, `ownerType`, `storageRegion`, `locationId`, `topic`, `webexUserRequest` | see type | no | Deprecated. Accepted so existing callers keep compiling. Not sent |

The list query is fixed apart from `status` and `limit`:

```
orderType=DESC&orderBy=appCreateTime&status=available&category=calling&offset=0&limit=30
```

---

## Examples and Use Cases

### Create a CallRecording Client

```typescript
import {createCallRecordingClient} from '@webex/calling';

const callRecording = createCallRecordingClient(webex, {level: 'info'});
```

When using the top-level `webex` package, enable the client via `clientConfig.callRecording = true`
and access it as `calling.callRecordingClient`.

### List Recordings

```typescript
import {RecordingRequestType, RecordingStatus} from '@webex/calling';

const response = await callRecording.getCallRecording({
  type: RecordingRequestType.LIST,
  options: {max: 30, status: RecordingStatus.AVAILABLE},
});

if (response.statusCode === 200) {
  console.log(`Retrieved ${response.data.recordings?.length} recordings`);
}
```

### Get a Single Recording and Metadata

```typescript
const recordingResponse = await callRecording.getCallRecording({
  type: RecordingRequestType.DETAIL,
  recordingId: 'recording-uuid',
});
const metadataResponse = await callRecording.getCallRecording({
  type: RecordingRequestType.METADATA,
  recordingId: 'recording-uuid',
});

console.log(recordingResponse.data.recording?.recordingPlaybackLinks?.transcriptPlaybackLink);
console.log(recordingResponse.data.recording?.aiAssistantData?.suggestedNoteUrl);
console.log(metadataResponse.data.metadata?.serviceData);
```

### Get Recordings by Call Session Id

```typescript
const response = await callRecording.getCallRecording({
  type: RecordingRequestType.BY_CALL_SESSION,
  callSessionId: 'call-session-id',
});

console.log(`Found ${response.data.recordings?.length} recordings for the session`);
```

### Delete a Recording (soft delete / recycle bin)

```typescript
const response = await callRecording.deleteRecording('recording-uuid');

if (response.statusCode >= 200 && response.statusCode < 300) {
  // Recording moved to recycle bin; Mercury TRASH -> callRecording:deleted.
}
```

> Compliance permanent delete (`DELETE /convergedRecordings/{id}`) and batch purge/restore APIs are
> not exposed on this client.

### Listen for Recording Events

```typescript
callRecording.on('callRecording:created', (event) => {
  console.log('Recording created:', event.data.activity.object.id);
});

callRecording.on('callRecording:updated', (event) => {
  if (event.data.eventSubType === 'SUMMARY_CREATE') {
    console.log('AI summary/transcript is now available for', event.data.activity.object.id);
  }
});

callRecording.on('callRecording:deleted', (event) => {
  console.log('Recording deleted:', event.data.activity.object.id);
});
```

---

## Implementation Notes

### Base URL Resolution

The `WxcCallRecordingConnector` resolves the recording base URL from the u2c catalog on each request:

1. `webex.internal.services._serviceUrls['webex-user-hub-service']`.
2. Fallback: `webex.internal.services.get('webex-user-hub-service')`.

`joinUserhubRecordingsUrl` turns that host into
`{userhub}/webappng/api/v1/hub/convergedRecordings`.

### HTTP Client Usage

When `credentials.supertoken` is present, the connector calls User Hub with `fetch` and that token.
Headers are `Accept: application/json`, `Authorization`, and `WebexUserRequest: true`. It does not
call `webex.request` on that path, because `getUserToken()` downscopes the token and User Hub can
return 500. If there is no supertoken, it uses `webex.request` with the same Accept and
`WebexUserRequest` headers, and retries once with `fetch` when that call returns 500.

Errors are **returned** (not thrown) as `{statusCode, data: {error}, message}` envelopes via
`serviceErrorCodeHandler`, and diagnostic logs are uploaded via `uploadLogs()` on failure.

### URL Construction

Internally `getCallRecording` dispatches to one operation per `request.type`. A `LIST` request
builds:

```
{userhub}/webappng/api/v1/hub/convergedRecordings?orderType=DESC&orderBy=appCreateTime&status=available&category=calling&offset=0&limit=30
```

- `status` defaults to `available`. `limit` defaults to `30` (`options.max`). `offset` is `0`.
- `category` is always `calling`. `siteurl` is not sent.
- User Hub rows use `recordings` or `items`. Each row is mapped by `mapUserhubRecording` (`recordUUID` → `id`, `title` → `topic`, `callingData` → `serviceData`, playback and AI links copied through).
- `DETAIL`: `GET {userhub}/webappng/api/v1/hub/convergedRecordings/{recordingId}` with no query. This body carries `recordingPlaybackLinks.transcriptPlaybackLink` and `aiAssistantData.suggestedNoteUrl`.
- `METADATA`: the same detail URL. `mapUserhubMetadata` keeps `id`, owner, `callSessionId`, and `serviceData`.
- `deleteRecording`: `POST {userhub}/webappng/api/v1/hub/convergedRecordings/softDelete` with body `{ recordUUIDs: [recordingId] }` (recycle bin; requires `spark:recordings_write`).

### `BY_CALL_SESSION` request (API gap)

There is no User Hub query parameter for call session id. The client fetches the list and filters
client-side on `serviceData.callSessionId === callSessionId`. The scan is the same page as `LIST`
(`status` and `limit` only). If the underlying list call fails, the original error response is
returned unchanged.

---

## Dependencies

### Internal Dependencies

| Module | Purpose |
| ------ | ------- |
| `WxcCallRecordingConnector` | Webex Calling (WXC) backend connector — REST calls, URL resolution, Mercury subscription/emit |
| `getCallingBackEnd` | Resolves the user's calling backend so the facade can select a connector (WXC-only today) |
| `SDKConnector` | Singleton bridge to Webex SDK, Mercury event listener registration |
| `Eventing<T>` | Typed event emitter base class |
| `Logger` | Structured logging with file/method context |
| `serviceErrorCodeHandler` | Standardized error response formatting |
| `uploadLogs` | Uploads diagnostic logs on error |
| `userhub.ts` | Joins the User Hub recordings URL and maps `recordUUID` / `callingData` / playback links onto `Recording` |
| `webex.internal.services` | Resolves the `webex-user-hub-service` base URL from the u2c catalog |
| `webex.internal.mercury` | Delivers `convergedRecordings.*` events via the SDKConnector listener |

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md) — Component overview, data flows, sequence diagrams

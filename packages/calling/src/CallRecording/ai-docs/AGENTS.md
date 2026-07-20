# CallRecording Module

## Overview

The `CallRecording` module provides read access to **Post Call Recordings** (recordings, transcripts,
summaries, and action items) produced for Webex Calling sessions through a single
`getCallRecording` method, moves a recording to the recycle bin via `deleteRecording`, and forwards recording
lifecycle events received over Mercury as typed SDK events.

Recordings are fetched from the **Webex public developer API (hydra)** — catalog service
`hydraDeveloperApi` (e.g. `https://integration.webexapis.com/v1`) — whose base URL is resolved
directly from the u2c catalog. URL resolution and the underlying Mercury subscriptions are owned by
the WXC backend connector, while the `CallRecording` facade exposes a typed, ergonomic API.

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
| **List Recordings** | Retrieves the current user's converged recordings with optional time-range filters, status filter, and pagination. |
| **Get Recording** | Fetches a single recording by its `id`, including temporary direct download links. |
| **Get By Call Session** | Returns all recordings tied to a call session id (`serviceData.callSessionId`), filtered client-side. |
| **Get Metadata** | Fetches the metadata document for a recording (owner, session, participants, media streams, extension data). |
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

> Party details (`personality`, `callingParty`, `calledParty`) are only on the **metadata**
> `serviceData`, not the `LIST` response, so resolving avatar/presence for a list needs a `METADATA`
> call per recording — fetch lazily for visible rows and cache by `recordingId`.

#### `getCallRecording` request types

| `request.type` (`RecordingRequestType`) | Request shape | Maps to | Resolves with |
| --- | --- | --- | --- |
| `LIST` | `{type, options?}` | `GET /convergedRecordings` | `RecordingListResponse` |
| `DETAIL` | `{type, recordingId}` | `GET /convergedRecordings/{id}` | `RecordingResponse` |
| `METADATA` | `{type, recordingId}` | `GET /convergedRecordings/{id}/metadata` | `RecordingMetadataResponse` |
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
| `Recording` | A converged recording. Key fields: `id`, `topic`, `createTime`, `timeRecorded`, `status`, `serviceType`, `durationSeconds`, `sizeBytes`, `ownerId`, `ownerEmail`, `serviceData` (`locationId`, `callSessionId`), `temporaryDirectDownloadLinks` |
| `RecordingServiceData` | Service-specific data: `callRecordingId`, `locationId`, `callSessionId`, and (metadata only) the call parties `personality`, `callingParty`, `calledParty` |
| `RecordingPersonality` | Which side the owner was on: `'originator'` (remote = `calledParty`) \| `'terminator'` (remote = `callingParty`) |
| `RecordingParty` | A call party: `actor` (`{type, id, email}`), `number`, `name`. `actor.id` is the person UUID for avatar/presence |
| `RecordingActor` | The acting entity behind a party: `type`, `id` (person UUID for Webex users), `email` |
| `RecordingMetadata` | Metadata document: `owner`, `session`, `participants`, `mediaStreams`, `extensionData`, `serviceData` (with the call parties) |
| `GetRecordingsOptions` | Optional `from`, `to`, `days`, `status`, `max`, `serviceType`, `format`, `ownerType`, `storageRegion`, `locationId`, `topic`, `webexUserRequest` |
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
| Recording id (for `DETAIL` / `METADATA` requests) | `id` |
| Call session id (for the `BY_CALL_SESSION` request) | `serviceData.callSessionId` |
| Location | `serviceData.locationId` |
| Owner | `ownerId` / `ownerEmail` / `ownerType` |
| Remote party (avatar / presence) | `getRemoteParty(metadata.serviceData)?.actor?.id` — only on the `METADATA` response |
| Direct media links (single `DETAIL` request) | `temporaryDirectDownloadLinks` |

---

## Configuration

The `CallRecording` constructor accepts:

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `webex` | `WebexSDK` | Yes | An initialized Webex SDK instance (with the `hydraDeveloperApi` service in its u2c catalog) |
| `logger` | `LoggerInterface` | Yes | Logger interface with a `level` property |

### List Options (`GetRecordingsOptions`)

These apply to the `LIST` and `BY_CALL_SESSION` requests (passed as `request.options`).

| Field | Type | Default | Description |
| ----- | ---- | ------- | ----------- |
| `from` | `string` (ISO-8601) | `now - days` | Inclusive start of the time window (always sent) |
| `to` | `string` (ISO-8601) | `now` | Inclusive end of the time window (always sent) |
| `days` | `number` | `30` | Lookback used to derive `from` when `from` is omitted (API max window is 30 days) |
| `status` | `RecordingStatus` | `available` | Filter by recording status (`available`/`deleted`) |
| `max` | `number` | `30` | Maximum number of records to return per page |
| `serviceType` | `string` | _(unset)_ | Filter by producing service (e.g. `calling`); sent only when provided |
| `format` | `string` | _(unset)_ | Filter by media format (e.g. `MP3`, `MP4`); sent only when provided |
| `ownerType` | `string` | _(unset)_ | Filter by owner type (e.g. `user`); sent only when provided |
| `storageRegion` | `string` | _(unset)_ | Filter by storage region (e.g. `US`); sent only when provided |
| `locationId` | `string` | _(unset)_ | Filter by location id; sent only when provided |
| `topic` | `string` | _(unset)_ | Filter by recording topic; sent only when provided |
| `webexUserRequest` | `boolean` | `false` | When true, sends the `WebexUserRequest: true` header (ad-hoc rate-limit bypass) |

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

console.log(recordingResponse.data.recording?.temporaryDirectDownloadLinks);
console.log(metadataResponse.data.metadata?.participants);
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

The `WxcCallRecordingConnector` resolves the recording base URL at construction directly from the
u2c catalog:

1. `webex.internal.services._serviceUrls.hydraDeveloperApi` (cached service URL).
2. Fallback: `webex.internal.services.get(webex.internal.services._activeServices.hydraDeveloperApi)`.

### HTTP Client Usage

All read methods use `this.webex.request({uri, method: GET, service: 'hydraDeveloperApi'})`. Errors are
**returned** (not thrown) as `{statusCode, data: {error}, message}` envelopes via
`serviceErrorCodeHandler`, and diagnostic logs are uploaded via `uploadLogs()` on failure.

### URL Construction

Internally `getCallRecording` dispatches to one operation per `request.type`. A `LIST` request
builds the list URL as:

```
{recordingServiceUrl}/convergedRecordings?from={now-days}&to={now}&status=available&max=30
```

- A `from` lower bound is always sent (like CallHistory's mandatory `from` date) so the API returns results; it is derived as `now - days` (default 30) when not provided. `to` defaults to `now` when not supplied. The list API only accepts a `from`/`to` interval of at most 30 days, so the default stays within that limit and custom `days`/`from` values must too.
- The sort/filter/pagination params default to the values used by the Webex web client and are overridable via `GetRecordingsOptions`.
- The raw list response is `{ "items": [ ... ] }`; the client maps `items` to `data.recordings`.
- `DETAIL`: `GET {recordingServiceUrl}/convergedRecordings/{recordingId}`.
- `METADATA`: `GET {recordingServiceUrl}/convergedRecordings/{recordingId}/metadata`.
- `deleteRecording`: `POST {recordingServiceUrl}/convergedRecordings/softDelete` with body `{ recordingIds: [recordingId] }` (soft delete / recycle bin; requires `spark:recordings_write`).

### `BY_CALL_SESSION` request (API gap)

There is no confirmed server-side query parameter to filter by call session id. The client fetches
a list (the same operation as a `LIST` request, using `request.options`) and filters client-side on
`serviceData.callSessionId === callSessionId`. Because the scan is bounded by that list query, it
only searches the default time window/status and first `max` records unless `options` are passed.
Forward `GetRecordingsOptions` (e.g. a wider `days`/`from`–`to` window, a different `status`, or a
larger `max`) when the target session may fall outside the defaults. If the underlying list
call fails, the original error response is returned unchanged.

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
| `webex.internal.services` | Resolves the `hydraDeveloperApi` base URL from the u2c catalog |
| `webex.internal.mercury` | Delivers `convergedRecordings.*` events via the SDKConnector listener |

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md) — Component overview, data flows, sequence diagrams

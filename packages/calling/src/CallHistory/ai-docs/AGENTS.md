# CallHistory Module

## Overview

The `CallHistory` module provides APIs for retrieving, managing, and receiving real-time updates for call history records from backend services. It supports fetching paginated and sorted call history, marking missed calls as read, deleting call history records, and listening for real-time session events via Mercury WebSocket.

For Webex Calling (WXC), call history is fetched from Janus and includes shared session support. For UCM (Unified Communications Manager), call history records can be enriched with line number data from the UCM Lines API.

**Package:** `@webex/calling`

**Entry point:** `packages/calling/src/CallHistory/CallHistory.ts`

**Factory:** `createCallHistoryClient(webex, logger) -> ICallHistory`

---

### Key Capabilities

| Capability | Description |
| ----------- | ----------- |
| **Fetch Call History** | Retrieves call history records from backend APIs with configurable date range, record limit, and sort order (ASC/DESC). |
| **Sorting** | Supports sorting by `startTime` or `endTime` in ascending or descending order. Default sort is by `endTime` descending. |
| **Update Missed Calls** | Marks missed call records as read by posting `endTime` and `sessionId` pairs to the Janus `setReadState` endpoint. |
| **Delete Call History Records** | Deletes call history records by posting `endTime` and `sessionId` pairs to the Janus `markAsDeleted` endpoint. Validates date formats before submission. |
| **Real-Time Session Events** | Listens for Mercury WebSocket events (`callSessionEventInclusive`, `callSessionEventLegacy`, `callSessionEventViewed`, `callSessionEventDeleted`) and emits them to the application. |
| **Error Handling & Logging** | Standardized error handling via `serviceErrorCodeHandler` with automatic log upload on failures. |

### Backend-Specific Behavior

| Backend | Behavior |
| ------- | -------- |
| **WXC** | Adds `includeSharedSessions=true` so shared session types (`WEBEXCALLING_SHARED`) are included in call history queries. |
| **UCM** | Enriches call history records with `ucmLineNumber` by matching `self.cucmDN` against UCM Lines API (`dnorpattern`). |

---

## Public API

### ICallHistory Interface

The following methods are defined on the `ICallHistory` interface:

| Method | Signature | Description |
| ------ | --------- | ----------- |
| `getCallHistoryData` | `(days?: number, limit?: number, sort?: SORT, sortBy?: SORT_BY): Promise<JanusResponseEvent>` | Fetches call history records from Janus |
| `updateMissedCalls` | `(endTimeSessionIds: EndTimeSessionId[]): Promise<UpdateMissedCallsResponse>` | Marks missed calls as read |
| `deleteCallHistoryRecords` | `(deleteSessionIds: EndTimeSessionId[]): Promise<DeleteCallHistoryRecordsResponse>` | Deletes call history records |

### Inherited from Eventing\<CallHistoryEventTypes\>

| Method | Signature | Description |
| ------ | --------- | ----------- |
| `on` | `(event, handler)` | Subscribe to an event |
| `off` | `(event, handler)` | Unsubscribe from an event |
| `emit` | `(event, data)` | Emit an event |

### Events Emitted

| Event | Enum Key | Payload | Description |
| ----- | -------- | ------- | ----------- |
| `callHistory:user_recent_sessions` | `COMMON_EVENT_KEYS.CALL_HISTORY_USER_SESSION_INFO` | `CallSessionEvent` | New or updated call session received |
| `callHistory:user_viewed_sessions` | `COMMON_EVENT_KEYS.CALL_HISTORY_USER_VIEWED_SESSIONS` | `CallSessionViewedEvent` | Sessions marked as viewed |
| `callHistory:user_sessions_deleted` | `COMMON_EVENT_KEYS.CALL_HISTORY_USER_SESSIONS_DELETED` | `CallSessionDeletedEvent` | Sessions deleted |

### Key Types

| Type | Description |
| ---- | ----------- |
| `JanusResponseEvent` | Response containing `statusCode`, `data.userSessions`, and `message` |
| `UpdateMissedCallsResponse` | Response containing `statusCode`, `data.readStatusMessage`, and `message` |
| `DeleteCallHistoryRecordsResponse` | Response containing `statusCode`, `data.deleteStatusMessage`, and `message` |
| `EndTimeSessionId` | Object with `endTime` (string) and `sessionId` (string) |
| `SORT` | Enum: `ASC = 'ASC'`, `DESC = 'DESC'`, `DEFAULT = 'DESC'` |
| `SORT_BY` | Enum: `START_TIME = 'startTime'`, `END_TIME = 'endTime'`, `DEFAULT = 'endTime'` |

### Event Payload Structures

The event payloads have nested structures that must be accessed correctly:

| Event Type | Data Access Path | Inner Type |
| ---------- | ---------------- | ---------- |
| `CallSessionEvent` | `event.data.userSessions.userSessions` | `UserSession[]` |
| `CallSessionViewedEvent` | `event.data.userReadSessions.userReadSessions` | `UserReadSessions[]` |
| `CallSessionDeletedEvent` | `event.data.deletedSessions` | `string[]` |

### UserSession Type (key fields for this module)

```typescript
type UserSession = {
  id: string;
  sessionId: string;
  disposition: Disposition;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  direction: string;
  sessionType: SessionType;
  self: CallRecordSelf;
  other: CallRecordListOther;
  // ... additional fields
};

type CallRecordSelf = {
  id: string;
  name?: string;
  phoneNumber?: string;
  cucmDN?: string;        // UCM directory number, used for line enrichment
  ucmLineNumber?: number; // Populated by UCM line enrichment
};
```

---

## Configuration

The `CallHistory` constructor accepts:

| Parameter | Type | Required | Description |
| --------- | ---- | -------- | ----------- |
| `webex` | `WebexSDK` | Yes | An initialized Webex SDK instance |
| `logger` | `LoggerInterface` | Yes | Logger interface with a `level` property |

### `getCallHistoryData` Parameters

| Parameter | Type | Default | Description |
| --------- | ---- | ------- | ----------- |
| `days` | `number` | `10` | Number of days of history to fetch |
| `limit` | `number` | `50` | Maximum number of records to return |
| `sort` | `SORT` | `SORT.DEFAULT` | Sort order (ASC/DESC) |
| `sortBy` | `SORT_BY` | `SORT_BY.DEFAULT` | Sort field (startTime/endTime) |

---

## Examples and Use Cases

### Create a CallHistory Client

```typescript
import {createCallHistoryClient} from '@webex/calling';

const callHistory = createCallHistoryClient(webex, {level: 'info'});
```

### Fetch Call History Records

```typescript
const response = await callHistory.getCallHistoryData(10, 50, SORT.DESC, SORT_BY.END_TIME);

if (response.statusCode === 200) {
  const sessions = response.data.userSessions;
  console.log(`Retrieved ${sessions.length} call records`);
}
```

### Listen for Real-Time Session Events

```typescript
callHistory.on('callHistory:user_recent_sessions', (event) => {
  console.log('New session event:', event.data.userSessions.userSessions);
});

callHistory.on('callHistory:user_viewed_sessions', (event) => {
  console.log('Sessions viewed:', event.data.userReadSessions.userReadSessions);
});

callHistory.on('callHistory:user_sessions_deleted', (event) => {
  console.log('Sessions deleted:', event.data.deletedSessions);
});
```

### Mark Missed Calls as Read

```typescript
const endTimeSessionIds = [
  {endTime: '2024-01-15T10:30:00.000Z', sessionId: 'session-uuid-1'},
  {endTime: '2024-01-15T11:00:00.000Z', sessionId: 'session-uuid-2'},
];

const response = await callHistory.updateMissedCalls(endTimeSessionIds);

if (response.statusCode === 200) {
  console.log(response.data.readStatusMessage);
}
```

### Delete Call History Records

```typescript
const deleteSessionIds = [
  {endTime: '2024-01-15T10:30:00.000Z', sessionId: 'session-uuid-1'},
];

const response = await callHistory.deleteCallHistoryRecords(deleteSessionIds);

if (response.statusCode === 200) {
  console.log(response.data.deleteStatusMessage);
}
```

---

## Implementation Notes

### HTTP Client Usage

The module uses **two different HTTP mechanisms** depending on the method:

| Method | HTTP Client | Auth Handling |
| ------ | ----------- | ------------- |
| `getCallHistoryData` | `this.webex.request()` (SDK built-in) | Automatic via SDK |
| `updateMissedCalls` | Browser `fetch` API | Manual `Authorization` header via `this.webex.credentials.getUserToken()` |
| `deleteCallHistoryRecords` | Browser `fetch` API | Manual `Authorization` header via `this.webex.credentials.getUserToken()` |

When adding new API methods, follow the `fetch`-based pattern (used by `updateMissedCalls`/`deleteCallHistoryRecords`) for POST endpoints and `webex.request` for GET endpoints.

### Request Body Structures

The POST endpoints use different body key names:

| Endpoint | Body Key | Body Shape |
| -------- | -------- | ---------- |
| `setReadState` | `endTimeSessionIds` | `{endTimeSessionIds: [{endTime: number, sessionId: string}]}` |
| `markAsDeleted` | `deleteSessionIds` | `{deleteSessionIds: [{endTime: number, sessionId: string}]}` |

Note: In both cases, `endTime` is converted from an ISO date string to milliseconds (epoch) before sending.

### URL Construction

`getCallHistoryData()` builds the request URL in steps:

1. Base path: `{janusUrl}/history/userSessions`
2. Required query params: `from`, `limit`, `includeNewSessionTypes=true`, `sort`
3. Conditional query param: `includeSharedSessions=true` (WXC only)

The `FROM_DATE` constant is `'?from'` (includes the `?` query string opener), so the final Janus URL pattern is:

```
{janusUrl}/history/userSessions?from={isoDate}&limit={limit}&includeNewSessionTypes=true&sort={sort}[&includeSharedSessions=true]
```

Notes:
- `includeNewSessionTypes=true` is always appended.
- `includeSharedSessions=true` is appended only for WXC backend.
- `sortBy` is applied in module logic after fetch (for `startTime`) and is not sent as a URL parameter.

---

## Dependencies

### Runtime Dependencies

| Package | Purpose |
| ------- | ------- |
| `webex` (SDK) | HTTP requests to Janus API, Mercury WebSocket event subscription |

### Internal Dependencies

| Module | Purpose |
| ------ | ------- |
| `SDKConnector` | Singleton bridge to Webex SDK, Mercury event listener registration |
| `Eventing<T>` | Typed event emitter base class |
| `Logger` | Structured logging with file/method context |
| `serviceErrorCodeHandler` | Standardized error response formatting |
| `getVgActionEndpoint` | Resolves VG endpoint for UCM Lines API |
| `getCallingBackEnd` | Determines the calling backend (WXC, UCM, BWRKS) |
| `uploadLogs` | Uploads diagnostic logs on error |

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md) — Component overview, data flows, sequence diagrams

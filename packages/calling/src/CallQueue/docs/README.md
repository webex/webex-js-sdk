---
type: Module Spec
title: Call queue agent status
description: Call queue agent state, membership, events, and client lifecycle.
tags: [module, specification]
---

# Call queue agent status

Cloud Webex Calling only. `createCallQueueClient(webex, logger, {webexApiBaseUrl})` returns a client that:

- Uses the caller-supplied API origin: `https://integration.webexapis.com` for Integration, `https://webexapis.com` for commercial Production, or `https://api-usgov.webex.com` for FedRAMP. It validates the origin against these exact HTTPS hosts, permits an optional trailing slash, and appends `/v1`; missing or invalid options fail closed before any queue request. Consumers must supply the effective origin for their environment.
- Uses `GET`/`PUT /telephony/config/people/me/settings/queues` for the primary line and `GET`/`PUT /telephony/config/people/me/settings/secondaryLines/{lineOwnerId}/queues` for a secondary virtual line. Raw virtual-line UUIDs are encoded as `VIRTUAL_LINE` Webex IDs before constructing the public API URL.
- `GET`s `/telephony/config/queues` through the same environment-selected public API to fill a queue display name when agent settings omit it. Catalog access is optional and may be forbidden for some users. Pagination follows a same-origin `Link: ...; rel="next"` header, with a bounded fallback for body `paging.next`.
- `POST`s `/telephony/calls/sync/invoke` through the same public API with the registered `wdmUrl` and `resources: [{resource: 'telephony_agents'}]`. An Integration test returned HTTP 204; live Mercury event delivery and Production still require end-to-end verification.
- Listens for Mercury `event:telephony_agents.sync`, `.state`, and `.join`, as well as the legacy singular topic spellings.
- Emits `callQueue:updated` with `{ acdState, queues }`; virtual-line events also include `lineOwnerId`. The public `ICallQueue` interface exposes typed `on` and `off` methods for this event. On disposal, the client calls Mercury `off(event)` for each registered queue event name; this removes all Mercury listeners for those event names on the same Webex instance, including listeners added by other subscribers.

Backend detection uses the shared `getCallingBackEnd` utility once device entitlement models are available. A client created before that data is available rejects requests as unsupported until a later request can detect the backend, and then registers its listeners once for Webex Calling. Unexpected errors from backend detection are not treated as missing registration data.

`prepareForReuse()` rechecks backend readiness without making a network request and registers any missing Webex Calling listeners. It returns false when the client has been disposed or existing listeners no longer match the detected backend; the caller must replace the client instead. Repeated calls do not register duplicate listeners. Successful preparation clears cached queue state and names and invalidates in-flight responses and event refreshes from the prior lifecycle. A superseded API call returns 409; if an update was already sent, it may have completed server-side, so consumers must refresh before deciding whether to retry.

`lineOwnerId` must match `^[A-Za-z0-9_-]{1,128}$`. Cached agent status is scoped to its line. Public API queue IDs may be encoded Webex IDs while Mercury can carry UUIDs; comparisons normalize the IDs while retaining the public ID. Raw UUIDs supplied in membership updates are encoded as `CALL_QUEUE` Webex IDs. Before setting a queue to `available: false`, the client loads the line's settings if it does not already know the queue's `allowLogOffEnabled` value. A queue with `allowLogOffEnabled: false` cannot be changed to `available: false`. Empty or non-array `queues` updates and invalid update request objects are rejected before sending a request.

ACD values are `SIGN_IN`, `SIGN_OUT`, `AVAILABLE`, `UNAVAILABLE`, and `WRAP_UP`. Mercury camelCase values (`signIn`, `wrapUp`) map onto those names. Mercury `joinInfo` entries carry `queueId` and joined/unjoined/unassigned status; sync events replace the queue list while join events merge or remove entries. Actor IDs scope changes to the primary user or a secondary virtual line. Queue availability may be absent and must not be treated as a known false value. If an initial response omits agent status, the client returns an error rather than inventing a signed-out state. When a 204 update has no cached state, the client reloads settings before returning a snapshot.

When a Mercury event includes both queue records and `joinInfo`, retain metadata from the incoming records while applying membership from `joinInfo`; use previously known metadata for joined queues absent from the incoming records. Match raw and encoded queue IDs while preserving an existing public ID.

Do not log tokens or queue payloads. Unavailable reason codes are not part of this client.

When a queue request fails, diagnostic log upload is best-effort: an upload or metrics failure must not replace the original request error returned to the caller. Browser network errors may lack an HTTP status, so the shared error handler's fallback status does not necessarily represent a server response.

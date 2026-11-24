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
- Listens for Mercury `event:telephony_agents.sync`, `.state`, and `.join`, as well as singular `telephony_agent` spellings retained for compatibility. Both spellings are handled the same way; the singular variant has not been independently verified against the backend.
- Emits `callQueue:updated` with `{ acdState, queues }`; virtual-line events also include `lineOwnerId`. The public `ICallQueue` interface exposes typed `on` and `off` methods for this event. On disposal, the client removes only the Mercury callbacks it registered, leaving other subscribers intact.

Backend detection uses the shared `getCallingBackEnd` utility once device entitlement models are available. A client created before that data is available rejects requests as unsupported until a later request can detect the backend, and then registers its listeners once for Webex Calling. Unexpected errors from backend detection are not treated as missing registration data.

The factory accepts an optional previous client for reuse and replaces it when its configuration or backend is no longer compatible. When called in managed mode by the Webex wrapper, it also handles disablement, cleanup, and initialization errors without blocking other clients; direct callers retain the existing error behavior. It rejects a Webex instance that differs from the one already bound to the shared SDK connector. `prepareForReuse()` rechecks backend readiness without making a network request and registers any missing Webex Calling listeners. It returns false when the client has been disposed or existing listeners no longer match the detected backend; the caller must replace the client instead. Repeated calls do not register duplicate listeners. Successful preparation clears cached queue state and names and invalidates in-flight responses and event refreshes from the prior lifecycle. A superseded API call returns 409; if an update was already sent, it may have completed server-side, so consumers must refresh before deciding whether to retry.

`lineOwnerId` must match `^[A-Za-z0-9_-]{1,128}$`. Cached agent status is scoped to its line. Public API queue IDs may be encoded Webex IDs while Mercury can carry UUIDs; comparisons normalize the IDs while retaining the public ID. Raw UUIDs supplied in membership updates are encoded as `CALL_QUEUE` Webex IDs. Before setting a queue to `available: false`, the client loads the line's settings if it does not already know the queue's `allowLogOffEnabled` value. A queue with `allowLogOffEnabled: false` cannot be changed to `available: false`. Empty or non-array `queues` updates and invalid update request objects are rejected before sending a request.

ACD values are `SIGN_IN`, `SIGN_OUT`, `AVAILABLE`, `UNAVAILABLE`, and `WRAP_UP`. Mercury camelCase values (`signIn`, `wrapUp`) map onto those names. Mercury `joinInfo` entries carry `queueId` and joined/unjoined/unassigned status; sync events replace the queue list while join events merge or remove entries. Actor IDs scope changes to the primary user or a secondary virtual line. Queue availability may be absent and must not be treated as a known false value. If an initial response omits agent status, the client returns an error rather than inventing a signed-out state. When a 204 update has no cached state, the client reloads settings before returning a snapshot.

A REST settings response with an array containing queue records without IDs is rejected rather than interpreted as a partial or empty list. Omitted or non-array queues retain the previously cached list as before, and an explicit empty array remains valid. If a successful update returns an invalid queue array, the client reloads settings before returning a snapshot; if the reload fails, the update may already have been applied and the caller should refresh before retrying.

When a Mercury event includes both queue records and `joinInfo`, retain metadata from the incoming records while applying membership from `joinInfo`; use previously known metadata for joined queues absent from the incoming records. Match raw and encoded queue IDs while preserving an existing public ID.

An explicit empty sync queue or `joinInfo` list clears the cached list. If a sync list contains invalid records, merge any valid queue records or membership updates without removing other cached queues; an entirely invalid list is ignored. A valid `joinInfo` list still determines membership independently, including removal of unassigned queues.

Do not log tokens or queue payloads. Unavailable reason codes are not part of this client.

When a queue request fails, diagnostic log upload is best-effort: an upload or metrics failure must not replace the original request error returned to the caller. Browser network errors may lack an HTTP status, so the shared error handler's fallback status does not necessarily represent a server response.

# Call queue agent status

Cloud Webex Calling only. `createCallQueueClient(webex, logger)` returns a client that:

- Chooses `https://integration.webexapis.com/v1` for Integration (including locally hosted clients configured with Integration U2C), `https://webexapis.com/v1` for commercial Production, and `https://api-usgov.webex.com/v1` for FedRAMP. Unknown or conflicting environment signals fail closed.
- Uses `GET`/`PUT /telephony/config/people/me/settings/queues` for the primary line and `GET`/`PUT /telephony/config/people/me/settings/secondaryLines/{lineOwnerId}/queues` for a secondary virtual line. Raw virtual-line UUIDs are encoded as `VIRTUAL_LINE` Webex IDs before constructing the public API URL.
- `GET`s `/telephony/config/queues` through the same environment-selected public API to fill a queue display name when agent settings omit it. Catalog access is optional and may be forbidden for some users. Pagination follows a same-origin `Link: ...; rel="next"` header, with a bounded fallback for body `paging.next`.
- `POST`s `/telephony/calls/sync/invoke` through the same public API with the registered `wdmUrl` and `resources: [{resource: 'telephony_agents'}]`. An Integration test returned HTTP 204; live Mercury event delivery and Production still require end-to-end verification.
- Listens for Mercury `event:telephony_agents.sync`, `.state`, and `.join`, as well as the legacy singular topic spellings.
- Emits `callQueue:updated` with `{ acdState, queues }`; virtual-line events also include `lineOwnerId`; exposes `dispose()` to remove its Mercury listeners when the client is replaced.

`lineOwnerId` must match `^[A-Za-z0-9_-]{1,128}$`. Cached agent status is scoped to its line. Public API queue IDs may be encoded Webex IDs while Mercury can carry UUIDs; comparisons normalize the IDs while retaining the public ID. Raw UUIDs supplied in membership updates are encoded as `CALL_QUEUE` Webex IDs. Before setting a queue to `available: false`, the client loads the line's settings if it does not already know the queue's `allowLogOffEnabled` value. A queue with `allowLogOffEnabled: false` cannot be changed to `available: false`. Empty `queues` updates are rejected.

ACD values are `SIGN_IN`, `SIGN_OUT`, `AVAILABLE`, `UNAVAILABLE`, and `WRAP_UP`. Mercury camelCase values (`signIn`, `wrapUp`) map onto those names. Mercury `joinInfo` entries carry `queueId` and joined/unjoined/unassigned status; sync events replace the queue list while join events merge or remove entries. Actor IDs scope changes to the primary user or a secondary virtual line. Queue availability may be absent and must not be treated as a known false value. If an initial response omits agent status, the client returns an error rather than inventing a signed-out state. When a 204 update has no cached state, the client reloads settings before returning a snapshot.

Do not log tokens or queue payloads. Unavailable reason codes are not part of this client.

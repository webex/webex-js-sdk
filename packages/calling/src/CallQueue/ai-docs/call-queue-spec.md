# Call queue agent status

Cloud Webex Calling only. `createCallQueueClient(webex, logger)` returns a client that:

- uses the Integration Calling Subscriber Gateway base (`https://int-first-calling.svc.webex.com/calling-subscriber-gateway/api/v1`) when Integration is detected, otherwise the default production base (`https://calling-subscriber-gateway-a.wbx2.com/api/v1`), for `GET`/`PATCH /users/me/settings/queues`
- uses the same environment-selected gateway for `/users/me/settings/secondarylines/{lineOwnerId}/queues` when a line id is passed; `services.discovery.callingGateway` can override the base for a different region
- `GET`s `/v1/telephony/config/queues` through Hydra to fill a queue display name when agent settings omit it
- `POST`s `/v1/telephony/calls/sync/invoke` through Hydra with the full registered `wdmUrl` and `resources: [{resource: 'telephony_agents'}]`
- listens for Mercury `event:telephony_agents.sync`, `.state`, and `.join`, as well as the legacy singular topic spellings
- emits `callQueue:updated` with `{ acdState, queues }`; virtual-line events also include `lineOwnerId`
- exposes `dispose()` to remove its Mercury listeners when the client is replaced

The settings routes are sent to Calling Subscriber Gateway. The queue catalog and sync routes use Hydra service discovery.

`lineOwnerId` must match `^[A-Za-z0-9_-]{1,128}$`. Cached agent status is scoped to its line. Before patching a queue to `available: false`, the client loads that line's settings if it does not already know the queue's `allowLogOffEnabled` value. A queue with `allowLogOffEnabled: false` cannot be patched to `available: false`. Empty `queues` updates are rejected.

ACD values are `SIGN_IN`, `SIGN_OUT`, `AVAILABLE`, `UNAVAILABLE`, and `WRAP_UP`. Mercury camelCase values (`signIn`, `wrapUp`) map onto those names. Mercury `joinInfo` entries carry `queueId` and joined/unjoined/unassigned status; sync events replace the queue list while join events merge or remove entries. Actor IDs scope changes to the primary user or a secondary virtual line. Queue availability may be absent in a CSG response and must not be treated as a known false value. If an initial response omits agent status, the client returns an error rather than inventing a signed-out state. When a 204 update has no cached state, the client reloads settings before returning a snapshot.

Do not log tokens or queue payloads. Unavailable reason codes are not part of this client.

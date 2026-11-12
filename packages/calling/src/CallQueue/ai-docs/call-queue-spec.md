# Call queue agent status

Cloud Webex Calling only. `createCallQueueClient(webex, logger)` returns a client that:

- uses the Integration API base (`https://integration.webexapis.com`) when the registered device URL contains `-int`, otherwise the production API base (`https://webexapis.com`), for `GET`/`PATCH /v1/telephony/config/people/me/settings/queues`
- uses the same environment-selected API base for `/v1/telephony/config/people/me/settings/secondarylines/{lineOwnerId}/queues` when a line id is passed
- `GET`s `/v1/telephony/config/queues` through Hydra to fill a queue display name when agent settings omit it
- `POST`s `/v1/telephony/calls/sync/invoke` through Hydra with `{ wdmDeviceId }` taken from the registered Webex device
- listens for Mercury `event:telephony_agent.sync`, `event:telephony_agent.state`, and `event:telephony_agent.join`
- emits `callQueue:updated` with `{ acdState, queues }`

The settings routes are sent to the public Webex API gateway, which routes `/v1/telephony/config/people/me/**` to Calling Subscriber Gateway. The queue catalog and sync routes are not part of that CSG route mapping.

`lineOwnerId` must match `^[A-Za-z0-9_-]{1,128}$`. Cached agent status is scoped to its line. Before patching a queue to `available: false`, the client loads that line's settings if it does not already know the queue's `allowLogOffEnabled` value. A queue with `allowLogOffEnabled: false` cannot be patched to `available: false`. Empty `queues` updates are rejected.

ACD values are `SIGN_IN`, `SIGN_OUT`, `AVAILABLE`, `UNAVAILABLE`, and `WRAP_UP`. Mercury camelCase values (`signIn`, `wrapUp`) map onto those names. A sync event replaces the queue list. A state or join event merges queues by id.

Do not log tokens or queue payloads. Unavailable reason codes are not part of this client.

# Call queue agent status

Cloud Webex Calling only. `createCallQueueClient(webex, logger)` returns a client that:

- `GET`s and `PATCH`es `/v1/telephony/config/people/me/settings/queues`
- `GET`s `/v1/telephony/config/queues` to fill a queue display name when agent settings omit it
- uses `/v1/telephony/config/people/me/settings/secondarylines/{lineOwnerId}/queues` when a line id is passed
- `POST`s `/v1/telephony/calls/sync/invoke` with `{ wdmDeviceId }` taken from the registered Webex device
- listens for Mercury `event:telephony_agent.sync`, `event:telephony_agent.state`, and `event:telephony_agent.join`
- emits `callQueue:updated` with `{ acdState, queues }`

`lineOwnerId` must match `^[A-Za-z0-9_-]{1,128}$`. Cached agent status is scoped to its line. Before patching a queue to `available: false`, the client loads that line's settings if it does not already know the queue's `allowLogOffEnabled` value. A queue with `allowLogOffEnabled: false` cannot be patched to `available: false`. Empty `queues` updates are rejected.

ACD values are `SIGN_IN`, `SIGN_OUT`, `AVAILABLE`, `UNAVAILABLE`, and `WRAP_UP`. Mercury camelCase values (`signIn`, `wrapUp`) map onto those names. A sync event replaces the queue list. A state or join event merges queues by id.

Do not log tokens or queue payloads. Unavailable reason codes are not part of this client.

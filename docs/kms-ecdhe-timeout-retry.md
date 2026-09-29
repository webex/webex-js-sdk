# KMS ECDHE Timeout Retry Issue

## Problem

KMS requests retry with an exponentially increasing timeout. The default values are:

- `kmsInitialTimeout`: 6 seconds
- `kmsMaxTimeout`: 32 seconds
- `ecdhMaxTimeout`: 96 seconds

After a timeout, `KMS.request()` doubles the timeout and rejects when it reaches
`ecdhMaxTimeout`. It is intended to delete the cached ECDHE context and negotiate a new
one after reaching `kmsMaxTimeout`:

```js
const nextTimeout = timeout * 2;

if (timeout >= kmsMaxTimeout && nextTimeout < ecdhMaxTimeout) {
  contexts.delete(this);
  timeout = 0;
}
```

With the default values, requests follow this sequence:

| Attempt | Attempt timeout | Value after failure | Result |
| --- | ---: | ---: | --- |
| 1 | 6s | 12s | Retry with existing ECDHE context |
| 2 | 12s | 24s | Retry with existing ECDHE context |
| 3 | 24s | 48s | `nextTimeout` is 96s, so `96 < 96` is false |
| 4 | 48s | 96s | Request is rejected before another attempt |

The ECDHE renegotiation branch is therefore unreachable with the default configuration.
Every retry uses the same cached ECDHE key. If KMS can no longer decrypt that session,
new request IDs and longer timeouts cannot recover it.

Changing `<` to `<=` is insufficient because the current code does not record whether
renegotiation has already occurred. Resetting the timeout without that state could create
an unlimited retry cycle.

## Proposed Solution

Model retries as two explicit, bounded phases:

1. Retry with the existing ECDHE context up to the normal KMS retry threshold.
2. Delete the cached context and negotiate a fresh ECDHE context exactly once.
3. Retry the original request with a separate bounded timeout or attempt budget.
4. Reject after that budget is exhausted.

Carry an internal flag such as `ecdhRenegotiated` through recursive `request()` calls.
Only clear `contexts` when the flag is false, then set it to true for all subsequent
attempts. This makes recovery possible while guaranteeing termination.

Tests should verify that a simulated timeout:

- reuses the original context before the normal threshold;
- negotiates one new context after the threshold;
- succeeds when the post-renegotiation attempt receives a response; and
- rejects without negotiating repeatedly when the final budget is exhausted.
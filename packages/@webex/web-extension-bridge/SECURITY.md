# Security policy — @webex/web-extension-bridge

This package sits on a trust boundary: it carries messages from an untrusted web page into
a privileged browser extension and back. Security reports are treated as the highest
priority work on it.

## Reporting a vulnerability

Please do **not** open a public GitHub issue, pull request or discussion for a suspected
vulnerability.

| Channel | Use for |
| --- | --- |
| [psirt@cisco.com](mailto:psirt@cisco.com) — Cisco Product Security Incident Response Team | Any suspected vulnerability. This is the authoritative channel and follows the [Cisco Security Vulnerability Policy](https://sec.cloudapps.cisco.com/security/center/resources/security_vulnerability_policy.html). |
| [devsupport@webex.com](mailto:devsupport@webex.com) | Questions about whether a behaviour is a vulnerability or an [accepted risk](README.md#explicitly-accepted-risks). |

Include, as far as you can: affected version, browser and extension version, a minimal
reproduction (a page plus an extension is ideal), the impact you believe it has, and
whether the issue is already public.

## What to expect

| Stage | Target |
| --- | --- |
| Acknowledgement of your report | 3 business days |
| Initial triage, severity assessment and whether we accept it as a vulnerability | 10 business days |
| Fix or documented mitigation for critical and high severity | 30 days from triage |
| Fix or documented mitigation for medium and low severity | Next scheduled release |
| Public disclosure | Coordinated with you, normally once a fixed version is published |

Cisco follows coordinated disclosure. We will keep you updated as triage progresses and
will credit you in the release notes if you would like to be credited.

## Supported versions

Security fixes land on the latest minor of the current major version. Older majors are not
patched; upgrade to receive fixes. The wire protocol is versioned independently of the
package (see [README](README.md#8-browser-support-versioning-and-compatibility)), and both
halves of a bridge must run the same protocol version.

## In scope

- Bypassing the origin allow-list, the `event.source === window` check, or the session
  token binding on either side of the page ↔ content-script hop.
- Reaching the service worker, or any privileged `chrome.*` capability, from page script
  through the relay.
- Accepting a forged, replayed or cross-channel envelope: guessed `correlationId`,
  reused message id, stale timestamp, mismatched channel, or a spoofed `sender`.
- Leaking payloads, session tokens, stack traces or handler error text across a boundary,
  including through logs or counters.
- Prototype pollution via envelope or payload keys.
- Unbounded resource growth: buffers, listener sets, seen-id caches, in-flight maps, or a
  bypass of the payload-size, rate-limit or in-flight caps.
- A request that never settles, or settles more than once.

## Out of scope

These are documented, deliberate limits rather than defects. They are explained in full in
[README §6](README.md#explicitly-accepted-risks).

- Cross-site scripting **in the host page** being able to call `publish()`, invoke your
  registered handlers, or observe bridge traffic. All same-origin page scripts share one
  JavaScript world; the SDK cannot create a confidentiality boundary inside it.
- Another installed extension that the user has granted host permissions on the same
  origin speaking the protocol.
- A push being lost while the MV3 service worker is spinning up. Push is best-effort by
  design; the pull path is the correctness guarantee.
- The absence of envelope signing. This is a
  [deliberate decision](README.md#why-there-is-no-message-signing), not an oversight —
  any key page script can reach, injected script can reach too.
- Findings that only apply to the samples under `docs/samples/`, which allow-list a
  localhost dev origin and generate their manifest with a "local testing only" banner.
- Missing hardening in a consumer's own manifest, CSP or handler validation. See the
  [before-you-ship checklist](README.md#7-before-you-ship).

## For contributors

Every threat in the intake threat model has a named regression test in
`test/unit/spec/security/threats.ts`. A new threat needs a new failing test before its fix
is accepted, and that suite must never be skipped. Changes that relax a validation rule,
widen an allow-list, add an HTML sink, weaken a bound, or introduce a runtime dependency
require an explicit reviewer note justifying them.

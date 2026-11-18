---
type: ADR
title: ADR-0001 - Keep the existing package docs separate
description: SDD onboarding keeps README.md and NODE-OAUTH-FLOW-GUIDE.md as context-only documents and writes the module specification from code.
tags: [adr]
timestamp: 2026-11-11T08:35:47Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-11T09:32:15Z
validation_status: pass-with-warnings
-->

# ADR-0001 - Keep the existing package docs separate

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-11-11 |
| Deciders      | rarajes2@cisco.com (bootstrap questionnaire) |
| Supersedes    | N/A |
| Superseded by | N/A |

## Context

Onboarding found two existing documents in this package. `README.md` is the npm page, with a usage
example and a method and property reference. `NODE-OAUTH-FLOW-GUIDE.md` is a technical guide that
covers Node initialization, flow types, the code exchange, server-side token management, refresh,
and SDK events. Much of the guide describes behavior owned by other packages or by the host
application. No other intent, design, or AI-authored spec exists in the package.

Checking both against `src/` and `test/` found these differences, with code as the referee:

| Document claim | Code and test behavior | Evidence |
| -------------- | ---------------------- | -------- |
| README: the usage example configures only `client_id` and `client_secret` | The code grant also sends `credentials.redirect_uri`, which must match the URI used to obtain the code | `src/authorization.js` |
| README: `logout(options)` "Logs out the current user", `options.token` optional | `logout` posts `{token, cisService}` to the logout URL and returns `undefined` without waiting; `WebexCore#logout` supplies `token` | `src/authorization.js` |
| README: `createJwt` lists `expiresIn` as an option | Omitting `expiresIn` rejects, because `jsonwebtoken` 9 rejects an undefined `expiresIn` option; a missing `secretId` throws synchronously | `src/authorization.js`, `package.json` |
| README: the method list has no error behavior | An HTTP 400 on the code grant rejects with a grant-error class; other failures pass through | `src/authorization.js` |
| Guide §1.1: `clientType` is `'confidential'` by default for Node.js (§1.2 adds that the flow defaults to the authorization-code grant) | `src/config.js` sets no `clientType`, and nothing in this package reads it; the code grant is the only login flow here | `src/config.js`, `src/authorization.js` |
| Guide §2.3: a client-credentials flow | Not in this package; client tokens belong to webex-core credentials | `src/authorization.js` |
| Guide §3.1: state validation for CSRF protection | This package receives only `code`; any `state` check is the host's | `src/authorization.js` |
| Guide §3.2: `client_id` and `client_secret` are parameters of the POST | They are sent as HTTP Basic credentials; the form also carries `self_contained_token: true` | `src/authorization.js` |
| Guide §4: secure token storage, user association, encryption, supertoken metadata, and token validation | None of these is in this package; the response body is handed to webex-core credentials as is | `src/authorization.js` |
| Guide §5: expiration monitoring, refresh, and "JWT refresh implementation in Node.js authorization plugin" | Refresh is owned by webex-core credentials, which calls this plugin's `requestAccessTokenFromJwt` in JWT mode; this plugin has no refresh logic | `src/authorization.js` |
| Guide §6.2: events `unauthorized`, `token:refresh`, and `auth:error` | This package triggers no custom event (only the ampersand property-change events `change:isAuthorizing` and `change:isAuthenticating`), and no such event exists in the sibling webex-core source | `src/authorization.js` |
| Guide §6.1: configuration validation of client credentials during initialization | Nothing validates credentials at initialization; a missing `client_id` fails the first code grant before anything is sent, and a wrong secret surfaces as the broker's error on the first code grant (a grant error when it is HTTP 400) | `src/authorization.js` |

The guide's description of the authorization-code grant as the primary Node flow (§2.1), the JWT
exchange (§2.2), and the token response fields (§3.3) match the code.

## Decision

Keep `README.md` and `NODE-OAUTH-FLOW-GUIDE.md` unchanged. Do not migrate or reconcile them into the
module specification. Record `spec_source_policy.mode` as `keep-separate` with
`migrated_source_disposition` `retain`, and route both files in `spec_sources` as `reference-only`,
`canonical: false`, `use_by_agents: context-only`.

The canonical behavior is `src/` plus `test/`, described in `src/docs/README.md`. Where either document
is silent or disagrees, code wins. The differences that affect callers of this package are recorded in
the module specification's Pitfalls and constraints. Claims about features that do not exist here
(the client-credentials flow, credential validation at initialization, and the guide's events) are
listed only in this ADR.

## Why

The developer chose to keep both documents separate from the SDD tree. The README is the npm-facing
page, and the guide spans behavior owned by webex-core and by host applications. Rewriting either is a
product-doc change, not a requirement of making the package SDD-ready. The same choice was made for
the sibling browser authorization package.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Reconcile both documents into `src/docs/README.md`, marking stale units | Not selected by the developer; the module spec is written from code and lists the differences instead |
| Migrate both documents into the module spec as source text | Many claims are stale or belong to webex-core, and the README stays the npm page |
| Correct the documents during onboarding | Onboarding writes the SDD tree only and does not edit existing documents |

## Consequences

**Positive:**

- The npm page and the guide stay stable for their readers.
- The module specification is the single behavioral reference for this package.

**Negative / tradeoffs:**

- Agents must not treat `README.md` or `NODE-OAUTH-FLOW-GUIDE.md` as the method, event, error, or
  refresh reference.
- The stale claims stay until a maintainer makes a separate product-doc change.

## Constraint on future changes

Do not delete either document as part of spec maintenance. When behavior changes, keep the module
specification aligned with code, not with these documents.

## Follow-up

- [ ] Optional product-doc change: align `README.md` and `NODE-OAUTH-FLOW-GUIDE.md` with the
  differences listed above.

## Revisit when

- A maintainer chooses to make either document match the code, or to make the module specification
  the published reference.

## References

- `README.md`
- `NODE-OAUTH-FLOW-GUIDE.md`
- `src/index.js`
- `src/authorization.js`
- `src/config.js`
- `.sdd/manifest.json` `spec_source_policy`

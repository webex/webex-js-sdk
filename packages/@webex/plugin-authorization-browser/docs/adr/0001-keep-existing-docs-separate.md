---
type: ADR
title: ADR-0001 - Keep the existing package docs separate
description: SDD onboarding keeps README.md and BROWSER-OAUTH-FLOW-GUIDE.md as context-only documents and writes the module specification from code.
tags: [adr]
timestamp: 2026-11-04T06:35:39Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-04T08:54:29Z
validation_status: pass-with-warnings
-->

# ADR-0001 - Keep the existing package docs separate

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-11-04 |
| Deciders      | rarajes2@cisco.com (bootstrap questionnaire) |
| Supersedes    | N/A |
| Superseded by | N/A |

## Context

Onboarding found two existing documents in this package. `README.md` is the npm page, with usage
examples, a method and property reference, and error-handling notes. `BROWSER-OAUTH-FLOW-GUIDE.md` is
a technical guide that covers browser initialization, flow selection, CSRF handling, token parsing,
JWT login, refresh, and SDK events. Parts of the guide describe behavior owned by other packages. No
other intent, design, or AI-authored spec exists in the package.

Checking both against `src/` and `test/` found these differences, with code as the referee:

| Document claim | Code and test behavior | Evidence |
| -------------- | ---------------------- | -------- |
| README: a redirect OAuth error is caught as `error.name === 'OAuthError'` | `initialize` throws, but the unit test pins a `TypeError` "Cannot convert object to primitive value" instead of a grant-error instance | `src/authorization.js`, `test/unit/spec/authorization.js` |
| README: popup login through `initiateLogin({separateWindow})` | Works only for public clients; `initiateAuthorizationCodeGrant` ignores `separateWindow`, and `separateWindow` is also serialized into the authorize URL | `src/authorization.js`, `test/unit/spec/authorization.js` |
| README: the implicit-grant example calls `initiateImplicitGrant({state})` directly | Only `initiateLogin` adds the CSRF token; a direct call navigates without one | `src/authorization.js` |
| README: `createJwt` lists `expiresIn` as an option | Omitting `expiresIn` rejects, because `jsonwebtoken` 9 rejects an undefined `expiresIn` option | `src/authorization.js`, `package.json` |
| README: `webex.on('unauthorized')` under authentication status | That event belongs to webex-core, not this plugin | `src/authorization.js` |
| README: "Cross-browser compatibility" | No code or test in this package supports or tests a browser matrix | `src/authorization.js` |
| Guide §1.3 and §4.2: the code grant "exchanges code for tokens" and the code is "captured from URL" | `initialize` parses only the URL hash; a `?code=` query is ignored, and no code exchange exists in this package | `src/authorization.js`, `test/automation/fixtures/app.js` |
| Guide §1.5 and §3.3: the plugin parses the URL "for OAuth tokens/codes" | Only hash tokens are parsed | `src/authorization.js` |
| Guide §4.1: the hash carries `scope` | `scope` and any other hash key are passed to credentials and are not scrubbed from the URL | `src/authorization.js` |
| Guide §5.4: "JWT refresh implementation in browser authorization plugin" | webex-core credentials reads `jwtRefreshCallback` and then calls this plugin's `requestAccessTokenFromJwt`; this plugin has no refresh logic | `src/authorization.js` |
| Guide §1.3, §4.4, and §5.1-§5.3: refresh, token storage, and interceptors | Owned by webex-core credentials and storage; `src/config.js` supplies no `refreshCallback`, so a browser token refreshes only when the host provides one | `src/config.js`, `test/automation/fixtures/app.js` |
| Guide §6.2: `ready`, `unauthorized`, and `client:logout` events | Emitted by webex-core; this plugin only exposes its `ready` property and `change:ready` | `src/authorization.js` |

The guide's flow-selection (§1.2), CSRF generation and verification (§2.2, §3.4), redirection options
(§2.3, for public clients), and JWT login (§4.3) sections match the code.

## Decision

Keep `README.md` and `BROWSER-OAUTH-FLOW-GUIDE.md` unchanged. Do not migrate or reconcile them into
the module specification. Record `spec_source_policy.mode` as `keep-separate` with
`migrated_source_disposition` `retain`, and route both files in `spec_sources` as `reference-only`,
`canonical: false`, `use_by_agents: context-only`.

The canonical behavior is `src/` plus `test/`, described in `src/docs/README.md`. Where either document
is silent or disagrees, code wins. The differences above are recorded in the module specification's
Pitfalls and constraints.

## Why

The developer chose to keep both documents separate from the SDD tree. The README is the npm-facing
page, and the guide spans behavior owned by webex-core. Rewriting either is a product-doc change, not
a requirement of making the package SDD-ready.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Reconcile both documents into `src/docs/README.md`, marking stale units | Not selected by the developer; the module spec is written from code and lists the differences instead |
| Migrate both documents into the module spec as source text | Several claims are stale or belong to webex-core, and the README stays the npm page |
| Correct the documents during onboarding | Onboarding writes the SDD tree only and does not edit existing documents |

## Consequences

**Positive:**

- The npm page and the guide stay stable for their readers.
- The module specification is the single behavioral reference for this package.

**Negative / tradeoffs:**

- Agents must not treat `README.md` or `BROWSER-OAUTH-FLOW-GUIDE.md` as the method, event, error, or
  refresh reference.
- The stale claims stay until a maintainer makes a separate product-doc change.

## Constraint on future changes

Do not delete either document as part of spec maintenance. When behavior changes, keep the module
specification aligned with code, not with these documents.

## Follow-up

- [ ] Optional product-doc change: align `README.md` and `BROWSER-OAUTH-FLOW-GUIDE.md` with the
  differences listed above.

## Revisit when

- A maintainer chooses to make either document match the code, or to make the module specification
  the published reference.

## References

- `README.md`
- `BROWSER-OAUTH-FLOW-GUIDE.md`
- `src/index.js`
- `src/authorization.js`
- `src/config.js`
- `.sdd/manifest.json` `spec_source_policy`

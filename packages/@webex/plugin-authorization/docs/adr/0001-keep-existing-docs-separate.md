---
type: ADR
title: ADR-0001 - Keep the existing package docs separate
description: SDD onboarding keeps README.md and OAUTH-FLOW-GUIDE.md as context-only documents and writes the module specification from code.
tags: [adr]
timestamp: 2026-11-12T05:11:05Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T05:35:41Z
validation_status: pass
-->

# ADR-0001 - Keep the existing package docs separate

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-11-12 |
| Deciders      | rarajes2@cisco.com (bootstrap questionnaire) |
| Supersedes    | N/A |
| Superseded by | N/A |

## Context

Onboarding found two existing documents in this package. `README.md` is the npm page: install
command, a usage example, environment selection, client types and OAuth flows, and per-environment
method lists. `OAUTH-FLOW-GUIDE.md` is an overview that links the browser and Node flow guides of the
sibling packages and compares the two environments. Most of what both documents describe is
behavior of `@webex/plugin-authorization-node`, `@webex/plugin-authorization-browser`, or webex-core,
not of this package, whose `src/` holds two re-export files. No other intent, design, or AI-authored
spec exists in the package.

Checking both against this package's code and the sibling code they describe found these
differences, with code as the referee:

| Document claim | Code behavior | Evidence |
| -------------- | ------------- | -------- |
| README "Environment Detection": the package loads the browser plugin "when running in a browser context" and the Node plugin "when running in Node.js" | Selection happens when the module is resolved, through the `package.json` `browser` field. Node `require`, and any resolver that ignores the field, loads the Node plugin wherever it runs; webpack and browserify load the browser plugin | `package.json`, `src/index.js`, `src/index.browser.js` |
| Guide "Quick Environment Detection": the browser plugin is chosen by detecting the `window` object | No code checks `window`; the choice is the `browser` field mapping | `package.json` |
| README Node methods: `getClientToken(options)` obtains a client token; client-credentials grant "Only available in Node.js SDK via getClientToken()" | Neither authorization plugin defines `getClientToken`. It is a webex-core credentials method, `webex.credentials.getClientToken`, and nothing in this package restricts it to Node | `src/index.js`, `src/index.browser.js`; sibling webex-core file src/lib/credentials/credentials.js |
| README usage example: `redirect_uri` is commented "Only for browser environments" | The Node plugin's code grant also sends `credentials.redirect_uri` (recorded in the Node plugin's ADR-0001) | `src/index.js`; sibling plugin-authorization-node file src/authorization.js |
| README browser features: "support for redirects, popups" | Only `initiateImplicitGrant` opens a separate window (`options.separateWindow`); `initiateAuthorizationCodeGrant` always redirects the current window | `src/index.browser.js`; sibling plugin-authorization-browser file src/authorization.js |
| Guide "Code References": this package is the "Main Authorization Plugin" | This package contains no plugin; it re-exports one of the two sibling plugins | `src/index.js`, `src/index.browser.js` |
| Guide browser features: "Browser storage adapters for token persistence"; Node features: "Database/file storage for token persistence" | Neither authorization plugin stores tokens; both hand them to webex-core credentials. The browser plugin's `package.json` lists storage adapters, but its `src/` does not import them | sibling plugin-authorization-browser files src/authorization.js and package.json; sibling plugin-authorization-node file src/docs/README.md |
| Guide common steps: "Token Refresh: Automatically refresh expired tokens" | Refresh is owned by webex-core credentials, not by either plugin or this package | sibling plugin-authorization-node file src/docs/README.md |

These parts match the code: the browser defaults to the implicit grant (`clientType: 'public'`) and
uses the authorization-code grant only when `clientType` is `'confidential'`; `initiateLogin` chooses
between them; the browser keeps its CSRF token in `sessionStorage`; the Node primary flow is the
authorization-code exchange plus JWT login; both plugins expose `requestAccessTokenFromJwt`,
`createJwt`, `logout`, `isAuthorizing`, and `isAuthenticating`; and the linked browser and Node guides
exist at the paths the documents name.

## Decision

Keep `README.md` and `OAUTH-FLOW-GUIDE.md` unchanged. Do not migrate or reconcile them into the module
specification. Record `spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition`
`retain`, and route both files in `spec_sources` as `reference-only`, `canonical: false`,
`use_by_agents: context-only`.

The canonical behavior of this package is `src/` plus `package.json`, described in
`src/docs/README.md`. Where either document is silent or disagrees, code wins. Differences that
affect callers of this package, the resolution-time selection and the misplaced `getClientToken`,
are also recorded in the module specification's Pitfalls and constraints. Claims about sibling
behavior are listed only in this ADR; the sibling packages own those facts.

## Why

The developer chose to keep both documents separate from the SDD tree. The README is the npm-facing
page, and the guide is a cross-package overview whose detail belongs to the browser and Node
packages and to webex-core. Rewriting either is a product-doc change, not a requirement of making
the package SDD-ready. The same choice was made for the sibling Node authorization package.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Reconcile both documents into `src/docs/README.md`, marking stale units | Not selected by the developer; most units describe sibling packages, which this module spec must not restate |
| Migrate both documents into the module spec as source text | The README stays the npm page, and the guide's content is owned by other packages |
| Correct the documents during onboarding | Onboarding writes the SDD tree only and does not edit existing documents |

## Consequences

**Positive:**

- The npm page and the overview stay stable for their readers.
- The module specification is the single behavioral reference for this package.

**Negative / tradeoffs:**

- Agents must not treat `README.md` or `OAUTH-FLOW-GUIDE.md` as the reference for how the
  implementation is selected or which methods exist in each environment.
- The stale claims stay until a maintainer makes a separate product-doc change.

## Constraint on future changes

Do not delete either document as part of spec maintenance. When behavior changes, keep the module
specification aligned with code, not with these documents.

## Follow-up

- [ ] Optional product-doc change: align `README.md` and `OAUTH-FLOW-GUIDE.md` with the differences
  listed above.

## Revisit when

- A maintainer chooses to make either document match the code, or to make the module specification
  the published reference.

## References

- `README.md`
- `OAUTH-FLOW-GUIDE.md`
- `src/index.js`
- `src/index.browser.js`
- `package.json`
- `.sdd/manifest.json` `spec_source_policy`

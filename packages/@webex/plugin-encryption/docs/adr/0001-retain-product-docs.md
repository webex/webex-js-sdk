---
type: ADR
title: ADR-0001 - Retain the product docs
description: SDD onboarding keeps README.md and developer-quickstart.md as product documentation and routes them only as context.
tags: [adr]
timestamp: 2026-11-16T06:56:00Z
status: accepted
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: adr@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-16T07:57:20Z
validation_status: pass
-->

# ADR-0001 - Retain the product docs

| Field         | Value |
| ------------- | ----- |
| Status        | Accepted |
| Decision date | 2026-11-16 |
| Deciders      | rarajes2@cisco.com (chosen in chat during onboarding) |
| Supersedes    | N/A |
| Superseded by | N/A |

## Context

Onboarding found two existing documents. `README.md` is the npm page: install and CDN snippets, a
pointer to the API reference, a "KMS certificate validation" section, links to the API docs and the
hosted sample app, sample code for `register`, `downloadAndDecryptFile`, and `deregister`, and a short
Development section. `developer-quickstart.md` guides a developer through the encryption sample app
in the workspace (token, init and register, decrypt and save a file). No other intent, design, or
AI-authored spec exists in this package.

Checked against code at onboarding:

| Document content | Code |
| ---------------- | ---- |
| `import Webex from '@webex/plugin-encryption'`, `Webex.init`, `webex.cypher.register()`, `downloadAndDecryptFile(attachmentURL, options)`, `deregister()` | Agree with `src/webex.js` and `src/cypher/index.ts` |
| The CDN bundle `webex/umd/encryption.min.js` | Built by the workspace from `src/webex.js` |
| "KMS certificate validation": the `config.encryption` fields `shouldValidateKMSCertificate`, `caroots`, `reportOnlyAssetsBaseUrl`, and `carootsReportOnly` | Owned and read by `@webex/internal-plugin-encryption`; this package passes the config through unchanged |
| Development: files in a `src/@webex/plugin-encryption` folder are compiled and served as `encryption.js` | No such folder exists; the workspace webpack builds the bundle from `src/webex.js` |
| Quickstart: a token with the `spark:kms` scope; register after `ready`; build the file from the returned buffer | Agree with the code; the build steps are workspace scripts |

## Decision

Keep `README.md` and `developer-quickstart.md` unchanged. Do not migrate them into the module
specification. Record `spec_source_policy.mode` as `keep-separate` with `migrated_source_disposition`
`retain`, and route both in `spec_sources` as `reference-only` and `context-only`.

The canonical behavior is `src/` plus `test/`. The module specification follows code.

## Why

The README is the npm-facing page and the quickstart serves the sample app; both are written for
application developers and agree with the code on this package's API. The module specification
restates that behavior from code with requirement IDs, so nothing is lost by leaving the documents
where their readers look. The certificate-validation section documents another package's
configuration and is specified there. The developer chose `keep-separate` in chat, the same choice as
the other onboarded packages in this workspace.

## Alternatives considered

| Alternative | Why it was not selected |
| ----------- | ----------------------- |
| Migrate both documents into `src/docs/README.md` and delete them | The npm page and the sample-app guide would lose their user documentation; deletion was not requested |
| Reconcile them with the module specification | It would copy application-facing wording into the specification for no behavioral gain; the developer chose `keep-separate` |
| Rewrite the README during onboarding | Onboarding writes the SDD tree only and does not edit product documents |

## Consequences

**Positive:**

- The npm page and the sample-app guide stay stable.
- The module specification is the single behavioral reference for agents.

**Negative / tradeoffs:**

- The README sample code and the module specification describe the same API and can drift; an API
  change must update both.
- The wrong Development folder path and the certificate-validation section stay until a maintainer
  edits the README.

## Constraint on future changes

Do not delete either document as part of spec maintenance. When the `webex.cypher` API changes, update
the module specification from code and check the README sample code and the quickstart in the same
change.

## Follow-up

- [ ] A maintainer may correct the Development section's folder path and point the certificate
  section at the internal encryption plugin, in a separate product-doc change.

## Revisit when

- A maintainer rewrites the README or the quickstart, or the sample app moves.

## References

- `README.md`
- `developer-quickstart.md`
- `src/webex.js`
- `src/cypher/index.ts`
- `.sdd/manifest.json` `spec_source_policy`

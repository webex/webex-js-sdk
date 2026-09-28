---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/helper-image.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-opus-5
approved_by: rarajes2@cisco.com
updated_at: 2026-09-28T14:57:53Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/helper-image**. This package is a workspace member of the Webex JavaScript
SDK, so every command runs from the workspace root through `yarn workspace`, not from the package
directory.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node | `>=18`, declared in `package.json`. The enclosing workspace pins a newer line through its own Node version file, so prefer the workspace's pinned version when the two differ. |
| Yarn | Yarn workspaces are required, because this package's sibling dependencies use the `workspace:*` protocol in `package.json`. The version is pinned by the enclosing workspace. |
| GraphicsMagick or ImageMagick | Needed only to exercise the Node thumbnail path in `src/process-image.js` at runtime. Not needed to build or to run this package's own tests, because the active unit cases do not reach that path. Its absence is handled: `processImage` logs a warning and resolves undefined. |
| Chrome and Firefox | Needed only for the browser test runner, which `@webex/legacy-tools` defaults to those two browsers. |
| Registry access | None beyond the public npm registry. This package resolves no dependency from an authenticated registry. |

## Install

```bash
yarn install
```

Run it once from the workspace root. It installs this package's dependencies together with the
workspace siblings it depends on.

## Build

```bash
yarn workspace @webex/helper-image build
```

This transpiles `src/` into `dist/` through `@webex/legacy-tools`. There is no separate compile or
typecheck step: the sources are JavaScript, `package.json` declares no typecheck target, and the
build produces the published artifact without running tests.

## Run

This package is a library with no runnable entry point, so there is no run command. To exercise it,
import it from a consuming package or run the tests below.

## Tests

```bash
yarn workspace @webex/helper-image test:unit
```

Do not run the package's aggregate `test` script, `yarn workspace @webex/helper-image test`. It chains
`yarn test:integration`, which `package.json` does not define, so it fails before reaching the browser
tier. It is recorded in the manifest because the script genuinely exists, but no workflow should select
it. Run the tiers below individually.

Use the table as the repository-level test router. List only tiers that
actually exist; behavioral intent belongs in the owning module specifications and exact
cases remain in the repository's native test sources.

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit, Node runner | `yarn workspace @webex/helper-image test:unit` | `test/unit/spec` | Mocha with `@webex/test-helper-chai` assertions and Sinon stubs, run by `@webex/legacy-tools` | None |
| Unit, browser runner | `yarn workspace @webex/helper-image test:browser` | `test/unit/spec` | The same specs under Karma in a real browser, the only runner that executes the `browserOnly` cases | Chrome and Firefox, the runner's defaults, plus the fixture server that serves the test image |
| Integration | None | Not applicable | Not applicable | Not applicable |
| System / E2E | None | Not applicable | Not applicable | Not applicable |

This package has one test suite and two runners for it, not two suites. There is no integration or
end-to-end directory, and the browser runner is deliberately not recorded as an integration tier: it
executes the same spec file, so labelling it one would misdescribe the suite. The manifest records it
as the `browser-test` command and names it inside the unit tier's framework description, which is why
`tests` declares only `unit`.

Both tiers execute the same file, `test/unit/spec/index.js`. The runner matters: the suite gates cases
with `browserOnly` and `nodeOnly`, so the `updateImageOrientation` cases execute only under the
browser runner. Running just `test:unit` therefore leaves part of the suite unexecuted.

- Coverage or quality gate: none. No coverage threshold applies to this package; `package.json`
  declares no coverage script, and the inherited Jest configuration disables coverage collection.
  This was confirmed by the package owner rather than inferred.
- Enforcement source: not applicable, as no gate exists.
- Test environment or QA dependencies: none beyond a local browser for the browser runner.

`jest.config.js` is present and its inherited test-match pattern would select
`test/unit/spec/index.js`, but no script in `package.json` invokes Jest. The runners actually used are
Mocha and Karma, through `@webex/legacy-tools`.

## Configuration and secrets

- Required configuration: none. The package reads no environment variables and loads no config file.
- Secret source: not applicable; the package handles no credentials.
- Package or artifact access: the public npm registry only; no authentication is required to install.
- Required neighboring repositories or workspace layout: this package must be built inside the SDK
  workspace, because `package.json` resolves `@webex/http-core` and the test helpers through the
  `workspace:*` protocol. Its dependencies are built before it in the workspace's topological order.
- Platform, simulator, device, or SDK setup: install a local Chrome and Firefox for the browser
  runner. Install GraphicsMagick or ImageMagick only when exercising the Node thumbnail path.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn install` from the workspace root.
2. Run `yarn workspace @webex/helper-image build` and confirm `dist/` is produced.
3. Run `yarn workspace @webex/helper-image test:unit`.

Expected result: the build writes transpiled output to `dist/`, and the unit run reports the `orient()`
suite passing across all eight EXIF orientation values. The `readExifData` cases are reported as
pending, because they are disabled with `xdescribe` in `test/unit/spec/index.js`, and the
`updateImageOrientation` cases do not appear at all under the Mocha runner because they are gated to
the browser.

## Next steps

- [Repository architecture](architecture.md)
- Service specification — not applicable; this package has no deployable service
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
- [Module specification for `src/`](../src/docs/README.md)

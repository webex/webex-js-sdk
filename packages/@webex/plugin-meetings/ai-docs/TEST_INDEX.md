<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: test-index@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-18T15:33:39Z
validation_status: not-run
-->
# TEST INDEX — @webex/plugin-meetings

## Test Surface

| Tier | Command | What it covers |
|---|---|---|
| unit | `yarn workspace @webex/plugin-meetings test:unit` | source-mirrored behavior with Mocha/Sinon/test helpers |
| targeted unit | `yarn workspace @webex/plugin-meetings test:unit --targets meeting/brbState.ts` | one file/area relative to `test/unit/spec/` |
| browser/integration | `yarn workspace @webex/plugin-meetings test:browser` | browser/media/service integration through Karma |
| lint | `yarn workspace @webex/plugin-meetings test:style` | source style/static lint |
| build/type | `yarn workspace @webex/plugin-meetings build:src` | transpilation and TypeScript declarations |

## Where the Cases Live

Source paths under `src/{area}/` mirror unit tests under `test/unit/spec/{area}/`. Core areas with broad suites include `meeting`, `meetings`, `locus-info`, `members`, `media`, `multistream`, `breakouts`, `reachability`, `roap`, and interceptors. Feature areas have owning test directories when current behavior is covered.

When adding tests, follow the existing file's style, use Sinon and `@webex/test-helper-chai`, prefer `calledOnceWithExactly`, use fake timers for timer/retry behavior, and parameterize more than three similar cases.

## Coverage / Quality Gate

No package-specific numeric coverage or static-analysis threshold exists by repository-owner confirmation. This does not waive tests: behavior changes need focused positive/negative/cleanup coverage, package build, and lint proportional to risk. `.sdd/manifest.json` coverage describes documentation trust, not code-test percentage.

Plugin unit tests are slow. Use the smallest `--targets` value. The retained package rule permits temporary Mocha `.only` for a focused run, but every `.only` must be removed before completion.

## QA Dependencies & Environments

- Unit tests mock Webex/core/media dependencies and should not require production credentials.
- Browser/integration tests may require browser WebRTC, media permissions, Webex test users, remote services, and managed environment values.
- Node 22.14 is the repository development runtime. Do not commit `.env`, credentials, or test-user secrets.

## Where to Go Next

- Module-specific strategy and traceability: each source-local module spec in `SPEC_INDEX.md`
- Development loop: `GETTING_STARTED.md`
- Review gates: `REVIEW_CHECKLIST.md`
- Testing rules: `RULES.md`

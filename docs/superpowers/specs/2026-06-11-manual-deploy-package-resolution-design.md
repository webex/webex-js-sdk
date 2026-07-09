# Manual deploy: sound package resolution

## Context

`.github/workflows/manual-deploy.yml` (added in 6ba5266953, refined in 7d6b9d4cf2 / 2b5c6c98fa) currently resolves the set of publishable packages three different ways across three different jobs. The three views should always agree, but nothing enforces this — the resolution logic can drift silently.

The automated counterpart, `.github/workflows/deploy.yml`, computes its package list once in a `generate-package-matrix` job, exposes it as job outputs, and downstream jobs consume it via `needs.<job>.outputs.<name>`. Manual deploy should mirror that shape.

## Problems with the current resolution

| Step | Mechanism | Location |
|---|---|---|
| Set package versions | `yarn workspaces foreach --all --no-private exec npm pkg set version=…` | `publish-npm` (line ~178), `publish-documentation` (line ~252) |
| Deploy to NPM | `yarn package-tools list` → `--from "{a,b,c}"` (yarn brace pattern) | `publish-npm` (lines ~194–212) |
| Changelog | `yarn package-tools list` piped through a no-op `tr \| sed`, then unquoted into `--packages` (relies on **shell** brace expansion) | `publish-documentation` (lines ~270–294) |

Concrete issues:

1. **Three resolution paths**, three filtering implementations, no shared output. Drift is silent.
2. **List computed twice** — once in `publish-npm`, once in `publish-documentation`. Same query, no reuse.
3. **`tr '\n' ' ' | sed 's/ *$//'` is a no-op** — `package-tools list` (default yarn mode) emits `{a,b,c}` on one line with no newlines. The pipe signals copy-paste from a different mode.
4. **Changelog relies on bash brace expansion**, not yarn's. The unquoted interpolation `--packages ${{ ... }}` lets bash expand `{a,b,c}` to `a b c`. Quoting the interpolation (a reasonable safety reflex) silently breaks the step — commander would receive the literal `{a,b,c}` as a single arg.
5. **Two duplicated version-set blocks** (`publish-npm` and `publish-documentation`) must remain identical or NPM artifacts and changelog entries diverge.

## Goal

A single, authoritative publishable-package list that all three downstream operations (version-set, NPM publish, changelog) consume.

## Architecture

```
authorize → initialize → build ──▶ publish-npm ──┬──▶ publish-tag
                          │                      │
                          │                      └──▶ publish-documentation
                          │
                          └─ outputs.packages  (consumed by all 3 downstream jobs)
```

The `build` job becomes the single source of truth. It already installs deps, so adding one `yarn package-tools list --mode node` step is essentially free — no new runner job.

## Components

### 1. `build.list` step — compute once

```yaml
- name: Resolve publishable packages
  id: list
  run: |
    PACKAGES=$(yarn package-tools list --mode node)
    if [ -z "$PACKAGES" ]; then
      echo "::error::No publishable packages resolved." >&2
      exit 1
    fi
    echo "packages=$PACKAGES" >> "$GITHUB_OUTPUT"
```

`--mode node` emits a clean space-separated list with no brace syntax. Safe to interpolate quoted or unquoted; no dependence on shell brace expansion.

Empty-list guard is theoretical insurance — we always have publishable packages today, but a future tooling regression that returned empty would otherwise silently skip the publish.

Job-level output:
```yaml
outputs:
  packages: ${{ steps.list.outputs.packages }}
```

### 2. `publish-npm` — version-set + deploy

```yaml
- name: Set Package Versions
  env:
    VERSION: ${{ inputs.version }}
    PACKAGES: ${{ needs.build.outputs.packages }}
  run: yarn workspaces foreach --from "$PACKAGES" exec npm pkg set version="$VERSION"

# …

- name: Deploy Packages
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
    DIST_TAG: ${{ inputs.dist-tag }}
    PACKAGES: ${{ needs.build.outputs.packages }}
  run: yarn workspaces foreach --from "$PACKAGES" --verbose run deploy:npm --access public --tag "$DIST_TAG"
```

`yarn workspaces foreach --from` accepts a quoted space-separated glob list, so the `--mode node` output works directly without brace syntax.

### 3. `publish-documentation` — version-set + changelog

```yaml
- name: Set Package Versions
  env:
    VERSION: ${{ inputs.version }}
    PACKAGES: ${{ needs.build.outputs.packages }}
  run: yarn workspaces foreach --from "$PACKAGES" exec npm pkg set version="$VERSION"

# …

- name: Update changelog
  env:
    DIST_TAG: ${{ inputs.dist-tag }}
    PACKAGES: ${{ needs.build.outputs.packages }}
  run: |
    if PREVIOUS_TAG=$(git describe --tags --abbrev=0 2>/dev/null); then
      PREVIOUS_COMMIT=$(git rev-list -n 1 "$PREVIOUS_TAG")
      echo "Using previous tag '$PREVIOUS_TAG' ($PREVIOUS_COMMIT) as changelog base."
    else
      PREVIOUS_COMMIT=$(git rev-parse HEAD~1)
      echo "No prior tag found; falling back to HEAD~1 ($PREVIOUS_COMMIT) as changelog base."
    fi
    yarn package-tools changelog --packages $PACKAGES --tag "$DIST_TAG" --commit "$PREVIOUS_COMMIT"
```

Note: `--packages` is intentionally unquoted so commander receives the names as variadic args — matching how `deploy.yml` already invokes the same command. Space-separated input makes this clean; brace-form needed shell expansion to work.

The `tools` build dependency that was previously inline (`yarn workspaces foreach --from '@webex/*-tools' …`) is unchanged — only the version-set call swaps over to `--from "$PACKAGES"`.

## What gets removed

- `Get publishable packages` step in `publish-npm` — moves to `build.list`.
- `Get all package names for changelog` step in `publish-documentation`, including the `tr | sed` no-op.
- `--all --no-private` on both version-set steps — replaced with `--from "$PACKAGES"`.

## Data flow

```
build.list step          ──▶ build.outputs.packages  ("@webex/a @webex/b webex …")
                              │
                              ├──▶ publish-npm: set versions          (--from "$PACKAGES")
                              ├──▶ publish-npm: deploy                (--from "$PACKAGES")
                              ├──▶ publish-documentation: set versions (--from "$PACKAGES")
                              └──▶ publish-documentation: changelog    (--packages $PACKAGES)
```

## Error handling

- `yarn package-tools list --mode node` non-zero exit → build fails, no downstream runs.
- Empty output → guarded explicit error in `build.list`.
- A package missing from `$PACKAGES` (e.g. mid-deploy package.json edit) → `yarn workspaces foreach --from` would warn or skip depending on yarn behavior. Out of scope; manual deploy assumes a stable repo state during the run.

## Testing approach

Manual deploy is workflow-only, no unit-test surface. Verification path:

1. Trigger `workflow_dispatch` against a non-production dist-tag (`alpha`) on a feature branch.
2. Inspect `build.outputs.packages` in the run logs; cross-check against `yarn package-tools list --mode node` locally.
3. Confirm the publish step's per-workspace log lists exactly the resolved set.
4. Confirm the changelog commit on the `documentation` branch covers the same set.

## Out of scope

- The other PR #4411 reviewer concerns (token scoping, action SHA pinning, actor allowlist) — already handled in 7d6b9d4cf2 / 2b5c6c98fa or are independent of resolution logic.
- Verifying that all non-private packages use `workspace:*` for internal deps — separate audit. If any pin a literal version, manual deploy will publish stale internal-dep refs; easy followup using `grep -l '"@webex/[^"]*": "[0-9]'` over `packages/**/package.json`.
- Consolidating the two duplicated version-set steps into a composite action — larger refactor, separate change.

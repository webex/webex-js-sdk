# Manual deploy package resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Centralize publishable-package resolution in `manual-deploy.yml` so version-set, NPM publish, and changelog all consume one authoritative list from the build job.

**Architecture:** Add a single `package-tools list --mode node` step to the existing `build` job, expose its output as `needs.build.outputs.packages`, and rewrite the four downstream steps (two `Set Package Versions` and the deploy + changelog steps) to consume that variable instead of recomputing the list or relying on `--all --no-private`.

**Tech Stack:** GitHub Actions, yarn 3 workspaces, `@webex/package-tools` (in-repo CLI), bash.

**Spec:** `docs/superpowers/specs/2026-06-11-manual-deploy-package-resolution-design.md`

**Verification:** Manual — user runs `workflow_dispatch` with `dist-tag=alpha` against this branch and inspects logs. No unit-test surface (workflow-only changes).

---

## File Structure

Single file changes, no new files. The plan reshapes one existing workflow:

- Modify: `.github/workflows/manual-deploy.yml`
  - **`build` job:** add a "Resolve publishable packages" step + `outputs.packages`.
  - **`publish-npm` job:** add `needs: build` (already present), drop the inline `Get publishable packages` step, rewrite `Set Package Versions` and `Deploy Packages` to consume `needs.build.outputs.packages`.
  - **`publish-documentation` job:** add `needs: build` to its needs list, drop the inline `Get all package names for changelog` step (including the no-op `tr | sed`), rewrite `Build tools and set versions` to consume the shared list, and rewrite `Update changelog` accordingly.

The `publish-tag` job is untouched — it doesn't consume the package list.

---

## Task 1: Add the resolved package list as a build-job output

**Files:**
- Modify: `.github/workflows/manual-deploy.yml` (the `build` job, currently lines 96–136)

**Why first:** Every other task consumes this output. Add it before any consumer references it so intermediate states still parse as a valid workflow.

- [ ] **Step 1: Read the current `build` job to confirm its shape**

Run: `sed -n '96,136p' .github/workflows/manual-deploy.yml`
Expected: shows the `build` job with steps ending in `Cache Distributables`, no `outputs:` block.

- [ ] **Step 2: Add `outputs:` block and the resolve step**

Edit the `build` job. Two changes:

a) Insert an `outputs:` block immediately after `runs-on: ubuntu-latest` (currently line 99). New lines:

```yaml
    outputs:
      packages: ${{ steps.list.outputs.packages }}
```

b) Insert a new step **after** the existing `Build Other Packages` step (currently the step that runs `yarn workspaces foreach --parallel --topological --verbose run build:src`) and **before** `Cache Distributables`. The new step:

```yaml
      - name: Resolve publishable packages
        id: list
        # `package-tools list --mode node` emits a space-separated list of
        # non-private workspaces. This is the single source of truth for
        # which packages get version-set, published to NPM, and included in
        # the changelog. Downstream jobs consume it via
        # `needs.build.outputs.packages`.
        run: |
          PACKAGES=$(yarn package-tools list --mode node)
          if [ -z "$PACKAGES" ]; then
            echo "::error::No publishable packages resolved." >&2
            exit 1
          fi
          echo "packages=$PACKAGES" >> "$GITHUB_OUTPUT"
```

- [ ] **Step 3: Sanity-check the YAML parses**

Run: `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/manual-deploy.yml','utf8')); console.log('OK')"`
Expected: prints `OK`. (`js-yaml` is a transitive dependency of the repo and is already in `node_modules`.)

- [ ] **Step 4: Confirm the resolve step ran locally without error**

Run: `yarn package-tools list --mode node | tr ' ' '\n' | head -20`
Expected: prints 20 workspace names like `@webex/common`, `@webex/common-evented`, `webex`, `webex-node`, etc. — no `byods-demo-server`, no `@webex/*-tools`.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/manual-deploy.yml
git commit -m "$(cat <<'EOF'
chore(tooling): expose publishable packages as build job output

Adds a single 'Resolve publishable packages' step to the build job
in manual-deploy.yml that runs `yarn package-tools list --mode node`
and exposes the result as `needs.build.outputs.packages`. This is
the foundation for centralizing package resolution across the
version-set, NPM publish, and changelog steps.

The `--mode node` form emits a space-separated list with no brace
syntax, safe to interpolate quoted or unquoted in downstream steps.
EOF
)"
```

---

## Task 2: Switch `publish-npm` to consume the shared list

**Files:**
- Modify: `.github/workflows/manual-deploy.yml` (the `publish-npm` job, currently lines 138–212)

**Why second:** This job already declares `needs: build`, so it can read `needs.build.outputs.packages` immediately. Replaces the inline `Get publishable packages` step and the two consumers.

- [ ] **Step 1: Confirm `publish-npm` currently has `needs: build`**

Run: `grep -A1 "publish-npm:" .github/workflows/manual-deploy.yml | head -4`
Expected: shows `needs: build` on the next line after `name:`.

- [ ] **Step 2: Replace the `Set Package Versions` step**

Find the existing step (currently at lines 171–178):

```yaml
      - name: Set Package Versions
        # `package-tools` does not expose a `version set` command, so use
        # `npm pkg set` across non-private workspaces to write the requested
        # version into every publishable package.json. Internal package deps
        # use `workspace:*` and don't need rewriting.
        env:
          VERSION: ${{ inputs.version }}
        run: yarn workspaces foreach --all --no-private exec npm pkg set version="$VERSION"
```

Replace with:

```yaml
      - name: Set Package Versions
        # `package-tools` does not expose a `version set` command, so use
        # `npm pkg set` across the resolved publishable workspaces to write
        # the requested version into every publishable package.json.
        # Internal package deps use `workspace:*` and don't need rewriting.
        env:
          VERSION: ${{ inputs.version }}
          PACKAGES: ${{ needs.build.outputs.packages }}
        run: yarn workspaces foreach --from "$PACKAGES" exec npm pkg set version="$VERSION"
```

- [ ] **Step 3: Delete the now-redundant `Get publishable packages` step**

Find and remove the entire step (currently at lines 194–199):

```yaml
      - name: Get publishable packages
        id: get-publishable
        # `package-tools list` (no flags) excludes packages marked `private: true`,
        # so internal-only workspaces (samples, helpers, etc.) are filtered out.
        # Output format `{pkg1,pkg2,...}` is consumed directly by `yarn workspaces foreach --from`.
        run: echo "packages=$(yarn package-tools list)" >> "$GITHUB_OUTPUT"
```

- [ ] **Step 4: Update the `Deploy Packages` step to consume the shared list**

Find the existing step (currently at lines 207–212):

```yaml
      - name: Deploy Packages
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          DIST_TAG: ${{ inputs.dist-tag }}
          PACKAGES: ${{ steps.get-publishable.outputs.packages }}
        run: yarn workspaces foreach --from "$PACKAGES" --verbose run deploy:npm --access public --tag "$DIST_TAG"
```

Change `PACKAGES` to consume `needs.build.outputs.packages`:

```yaml
      - name: Deploy Packages
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
          DIST_TAG: ${{ inputs.dist-tag }}
          PACKAGES: ${{ needs.build.outputs.packages }}
        run: yarn workspaces foreach --from "$PACKAGES" --verbose run deploy:npm --access public --tag "$DIST_TAG"
```

- [ ] **Step 5: Sanity-check the YAML parses**

Run: `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/manual-deploy.yml','utf8')); console.log('OK')"`
Expected: prints `OK`.

- [ ] **Step 6: Verify no orphan reference to `steps.get-publishable`**

Run: `grep -n "get-publishable" .github/workflows/manual-deploy.yml`
Expected: no output. (If anything remains, that's a leftover reference — fix it before committing.)

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/manual-deploy.yml
git commit -m "$(cat <<'EOF'
chore(tooling): consume shared package list in publish-npm

Drops the inline `Get publishable packages` step in favor of
`needs.build.outputs.packages`. Both `Set Package Versions` and
`Deploy Packages` now use the same authoritative list, eliminating
silent drift between what gets versioned and what gets published.
EOF
)"
```

---

## Task 3: Switch `publish-documentation` to consume the shared list

**Files:**
- Modify: `.github/workflows/manual-deploy.yml` (the `publish-documentation` job, currently lines 214–306)

**Why third:** This job currently lists `needs: publish-npm` only. We need to add `build` to its `needs:` so it can read `needs.build.outputs.packages`. (Adding `build` is safe — `publish-npm` already needs `build`, so the dependency is implicit; making it explicit unlocks the output reference.)

- [ ] **Step 1: Update the `needs:` list**

Find:

```yaml
  publish-documentation:
    name: Publish - Documentation
    needs: publish-npm
    runs-on: ubuntu-latest
```

Change to:

```yaml
  publish-documentation:
    name: Publish - Documentation
    needs: [build, publish-npm]
    runs-on: ubuntu-latest
```

- [ ] **Step 2: Replace the `Build tools and set versions` step**

Find the existing step (currently at lines 247–252):

```yaml
      - name: Build tools and set versions
        env:
          VERSION: ${{ inputs.version }}
        run: |
          yarn workspaces foreach --from '@webex/*-tools' --topological-dev --parallel --verbose run build:src
          yarn workspaces foreach --all --no-private exec npm pkg set version="$VERSION"
```

Replace with:

```yaml
      - name: Build tools and set versions
        env:
          VERSION: ${{ inputs.version }}
          PACKAGES: ${{ needs.build.outputs.packages }}
        run: |
          yarn workspaces foreach --from '@webex/*-tools' --topological-dev --parallel --verbose run build:src
          yarn workspaces foreach --from "$PACKAGES" exec npm pkg set version="$VERSION"
```

- [ ] **Step 3: Delete the inline `Get all package names for changelog` step**

Find and remove the entire step (currently at lines 270–278):

```yaml
      - name: Get all package names for changelog
        id: get-packages
        run: |
          PACKAGES=$(yarn package-tools list | tr '\n' ' ' | sed 's/ *$//')
          {
            echo 'packages<<EOF'
            echo "$PACKAGES"
            echo 'EOF'
          } >> "$GITHUB_OUTPUT"
```

- [ ] **Step 4: Update the `Update changelog` step**

Find the existing step (currently at lines 280–294):

```yaml
      - name: Update changelog
        env:
          DIST_TAG: ${{ inputs.dist-tag }}
        run: |
          # Anchor the changelog to the previous release tag so a manual deploy
          # captures every commit since the last release, not just HEAD~1.
          # Fall back to HEAD~1 only when no prior tag exists (fresh repos).
          if PREVIOUS_TAG=$(git describe --tags --abbrev=0 2>/dev/null); then
            PREVIOUS_COMMIT=$(git rev-list -n 1 "$PREVIOUS_TAG")
            echo "Using previous tag '$PREVIOUS_TAG' ($PREVIOUS_COMMIT) as changelog base."
          else
            PREVIOUS_COMMIT=$(git rev-parse HEAD~1)
            echo "No prior tag found; falling back to HEAD~1 ($PREVIOUS_COMMIT) as changelog base."
          fi
          yarn package-tools changelog --packages ${{ steps.get-packages.outputs.packages }} --tag "$DIST_TAG" --commit "$PREVIOUS_COMMIT"
```

Replace with:

```yaml
      - name: Update changelog
        env:
          DIST_TAG: ${{ inputs.dist-tag }}
          PACKAGES: ${{ needs.build.outputs.packages }}
        run: |
          # Anchor the changelog to the previous release tag so a manual deploy
          # captures every commit since the last release, not just HEAD~1.
          # Fall back to HEAD~1 only when no prior tag exists (fresh repos).
          if PREVIOUS_TAG=$(git describe --tags --abbrev=0 2>/dev/null); then
            PREVIOUS_COMMIT=$(git rev-list -n 1 "$PREVIOUS_TAG")
            echo "Using previous tag '$PREVIOUS_TAG' ($PREVIOUS_COMMIT) as changelog base."
          else
            PREVIOUS_COMMIT=$(git rev-parse HEAD~1)
            echo "No prior tag found; falling back to HEAD~1 ($PREVIOUS_COMMIT) as changelog base."
          fi
          # `--packages` is intentionally unquoted so commander receives the
          # workspace names as variadic args (matching deploy.yml's invocation).
          yarn package-tools changelog --packages $PACKAGES --tag "$DIST_TAG" --commit "$PREVIOUS_COMMIT"
```

- [ ] **Step 5: Sanity-check the YAML parses**

Run: `node -e "require('js-yaml').load(require('fs').readFileSync('.github/workflows/manual-deploy.yml','utf8')); console.log('OK')"`
Expected: prints `OK`.

- [ ] **Step 6: Verify no orphan reference to `steps.get-packages`**

Run: `grep -n "get-packages" .github/workflows/manual-deploy.yml`
Expected: no output.

- [ ] **Step 7: Verify no remaining `--all --no-private` in the file**

Run: `grep -n "all --no-private" .github/workflows/manual-deploy.yml`
Expected: no output. (The two version-set steps were the only consumers.)

- [ ] **Step 8: Commit**

```bash
git add .github/workflows/manual-deploy.yml
git commit -m "$(cat <<'EOF'
chore(tooling): consume shared package list in publish-documentation

Drops the inline `Get all package names for changelog` step (and
its no-op `tr | sed` pipeline) in favor of `needs.build.outputs.packages`.
Both `Build tools and set versions` and `Update changelog` now use
the same authoritative list as publish-npm, so the changelog and
the published artifacts can never describe different package sets.

Adds `build` to the job's `needs:` list to expose the output.
EOF
)"
```

---

## Task 4: Final sanity sweep

**Files:** none (read-only checks)

- [ ] **Step 1: Confirm only one place computes the package list**

Run: `grep -nE "package-tools list" .github/workflows/manual-deploy.yml`
Expected: exactly one line — the `Resolve publishable packages` step in `build`.

- [ ] **Step 2: Confirm all four consumer steps reference `needs.build.outputs.packages`**

Run: `grep -n "needs.build.outputs.packages" .github/workflows/manual-deploy.yml`
Expected: exactly four matches — `Set Package Versions` (publish-npm), `Deploy Packages` (publish-npm), `Build tools and set versions` (publish-documentation), `Update changelog` (publish-documentation).

- [ ] **Step 3: Confirm yamllint-style trailing whitespace and final newline**

Run: `grep -n " $" .github/workflows/manual-deploy.yml || echo "no trailing whitespace"`
Expected: prints `no trailing whitespace`.

Run: `tail -c 1 .github/workflows/manual-deploy.yml | xxd`
Expected: shows `0a` (a newline byte).

- [ ] **Step 4: Confirm git history is three clean commits**

Run: `git log --oneline -3`
Expected: three commits with the messages from Tasks 1–3, all on top of `2b5c6c98fa`.

- [ ] **Step 5: Hand off to user for workflow_dispatch verification**

Notify the user the implementation is complete and ready for the manual `workflow_dispatch` run with `dist-tag=alpha` they planned. The user verifies:
1. `build` job logs show the resolved package list.
2. Publish step lists exactly the resolved set.
3. Changelog commit on the `documentation` branch covers the same set.

No code action here — this is the verification gate the user committed to.

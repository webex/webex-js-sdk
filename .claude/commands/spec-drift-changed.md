# Spec Drift Detection — Changed Files Only

Validate the contact-center specs affected by any staged/unstaged changes — whether the changes are to the specs themselves OR to source code that a spec covers. Lightweight mode for pre-commit validation.

Specs are routed by `packages/@webex/contact-center/.sdd/manifest.json`: each entry in `modules[]` has a `path` (source directory, relative to the package root) and a `canonical_spec` (its spec, normally `<path>/docs/README.md`). Package-level docs are `AGENTS.md` and `docs/**/*.md` in the package.

## Step 1: Find All Changed Files

Run these commands to find all changed files (staged and unstaged):

```bash
# Get both staged and unstaged changed files
(git diff --name-only HEAD 2>/dev/null; git diff --name-only --cached 2>/dev/null) | sort -u
```

## Step 2: Identify Specs That Need Validation

From the changed files under `packages/@webex/contact-center/`, build TWO lists:

### List A: Changed spec files
Files that are a module `canonical_spec`, the package `AGENTS.md`, or under the package `docs/`. These docs changed directly and need validation.

### List B: Source files covered by a module spec
For each other changed file, pick the module whose `path` is the longest prefix of the file path (relative to the package root). Its `canonical_spec` needs validation. Unit tests map through the source path they mirror: `test/unit/spec/<rel>` maps like `src/<rel>`. Any other package file (for example `package.json` or build config) maps to the package spec `src/docs/README.md`.

Use this to build the mapping (the subshell keeps the shell at the repository root for Step 5):
```bash
(cd packages/@webex/contact-center && python3 - <<'PY'
import json, subprocess
mods = json.load(open('.sdd/manifest.json'))['modules']
specs = {m['canonical_spec'] for m in mods}
out = subprocess.run("(git diff --name-only HEAD; git diff --name-only --cached) | sort -u",
                     shell=True, capture_output=True, text=True, cwd='../../..').stdout.split()
pre = 'packages/@webex/contact-center/'
for f in (x[len(pre):] for x in out if x.startswith(pre)):
    if f in specs or f == 'AGENTS.md' or f.startswith('docs/'):
        print(f'{f} -> {f} (spec changed)'); continue
    src = 'src/' + f[len('test/unit/spec/'):] if f.startswith('test/unit/spec/') else f
    owner = max((m for m in mods if src == m['path'] or src.startswith(m['path'] + '/')),
                key=lambda m: len(m['path']), default=None)
    print(f"{f} -> {owner['canonical_spec'] if owner else 'src/docs/README.md'}")
PY
)
```

Example mapping:
```
Changed file                                   → spec to validate
src/services/task/Task.ts                      → src/services/task/docs/README.md
src/services/task/state-machine/actions.ts     → src/services/task/state-machine/docs/README.md
test/unit/spec/services/config/index.ts        → src/services/config/docs/README.md
```

**Deduplicate**: If multiple files map to the same spec, validate that spec only once.

### Combine Lists A and B
The final set of specs to validate is the union of List A and List B.

If NEITHER list has entries, report: **"No specs affected by current changes — nothing to check."** and go straight to Step 5. Do not stop before Step 5: the pre-commit hook still needs the marker for the staged contact-center files.

## Step 3: Validate Affected Specs

For each spec that needs validation, spawn an Explore agent with this prompt:

```
You are validating SDD documentation accuracy against source code.

SOURCE OF TRUTH (actual code): {module path; files owned by a deeper module in .sdd/manifest.json belong to that module's spec}
DOCS TO VALIDATE: {spec path} (for a package doc, validate it against the package src/)

CHANGED SOURCE FILES (if any): {list of changed files mapped to this spec}
CHANGED DOC FILES (if any): {list of changed spec files}

Read the spec. Check these 7 categories:

1. FILE TREE: Read any documented file/directory trees. Glob the actual directory. Report missing/extra files.

2. METHOD/API SIGNATURES: For every method documented, read the actual source and verify: name, params, param types, return type, modifiers. Flag any mismatch. Pay special attention to methods in changed source files — new methods may be missing from docs, or changed signatures may not be reflected.

3. TYPE DEFINITIONS: For every type/enum/interface documented, find the actual definition in source. Compare name, fields, field types, enum values. Check if changed source files introduced new types not yet documented.

4. EVENT NAMES: For every event constant referenced, verify it exists in source with the exact same name and value. Verify trigger vs emit usage (cc.ts uses trigger, EventEmitter classes use emit). Check if changed source files added new events not yet documented.

5. ARCHITECTURE PATTERNS: Verify claims about HTTP vs WebSocket flow, trigger vs emit, singleton vs factory, bootstrap order, class hierarchy.

6. LINK VALIDATION: For every relative link [text](path), verify the target exists on disk.

7. CODE EXAMPLES: For every code block, verify API names, method names, parameter names, import paths are correct.

For each finding, report:
- File: (path)
- Line/Section: (approximate line or section heading)
- Category: (1-7)
- Severity: Blocking / Important / Medium / Minor
  - Blocking = wrong API that would cause runtime errors if an AI agent follows the docs
  - Important = wrong params/types that would cause compilation errors
  - Medium = incomplete or stale info (e.g., new methods/types/events missing from docs)
  - Minor = broken links, cosmetic issues
- What doc says: (quoted)
- What code actually has: (evidence with file:line)
- Suggested fix: (exact replacement text)
```

Run all agents in parallel if multiple specs are affected.

## Step 4: Consolidate and Report

Present findings in this format:

```markdown
## Spec Drift Report — Changed Files
Generated: {date}
Trigger: {source code changes / spec changes / both}
Specs checked: {list}

### Changed Source Files
{list of changed source files and their mapped spec}

### Changed Spec Files
{list of changed spec files, or "None"}

### Summary

| Spec | Findings | Blocking | Important | Medium | Minor |
|------|----------|----------|-----------|--------|-------|
| ...  |          |          |           |        |       |

### Blocking Findings
...

### Important Findings
...

### Medium Findings
...

### Minor Findings
...

### Actionable Fixes by File
(grouped by file path, each with exact old text -> new text)
```

## Step 5: Create Verification Marker

After presenting the validation report (regardless of findings, and also when Step 2 found no affected specs), create a verification marker so the pre-commit hook allows the commit:

```bash
# Hash staged content (not just paths) — must match the hook's hash logic exactly.
# Run from the repository root: CC_PKG is a root-relative pathspec, as in the hook.
cd "$(git rev-parse --show-toplevel)"
CC_PKG="packages/@webex/contact-center"
STAGED_CC=$(git diff --cached --name-only 2>/dev/null | grep "^${CC_PKG}/")
if [ -n "$STAGED_CC" ]; then
  HASH=$(git diff --cached -- "$CC_PKG" | (shasum 2>/dev/null || sha256sum) | cut -d' ' -f1)
  touch "/tmp/.spec-drift-verified-${HASH}"
  echo "Verification marker created: /tmp/.spec-drift-verified-${HASH}"
fi
```

> **Note:** The verification marker covers only currently **staged** content. If you modify and re-stage files after verification, the content hash changes and you will need to re-run `/spec-drift-changed`.

Report to the user: "Verification marker created. The pre-commit hook will allow the next commit for these staged files."

## Rules

- Do NOT auto-fix anything — report findings only
- Always read actual source code to verify — never assume
- Use the Agent tool with `subagent_type: "Explore"` for checker agents
- Run agents in parallel when multiple specs are affected
- If an agent does not return within a reasonable time, note it as "Timed out — manual review needed" in the report and continue with available results
- Always create the verification marker at the end, even if there are findings or no affected specs — this tool is **advisory**: the developer decides whether to fix or commit as-is
- The marker hash MUST match the hook's hash computation — both use `git diff --cached` content (not just file paths)

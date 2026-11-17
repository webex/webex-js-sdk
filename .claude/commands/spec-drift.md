# Spec Drift Detection — Full Scan

Run a comprehensive validation of all contact-center SDD specs against actual source code. Deploys a parallel agent team to catch documentation drift across 7 categories.

## Step 1: Auto-Discovery

Discover every spec from the package manifest, `packages/@webex/contact-center/.sdd/manifest.json`:

1. **Repo detection**: This is ccSDK — `packages/@webex/contact-center/` exists
2. **Module specs**: each `modules[]` entry gives a source `path` and its `canonical_spec` (normally `<path>/docs/README.md`), both relative to the package root
3. **Package docs**: `AGENTS.md`, `docs/index.md`, `docs/architecture.md`, `docs/getting-started.md`, `docs/specs/README.md` (module registry), and `docs/adr/*.md`
4. **Source root**: `packages/@webex/contact-center/src/`

A module spec covers the files under its `path` except those owned by a deeper module (for example `src/services/task/state-machine` has its own spec).

Build an inventory:
```bash
(cd packages/@webex/contact-center && python3 -c "import json; [print(m['canonical_spec'], '->', m['path']) for m in json.load(open('.sdd/manifest.json'))['modules']]")
```
```
module spec                                         → source directory
src/docs/README.md                                  → src/
src/services/core/docs/README.md                    → src/services/core/
src/services/task/docs/README.md                    → src/services/task/
src/services/task/state-machine/docs/README.md      → src/services/task/state-machine/
... (every module listed in the manifest)
```

## Step 2: Spawn Checker Agents in Parallel

Use the Agent tool to spawn agents. **All agents run in parallel.**

### Per-Module Checker Agents (one per module spec)

For EACH module spec discovered, spawn one Explore agent with this prompt:

```
You are validating SDD documentation accuracy.

SOURCE OF TRUTH (actual code): {module path; files owned by a deeper module in .sdd/manifest.json belong to that module's spec}
DOCS TO VALIDATE: {module spec path}

Read the spec. Check these 7 categories:

### Category 1: FILE TREE
Read any documented file/directory trees in the docs. Glob the actual directory. Report:
- Files listed in docs but missing on disk
- Files on disk but missing from docs
- Wrong nesting or directory structure

### Category 2: METHOD/API SIGNATURES
For every method, function, or API endpoint documented:
- Read the actual source file
- Verify: method name, parameter names, parameter types, return type, access modifiers (public/private/static)
- Check if method actually exists in the documented file
- Flag any param that is documented but doesn't exist, or exists but isn't documented

### Category 3: TYPE DEFINITIONS
For every type, enum, interface, or constant documented:
- Find the actual definition in source (check src/types.ts for public types, src/services/*/types.ts for internal)
- Compare: name, fields/members, field types, enum values
- Flag missing fields, wrong types, renamed types

### Category 4: EVENT NAMES
For every event constant referenced (CC_EVENTS, TASK_EVENTS, AGENT_EVENTS, etc.):
- Find the actual constant definition in source
- Verify the exact string value matches
- Check the event is emitted where the docs say it is
- Verify trigger vs emit usage (cc.ts uses trigger, EventEmitter classes use emit)

### Category 5: ARCHITECTURE PATTERNS
For claims about architectural patterns, verify:
- HTTP vs WebSocket: Is the request flow correctly described?
- trigger vs emit: Does the documented class use the correct emission method?
- Singleton vs factory: Is the instantiation pattern correct?
- Bootstrap/initialization order: Does the documented sequence match actual code?
- Class hierarchy: Are extends/implements relationships correct?
- Dependency injection patterns: Are they accurately described?

### Category 6: LINK VALIDATION
For every relative markdown link [text](path):
- Resolve the path relative to the document's location
- Verify the target file exists on disk
- For anchor links (#section), verify the heading exists in the target

### Category 7: CODE EXAMPLES
For every inline code block or code snippet:
- Verify API names, method names, parameter names are correct
- Verify import paths are valid
- Check that documented usage patterns match actual API signatures
- Verify event listener patterns use named callbacks (not anonymous functions)

## Output Format

For each finding, report:
- **File**: (path to the spec with the issue)
- **Line/Section**: (approximate line number or section heading)
- **Category**: (1-7 from above)
- **Severity**:
  - Blocking = wrong API that would cause runtime errors if an AI agent follows the docs
  - Important = wrong params/types that would cause compilation errors
  - Medium = incomplete or stale info that would cause confusion
  - Minor = broken links, cosmetic issues
- **What doc says**: (quoted text from the doc)
- **What code actually has**: (evidence from source, with file path and line)
- **Suggested fix**: (exact replacement text)

If no issues found in a category, state "No issues found" for that category.
```

### Package Docs Agent

Spawn one additional Explore agent for the package-level docs:

```
Validate the package-level SDD documents for packages/@webex/contact-center/:

1. **AGENTS.md**:
   - Every module and spec it routes to must exist on disk at the documented path
   - Every module in .sdd/manifest.json should be reachable from it
   - Commands must match `commands` in .sdd/manifest.json and package.json scripts (test:unit, test:style, not test:styles)

2. **docs/specs/README.md** (module registry):
   - One row per manifest module; each spec link must resolve

3. **docs/architecture.md** and **docs/getting-started.md**:
   - Contract IDs must match `contract_catalog` in .sdd/manifest.json
   - Naming, event, and type-location claims (public in src/types.ts, internal in services/*/types.ts) must match code
   - Setup and test steps must reference correct commands and configs

4. **docs/index.md** and **docs/adr/*.md**:
   - All referenced documents and file paths must exist
   - ADR status and cross-references must be internally consistent

For each finding, report:
- **File**: (path)
- **Line/Section**: (section heading or line)
- **Category**: (1-7: File Tree, Method/API, Type Definition, Event Name, Architecture Pattern, Link Validation, Code Example)
- **Severity**: Blocking / Important / Medium / Minor
- **What doc says**: (quoted)
- **What code actually has**: (evidence with file:line)
- **Suggested fix**: (replacement text)
```

## Step 3: Consolidate Results

After ALL agents complete, consolidate into this report format:

```markdown
## Spec Drift Report — ccSDK (@webex/contact-center)
Generated: {date}
Scanned: {N} module specs, {M} package docs

### Summary

| Spec           | Findings | Blocking | Important | Medium | Minor |
|----------------|----------|----------|-----------|--------|-------|
| (each spec)    |          |          |           |        |       |
| package docs   |          |          |           |        |       |
| **Total**      | **N**    |          |           |        |       |

### Blocking Findings
(must fix — wrong APIs that would cause runtime errors if AI agent follows the docs)

### Important Findings
(wrong params, signatures, types — would cause compilation errors)

### Medium Findings
(incomplete info, stale file trees — would cause confusion)

### Minor Findings
(broken links, cosmetic issues)

### Actionable Fixes by File
(grouped by file path, each with exact old text -> new text)
```

## Rules

- Do NOT auto-fix anything — report findings only
- Always read actual source code to verify — never assume
- Use the Agent tool with `subagent_type: "Explore"` for all checker agents
- Run all agents in parallel for speed
- If an agent does not return within a reasonable time, note it as "Timed out — manual review needed" in the report and continue with available results
- If a manifest module has no source directory or its `canonical_spec` is missing, flag it as a Category 1 (File Tree) finding
- Count findings by severity in the summary table

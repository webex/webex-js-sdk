# Unmaintained / Suspect NPM Dependency Audit Process

This document describes the manual audit and handling process for NPM dependencies that appear to be unmaintained or otherwise suspicious.

As part of this process, dependencies are systematically discovered across the entire repository, including the root package and all sub-packages within the monorepo structure. The collection is based on direct dependencies and devDependencies declared in each package.json, with each dependency explicitly attributed to its originating package location.

The goal is to identify and assess potential risks in the dependency supply chain using a complete and source-aware dependency inventory, and to provide a repeatable, auditable process for triage, justification (including dismissals where appropriate), and remediation.

---

## 1. Audit cadence

- Monthly: detect newly stale or suspect dependencies
- Quarterly: review the catalog and validate past decisions
- Execution: a designated developer runs the audit script and performs manual triage
- Records: `docs/dependency/unmaintained-catalog.md`

---

## 2. Goals and scope

Identify dependencies that meet one or more conditions:

- No publish activity for STALE_YEARS (default 2 years)
- Marked `deprecated` on npm
- No visible active maintenance on upstream repository

For each suspect package the team must record a decision: `REPLACE`, `FORK_MAINTAIN`, `ACCEPT`, or `False Positive` (with justification).

Target metrics (example):

- Critical = 0 (aim to eliminate deprecated + vulnerable packages)
- Reduce High severity items quarter over quarter

---

## 3. Manual audit workflow

### Step 1 — Run the audit script

From the repository root run:

```bash
node docs/dependency/audit-unmaintained.js
```

What the script does (quick scan):

- Reads direct `dependencies` and `devDependencies` from `package.json`
- Reads `dependencies` and `devDependencies` from `packages/*/*/package.json`
- Reads `dependencies` and `devDependencies` from `packages/*/package.json`
- Queries the npm registry for each package's metadata
- Flags packages that are deprecated or older than `STALE_YEARS`
- Appends findings to `docs/dependency/unmaintained-catalog.md` and writes an immutable snapshot under `docs/dependency/snapshots/`
- If no new unmaintained package is found, the snapshot will prompt > No unmaintained dependencies detected

Note: the script does not modify code or create PRs; it produces records for manual review.

### Step 2 — Manual triage of newly flagged items

The script has generated a preliminary judgment. Please conduct manual review. You can use

```bash
npm info <package-name>
```

to detect package information.

For every new entry in the catalog a reviewer must fill these fields in the catalog table:

1. Severity (required)

| Severity | When to use                             |
| -------- | --------------------------------------- |
| Critical | deprecated and no updates > STALE_YEARS |
| High     | deprecated or no updates > STALE_YEARS  |
| Medium   | no updates > STALE_YEARS / 2            |
| Low      | small utility library with low impact   |

2. Decision (required)

- `REPLACE` — prefer replacing with a maintained alternative
- `FORK_MAINTAIN` — vendor/fork and maintain internally
- `ACCEPT` — accept risk with justification and monitoring plan
- `False Positive` — mark and note reason

3. Evidence (required)

- npm last publish timestamp (script output)
- GitHub / repo activity links or screenshots
- `deprecated` flag evidence (npm page or metadata)
- CVE / OSV links if vulnerabilities exist

4. Update example (catalog header)

```md
| Date | Package | Version | Version | Reason | Evidence | Severity | Decision | Notes |
| ---- | ------- | ------- | ------- | ------ | -------- | -------- | -------- | ----- |
```

### Step 3 — Choose a remediation path

A. REPLACE (preferred)

- When a good alternative exists or package is deprecated
- Requires compatibility testing and migration notes

B. FORK_MAINTAIN

- When the package is critical and no replacement exists
- Fork into company org, apply fixes, and publish an internal or scoped package

C. ACCEPT (risk acceptance)

- Only for low-impact utilities with no vulnerabilities
- Must be documented and scheduled for re-review next quarter

D. False Positive

---

## 4. Pull requests and evidence

When implementing `REPLACE` or `FORK_MAINTAIN`, open a PR that includes:

1. Exact package changes (old → new versions)
2. Rationale (last publish, maintenance activity, deprecated flag, CVE links)
3. Evidence (links/screenshots to npm, GitHub, CVE/OSV)
4. Decision type (`REPLACE` / `FORK_MAINTAIN`)
5. Compatibility impact, tests, and rollback plan
6. Next review date (recommended: 1 month)

---

## 5. Script details

- Location: `docs/dependency/audit-unmaintained.js`
- Optional environment variables:
  - `STALE_YEARS` (default `2`)
  - `CONCURRENCY` (concurrent npm requests, default `20`)

The script writes immutable snapshots to `docs/dependency/snapshots/` and updates `docs/dependency/unmaintained-catalog.md`. The `Decision` column is intentionally left blank for manual triage.

---

## 6. Expected repository artifacts

```
docs/
  dependency/
    audit-process.md                # this file
    audit-unmaintained.js           # audit script
    unmaintained-catalog.md         # catalog for manual triage
    snapshots/                      # per-run immutable snapshots
```

All substantive changes (decisions, forks, replacements) must be made via PR with evidence.

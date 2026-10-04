# Contributing

Thanks for contributing to this project.

## Before You Start

1. Read `AGENTS.md` and `README.md`.
2. Open an issue for significant changes.
3. Work in a feature branch from `main`.

## Development Workflow

1. Make focused, reviewable changes.
2. Run local validation before opening a PR.
3. Update docs when behavior or interfaces change.

<!-- repo-standards:doc-managed:contributing-sync:start -->

## Setup and Validation Alignment

Keep setup and validation guidance aligned with `README.md` quick start and command references.
Only include commands that can be verified from repository-local evidence such as package manifests, `Makefile` targets, CI workflows, Docker/compose files, or checked-in scripts.

```bash
[verified setup command]
[verified validation command]
```

<!-- repo-standards:doc-managed:contributing-sync:end -->

## Pull Requests

1. Use a clear title and description.
2. Link related issues.
3. Include test evidence and risk notes.
4. Keep PR scope small; split unrelated work.

## Commit Messages

Use conventional commit style when possible:

```text
type(scope): summary
```

Examples:

- `feat(sync): add support for custom mappings`
- `fix(validation): make link checks portable on macOS`

## Code of Conduct

By participating, you agree to follow the repository `CODE_OF_CONDUCT.md`.

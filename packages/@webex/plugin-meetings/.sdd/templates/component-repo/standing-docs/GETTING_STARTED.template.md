<!-- ───────────────────────────────
  Template:     Getting Started
  Template-ID:  getting-started
  Generates:    ai-docs/GETTING_STARTED.md
  Description:  Clone/build/run loop, toolchain, config/secrets, artifact registries, and multi-repo workspace layout.
  Library ver:  0.2.2
  Last updated: 2026-07-22
─────────────────────────────── -->

# Getting Started — <repo name>

> Start here → root [`AGENTS.md`](../AGENTS.md) (agent entry) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md). Then this doc to get a build/test loop running.
> Context-efficiency: link to canonical docs — don't duplicate them; load on demand, not upfront.

<!--
  STANDING reference doc — zero to a running build/test loop, plus the multi-repo workspace layout. Fill every
  command from the real build config (file path) — never guess. Headings are flat; sections preceded by
  `<!-- Include if: ... -->` are kept only when the condition holds. Each section comment gives Capture /
  Avoid / Example.
-->

## Prerequisites

### Toolchain
<!-- Capture: the exact language runtimes and build tools a contributor must install before any command
     runs, one row each, mirrored from the manifest `toolchain` block. Read versions from committed config
     (.nvmrc, .tool-versions, engines, compiler-release, Dockerfile); if a required version is not pinned
     in the repo, capture it via the onboarding questionnaire rather than guessing. Avoid: "install Node"
     with no version, or a version invented from memory. Example: JDK 21 · Maven 3.8+ · Docker. -->
| Tool | Version | Where it's pinned |
|---|---|---|
| `<tool>` | `<version>` | `<source file, or "declared during onboarding">` |

### Access
<!-- Capture: the accounts/network access needed before anything runs — registries, VPN/egress, secret
     store. Name registries here; the exact hosts and auth variable names live under Configuration & Secrets.
     Avoid: omitting an internal registry or egress requirement the build depends on. Example: "read access
     to the internal Maven registry; outbound egress to the artifact host; VPN for staging." -->
- <required registries / egress / VPN / accounts — or "none">

## Clone & Install
<!-- Capture: the real clone + install commands. Avoid: a generic `npm install` if the repo pins `npm ci`.
     Example: "git clone <url> && cd <repo> && pnpm install --frozen-lockfile". -->
```bash
<git clone ...>
<install command — from the real build config>
```

## Build / Run / Test
<!-- Capture: the core loop copied from the manifest `commands`, one row per command role so a reader
     (or a builder/tester workflow) runs the right command for each job. Avoid: inventing commands or
     collapsing distinct roles (a package build without tests is not the full build). Include only the
     roles the repo actually defines. Example: Install `mvn -N …` · Build `mvn verify` · Unit test
     `mvn -pl '!test' test` · Integration test `mvn -pl test verify` · Coverage `mvn jacoco:check`. -->
| Role | Command |
|---|---|
| Install | `<cmd>` |
| Build (full, with tests) | `<cmd>` |
| Package (build without tests) | `<cmd>` |
| Run (local) | `<cmd>` |
| Unit test | `<cmd>` |
| Integration test | `<cmd>` |
| Coverage check | `<cmd>` |
| Lint / format | `<cmd>` |

## First-Run Verification
<!-- Capture: one concrete check that proves the setup works. Avoid: "it should work". Example: "curl
     localhost:8080/health → 200 {\"status\":\"ok\"}." -->
- <how to confirm it's working>

<!-- Include if: the repo needs local config / env vars / secrets to run -->
## Configuration & Secrets
<!-- Capture: required config/env + where secrets come from (never hardcode). Avoid: committing a real .env.
     Example: "Copy .env.example; fill DB_URL; secrets via the secret manager." -->
- Required config/env: <list>. Obtain secrets from <secret store> — never hardcode (see `SECURITY.md`).

<!-- Include if: the build resolves dependencies from an external or authenticated registry -->
### Artifact Registries
<!-- Capture: each external artifact source the build resolves from, mirrored from the manifest
     `registries` block: name, host, the settings file that points the build at it, and the NAMES of the
     auth environment variables. Record names and hosts only — NEVER the credential values (see
     `SECURITY.md`); the values are provided by the environment/pipeline. Avoid: pasting a token, omitting
     the registry host, or dropping the auth variable names a fresh clone needs to authenticate.
     Example: "internal-maven | artifacts.example.com | config/maven/settings.xml | ARTIFACTORY_USER,
     ARTIFACTORY_TOKEN". -->
| Registry | Host | Settings file | Auth env-var names (values NOT stored) |
|---|---|---|---|
| `<name>` | `<host>` | `<settings file>` | `<VAR_NAME_1>, <VAR_NAME_2>` |

<!-- Include if: topology A — the product spans multiple repositories -->
## Multi-Repo Workspace Layout
<!-- Capture: how the sibling repos are laid out locally so cross-repo work resolves. Avoid: assuming one clone
     is enough for a multi-repo product.
     Verify against the team's real workspace convention when available. -->
```
<workspace-root>/
  <owner>/<repo-a>/
  <owner>/<repo-b>/
  <shared spec or workspace-level AGENTS.md, if used>
```
- Related repos and what each provides: see `ARCHITECTURE.md` (Cross-Repo Dependency Graph) and the workspace-level `AGENTS.md`.

<!-- Include if: the repo has a containerized or scripted dev environment -->
## Dev Environment
<!-- Capture: the devcontainer/compose/make target that brings up dependencies. Avoid: manual multi-step setup
     when a one-command env exists. Example: "make dev brings up <datastore> + the app via docker compose." -->
- <devcontainer / compose / make target that brings up dependencies>

## Where to Go Next
- Agent entry: `../AGENTS.md` · System shape: `ARCHITECTURE.md` · Routing: `SPEC_INDEX.md`
- Conventions: `patterns/` + `rules/` (and `RULES.md`).

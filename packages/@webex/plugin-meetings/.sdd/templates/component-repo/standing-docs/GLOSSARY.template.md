<!-- ───────────────────────────────
  Template:     Glossary
  Template-ID:  glossary
  Generates:    ai-docs/GLOSSARY.md
  Description:  Ubiquitous language — domain term → definition → authoritative code location.
  Library ver:  0.2.2
  Last updated: 2026-06-30
─────────────────────────────── -->

# Glossary — <repo name>

> Start here → root [`AGENTS.md`](../AGENTS.md) (agent entry) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md). Then this doc; related: `DATA_MODEL.md`, `CONTRACTS.md`.
> Context-efficiency: link to canonical docs — don't duplicate them; load on demand, not upfront.

<!--
  STANDING reference doc. The repo's ubiquitous language: each domain term → a precise definition → where it
  lives in code. Prevents renamed concepts and invented synonyms. Headings are flat; sections preceded by
  `<!-- Include if: ... -->` are kept only when the condition holds. Each section comment gives Capture /
  Avoid / Example. Fill from real code (file path) — never invent a term that isn't used.
-->

> Read this before naming anything. Use the canonical name exactly; never introduce a synonym. Find a term
> in code that isn't here? Add it rather than guessing its meaning.

## Domain Terms
<!-- Capture: each term that has a SPECIFIC meaning here → definition + the type/file that owns it + synonyms
     to avoid. Avoid: dictionary definitions or terms with no code anchor. Example: "<Term> | <precise repo meaning>
     | <module>/<file>.ts | not '<ambiguous synonym>'." -->
| Term | Definition (one or two sentences) | Authoritative location (file/type) | Notes / synonyms to avoid |
|---|---|---|---|
| `<term>` | <what it means here> | `<file path>` | <"do not call it X"> |

## Abbreviations & Acronyms
<!-- Capture: every abbreviation the codebase uses, expanded + its meaning here. Avoid: leaving an acronym
     ambiguous across domains. Example: "<ABC> — <Full Expansion> (not '<other possible expansion>')." -->
| Abbreviation | Expansion | Meaning in this repo |
|---|---|---|

<!-- Include if: the same word means different things in different modules/bounded contexts -->
## Context-Specific Meanings
<!-- Capture: where a term legitimately differs by area, each meaning + its boundary. Avoid: merging the two
     meanings. Example: "'<Term>' = <meaning A> in <module-a>/, but = <meaning B> in <module-b>/." -->
| Term | Context / module | Meaning here |
|---|---|---|

<!-- Include if: the repo has deprecated/renamed concepts still present in older code -->
## Deprecated / Renamed Terms
<!-- Capture: old term → current term, why renamed, where the old one still appears. Avoid: silently dropping
     the old name (readers still hit it in old code). Example: "'<OldTerm>' → '<CurrentTerm>'; renamed in <version>; still in <legacy-path>/." -->
| Old term | Current term | Why renamed | Still appears in |
|---|---|---|---|

## Maintenance
<!-- Capture: the rule that keeps this current. Avoid: letting the glossary rot. Example: "New entity/event/
     state → add a term here in the same change." -->
- When a new domain concept is introduced (new entity, event, state), add it here in the same change.
- Cross-reference: data entities → `DATA_MODEL.md`; public-surface terms → `CONTRACTS.md`.

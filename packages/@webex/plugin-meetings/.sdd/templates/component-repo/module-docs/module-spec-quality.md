# Detailed Module Spec Standard

Use this standard with `module-spec.template.md` when generating or manually writing
`<module-path>/ai-docs/<module-name>-spec.md`. It applies whether a team uses an automated generator
or its own manual process.

## Required Shape

A module spec is the canonical module document. It combines orientation, requirements, design,
behavior flows, contracts, edge cases, and module tests in one source-local file.

Every generated module spec keeps these universal sections:

- `Metadata`
- `Evidence Rules`
- `Source Material Register`
- `Overview`
- `Purpose / Responsibility`
- `Stack`
- `Folder / Package Structure`
- `Key Files (source of truth)`
- `Public Surface`
- `Requires (dependencies)`
- `Requirements`
- `Design Overview`
- `Data Flow`
- `Sequence Diagram(s)`
- `Class / Component Relationships`
- `Use Cases`
- `Pitfalls`
- `Test-Case Strategy (module)`
- `Traceability`

Conditional sections are kept only when they apply to the module. When kept, they are filled with the
same level of evidence as the universal sections.

Rendered sections follow the template order: identity/provenance, orientation, public boundary,
requirements, implementation design and flows, applicable state/data/protocol details, maintenance
edges, tests, and traceability. Reordering generated sections makes the spec harder to scan and should
be corrected before validation.

The rendered `Metadata` table includes: `Module id`, `Source path(s)`, `Doc kind`,
`Coverage score`, `Generated from`, `generated_by / approved_by / updated_at`, and
`Validation status`.

`Coverage score` is always present. Before measurement it is `Pending coverage assessment`; after
measurement it is the numeric percentage plus assessment date and short evidence summary. `Coverage
score` and `Validation status` must not cite `.generated/` run-record paths or other local generated
report paths.

## Detail Expectations

The spec should be context-efficient and complete. A future agent should be able to read the module
spec and understand the module enough to make a safe change without rediscovering the core behavior
from scratch.

- `Overview` and `Design Overview` explain ownership, internal structure, and rationale.
- `Requirements` capture observable behavior and compatibility promises with WHAT, WHY, evidence,
  tests/examples, gaps, and confidence.
- `Data Flow` names the exact transport or call style and includes a Mermaid diagram for non-trivial
  modules.
- `Sequence Diagram(s)` start with a sequence inventory or coverage note. The number of diagrams is
  based on major operation groups from public surfaces, use cases, events, commands, state transitions,
  and async jobs. One diagram can cover multiple operations only when actors, ordering, transport,
  state transition, and failure behavior are the same. A single diagram is acceptable only for a
  one-operation or trivial pass-through/composition module. Include relevant error, timeout, retry,
  rollback, rejected, and recovery paths.
- `Class / Component Relationships` show main objects/components and how they relate; a file list is
  not enough.
- `Use Cases` are concrete actor -> steps -> outcome flows with evidence.
- `Pitfalls` capture module-specific failure modes, sharp edges, and must-not-break behavior.
- `Test-Case Strategy (module)` maps behaviors/requirements to existing tests and gaps.
- Native contract sources such as OpenAPI, AsyncAPI, proto, GraphQL, JSON Schema, SDK API reports,
  typedoc, or package entry points are linked as exact detail sources. The module spec summarizes and
  routes to them instead of pasting full schemas.

Use `N/A` only when the code proves the concern cannot apply, and include the evidence path or reason.

## Existing Docs

When a repo already has module overview, architecture, HLD, LLD, API, or test notes, use them as
source material instead of discarding their detail. Record exact prior doc paths in
`.sdd/manifest.json` and local source-fidelity run records; the committed module spec's
`Source Material Register` summarizes source basis by category and disposition, not by old
non-canonical file names:

- orientation content maps to `Overview`, `Purpose / Responsibility`, `Stack`,
  `Folder / Package Structure`, and `Key Files`;
- architecture content maps to `Design Overview`, `Data Flow`, `Sequence Diagram(s)`,
  `Class / Component Relationships`, conditional design sections, and `Pitfalls`;
- API/contract content maps to `Public Surface`, the root contract index, and linked schema/API
  sources;
- behavior and test content maps to `Requirements`, `Use Cases`, and `Test-Case Strategy (module)`.

If code evidence disproves older content, mark the conflict and do not present the old statement as
current behavior.

## Completion Check

Before treating a module spec as ready, check:

- all universal sections exist;
- sections are in the source-template order;
- the rendered metadata table includes all required rows;
- retained conditional sections are present and filled;
- sequence inventory, diagrams, and failure/error/recovery paths exist for non-trivial modules;
- every requirement has WHAT, WHY, source evidence, test/example evidence or a gap, and confidence;
- public surfaces link to the root contract index and exact schema/API detail source when one exists;
- no template placeholders, generic fill text, or vague evidence anchors remain.
- migrated specs do not name old non-canonical source files as headings, appendices, or Source
  Material Register rows; exact source routing remains in the manifest/local source-fidelity records.

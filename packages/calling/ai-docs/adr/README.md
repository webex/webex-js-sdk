# ai-docs/adr/ — Architecture Decision Records

Standing, append-only record of **why** the architecture is the way it is — including the options that
were rejected. Unlike temporary generation records, ADRs live with the repo
forever, so an agent sees the reasoning behind a constraint instead of "fixing" it by accident.

## Use ADRs For

Use ADRs for durable architecture decisions that constrain future work. Do not use ADRs for run
notes, temporary investigation findings, or per-feature task history.

- **Fill-in shape:** `_adr-example.md` (Context · Decision · Alternatives Considered · Consequences · Revisit When).
- **Numbering:** one file per decision, `NNNN-short-title.md` (zero-padded, monotonic).
- **Immutability:** ADRs are immutable once `Accepted`. To change a decision, write a new ADR that
  supersedes the old one (and set the old one's status to `Superseded by NNNN`).
- Reference ADRs from `ARCHITECTURE.md` and module specs where a decision constrains the design.

Each ADR carries the standard metadata header, a navigation pointer, and Capture/Avoid/Example guidance.
See `../README.md` for this reference-docs area and `../../../README.md` for global conventions.

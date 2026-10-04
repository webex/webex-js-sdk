<!-- ───────────────────────────────
  Template:     ADR (example)
  Template-ID:  adr
  Generates:    ai-docs/adr/NNNN-<kebab-title>.md
  Description:  Standing architecture decision record — context, decision, alternatives rejected, consequences.
  Library ver:  0.2.2
  Last updated: 2026-06-30
─────────────────────────────── -->

# ADR-NNNN — <short decision title>

> Start here → repo root [`AGENTS.md`](../../AGENTS.md) (agent entry) · router [`SPEC_INDEX.md`](../SPEC_INDEX.md) · system [`ARCHITECTURE.md`](../ARCHITECTURE.md). This is a standing `ai-docs/adr/` decision record; the folder README explains numbering/supersession.
> Context-efficiency: link to canonical docs — don't duplicate them; one decision per file.

<!--
  STANDING decision record. One decision per file; immutable once Accepted. Capture the WHY and the rejected
  options so the reasoning survives. Headings are flat; sections preceded by `<!-- Include if: ... -->` are
  kept only when relevant. Each section comment gives Capture / Avoid / Example.
-->

<!-- Capture: status + date + deciders (roles) + supersession link. Avoid: editing an Accepted ADR in place —
     supersede it with a new one. Example: "Status: Accepted; Deciders: architect + users TL." -->
| Field | Value |
|---|---|
| Status | Proposed / Accepted / Superseded by ADR-NNNN / Deprecated |
| Date | <YYYY-MM-DD> |
| Deciders | <roles, not just names> |
| Supersedes / Superseded by | <ADR-NNNN, or none> |
| Generated from | `adr` @ SDLC template library `0.2.2` |

## Context
<!-- Capture: the forces — problem, constraints, what made the decision necessary, grounded in facts (file path/
     incident/requirement). Avoid: opinion with no evidence. Example: "Two services wrote `<entity>`, causing
     race-condition double-posts (INC-220)." -->
<context>

## Decision
<!-- Capture: what was decided, as a clear directive. Avoid: a vague preference. Example: "`<owner service>` is
     the sole writer of `<entity>`; others call its API." -->
<decision>

## Alternatives Considered
<!-- Capture: the rejected options + WHY (the most valuable part — stops relitigation/accidental reversal).
     Avoid: listing only the chosen option. Example: "Distributed lock — adds latency + a failure mode — rejected." -->
| Alternative | Pros | Cons | Why rejected |
|---|---|---|---|

## Consequences
<!-- Capture: what gets easier/harder, follow-on obligations, the constraint agents must now respect. Avoid:
     only the upside. Example: "Agents must: never write `<entity>` rows outside `<owner service>`." -->
- **Positive:** <…>
- **Negative / cost:** <…>
- **Agents must:** <the constraint this imposes on future changes>

<!-- Include if: the decision has a defined re-evaluation trigger -->
## Revisit When
<!-- Capture: the condition under which to reconsider. Avoid: "never". Example: "if write throughput exceeds
     what a single writer can sustain." -->
- <condition under which this should be reconsidered>

# Prompt Template: Generate `Discovery.md` from Inputs

Use this prompt with an LLM to generate an implementation-ready `Discovery.md` using `Discovery.template.md`.

---

## 1) Prompt (copy-paste)

You are an SDK discovery/spec author.  
Generate a complete `Discovery.md` by filling the structure from `Discovery.template.md`.

### Inputs

1. Source docs (Confluence/JIRA/meeting notes):
   - <PASTE LINKS + CONTENT SUMMARY>

2. Relevant code paths:
   - <PASTE FILE PATHS>

3. Existing specs:
   - <PASTE SPEC PATHS>

4. Target package/module:
   - <PASTE TARGET>

### Hard Rules

1. Do not invent existing APIs/events/symbols.  
   - If not found in code, mark as `Proposed`.
2. Every requirement must have an ID (`REQ-*`) and map to:
   - at least one contract section (`API-*`, `EVT-*`, `PAY-*`, `ERR-*`)
   - and at least one test case (`TEST-*`).
3. If data is missing:
   - write `TBD`
   - add an item in `Open Questions`.
4. Use exact enum/type/symbol names where known.
5. Keep `Current State` factual and concise.
6. Keep `Target Behavior` explicit and actionable.
7. Include backward compatibility impact for each API change.
8. Keep output pure Markdown using headings/tables from template.
9. Do not omit sections; use `None` where not applicable.
10. Use ASCII only.

### Quality Bar

- The document must be sufficient for implementation planning without re-reading the source docs.
- Contract tables must be complete and internally consistent.
- Test plan must reference contract IDs.

Now generate the completed `Discovery.md`.

---

## 2) Optional Verification Prompt (recommended second pass)

After generating `Discovery.md`, run this verification prompt:

Validate this `Discovery.md` for internal consistency and implementation readiness.

Checks:

1. Every `REQ-*` appears in implementation mapping and tests.
2. Every `API-*` has compatibility impact specified.
3. Every emitted/listened event has payload type defined.
4. Every error condition has recoverability and caller action.
5. All `TBD` items appear in `Open Questions`.
6. No contradictory statements between As-Is and To-Be.
7. No fabricated symbols unless marked `Proposed`.

Output:

- PASS/FAIL
- list of issues with section references
- minimal edits required to reach PASS

---

## 3) Team Usage Notes

- Keep one `Discovery.md` per feature.
- Keep contract IDs stable across updates.
- Use changelog section for all revisions.
- In PR descriptions, reference implemented IDs (e.g., `API-002`, `EVT-004`, `TEST-007`).

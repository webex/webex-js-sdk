# ai-docs/rules/ — deeper repo rules

`AGENTS.md` carries the 5–10 **critical** rules; the repo-wide `RULES.md` is the digest; this folder
holds the **fuller, per-rule detail** an agent loads on demand.

## Use Rules For

Use rule files when a future change must consistently follow a repo-specific constraint. Keep the
short rule in `AGENTS.md` or `RULES.md`; put examples, rationale, and enforcement details here.

- **Fill-in shape:** `_rule-example.md` (Rule · Why · How to follow · Enforced by).
- **Routing:** generic rules live directly in `ai-docs/rules/`; language-specific ones in
  `ai-docs/rules/<language>/`.
- **Defer to tooling:** if a linter/CI already enforces a rule, the rule file points to that rather than
  restating it.

Each rule file carries the standard metadata header, a navigation pointer, and Capture/Avoid/Example
guidance. See `../README.md` for this reference-docs area and `../../../README.md` for global
conventions.

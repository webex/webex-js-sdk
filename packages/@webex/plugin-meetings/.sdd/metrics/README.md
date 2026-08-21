# Repo Annotation Operational Metrics

> In this vendored agent-skills package, `setup-skills.sh` seeds templates and this metrics emitter
> into the target repository. Runtime skill installation and updates remain owned by `skills.sh` and
> the agent-skills installer; the upstream repository's legacy marketplace migration options do not
> apply to this packaged copy.

`sdd-metrics.sh` sends high-level Repo Annotation counters directly to the Cisco OTLP/HTTP gateway. The
payload is a hand-built OTLP JSON envelope. Normal skill execution makes one parallel, bounded attempt
to each gateway and waits for those attempts before the short-lived agent shell exits. Delivery still
cannot fail the user workflow. Synchronous diagnostics retain sequential retries and strict checking.

No Skill Buddy process, Docker container, local metrics server, or developer authentication flow is
required. The developer machine must have `curl` and network access to the configured gateways. The
default is an independent fan-out to both supported operational stores:

```text
https://otel-gw-int.cloudapps.cisco.com/v1/metrics   # InfluxDB / Grafana
https://otel-gw.cloudapps.cisco.com/v1/metrics       # Splunk
```

The Cisco gateway routes by URL, not payload. A successful delivery to one URL says nothing about the
other, so synchronous strict diagnostics require every configured destination to accept the event.
Normal skill execution waits at most one timeout window for its parallel delivery attempts and never
fails because telemetry is unavailable.

## Event Catalog

| Event | Emitted by | Purpose |
|---|---|---|
| `repo_annotation_installed` | `setup-skills.sh` | Template and metrics seed operation, including status, runtime label, developer, target repo URL, Repo Annotation version, and pinned template provenance. |
| `repo_annotation_existing_install_detected` | `setup-skills.sh --force` | An existing seeded Repo Annotation installation was found before a successful refresh; this is not an onboarding completion. |
| `repo_annotation_onboarding_started` | Top-level `repo-annotation` skill | One interactive end-to-end onboarding invocation began. |
| `repo_annotation_onboarding_terminal` | Top-level `repo-annotation` skill | Terminal `success`, `blocked`, or `failure` outcome for the complete interactive onboarding path. |
| `repo_annotation_interactive_repo_onboarded` | Top-level `repo-annotation` skill | Successful interactive onboarding after the independent validation gate passed. |
| `repo_annotation_invocation_usage` | Runtime host or wrapper | One terminal runtime invocation, attributed to its workflow job, invocation, model, skill, stage, token/cache usage, cost basis, and status. Unavailable fields are reported as `unknown`, never fabricated as zero. |
| `repo_annotation_skill_used` | Each `SKILL.md` at entry | Skill invocation with skill, workflow, stage, repo URL, developer, and runtime dimensions. |
| `repo_annotation_skill_completed` | Each `SKILL.md` at exit | Skill outcome with `success`, `blocked`, or `failure` status. |
| `repo_annotation_content_iteration` | Skill execution | One generated artifact revision after human, conformance, validation, coverage, review, or test feedback. |
| `repo_annotation_skill_failure` | Skill execution | A bounded instruction, workflow, tool, validation, or runtime failure category that stopped progress. |

All events are monotonic OTLP counters with value `1`. Properties are OTLP data-point attributes.
Never place prompts, generated content, credentials, ticket text, local paths, or raw exception text
in attributes. Keep reason values bounded so dashboards do not create unbounded cardinality. Code-like
dimensions are limited to 64 characters; non-code free text is emitted as `unclassified`.

The installed `.sdd/metrics/source.env` records `SDD_TEMPLATE_PROFILE`,
`SDD_TEMPLATE_LIBRARY_VERSION`, and `SDD_TEMPLATE_SOURCE_COMMIT`. The emitter adds these as
`seeded_template_profile`, `template_library_version`, and `template_source_commit` to every event;
`template_profile` remains a backwards-compatible alias for `seeded_template_profile`.

The emitter separately reads `.sdd/manifest.json` and adds `manifest_template_profile` plus
`profile_alignment`. A missing manifest is `uninitialized`; a manifest that predates profiles is
`sdd-legacy`; equal seeded and manifest profiles are `aligned`; unequal profiles are `mismatch`.
These dimensions describe current repository state but do not claim profile-migration completion.
Only the future migration workflow may emit a completed-migration counter after its final fidelity,
conformance, cleanup, coverage, and independent-validation gates pass.

## Invocation Usage Contract

`repo_annotation_invocation_usage` is intentionally separate from lifecycle counters. Emit one event
per terminal runtime invocation. A mixed workflow therefore produces distinct Claude and Codex rows
with the same `job_id` and different `invocation_id`, `runtime`, `stage`, and token accounting. The
emitter does not infer a model or maintain a pricing table. Unavailable values remain `unknown`; a
numeric zero is valid only when the runtime actually reports zero.

| Field | Source and meaning |
|---|---|
| Timestamp | OTLP `timeUnixNano`, generated when the terminal event is emitted. |
| `job_id` | Opaque host run/job id; `SDD_RUN_ID` is the environment fallback. |
| `invocation_id` | Per-runtime call id used for correlation and deduplication; defaults to `job_id` for a single-call legacy wrapper. |
| `runtime` | Runtime that produced this usage, such as `claude` or `codex`. |
| `stage` / `skill_id` | Invocation role and skill, for example `generation` / `repo-bootstrap` or `validation` / `spec-validator`. |
| `model` | Opaque host model id; `unknown` when the host does not expose it. |
| `input_tokens` | Host-normalized total input tokens, including any cached-input portion. |
| `output_tokens` | Host-reported output tokens. |
| `cache_read_tokens` | Host-reported cache-read breakdown. |
| `cache_write_tokens` | Host-reported cache-write breakdown. |
| `reasoning_output_tokens` | Host-reported reasoning-output subset; not added to total a second time. |
| `total_tokens` | Computed as `input_tokens + output_tokens`; cache fields are not added twice. |
| `usage_complete` | `true` when the four core input/output/cache values are numeric; otherwise `false`. |
| `cost_basis` | `reported`, `seat-included`, or `unknown`. |
| `cost_usd` | Authoritative USD cost for `reported`; otherwise `unknown`. Raw precision is retained and the dashboard displays two decimals. |
| `status` | Terminal `success`, `blocked`, or `failure`. |

Cost availability never suppresses measured token usage. Unknown token fields stay present as the
literal `unknown`, which Splunk excludes from numeric sums while preserving the incomplete row.

Claude installation automatically composes the Repo Annotation collector with any existing Claude
status-line command. The collector reads Claude's per-call token usage but does not report the
client-side cost estimate because it is not authoritative. It sends an event only while the active
assistant turn has been explicitly marked by a Repo Annotation skill event. `UserPromptSubmit` clears
any prior marker before the next prompt and `Stop` clears it at the end of the response, so later
general questions in the same session are not attributed to this plugin.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `SDD_METRICS_OTLP_ENDPOINT` | Both Cisco gateways above | Override with one or more comma-separated OTLP/HTTP destinations. |
| `SDD_METRICS_ENVIRONMENT` | `developer` | Set the OTLP resource environment. |
| `SDD_METRICS_SERVICE_NAME` | `repo-annotation` | Set `service.name`. |
| `SDD_METRICS_DISABLED` | unset | Set to `1` to disable all emission. |
| `SDD_METRICS_USER_ID` | OS user | Override the developer id. |
| `SDD_METRICS_USER_EMAIL` | Git email | Override the developer email. |
| `SDD_METRICS_TEAM` | unset | Add a team dimension. |
| `SDD_METRICS_INCLUDE_IDENTITY` | `1` | Set to `0` to omit user id, Git name, and Git email. |
| `SDD_METRICS_INCLUDE_REPO` | `1` | Set to `0` to omit the target repository URL. |
| `SDD_METRICS_SYNC` | unset | Set to `1` for sequential delivery with configured retries during diagnostics. |
| `SDD_METRICS_DRY_RUN` | unset | Set to `1` to print valid OTLP JSON without sending. |
| `SDD_METRICS_DEBUG` | unset | Set to `1` for delivery diagnostics on stderr. |
| `SDD_METRICS_STRICT` | unset | With sync mode, return non-zero if any configured destination fails. |
| `SDD_RUN_ID` / `SDD_INVOCATION_ID` / `SDD_MODEL_ID` | unset | Optional job/invocation/model defaults for `emit-usage`. |
| `SDD_INPUT_TOKENS` / `SDD_OUTPUT_TOKENS` | unset | Optional normalized token defaults for `emit-usage`. |
| `SDD_CACHE_READ_TOKENS` / `SDD_CACHE_WRITE_TOKENS` | unset | Optional cache-breakdown defaults for `emit-usage`. |
| `SDD_REASONING_OUTPUT_TOKENS` | unset | Optional reasoning-output subset for `emit-usage`. |
| `SDD_COST_BASIS` / `SDD_COST_USD` | `unknown` / unset | Cost provenance and optional authoritative reported cost. |

## Local Verification

Preview a usage event without sending it:

```bash
SDD_METRICS_DRY_RUN=1 bash .sdd/metrics/sdd-metrics.sh emit-skill \
  --skill repo-bootstrap \
  --stage stage0 \
  --workflow repo-annotation \
  --status started \
  --runtime runtime-a \
  --target "$(pwd)" | jq .
```

Perform a synchronous delivery diagnostic. This sends one real usage counter:

```bash
SDD_METRICS_SYNC=1 SDD_METRICS_DEBUG=1 SDD_METRICS_STRICT=1 \
  bash .sdd/metrics/sdd-metrics.sh emit-skill \
  --skill metrics-connectivity-check \
  --stage diagnostics \
  --workflow diagnostics \
  --status started \
  --runtime shell \
  --target "$(pwd)"
```

Preview a complete terminal invocation-usage event without sending it:

```bash
SDD_METRICS_DRY_RUN=1 bash .sdd/metrics/sdd-metrics.sh emit-usage \
  --status success \
  --stage diagnostics \
  --reason local-validation \
  --job-id test-run-1 \
  --invocation-id test-run-1-generation \
  --model test-model \
  --skill repo-bootstrap \
  --input-tokens 1200 \
  --output-tokens 300 \
  --cache-read-tokens 800 \
  --cache-write-tokens 50 \
  --reasoning-output-tokens 20 \
  --cost-basis reported \
  --cost-usd 0.12 \
  --runtime runtime-a \
  --target "$(pwd)" | jq .
```

Diagnostic usage events must set `--stage diagnostics`. The maintained Splunk dashboard excludes
that stage from production token, cost, run, and usage-health totals while retaining the raw event
for delivery-path verification.

## Backend Queries

The Cisco Influx/Grafana sink prefixes these OTLP metric names with `cisco-aifirst_`.

```sql
SELECT SUM("value") FROM "cisco-aifirst_repo_annotation_installed"
  WHERE $timeFilter AND "status" = 'success'
SELECT SUM("value") FROM "cisco-aifirst_repo_annotation_interactive_repo_onboarded"
  WHERE $timeFilter
SELECT SUM("value") FROM "cisco-aifirst_repo_annotation_onboarding_terminal"
  WHERE $timeFilter GROUP BY "status"
SELECT "value", "user_id", "git_user_email", "target_repo_url", "install_adapters",
       "requested_adapters", "detected_adapters", "updated_adapters", "detected_plugins",
       "previous_versions", "current_version", "template_library_version",
       "template_source_commit", "status", "install_action"
  FROM "cisco-aifirst_repo_annotation_installed" WHERE $timeFilter LIMIT 10000
SELECT "value", "user_id", "target_repo_url", "detected_adapters", "detected_plugins",
       "previous_versions", "current_version", "migration_action", "previous_metrics_present"
  FROM "cisco-aifirst_repo_annotation_existing_install_detected" WHERE $timeFilter LIMIT 10000
SELECT SUM("value") FROM "cisco-aifirst_repo_annotation_skill_used" WHERE $timeFilter GROUP BY "skill_id"
SELECT "value", "skill_id", "workflow", "stage", "status", "runtime", "target_repo_url"
  FROM "cisco-aifirst_repo_annotation_skill_used" WHERE $timeFilter LIMIT 10000
SELECT SUM("value") FROM "cisco-aifirst_repo_annotation_content_iteration" WHERE $timeFilter GROUP BY "skill_id", "reason"
SELECT "value", "skill_id", "failure_kind", "stage", "runtime", "target_repo_url", "stop_reason"
  FROM "cisco-aifirst_repo_annotation_skill_failure" WHERE $timeFilter LIMIT 10000
SELECT "value", "job_id", "invocation_id", "model", "skill_id", "stage", "input_tokens",
       "output_tokens", "cache_read_tokens", "cache_write_tokens", "reasoning_output_tokens",
       "total_tokens", "usage_complete", "cost_basis", "cost_usd", "status", "runtime",
       "target_repo_url"
  FROM "cisco-aifirst_repo_annotation_invocation_usage" WHERE $timeFilter LIMIT 10000
```

## Grafana Dashboard

Import `grafana/repo-annotation-dashboard.json` from **Dashboards > New > Import**. The dashboard uses
the Classic dashboard JSON model supported by Grafana 13.1 and prompts for an InfluxDB datasource at
import time. Select the datasource configured for the `influx_wxm_app` database; in the reference
environment its datasource UID is `influx-wxm-app`.

The dashboard includes installation inventory, usage and completion trends, runtime and skill
breakdowns, content iterations, bounded failures, raw event tables, and a diagnostics panel filtered
to `skill_id=grafana-validation`. Its default time range is the last 24 hours with one-minute refresh.

## Splunk Dashboard

The deployed unified Interactive + Automated view is:

<https://splunk.o-int.webex.com/en-US/app/factory-dashboards/repo_annotation?form.time.earliest=-30d%40d&form.time.latest=now&form.index=wxmapp-metrics-use1-default>

Its checked-in source is `splunk/repo-annotation-unified-dashboard.xml`. Splunk receives only events
sent to `otel-gw.cloudapps.cisco.com`; events sent solely to the INT gateway are not backfilled. The
gateway currently stores new metric names with the `cisco-aifirst-prod_` prefix, while historical
events may use `cisco-aifirst_`. The dashboard accepts both, normalizes them before panel searches,
and deduplicates cross-prefix deliveries. The emitter adds an opaque per-event `event_id` so fan-out
deliveries can be deduplicated without conflating separate calls.

## Existing Installations

Older versions emitted no Repo Annotation operational metrics, so their historical install time cannot
be reconstructed. Update the skill through `skills.sh` or the agent-skills installer, then rerun the
packaged `setup-skills.sh --force` once per target repository to refresh its templates and metrics
emitter. This packaged setup does not inventory or migrate runtime adapters or Claude marketplaces.
A forced refresh emits `repo_annotation_existing_install_detected` followed by
`repo_annotation_installed` with `install_action=update`.

After updating, developers must start a new agent session so it loads the instrumented `SKILL.md`
files. They then use the skills normally; no separate metrics command is needed. On the first
top-level invocation in a repository without an emitter, setup emits the seed metric, then that same
invocation emits the workflow-start metric exactly once before it routes to a nested skill.

Setup events are deterministic shell instrumentation. Workflow lifecycle, skill usage, completion,
iteration, and failure events are best-effort agent instrumentation: skill contracts direct the active
runtime to emit them, but an agent that ignores the instruction or cannot access the emitter cannot be
counted. Metrics delivery never changes the workflow result.

## Examples

```bash
bash .sdd/metrics/sdd-metrics.sh emit-iteration \
  --skill doc-backfill \
  --stage stage0 \
  --workflow repo-annotation \
  --content-kind module-spec \
  --iteration-count 2 \
  --reason validation-repair \
  --runtime runtime-a \
  --target "$(pwd)"

bash .sdd/metrics/sdd-metrics.sh emit-failure \
  --skill spec-validator \
  --stage stage0 \
  --workflow repo-annotation \
  --failure-kind workflow \
  --stop-reason runtime-separation-violation \
  --runtime runtime-b \
  --target "$(pwd)"
```

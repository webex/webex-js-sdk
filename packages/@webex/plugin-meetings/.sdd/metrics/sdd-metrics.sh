#!/usr/bin/env bash

set -u

SCRIPT_VERSION="11"
# The Cisco gateways route identical OTLP payloads to different backends. Repo Annotation requires
# both operational views, so the default fans out to Grafana/Influx and Splunk. An explicit override
# may still name one or more comma-separated endpoints for diagnostics or isolated environments.
DEFAULT_OTLP_ENDPOINTS="https://otel-gw-int.cloudapps.cisco.com/v1/metrics,https://otel-gw.cloudapps.cisco.com/v1/metrics"
MAX_ATTR_VALUE_LENGTH="${SDD_METRICS_MAX_ATTR_VALUE_LENGTH:-256}"
MAX_RETRIES="${SDD_METRICS_MAX_RETRIES:-3}"
TIMEOUT_SECONDS="${SDD_METRICS_TIMEOUT_SECONDS:-3}"

usage() {
  cat <<'EOF'
Emit Repo Annotation operational metrics directly to the Cisco OTLP/HTTP gateway.

Usage:
  sdd-metrics.sh emit-install --status <success|failure> --target <repo> --sdd-root <path> --runtime <adapter-list> --mode <copy|symlink|plugin> [--install-action <fresh|update|migrate>] [--plugins <csv>] [--reason <code>] [migration inventory options]
  sdd-metrics.sh emit-existing-install --target <repo> --sdd-root <path> --runtime <adapter-list> [--detected-adapters <csv>] [--detected-paths <csv>] [--detected-plugins <csv>] [--previous-versions <csv>] [--current-version <version>] [--migration-action <action>] [--previous-metrics-present <0|1>] [--previous-commit <sha>] [--previous-ref <ref>]
  sdd-metrics.sh emit-workflow --status <started|success|blocked|failure> --target <repo> --runtime <runtime> [--reason <code>]
  sdd-metrics.sh emit-usage --status <success|blocked|failure> --job-id <id> [--invocation-id <id>] [--model <id>] [--skill <name>] --runtime <runtime> --stage <generation|validation|diagnostics|other> [--input-tokens <n|unknown>] [--output-tokens <n|unknown>] [--cache-read-tokens <n|unknown>] [--cache-write-tokens <n|unknown>] [--reasoning-output-tokens <n|unknown>] [--cost-basis <reported|seat-included|unknown>] [--cost-usd <reported-decimal>] --target <repo> [--reason <code>]
  sdd-metrics.sh emit-skill --skill <name> --status <started|invoked|success|blocked|failure> --target <repo> [--stage <stage>] [--workflow <name>] [--runtime <runtime>]
  sdd-metrics.sh emit-iteration --skill <name> --content-kind <kind> --iteration-count <n> --target <repo> [--stage <stage>] [--workflow <name>] [--reason <code>] [--runtime <runtime>]
  sdd-metrics.sh emit-failure --skill <name> --failure-kind <kind> --target <repo> [--stage <stage>] [--workflow <name>] [--stop-reason <code>] [--runtime <runtime>]

Environment:
  SDD_METRICS_DISABLED=1          Disable all metrics emission.
  SDD_METRICS_OTLP_ENDPOINT       Override the comma-separated OTLP/HTTP destinations.
  SDD_METRICS_ENVIRONMENT         Resource environment (default: developer).
  SDD_METRICS_SERVICE_NAME        Resource service name (default: repo-annotation).
  SDD_METRICS_USER_ID             Override the developer user id attribute.
  SDD_METRICS_USER_EMAIL          Override the developer email attribute.
  SDD_METRICS_TEAM                Add a team attribute.
  SDD_METRICS_INCLUDE_IDENTITY    Set to 0 to omit user id/name/email (default: 1).
  SDD_METRICS_INCLUDE_REPO        Set to 0 to omit the target repository URL (default: 1).
  SDD_METRICS_SYNC=1              Wait for delivery; useful for diagnostics/tests.
  SDD_METRICS_DRY_RUN=1           Print the OTLP payload without sending it.
  SDD_METRICS_DEBUG=1             Print delivery diagnostics to stderr.
  SDD_METRICS_STRICT=1            In sync mode, return non-zero if any destination fails.
  SDD_RUN_ID                      Default opaque job/run id for emit-usage.
  SDD_INVOCATION_ID               Default per-runtime invocation id for emit-usage.
  SDD_MODEL_ID                    Default opaque model id for emit-usage.
  SDD_INPUT_TOKENS                Default normalized input-token count for emit-usage.
  SDD_OUTPUT_TOKENS               Default output-token count for emit-usage.
  SDD_CACHE_READ_TOKENS           Default cache-read-token count for emit-usage.
  SDD_CACHE_WRITE_TOKENS          Default cache-write-token count for emit-usage.
  SDD_REASONING_OUTPUT_TOKENS     Optional reasoning-output subset for emit-usage.
  SDD_COST_BASIS                  Default cost basis: reported, seat-included, or unknown.
  SDD_COST_USD                    Authoritative USD cost when cost basis is reported.

Production delivery waits for one bounded parallel attempt to each gateway. Delivery failure never
changes the skill workflow result. Set SDD_METRICS_SYNC=1 for sequential retries and diagnostics.
EOF
}

is_true() {
  case "${1:-}" in
    1|true|TRUE|yes|YES|on|ON) return 0 ;;
    *) return 1 ;;
  esac
}

debug() {
  is_true "${SDD_METRICS_DEBUG:-0}" || return 0
  printf '[sdd-metrics] %s\n' "$*" >&2
}

os_name() {
  local system
  system="$(uname -s 2>/dev/null | tr '[:upper:]' '[:lower:]')"
  case "$system" in
    darwin) printf 'macos' ;;
    linux) printf 'linux' ;;
    msys*|mingw*|cygwin*|windows*) printf 'windows' ;;
    *) printf '%s' "${system:-unknown}" ;;
  esac
}

runtime_name() {
  printf '%s' "${SDD_RUNTIME_ID:-unknown}"
}

json_escape() {
  local value="${1:-}"
  if command -v jq >/dev/null 2>&1; then
    printf '%s' "$value" | jq -Rs .
    return
  fi
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  value="${value//$'\t'/\\t}"
  printf '"%s"' "$value"
}

sanitize_value() {
  local value="${1:-}"
  value="${value//$'\n'/ }"
  value="${value//$'\r'/ }"
  value="${value//$'\t'/ }"
  if [[ "${#value}" -gt "$MAX_ATTR_VALUE_LENGTH" ]]; then
    value="${value:0:${MAX_ATTR_VALUE_LENGTH}}"
  fi
  printf '%s' "$value"
}

bounded_code() {
  local value="${1:-}"
  [[ -n "$value" ]] || return 0
  if [[ "${#value}" -le 64 && "$value" != *[!A-Za-z0-9._-]* ]]; then
    printf '%s' "$value" | tr '[:upper:]' '[:lower:]'
  else
    printf 'unclassified'
  fi
}

bounded_count() {
  local value="${1:-}"
  if [[ "$value" =~ ^[0-9]+$ && "$value" -le 10000 ]]; then
    printf '%s' "$value"
  fi
}

bounded_usage_count() {
  local value="${1:-}"
  if [[ "$value" =~ ^[0-9]+$ && "${#value}" -le 15 ]]; then
    printf '%s' "$value"
  fi
}

normalized_usage_value() {
  local value="${1:-unknown}"
  if [[ "$value" == "unknown" ]]; then
    printf 'unknown'
  else
    bounded_usage_count "$value"
  fi
}

bounded_cost() {
  local value="${1:-}"
  if [[ "$value" =~ ^[0-9]+([.][0-9]{1,9})?$ && "${#value}" -le 32 ]]; then
    printf '%s' "$value"
  fi
}

bounded_identifier() {
  local value="${1:-}"
  if [[ -n "$value" && "${#value}" -le 128 && "$value" != *[!A-Za-z0-9._:/@-]* ]]; then
    printf '%s' "$value"
  fi
}

git_value() {
  local repo="$1"
  shift
  [[ -d "$repo" ]] || return 0
  git -C "$repo" "$@" 2>/dev/null || true
}

git_root() {
  git_value "$1" rev-parse --show-toplevel
}

repo_remote() {
  local repo="$1"
  local root remote
  root="$(git_root "$repo")"
  [[ -n "$root" ]] || return 0
  remote="$(git_value "$root" remote get-url origin)"
  if [[ -z "$remote" ]]; then
    remote="$(git_value "$root" remote get-url upstream)"
  fi
  printf '%s' "$remote"
}

repo_web_url() {
  local url="${1:-}"

  if [[ "$url" =~ ^git@([^:]+):(.+)\.git$ ]]; then
    printf 'https://%s/%s' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
    return
  fi

  if [[ "$url" =~ ^git@([^:]+):(.+)$ ]]; then
    printf 'https://%s/%s' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
    return
  fi

  if [[ "$url" =~ ^ssh://([^@]+@)?([^/]+)/(.+)$ ]]; then
    printf 'https://%s/%s' "${BASH_REMATCH[2]}" "${BASH_REMATCH[3]%.git}"
    return
  fi

  if [[ "$url" =~ ^(https?://)[^/@]+@(.+)$ ]]; then
    url="${BASH_REMATCH[1]}${BASH_REMATCH[2]}"
  fi

  if [[ "$url" =~ ^https?:// ]]; then
    printf '%s' "${url%.git}"
  fi
}

source_env_file() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
  printf '%s/source.env' "$script_dir"
}

claude_usage_marker_file() {
  local root digest runtime_dir
  root="$(git_root "${target:-$(pwd)}")"
  [[ -n "$root" ]] || root="$(cd "${target:-$(pwd)}" 2>/dev/null && pwd)"
  [[ -n "$root" ]] || return 0
  if command -v shasum >/dev/null 2>&1; then
    digest="$(printf '%s' "$root" | shasum -a 256 | awk '{print $1}')"
  elif command -v sha256sum >/dev/null 2>&1; then
    digest="$(printf '%s' "$root" | sha256sum | awk '{print $1}')"
  else
    digest="$(printf '%s' "$root" | cksum | awk '{print $1 "-" $2}')"
  fi
  runtime_dir="${CLAUDE_CONFIG_DIR:-${HOME:-}/.claude}/repo-annotation-metrics/active"
  [[ -n "$digest" && "$runtime_dir" != "/repo-annotation-metrics/active" ]] || return 0
  mkdir -p "$runtime_dir" 2>/dev/null || return 0
  printf '%s/%s.env' "$runtime_dir" "$digest"
}

is_claude_runtime() {
  local value
  value="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
  [[ "$value" == *claude* ]]
}

write_claude_usage_marker() {
  local marker skill_name stage_name terminal_status
  skill_name="$(bounded_code "${1:-repo-annotation}")"
  stage_name="$(bounded_code "${2:-entry}")"
  terminal_status="$(bounded_code "${3:-active}")"
  marker="$(claude_usage_marker_file)"
  [[ -n "$marker" ]] || return 0
  {
    printf 'started_at=%s\n' "$(date '+%s')"
    printf 'skill=%s\n' "${skill_name:-repo-annotation}"
    printf 'stage=%s\n' "${stage_name:-entry}"
    printf 'terminal_status=%s\n' "${terminal_status:-active}"
  } >"${marker}.tmp" 2>/dev/null && mv -f "${marker}.tmp" "$marker" 2>/dev/null || true
}

mark_claude_usage_terminal() {
  if is_claude_runtime "$runtime"; then
    write_claude_usage_marker "repo-annotation" "entry" "${1:-unknown}"
  fi
}

source_commit() {
  if [[ -n "${REPO_ANNOTATION_COMMIT:-}" ]]; then
    printf '%s' "$REPO_ANNOTATION_COMMIT"
    return
  fi

  local env_file
  local value
  env_file="$(source_env_file)"
  if [[ -f "$env_file" ]]; then
    value="$(sed -n 's/^REPO_ANNOTATION_COMMIT=//p' "$env_file" 2>/dev/null | head -n 1 || true)"
    if [[ -n "$value" ]]; then
      printf '%s' "$value"
      return
    fi
  fi

  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
  git_value "$script_dir" rev-parse HEAD
}

source_ref() {
  if [[ -n "${REPO_ANNOTATION_REF:-}" ]]; then
    printf '%s' "$REPO_ANNOTATION_REF"
    return
  fi

  local env_file
  local value
  env_file="$(source_env_file)"
  if [[ -f "$env_file" ]]; then
    value="$(sed -n 's/^REPO_ANNOTATION_REF=//p' "$env_file" 2>/dev/null | head -n 1 || true)"
    if [[ -n "$value" ]]; then
      printf '%s' "$value"
      return
    fi
  fi

  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
  git_value "$script_dir" branch --show-current
}

source_version() {
  if [[ -n "${REPO_ANNOTATION_VERSION:-}" ]]; then
    printf '%s' "$REPO_ANNOTATION_VERSION"
  else
    source_env_value "REPO_ANNOTATION_VERSION"
  fi
}

source_env_value() {
  local key="$1"
  local env_file
  env_file="$(source_env_file)"
  [[ -f "$env_file" ]] || return 0
  sed -n "s/^${key}=//p" "$env_file" 2>/dev/null | head -n 1 || true
}

template_library_version() {
  if [[ -n "${SDD_TEMPLATE_LIBRARY_VERSION:-}" ]]; then
    printf '%s' "$SDD_TEMPLATE_LIBRARY_VERSION"
  else
    source_env_value "SDD_TEMPLATE_LIBRARY_VERSION"
  fi
}

template_source_commit() {
  if [[ -n "${SDD_TEMPLATE_SOURCE_COMMIT:-}" ]]; then
    printf '%s' "$SDD_TEMPLATE_SOURCE_COMMIT"
  else
    source_env_value "SDD_TEMPLATE_SOURCE_COMMIT"
  fi
}

template_profile() {
  if [[ -n "${SDD_TEMPLATE_PROFILE:-}" ]]; then
    printf '%s' "$SDD_TEMPLATE_PROFILE"
  else
    source_env_value "SDD_TEMPLATE_PROFILE"
  fi
}

manifest_template_profile() {
  local target="${1:-}"
  local root manifest
  root="$(git_root "$target")"
  [[ -n "$root" ]] || root="$target"
  manifest="$root/.sdd/manifest.json"

  if [[ ! -f "$manifest" ]]; then
    printf 'uninitialized'
    return
  fi

  if ! command -v python3 >/dev/null 2>&1; then
    printf 'unknown'
    return
  fi

  python3 - "$manifest" <<'PY' 2>/dev/null || printf 'unknown'
import json
import sys

try:
    with open(sys.argv[1], encoding="utf-8") as handle:
        manifest = json.load(handle)
except (OSError, ValueError):
    raise SystemExit(1)

layout = manifest.get("layout")
if layout is None:
    profile = "sdd-legacy"
elif not isinstance(layout, dict):
    profile = "unknown"
else:
    profile = layout.get("template_profile", "sdd-legacy")

if profile not in {"sdd-legacy", "repo-standards"}:
    profile = "unknown"
print(profile, end="")
PY
}

profile_alignment() {
  local seeded_profile="${1:-}"
  local manifest_profile="${2:-}"

  if [[ "$manifest_profile" == "uninitialized" ]]; then
    printf 'uninitialized'
  elif [[ -z "$seeded_profile" || "$seeded_profile" == "unknown" || "$manifest_profile" == "unknown" ]]; then
    printf 'unknown'
  elif [[ "$seeded_profile" == "$manifest_profile" ]]; then
    printf 'aligned'
  else
    printf 'mismatch'
  fi
}

otlp_attr() {
  printf '{"key":%s,"value":{"stringValue":%s}}' \
    "$(json_escape "$1")" \
    "$(json_escape "$2")"
}

attr_pairs=()

add_attr() {
  local key="$1"
  local value
  value="$(sanitize_value "${2:-}")"
  [[ -n "$value" ]] || return 0
  attr_pairs+=("$(otlp_attr "$key" "$value")")
}

add_common_attrs() {
  local target="$1"
  local remote root seeded_profile manifest_profile alignment
  root="$(git_root "$target")"
  remote="$(repo_remote "$target")"
  seeded_profile="$(template_profile)"
  manifest_profile="$(manifest_template_profile "$target")"
  alignment="$(profile_alignment "$seeded_profile" "$manifest_profile")"

  add_attr "os" "$(os_name)"
  if is_true "${SDD_METRICS_INCLUDE_IDENTITY:-1}"; then
    add_attr "user_id" "${SDD_METRICS_USER_ID:-$(whoami 2>/dev/null || true)}"
    add_attr "git_user_name" "$(git_value "${root:-$target}" config user.name)"
    add_attr "git_user_email" "${SDD_METRICS_USER_EMAIL:-$(git_value "${root:-$target}" config user.email)}"
  fi
  add_attr "team" "${SDD_METRICS_TEAM:-}"
  if is_true "${SDD_METRICS_INCLUDE_REPO:-1}"; then
    add_attr "target_repo_url" "$(repo_web_url "$remote")"
  fi
  add_attr "repo_annotation_commit" "$(source_commit)"
  add_attr "repo_annotation_ref" "$(source_ref)"
  add_attr "repo_annotation_version" "${REPO_ANNOTATION_VERSION:-$(source_version)}"
  add_attr "template_library_version" "$(template_library_version)"
  add_attr "template_source_commit" "$(template_source_commit)"
  # Keep template_profile as the backwards-compatible seeded-profile dimension. A seeded profile
  # alone does not prove that the repository manifest has migrated to that profile.
  add_attr "template_profile" "$(bounded_code "$seeded_profile")"
  add_attr "seeded_template_profile" "$(bounded_code "$seeded_profile")"
  add_attr "manifest_template_profile" "$(bounded_code "$manifest_profile")"
  add_attr "profile_alignment" "$(bounded_code "$alignment")"
  add_attr "emitter_version" "$SCRIPT_VERSION"
  add_attr "transport" "direct_otlp_http"
}

join_attrs() {
  local joined=""
  local pair
  for pair in "${attr_pairs[@]}"; do
    if [[ -n "$joined" ]]; then
      joined+=","
    fi
    joined+="$pair"
  done
  printf '%s' "$joined"
}

build_otlp_payload() {
  local event="$1"
  local seconds nanos service_name environment service_version attrs event_id
  seconds="$(date '+%s')"
  nanos="${seconds}000000000"
  event_id="${seconds}-${BASHPID:-$$}-${RANDOM:-0}"
  service_name="${SDD_METRICS_SERVICE_NAME:-repo-annotation}"
  environment="${SDD_METRICS_ENVIRONMENT:-developer}"
  service_version="$(source_commit)"
  [[ -n "$service_version" ]] || service_version="$SCRIPT_VERSION"

  attrs="$(join_attrs)"
  if [[ -n "$attrs" ]]; then
    attrs+=","
  fi
  attrs+="$(otlp_attr "event_id" "$event_id")"

  printf '%s' '{"resourceMetrics":[{"resource":{"attributes":['
  printf '%s,' "$(otlp_attr "service.name" "$service_name")"
  printf '%s,' "$(otlp_attr "service.version" "$service_version")"
  printf '%s' "$(otlp_attr "environment" "$environment")"
  printf '%s' ']},"scopeMetrics":[{"scope":{"name":"repo-annotation-telemetry","version":"'
  printf '%s' "$SCRIPT_VERSION"
  printf '%s' '"},"metrics":[{"name":'
  printf '%s' "$(json_escape "$event")"
  printf '%s' ',"sum":{"dataPoints":[{"attributes":['
  printf '%s' "$attrs"
  printf '%s' '],"asInt":"1","startTimeUnixNano":"'
  printf '%s' "$nanos"
  printf '%s' '","timeUnixNano":"'
  printf '%s' "$nanos"
  printf '%s' '"}],"aggregationTemporality":2,"isMonotonic":true}}]}]}]}'
}

post_with_retry() {
  local endpoint="$1"
  local payload="$2"
  local max_attempts="${3:-$MAX_RETRIES}"
  local attempt=1
  local http_code curl_status

  if ! command -v curl >/dev/null 2>&1; then
    debug "curl is unavailable; metric was not delivered"
    return 1
  fi

  while [[ "$attempt" -le "$max_attempts" ]]; do
    http_code="$(curl \
      --silent \
      --show-error \
      --output /dev/null \
      --write-out '%{http_code}' \
      --request POST \
      --header 'Content-Type: application/json' \
      --connect-timeout "$TIMEOUT_SECONDS" \
      --max-time "$TIMEOUT_SECONDS" \
      --data-binary @- \
      "$endpoint" 2>/dev/null <<<"$payload")"
    curl_status="$?"

    if [[ "$curl_status" -eq 0 && "$http_code" =~ ^2[0-9][0-9]$ ]]; then
      debug "delivered metric to $endpoint (HTTP $http_code)"
      return 0
    fi

    debug "delivery attempt $attempt/$max_attempts failed (curl=$curl_status, HTTP=${http_code:-none})"
    attempt=$((attempt + 1))
  done

  return 1
}

dispatch_event() {
  local event="$1"
  local endpoint_csv endpoint payload pid
  local -a endpoints=()
  local -a pids=()
  local attempted=0
  local failures=0
  endpoint_csv="${SDD_METRICS_OTLP_ENDPOINT:-$DEFAULT_OTLP_ENDPOINTS}"
  IFS=',' read -r -a endpoints <<<"$endpoint_csv"
  payload="$(build_otlp_payload "$event")"

  if is_true "${SDD_METRICS_DRY_RUN:-0}"; then
    printf '%s\n' "$payload"
    return 0
  fi

  if is_true "${SDD_METRICS_SYNC:-0}"; then
    for endpoint in "${endpoints[@]}"; do
      # Trim only leading/trailing whitespace. Avoid xargs: it also interprets quotes and backslashes.
      endpoint="${endpoint#"${endpoint%%[![:space:]]*}"}"
      endpoint="${endpoint%"${endpoint##*[![:space:]]}"}"
      [[ -z "$endpoint" ]] && continue
      attempted=$((attempted + 1))
      post_with_retry "$endpoint" "$payload" || failures=$((failures + 1))
    done
    if is_true "${SDD_METRICS_STRICT:-0}" && { [[ "$attempted" -eq 0 ]] || [[ "$failures" -gt 0 ]]; }; then
      return 1
    fi
    return 0
  fi

  # Normal skill execution waits for one parallel attempt per endpoint. Waiting keeps short-lived
  # agent shells from terminating unsent background jobs, while parallelism bounds added latency to
  # one timeout window. Failures remain best-effort and never change the workflow result.
  for endpoint in "${endpoints[@]}"; do
    endpoint="${endpoint#"${endpoint%%[![:space:]]*}"}"
    endpoint="${endpoint%"${endpoint##*[![:space:]]}"}"
    [[ -z "$endpoint" ]] && continue
    post_with_retry "$endpoint" "$payload" 1 </dev/null >/dev/null &
    pids+=("$!")
  done
  for pid in "${pids[@]}"; do
    wait "$pid" || true
  done
  return 0
}

cmd="${1:-}"
shift || true

case "$cmd" in
  -h|--help|"")
    usage
    exit 0
    ;;
esac

status=""
target="$(pwd)"
sdd_root=""
runtime=""
mode=""
plugins=""
install_action=""
reason=""
detected_adapters=""
detected_paths=""
requested_adapters=""
updated_adapters=""
detected_plugins=""
previous_versions=""
current_version=""
migration_backup_created=""
migration_action=""
previous_metrics_present=""
previous_commit=""
previous_ref=""
skill=""
stage=""
workflow=""
content_kind=""
iteration_count=""
failure_kind=""
stop_reason=""
job_id="${SDD_RUN_ID:-}"
invocation_id="${SDD_INVOCATION_ID:-}"
model="${SDD_MODEL_ID:-}"
input_tokens="${SDD_INPUT_TOKENS:-}"
output_tokens="${SDD_OUTPUT_TOKENS:-}"
cache_read_tokens="${SDD_CACHE_READ_TOKENS:-}"
cache_write_tokens="${SDD_CACHE_WRITE_TOKENS:-}"
reasoning_output_tokens="${SDD_REASONING_OUTPUT_TOKENS:-}"
cost_basis="${SDD_COST_BASIS:-}"
cost_usd="${SDD_COST_USD:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --status) status="${2:-}"; shift 2 ;;
    --target) target="${2:-}"; shift 2 ;;
    --sdd-root) sdd_root="${2:-}"; shift 2 ;;
    --runtime) runtime="${2:-}"; shift 2 ;;
    --mode) mode="${2:-}"; shift 2 ;;
    --plugins) plugins="${2:-}"; shift 2 ;;
    --install-action) install_action="${2:-}"; shift 2 ;;
    --reason) reason="${2:-}"; shift 2 ;;
    --detected-adapters) detected_adapters="${2:-}"; shift 2 ;;
    --detected-paths) detected_paths="${2:-}"; shift 2 ;;
    --requested-adapters) requested_adapters="${2:-}"; shift 2 ;;
    --updated-adapters) updated_adapters="${2:-}"; shift 2 ;;
    --detected-plugins) detected_plugins="${2:-}"; shift 2 ;;
    --previous-versions) previous_versions="${2:-}"; shift 2 ;;
    --current-version) current_version="${2:-}"; shift 2 ;;
    --migration-backup-created) migration_backup_created="${2:-}"; shift 2 ;;
    --migration-action) migration_action="${2:-}"; shift 2 ;;
    --previous-metrics-present) previous_metrics_present="${2:-}"; shift 2 ;;
    --previous-commit) previous_commit="${2:-}"; shift 2 ;;
    --previous-ref) previous_ref="${2:-}"; shift 2 ;;
    --skill) skill="${2:-}"; shift 2 ;;
    --stage) stage="${2:-}"; shift 2 ;;
    --workflow) workflow="${2:-}"; shift 2 ;;
    --content-kind) content_kind="${2:-}"; shift 2 ;;
    --artifact-path) shift 2 ;;
    --iteration-count) iteration_count="${2:-}"; shift 2 ;;
    --failure-kind) failure_kind="${2:-}"; shift 2 ;;
    --stop-reason) stop_reason="${2:-}"; shift 2 ;;
    --job-id) job_id="${2:-}"; shift 2 ;;
    --invocation-id) invocation_id="${2:-}"; shift 2 ;;
    --model) model="${2:-}"; shift 2 ;;
    --input-tokens) input_tokens="${2:-}"; shift 2 ;;
    --output-tokens) output_tokens="${2:-}"; shift 2 ;;
    --cache-read-tokens) cache_read_tokens="${2:-}"; shift 2 ;;
    --cache-write-tokens) cache_write_tokens="${2:-}"; shift 2 ;;
    --reasoning-output-tokens) reasoning_output_tokens="${2:-}"; shift 2 ;;
    --cost-basis) cost_basis="${2:-}"; shift 2 ;;
    --cost-usd) cost_usd="${2:-}"; shift 2 ;;
    *) shift ;;
  esac
done

if is_true "${SDD_METRICS_DISABLED:-0}"; then
  exit 0
fi

if [[ -z "$runtime" ]]; then
  runtime="$(runtime_name)"
fi

require_value() {
  local name="$1"
  local value="$2"
  if [[ -z "$value" ]]; then
    debug "missing required value: $name"
    return 1
  fi
}

case "$cmd" in
  emit-install)
    require_value "--status" "$status" || exit 2
    require_value "--runtime" "$runtime" || exit 2
    require_value "--mode" "$mode" || exit 2
    [[ "$status" == "success" || "$status" == "failure" ]] || exit 2
    add_common_attrs "$target"
    add_attr "skill_id" "setup-skills"
    add_attr "workflow" "repo-annotation"
    add_attr "stage" "setup"
    add_attr "status" "$(bounded_code "$status")"
    add_attr "agent_id" "$(bounded_code "$runtime")"
    add_attr "runtime" "$(bounded_code "$runtime")"
    add_attr "install_adapters" "$runtime"
    add_attr "install_mode" "$(bounded_code "$mode")"
    add_attr "install_action" "$(bounded_code "$install_action")"
    add_attr "plugins" "$plugins"
    add_attr "requested_adapters" "$requested_adapters"
    add_attr "detected_adapters" "$detected_adapters"
    add_attr "updated_adapters" "$updated_adapters"
    add_attr "detected_plugins" "$detected_plugins"
    add_attr "previous_versions" "$previous_versions"
    add_attr "current_version" "$current_version"
    add_attr "migration_backup_created" "$migration_backup_created"
    add_attr "reason" "$(bounded_code "$reason")"
    dispatch_event "repo_annotation_installed"
    ;;
  emit-existing-install)
    require_value "--runtime" "$runtime" || exit 2
    add_common_attrs "$target"
    add_attr "skill_id" "setup-skills"
    add_attr "workflow" "repo-annotation"
    add_attr "stage" "setup"
    add_attr "status" "detected"
    add_attr "agent_id" "$(bounded_code "$runtime")"
    add_attr "runtime" "$(bounded_code "$runtime")"
    add_attr "install_adapters" "$runtime"
    add_attr "detected_adapters" "$detected_adapters"
    add_attr "detected_paths" "$detected_paths"
    add_attr "detected_plugins" "$detected_plugins"
    add_attr "previous_versions" "$previous_versions"
    add_attr "current_version" "$current_version"
    add_attr "migration_action" "$(bounded_code "$migration_action")"
    add_attr "previous_metrics_present" "$previous_metrics_present"
    add_attr "previous_repo_annotation_commit" "$previous_commit"
    add_attr "previous_repo_annotation_ref" "$previous_ref"
    add_attr "reason" "$(bounded_code "${reason:-existing_install_before_refresh}")"
    dispatch_event "repo_annotation_existing_install_detected"
    ;;
  emit-workflow)
    require_value "--status" "$status" || exit 2
    case "$status" in
      started|success|blocked|failure) ;;
      *) exit 2 ;;
    esac
    add_common_attrs "$target"
    add_attr "channel" "interactive"
    add_attr "skill_id" "repo-annotation"
    add_attr "stage" "entry"
    add_attr "workflow" "repo-annotation"
    add_attr "status" "$(bounded_code "$status")"
    add_attr "outcome" "$(bounded_code "$status")"
    add_attr "agent_id" "$(bounded_code "$runtime")"
    add_attr "runtime" "$(bounded_code "$runtime")"
    add_attr "reason" "$(bounded_code "$reason")"
    if [[ "$status" == "started" ]]; then
      if is_claude_runtime "$runtime"; then
        write_claude_usage_marker "repo-annotation" "entry" "active"
      fi
      dispatch_event "repo_annotation_onboarding_started"
    else
      mark_claude_usage_terminal "$status"
      dispatch_event "repo_annotation_onboarding_terminal"
      if [[ "$status" == "success" ]]; then
        dispatch_event "repo_annotation_interactive_repo_onboarded"
      fi
    fi
    ;;
  emit-skill)
    require_value "--skill" "$skill" || exit 2
    require_value "--status" "$status" || exit 2
    case "$status" in
      started|invoked|success|blocked|failure) ;;
      *) exit 2 ;;
    esac
    add_common_attrs "$target"
    add_attr "skill_id" "$(bounded_code "$skill")"
    add_attr "stage" "$(bounded_code "$stage")"
    add_attr "workflow" "$(bounded_code "$workflow")"
    add_attr "status" "$(bounded_code "$status")"
    add_attr "agent_id" "$(bounded_code "$runtime")"
    add_attr "runtime" "$(bounded_code "$runtime")"
    add_attr "iteration_count" "$(bounded_count "$iteration_count")"
    add_attr "reason" "$(bounded_code "$reason")"
    if [[ "$status" == "started" || "$status" == "invoked" ]]; then
      if is_claude_runtime "$runtime"; then
        write_claude_usage_marker "$skill" "${stage:-stage0}" "active"
      fi
      dispatch_event "repo_annotation_skill_used"
    else
      dispatch_event "repo_annotation_skill_completed"
    fi
    ;;
  emit-usage)
    require_value "--status" "$status" || exit 2
    require_value "--job-id or SDD_RUN_ID" "$job_id" || exit 2
    require_value "--runtime" "$runtime" || exit 2
    require_value "--stage" "$stage" || exit 2
    if [[ -z "$skill" ]]; then
      skill="repo-annotation"
    fi
    if [[ -z "$invocation_id" ]]; then
      invocation_id="$job_id"
    fi
    model="${model:-unknown}"
    input_tokens="${input_tokens:-unknown}"
    output_tokens="${output_tokens:-unknown}"
    cache_read_tokens="${cache_read_tokens:-unknown}"
    cache_write_tokens="${cache_write_tokens:-unknown}"
    reasoning_output_tokens="${reasoning_output_tokens:-unknown}"
    if [[ -z "$cost_basis" && -n "$cost_usd" ]]; then
      cost_basis="reported"
    fi
    cost_basis="${cost_basis:-unknown}"
    case "$status" in
      success|blocked|failure) ;;
      *) exit 2 ;;
    esac
    [[ -n "$(bounded_identifier "$job_id")" ]] || exit 2
    [[ -n "$(bounded_identifier "$invocation_id")" ]] || exit 2
    [[ -n "$(bounded_identifier "$model")" ]] || exit 2
    [[ "$runtime" != "unknown" ]] || exit 2
    [[ -n "$(normalized_usage_value "$input_tokens")" ]] || exit 2
    [[ -n "$(normalized_usage_value "$output_tokens")" ]] || exit 2
    [[ -n "$(normalized_usage_value "$cache_read_tokens")" ]] || exit 2
    [[ -n "$(normalized_usage_value "$cache_write_tokens")" ]] || exit 2
    [[ -n "$(normalized_usage_value "$reasoning_output_tokens")" ]] || exit 2
    case "$cost_basis" in
      reported)
        [[ -n "$(bounded_cost "$cost_usd")" ]] || exit 2
        ;;
      seat-included|unknown)
        [[ -z "$cost_usd" ]] || exit 2
        ;;
      *) exit 2 ;;
    esac
    if [[ "$input_tokens" == "unknown" || "$output_tokens" == "unknown" ]]; then
      total_tokens="unknown"
    else
      total_tokens=$((10#$input_tokens + 10#$output_tokens))
    fi
    usage_complete="false"
    if [[ "$input_tokens" != "unknown" && "$output_tokens" != "unknown" && "$cache_read_tokens" != "unknown" && "$cache_write_tokens" != "unknown" ]]; then
      usage_complete="true"
    fi
    add_common_attrs "$target"
    add_attr "job_id" "$(bounded_identifier "$job_id")"
    add_attr "invocation_id" "$(bounded_identifier "$invocation_id")"
    add_attr "model" "$(bounded_identifier "$model")"
    add_attr "channel" "interactive"
    add_attr "workflow" "repo-annotation"
    add_attr "skill_id" "$(bounded_code "$skill")"
    add_attr "stage" "$(bounded_code "$stage")"
    add_attr "reason" "$(bounded_code "$reason")"
    add_attr "status" "$(bounded_code "$status")"
    add_attr "agent_id" "$(bounded_code "$runtime")"
    add_attr "runtime" "$(bounded_code "$runtime")"
    add_attr "usage_complete" "$usage_complete"
    add_attr "input_tokens" "$(normalized_usage_value "$input_tokens")"
    add_attr "output_tokens" "$(normalized_usage_value "$output_tokens")"
    add_attr "cache_read_tokens" "$(normalized_usage_value "$cache_read_tokens")"
    add_attr "cache_write_tokens" "$(normalized_usage_value "$cache_write_tokens")"
    add_attr "reasoning_output_tokens" "$(normalized_usage_value "$reasoning_output_tokens")"
    # Inputs are already validated at 15 digits each, so their computed sum is a safe numeric value
    # that may legitimately require 16 digits.
    add_attr "total_tokens" "$total_tokens"
    add_attr "cost_basis" "$(bounded_code "$cost_basis")"
    if [[ "$cost_basis" == "reported" ]]; then
      add_attr "cost_usd" "$(bounded_cost "$cost_usd")"
    else
      add_attr "cost_usd" "unknown"
    fi
    dispatch_event "repo_annotation_invocation_usage"
    ;;
  emit-iteration)
    require_value "--skill" "$skill" || exit 2
    require_value "--content-kind" "$content_kind" || exit 2
    require_value "--iteration-count" "$iteration_count" || exit 2
    [[ -n "$(bounded_count "$iteration_count")" ]] || exit 2
    add_common_attrs "$target"
    add_attr "skill_id" "$(bounded_code "$skill")"
    add_attr "content_kind" "$(bounded_code "$content_kind")"
    add_attr "iteration_count" "$(bounded_count "$iteration_count")"
    add_attr "reason" "$(bounded_code "$reason")"
    add_attr "stage" "$(bounded_code "$stage")"
    add_attr "workflow" "$(bounded_code "$workflow")"
    add_attr "agent_id" "$(bounded_code "$runtime")"
    add_attr "runtime" "$(bounded_code "$runtime")"
    dispatch_event "repo_annotation_content_iteration"
    ;;
  emit-failure)
    require_value "--skill" "$skill" || exit 2
    require_value "--failure-kind" "$failure_kind" || exit 2
    add_common_attrs "$target"
    add_attr "skill_id" "$(bounded_code "$skill")"
    add_attr "stage" "$(bounded_code "$stage")"
    add_attr "workflow" "$(bounded_code "$workflow")"
    add_attr "status" "failure"
    add_attr "failure_kind" "$(bounded_code "$failure_kind")"
    add_attr "stop_reason" "$(bounded_code "$stop_reason")"
    add_attr "reason" "$(bounded_code "$reason")"
    add_attr "agent_id" "$(bounded_code "$runtime")"
    add_attr "runtime" "$(bounded_code "$runtime")"
    dispatch_event "repo_annotation_skill_failure"
    ;;
  *)
    usage >&2
    exit 2
    ;;
esac

exit "$?"

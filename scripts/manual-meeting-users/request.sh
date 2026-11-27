#!/usr/bin/env bash
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
url="${1:-https://sq1mrs.dmz.webex.com/wbxrestfulapi/api/v1/meetingPreferences}"
# Optional second argument selects another user's credentials directory.
credentials_dir="${2:-$script_dir}"
tracking_id="SDK_MANUAL_$(python3 -c 'import uuid; print(uuid.uuid4())')"
printf 'TrackingID: %s\n' "$tracking_id" >&2
curl --silent --show-error --include --max-time 60 \
  --header "@${credentials_dir}/authorization.header" \
  --header 'Accept: application/json' \
  --header "TrackingID: ${tracking_id}" \
  "$url"

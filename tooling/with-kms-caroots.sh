#!/usr/bin/env bash
#
# Generates the KMS CA roots (Cisco Trusted Root Store Union bundle) and exposes
# them to the SDK/tests via the WEBEX_KMS_CAROOTS environment variable, then runs
# the given command. Used by CI and locally to run integration tests against the
# real KMS with certificate validation enabled.
#
# Usage:
#   tooling/with-kms-caroots.sh yarn workspace @webex/internal-plugin-encryption test:integration

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "$#" -eq 0 ]; then
  echo "Usage: tooling/with-kms-caroots.sh <command> [args...]" >&2
  exit 1
fi

echo "Generating KMS CA roots..." >&2
WEBEX_KMS_CAROOTS="$(node "${SCRIPT_DIR}/generate-kms-caroots.js" --stdout)"
export WEBEX_KMS_CAROOTS

exec "$@"

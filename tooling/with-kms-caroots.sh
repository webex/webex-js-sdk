#!/usr/bin/env bash
#
# Generates the KMS CA roots (Cisco Trusted Root Store Union bundle) into the
# encryption integration test fixture, runs the given command, then restores the
# committed placeholder. Used by CI and locally to run the encryption
# integration/browser tests against the real KMS with validation enabled.
#
# The fixture is a plain JSON file bundled by the tests; nothing reads it at SDK
# runtime, so the shipped library does no file/network I/O for CA roots.
#
# Usage:
#   tooling/with-kms-caroots.sh yarn workspace @webex/internal-plugin-encryption test:integration

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FIXTURE="${REPO_ROOT}/packages/@webex/internal-plugin-encryption/test/integration/spec/kms-caroots.fixture.json"

if [ "$#" -eq 0 ]; then
  echo "Usage: tooling/with-kms-caroots.sh <command> [args...]" >&2
  exit 1
fi

# Restore the committed placeholder on exit so generated roots are never committed.
trap 'printf "[]\n" > "${FIXTURE}"' EXIT

echo "Generating KMS CA roots..." >&2
node "${SCRIPT_DIR}/generate-kms-caroots.js" --out "${FIXTURE}" >&2

"$@"

#!/usr/bin/env bash
set -euo pipefail

packages="$1"
dist_tag="$2"
shift 2

if [[ -z "$packages" || "$packages" == '{}' ]]; then
  echo "No npm packages selected."
  exit 0
fi

# npm's OIDC check needs the canonical source URL in each published manifest.
repository=$(node -p 'JSON.stringify(require("./package.json").repository)')
npm pkg set --json "repository=$repository" \
  --workspace @webex/cli-tools --workspace @webex/package-tools --workspace @webex/webex-server
npm pkg set repository.directory=packages/@webex/webex-server --workspace @webex/webex-server

# Use the same Yarn publisher as Widgets. Convert the runner's lockfile
# for Yarn 4 after the SDK has built the release with Yarn 3.
export YARN_YARN_PATH="$PWD/.yarn/releases/yarn-4.10.3.cjs"
YARN_ENABLE_IMMUTABLE_INSTALLS=false node "$YARN_YARN_PATH" install --mode=update-lockfile
node "$YARN_YARN_PATH" workspaces foreach -W --from "$packages" --verbose \
  run deploy:npm --access public --tag "$dist_tag" "$@"

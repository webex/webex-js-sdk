#!/usr/bin/env bash
#
# One-time machine setup for running Karma browser tests over HTTPS (KARMA_HTTPS=true).
#
# Webex services only accept CORS requests from allow-listed origins, so Karma is served from
# https://localhost.webex.com (which resolves to 127.0.0.1) on port 443 using a certificate from
# mkcert (https://github.com/FiloSottile/mkcert). This script:
#   1. installs mkcert and NSS certutil (apt-get on Linux, Homebrew on macOS) if missing
#   2. trusts the mkcert root CA (`mkcert -install`); Firefox is handled per run by the Karma runner
#   3. makes sure localhost.webex.com resolves to 127.0.0.1
#   4. allows unprivileged processes to listen on port 443 (Linux only)
#
# The "Test - Browser" job in .github/workflows/pull-request.yml runs this script with --ci.
# Re-running it is safe.

set -euo pipefail

HOST='localhost.webex.com'
PORT=443
SYSCTL_KEY='net.ipv4.ip_unprivileged_port_start'
SYSCTL_FILE='/etc/sysctl.d/99-webex-karma-https.conf'

CI_MODE=false
PERSIST=false

usage() {
  cat <<EOF
Usage: $(basename "$0") [--persist] [--ci]

Sets up this machine to run Karma browser tests over HTTPS (KARMA_HTTPS=true).

Options:
  --persist  Linux only: keep the port ${PORT} permission across reboots (writes ${SYSCTL_FILE}).
  --ci       CI mode: always pin ${HOST} in /etc/hosts and export KARMA_HTTPS=true to \$GITHUB_ENV.
  -h, --help Show this help.
EOF
}

for arg in "$@"; do
  case "$arg" in
    --persist) PERSIST=true ;;
    --ci) CI_MODE=true ;;
    -h | --help) usage; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; usage >&2; exit 1 ;;
  esac
done

log() { printf '\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf 'Error: %s\n' "$*" >&2; exit 1; }

SUDO=''
if [ "$(id -u)" -ne 0 ]; then
  command -v sudo >/dev/null 2>&1 || fail 'sudo is required for parts of this setup'
  SUDO='sudo'
fi

OS="$(uname -s)"
case "$OS" in
  Linux | Darwin) ;;
  *) fail "unsupported OS '$OS'; see packages/legacy/tools/README.md for the manual steps" ;;
esac

install_dependencies() {
  if command -v mkcert >/dev/null 2>&1 && command -v certutil >/dev/null 2>&1; then
    log 'mkcert and certutil are already installed'
    return
  fi

  if [ "$OS" = 'Linux' ]; then
    command -v apt-get >/dev/null 2>&1 \
      || fail 'please install mkcert and NSS certutil (libnss3-tools / nss-tools) with your package manager'
    log 'Installing mkcert and libnss3-tools'
    $SUDO apt-get update -qq
    $SUDO apt-get install -y -qq mkcert libnss3-tools
  else
    command -v brew >/dev/null 2>&1 || fail 'please install Homebrew, or install mkcert and nss manually'
    log 'Installing mkcert and nss'
    brew install mkcert nss
  fi
}

trust_mkcert_ca() {
  if [ "$OS" = 'Linux' ]; then
    # Chrome on Linux reads ~/.pki/nssdb, but mkcert only installs into NSS databases that exist.
    local nssdb="$HOME/.pki/nssdb"

    mkdir -p "$nssdb"
    if [ ! -f "$nssdb/cert9.db" ]; then
      certutil -d "sql:$nssdb" -N --empty-password
    fi
  fi

  log 'Trusting the mkcert root CA'
  mkcert -install
}

resolves_to_loopback() {
  node -e "require('dns').lookup('$HOST', {family: 4}, (e, a) => process.exit(!e && a === '127.0.0.1' ? 0 : 1))" \
    2>/dev/null
}

ensure_host_resolves() {
  if [ "$CI_MODE" = false ] && resolves_to_loopback; then
    log "$HOST already resolves to 127.0.0.1"
    return
  fi

  if grep -qE "^[[:space:]]*127\.0\.0\.1[[:space:]]+([^#]*[[:space:]])?${HOST//./\\.}([[:space:]]|$)" /etc/hosts; then
    log "$HOST is already pinned in /etc/hosts"
  else
    log "Pinning $HOST to 127.0.0.1 in /etc/hosts"
    echo "127.0.0.1 $HOST" | $SUDO tee -a /etc/hosts >/dev/null
  fi
}

allow_port() {
  if [ "$OS" != 'Linux' ]; then
    # macOS (10.14+) lets unprivileged processes listen on ports below 1024.
    return
  fi

  local current
  current="$(cat "/proc/sys/${SYSCTL_KEY//.//}")"

  if [ "$current" -le "$PORT" ]; then
    log "Unprivileged processes can already listen on port $PORT ($SYSCTL_KEY=$current)"
  else
    log "Allowing unprivileged processes to listen on port $PORT ($SYSCTL_KEY=$PORT, was $current)"
    $SUDO sysctl -q -w "$SYSCTL_KEY=$PORT"
  fi

  if [ "$PERSIST" = true ]; then
    log "Persisting $SYSCTL_KEY=$PORT in $SYSCTL_FILE"
    echo "$SYSCTL_KEY=$PORT" | $SUDO tee "$SYSCTL_FILE" >/dev/null
  fi
}

enable_karma_https() {
  if [ "$CI_MODE" = true ]; then
    [ -n "${GITHUB_ENV:-}" ] || fail '--ci requires the GITHUB_ENV variable'
    echo 'KARMA_HTTPS=true' >>"$GITHUB_ENV"
    log 'Exported KARMA_HTTPS=true for subsequent steps'
    return
  fi

  cat <<EOF

Setup complete. Enable HTTPS for browser tests by adding this to the repository's .env file:

  KARMA_HTTPS=true

or per run:

  KARMA_HTTPS=true yarn workspace @webex/webex-core test:browser
EOF

  if [ "$OS" = 'Linux' ] && [ "$PERSIST" = false ]; then
    echo
    echo "Note: the port $PORT permission resets on reboot; re-run this script or use --persist."
  fi
}

install_dependencies
trust_mkcert_ca
ensure_host_resolves
allow_port
enable_karma_https

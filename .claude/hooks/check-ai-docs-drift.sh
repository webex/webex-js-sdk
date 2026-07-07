#!/bin/bash
# PreToolUse hook: Block git commit if contact-center code/docs changed without spec-drift verification
#
# Flow:
#   1. Read stdin to get the Bash command (JSON at tool_input.command)
#   2. If python3 unavailable or JSON parse fails -> exit 2 (fail-closed)
#   3. If command is NOT git commit -> exit 0 (allow immediately)
#   4. Check if ANY staged files are under packages/@webex/contact-center/
#   5. If none -> exit 0 (allow)
#   6. Check for verification marker (created by /spec-drift-changed)
#   7. If marker exists -> exit 0 (allow — marker stays until content changes)
#   8. If no marker -> exit 2 (BLOCK, instruct to run /spec-drift-changed)

CC_PKG="packages/@webex/contact-center"

# Ensure python3 is available
if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 is required for the spec-drift pre-commit hook but was not found."
  echo "Install python3 or remove this hook from .claude/settings.json to proceed."
  exit 2
fi

# Read tool input from stdin (JSON with tool_input.command)
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)

# Fail-closed: if we couldn't parse the command, block rather than silently allow
if [ -z "$COMMAND" ]; then
  echo "ERROR: Could not parse tool input. Blocking commit as a safety measure."
  exit 2
fi

# Only gate git commit commands (precise match to avoid catching git commit-tree, etc.)
case "$COMMAND" in
  "git commit"|git\ commit\ *) ;;  # Continue to check
  *) exit 0 ;;                      # Not a commit, allow immediately
esac

# Get staged files under the contact-center package
STAGED_CC=$(git diff --cached --name-only 2>/dev/null | grep "^${CC_PKG}/")

if [ -z "$STAGED_CC" ]; then
  exit 0  # No contact-center files staged, allow commit
fi

# Compute hash from staged content (not just paths) to detect re-staged changes
HASH=$(git diff --cached -- "$CC_PKG" | (shasum 2>/dev/null || sha256sum) | cut -d' ' -f1)
MARKER="/tmp/.spec-drift-verified-${HASH}"

if [ -f "$MARKER" ]; then
  exit 0  # Verified, allow commit (marker stays — invalidated naturally when content changes)
fi

# Block the commit
echo "BLOCKED: contact-center files are staged but ai-docs have not been verified for spec drift."
echo ""
echo "Staged contact-center files:"
echo "$STAGED_CC" | sed 's/^/  - /'
echo ""
echo "Run /spec-drift-changed to validate ai-docs against source code before committing."
echo "The command will check documentation accuracy and create a verification marker."
exit 2  # Exit code 2 = blocking error in Claude Code hooks

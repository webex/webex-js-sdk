#!/bin/bash
# PreToolUse hook: Block git commit if contact-center code/docs changed without spec-drift verification
#
# Flow:
#   1. Read stdin to get the Bash command (JSON at tool_input.command)
#   2. If command is NOT git commit -> exit 0 (allow immediately)
#   3. Check if ANY staged files are under packages/@webex/contact-center/
#   4. If none -> exit 0 (allow)
#   5. Check for verification marker (created by /spec-drift-changed)
#   6. If marker exists -> delete it, exit 0 (allow, one-time pass)
#   7. If no marker -> exit 2 (BLOCK, instruct to run /spec-drift-changed)

CC_PKG="packages/@webex/contact-center"

# Read tool input from stdin (JSON with tool_input.command)
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('tool_input',{}).get('command',''))" 2>/dev/null)

# Only gate git commit commands
case "$COMMAND" in
  git\ commit*) ;;  # Continue to check
  *) exit 0 ;;      # Not a commit, allow immediately
esac

# Get staged files under the contact-center package
STAGED_CC=$(git diff --cached --name-only 2>/dev/null | grep "^${CC_PKG}/")

if [ -z "$STAGED_CC" ]; then
  exit 0  # No contact-center files staged, allow commit
fi

# Compute hash of all staged contact-center files
HASH=$(echo "$STAGED_CC" | sort | shasum | cut -d' ' -f1)
MARKER="/tmp/.spec-drift-verified-${HASH}"

if [ -f "$MARKER" ]; then
  rm -f "$MARKER"  # One-time use
  exit 0           # Verified, allow commit
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

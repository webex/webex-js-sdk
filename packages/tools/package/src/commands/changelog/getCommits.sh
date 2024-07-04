#!/bin/bash

# Check if the previous commit hash is provided as an argument
if [ -z "$1" ]; then
  echo "Usage: $0 <prevCommit>"
  exit 1
fi

# Assign the provided argument to a variable
prevCommit=$1

# List all commits that came after the provided commit hash
commits=$(git log --pretty=format:'"%H":"%s",' $prevCommit..HEAD)

# Remove the trailing comma from the last commit entry
commits=${commits%?}

# Enclose the output in curly braces to form a valid JSON object
echo "{$commits}"

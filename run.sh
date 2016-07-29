#!/bin/bash

# Don't fail if the following fail
ps aux | grep node | grep -v node | awk '{print $2}' | xargs kill > /dev/null 2> /dev/null
ps aux | grep sc | grep -v sc | awk '{print $2}' | xargs kill > /dev/null 2> /dev/null
ps aux | grep grunt | grep -v grunt | awk '{print $2}' | xargs kill > /dev/null 2> /dev/null

# Now, fail if anything fails
set -e

# Ensure all internal tools are using the internal registry
export NPM_CONFIG_REGISTRY=http://engci-maven-master.cisco.com/artifactory/api/npm/webex-npm-group

# The first time Jenkins runs a job on a machine, it executes from the Jenkins
# home directory instead of the workspace directory. Make sure we're always
# running this script in the right place.
if [ -n "${WORKSPACE+1}" ]; then
  mkdir -p $WORKSPACE
  cd $WORKSPACE
fi

if [[ $NODE_LABELS == *"DOCKER_SLAVE"* ]]; then
  # I have no idea why the next line is required
  source ~/.nvm/nvm.sh
  nvm use 4
else
  NVM_DIR="`pwd`/.nvm"
  mkdir -p $NVM_DIR

  if [ -e $NVM_DIR/nvm.sh ]; then
    source $NVM_DIR/nvm.sh
  else
    if ! grep -qc 'nvm.sh' "$HOME/.bashrc" ; then
      echo '# Use the next comment to prevent the nvm installer from modifying bashrc'
      echo '# nvm.sh' >> $HOME/.bashrc
    fi

    curl https://raw.githubusercontent.com/creationix/nvm/v0.25.3/install.sh | NVM_DIR="$NVM_DIR" bash
    source $NVM_DIR/nvm.sh
  fi

  # Use node 0.10.40
  nvm install 4
fi

# Make sure we're using npm 2.x
NPM_MAJOR_VERSION=$(npm --version | awk -F'.' '{print $1}')
if [ "${NPM_MAJOR_VERSION}" = "1" ]; then
  npm install -g --registry=http://engci-maven-master.cisco.com/artifactory/api/npm/webex-npm-group npm@2.x
fi

if [ -n "$BUILD_NUMBER" ]; then
  echo "Build Number: $BUILD_NUMBER"
else
  BUILD_NUMBER=-1
  echo "Build Number not set, defaulting to $BUILD_NUMBER"
fi

# Make sure we have the github.com remote setup
set +e
git remote | grep -qc ghc
IS_MISSING_GHC_REMOTE=$?
set -e
if [ "${IS_MISSING_GHC_REMOTE}" = "1" ]; then
  git remote add ghc git@github.com:ciscospark/spark-js-sdk.git
fi

# Avoid Host key verification failed errors
ssh-keyscan -t rsa github.com >> ~/.ssh/known_hosts

# Run whatever command was passed to the script.
eval $@

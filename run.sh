#!/bin/bash

# Don't fail if the following fail
ps aux | grep node | grep -v node | awk '{print $2}' | xargs kill > /dev/null 2> /dev/null
ps aux | grep sc | grep -v sc | awk '{print $2}' | xargs kill > /dev/null 2> /dev/null
ps aux | grep grunt | grep -v grunt | awk '{print $2}' | xargs kill > /dev/null 2> /dev/null

# Now, fail if anything fails
set -e

#
# CONFIGURE NODE
#

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

echo "################################################################################"
if [ -n "$BUILD_NUMBER" ]; then
  echo "# Build Number: $BUILD_NUMBER"
else
  BUILD_NUMBER=-1
  echo "# Build Number not set, defaulting to $BUILD_NUMBER"
fi
echo "################################################################################"


#
# PREPARE DOCKER ENVIRONMENT
#

cd $(dirname $0)
export SDK_ROOT_DIR="$(pwd)"
export WORKDIR="${SDK_ROOT_DIR}"

# Pass environment variables to container at runtime
DOCKER_RUN_ENV=""
if [ -n "${CONVERSATION_SERVICE}" ]; then
  DOCKER_RUN_ENV+=" -e CONVERSATION_SERVICE=${CONVERSATION_SERVICE} "
fi
if [ -n "${DEVICE_REGISTRATION_URL}" ]; then
  DOCKER_RUN_ENV+=" -e DEVICE_REGISTRATION_URL=${DEVICE_REGISTRATION_URL} "
fi
if [ -n "${ATLAS_SERVICE_URL}" ]; then
  DOCKER_RUN_ENV+=" -e ATLAS_SERVICE_URL=${ATLAS_SERVICE_URL} "
fi
if [ -n "${HYDRA_SERVICE_URL}" ]; then
  DOCKER_RUN_ENV+=" -e HYDRA_SERVICE_URL=${HYDRA_SERVICE_URL} "
fi
if [ -n "${WDM_SERVICE_URL}" ]; then
  DOCKER_RUN_ENV+=" -e WDM_SERVICE_URL=${WDM_SERVICE_URL} "
fi
if [ -n "${ENABLE_NETWORK_LOGGING}" ]; then
  DOCKER_RUN_ENV+=" -e ENABLE_NETWORK_LOGGING=${ENABLE_NETWORK_LOGGING} "
fi
if [ -n "${ENABLE_VERBOSE_NETWORK_LOGGING}" ]; then
  DOCKER_RUN_ENV+=" -e ENABLE_VERBOSE_NETWORK_LOGGING=${ENABLE_VERBOSE_NETWORK_LOGGING} "
fi
if [ -n "${BUILD_NUMBER}" ]; then
  DOCKER_RUN_ENV+=" -e BUILD_NUMBER=${BUILD_NUMBER} "
fi
if [ -n "${PIPELINE}" ]; then
  DOCKER_RUN_ENV+=" -e PIPELINE=${PIPELINE} "
fi
if [ -n "${COMMON_IDENTITY_OAUTH_SERVICE_URL}" ]; then
  DOCKER_RUN_ENV+=" -e COMMON_IDENTITY_OAUTH_SERVICE_URL=${COMMON_IDENTITY_OAUTH_SERVICE_URL} "
fi
if [ -n "${SKIP_FLAKY_TESTS}" ]; then
  DOCKER_RUN_ENV+=" -e SKIP_FLAKY_TESTS=${SKIP_FLAKY_TESTS} "
fi

export DOCKER_CONTAINER_NAME="${JOB_NAME}-${BUILD_NUMBER}-builder"

# Push runtime config data into the container definition and build it
cat <<EOT >>./docker/builder/Dockerfile
RUN groupadd -g $(id -g) jenkins
RUN useradd -u $(id -u) -g $(id -g) -m jenkins
WORKDIR ${WORKDIR}
USER $(id -u)
EOT

set +e
docker build -t ${DOCKER_CONTAINER_NAME} ./docker/builder
EXIT_CODE=$?
if [ "${EXIT_CODE}" -ne "0" ]; then
  echo "Docker build failed, making attempt 2"
  docker build -t ${DOCKER_CONTAINER_NAME} ./docker/builder
  EXIT_CODE=$?
  if [ "${EXIT_CODE}" -ne "0" ]; then
    echo "Docker build failed, making attempt 3"
    docker build -t ${DOCKER_CONTAINER_NAME} ./docker/builder
    EXIT_CODE=$?
  fi
fi
set -e

# Reset the Dockerfile to make sure we don't accidentally commit it later
git checkout ./docker/builder/Dockerfile

export DOCKER_RUN_OPTS="${DOCKER_RUN_ENV}"
# Cleanup the container when done
export DOCKER_RUN_OPTS="${DOCKER_RUN_OPTS} --rm"
# Make sure the npm cache stays inside the workspace
export DOCKER_RUN_OPTS="${DOCKER_RUN_OPTS} -e NPM_CONFIG_CACHE=${WORKDIR}/.npm"
# Mount the workspace from the Jenkins slave volume
export DOCKER_RUN_OPTS="${DOCKER_RUN_OPTS} --volumes-from ${HOSTNAME}"
# Run commands as Jenkins user
export DOCKER_RUN_OPTS="${DOCKER_RUN_OPTS} --user=$(id -u):$(id -g)"
# Use the computed container name
export DOCKER_RUN_OPTS="${DOCKER_RUN_OPTS} ${DOCKER_CONTAINER_NAME}"

#
# MAKE SECRETS AVAILABLE TO AUX CONTAINERS
#

# Remove secrets on exit
trap "rm -f .env" EXIT

cat <<EOF >.env
COMMON_IDENTITY_CLIENT_SECRET=${CISCOSPARK_CLIENT_SECRET}
CISCOSPARK_CLIENT_SECRET=${CISCOSPARK_CLIENT_SECRET}
SAUCE_USERNAME=${SAUCE_USERNAME}
SAUCE_ACCESS_KEY=${SAUCE_ACCESS_KEY}
EOF

#
# REMOVE REMNANT SAUCE FILES FROM PREVIOUS BUILD
#

rm -rf .sauce/*/sc.pid
rm -rf .sauce/*/sc.tid
rm -rf .sauce/*/sc.ready
rm -rf .sauce/*/sauce_connect.log

#
# SET DEFAULT CONCURRENCY
#

if [ "${CONCURRENCY}" == "" ]; then
  export CONCURRENCY=3
fi

#
# CLEANUP CONTAINERS ON EXIT
#

trap "docker rmi ${DOCKER_CONTAINER_NAME}" EXIT

#
# RUN THE COMMAND THAT WAS PASSED TO THIS SCRIPT
#
eval $@

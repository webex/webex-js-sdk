#!/bin/bash

# Don't fail if the following fail
ps aux | grep node | grep -v node | awk '{print $2}' | xargs kill > /dev/null 2> /dev/null
ps aux | grep sc | grep -v sc | awk '{print $2}' | xargs kill > /dev/null 2> /dev/null
ps aux | grep grunt | grep -v grunt | awk '{print $2}' | xargs kill > /dev/null 2> /dev/null

# Now, fail if anything fails
set -e

if [ -n "${SDK_BUILD_DEBUG}" ]; then
  set -x
fi

#
# CONFIGURE NODE
#

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
fi

# Always use install. If that version is installed, it's the same as use and if
# it's not installed, you won't spend half an hour trying to figure out what
# exit code 3 is.
nvm install 6.10.1

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

cd "$(dirname $0)"
SDK_ROOT_DIR="$(pwd)"
export SDK_ROOT_DIR
WORKDIR="${SDK_ROOT_DIR}"
export WORKDIR

# Pass environment variables to container at runtime
DOCKER_ENV_FILE="${SDK_ROOT_DIR}/docker-env"
export DOCKER_ENV_FILE
rm -f ${DOCKER_ENV_FILE}

DOCKER_ENV_KEYS=""
DOCKER_ENV_KEYS+="ATLAS_SERVICE_URL "
DOCKER_ENV_KEYS+="BUILD_NUMBER "
DOCKER_ENV_KEYS+="CISCOSPARK_APPID_ORGID "
DOCKER_ENV_KEYS+="CONVERSATION_SERVICE "
DOCKER_ENV_KEYS+="COMMON_IDENTITY_OAUTH_SERVICE_URL "
DOCKER_ENV_KEYS+="DEVICE_REGISTRATION_URL "
DOCKER_ENV_KEYS+="ENABLE_NETWORK_LOGGING "
DOCKER_ENV_KEYS+="ENABLE_VERBOSE_NETWORK_LOGGING "
DOCKER_ENV_KEYS+="HYDRA_SERVICE_URL "
DOCKER_ENV_KEYS+="MESSAGE_DEMO_CLIENT_ID "
DOCKER_ENV_KEYS+="MESSAGE_DEMO_CLIENT_SECRET "
DOCKER_ENV_KEYS+="PIPELINE "
DOCKER_ENV_KEYS+="SAUCE_IS_DOWN "
DOCKER_ENV_KEYS+="SDK_BUILD_DEBUG "
DOCKER_ENV_KEYS+="SKIP_FLAKY_TESTS "
DOCKER_ENV_KEYS+="WDM_SERVICE_URL "
DOCKER_ENV_KEYS+="WORKSPACE "
DOCKER_ENV_KEYS+="JS_SDK_NPM_TOKEN "
# We don't want to fail if grep doesn't find the specified var
set +e
for KEY in $DOCKER_ENV_KEYS; do
  env | grep "${KEY}" >> ${DOCKER_ENV_FILE}
done
set -e

export DOCKER_CONTAINER_NAME="${JOB_NAME}-${BUILD_NUMBER}-builder"

if ! docker images | grep -qc ${DOCKER_CONTAINER_NAME}; then
  # Push runtime config data into the container definition and build it
  cat <<EOT >>./docker/builder/Dockerfile
RUN groupadd -g $(id -g) jenkins
RUN useradd -u $(id -u) -g $(id -g) -m jenkins
RUN echo '//registry.npmjs.org/:_authToken=${JS_SDK_NPM_TOKEN}' > $HOME/.npmrc
RUN mkdir -p /home/jenkins && chown $(id -u):$(id -g) /home/jenkins
RUN echo '//registry.npmjs.org/:_authToken=${JS_SDK_NPM_TOKEN}' > /home/jenkins/.npmrc
WORKDIR ${WORKDIR}
USER $(id -u)
EOT

  for DOCKER_BUILD_ITERATION in $(seq 1 3); do
    echo "Docker build ${DOCKER_BUILD_ITERATION}: building"

    set +e
    docker build -t ${DOCKER_CONTAINER_NAME} ./docker/builder
    EXIT_CODE=$?
    if [ "${EXIT_CODE}" == "0" ]; then
      echo "Docker build ${DOCKER_BUILD_ITERATION}: succeeded"
      break
    fi
    echo "Docker build ${DOCKER_BUILD_ITERATION}: failed"
  done

  if [ "${EXIT_CODE}" -ne "0" ]; then
    exit 30
  fi

  # Reset the Dockerfile to make sure we don't accidentally commit it later
  git checkout ./docker/builder/Dockerfile
fi

DOCKER_RUN_OPTS="--env-file ${DOCKER_ENV_FILE}"
# Cleanup the container when done
DOCKER_RUN_OPTS="${DOCKER_RUN_OPTS} --rm"
# Make sure the npm cache stays inside the workspace
DOCKER_RUN_OPTS="${DOCKER_RUN_OPTS} -e NPM_CONFIG_CACHE=${WORKDIR}/.npm"
# Mount the workspace from the Jenkins slave volume
DOCKER_RUN_OPTS="${DOCKER_RUN_OPTS} --volumes-from ${HOSTNAME}"
# Run commands as Jenkins user
DOCKER_RUN_OPTS="${DOCKER_RUN_OPTS} --user=$(id -u):$(id -g)"
# Use the computed container name
DOCKER_RUN_OPTS="${DOCKER_RUN_OPTS} ${DOCKER_CONTAINER_NAME}"
export DOCKER_RUN_OPTS

#
# MAKE SECRETS AVAILABLE TO AUX CONTAINERS
#

# Remove secrets on exit
trap "rm -f .env" EXIT

cat <<EOF >.env
COMMON_IDENTITY_CLIENT_SECRET=${CISCOSPARK_CLIENT_SECRET}
CISCOSPARK_APPID_SECRET=${CISCOSPARK_APPID_SECRET}
CISCOSPARK_CLIENT_SECRET=${CISCOSPARK_CLIENT_SECRET}
SAUCE_USERNAME=${SAUCE_USERNAME}
SAUCE_ACCESS_KEY=${SAUCE_ACCESS_KEY}
EOF

#
# SET DEFAULT CONCURRENCY
#

if [ "${CONCURRENCY}" == "" ]; then
  export CONCURRENCY=3
fi

#
# CLEANUP CONTAINERS ON EXIT
#
# disabling for now. run.sh gets called multiple times, which leads to multiple
# builds of the same container. this also has weird effects if there are still
# containers running. Jason tells me docker is configured to aggressively GC, so
# this should be fine.
# trap "docker rmi ${DOCKER_CONTAINER_NAME}" EXIT

#
# RUN THE COMMAND THAT WAS PASSED TO THIS SCRIPT
#
eval "$@"

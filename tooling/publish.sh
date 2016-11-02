#!/bin/bash

set -e

cd $(dirname $0)

DOCKER_RUN_OPTS="--rm --volumes-from ${HOSTNMAME} spark-js-sdk-builder"

echo "################################################################################"
echo "# PUBLISHING NEW VERSIONS TO NPM"
echo "################################################################################"

cd "${SDK_ROOT_DIR}"
echo '//registry.npmjs.org/:_authToken=${NPM_TOKEN}' > ~/.npmrc
REG="${NPM_CONFIG_REGISTRY}"
unset NPM_CONFIG_REGISTRY
npm run lerna -- exec -- bash -c "npm publish --access public || true"
export NPM_CONFIG_REGISTRY="${REG}"
rm -f ~/.npmrc

VERSION=$(git reflog -n 1 | grep "commit: v." | awk '{print $4}')
if [ -n "${VERSION}" ]; then
  git push origin "${VERSION}":"${VERSION}"
fi

echo "################################################################################"
echo "# PUBLISHING NEW DOCUMENENTATION"
echo "################################################################################"
npm run grunt:concurrent -- publish:docs

echo "Published ${VERSION}"

# LAST_LOG=$(git log -1 --pretty=%B)
#
# if [[ ${LAST_LOG} == "#release"* ]]; then
#   # Remove command commit, but allow it to dirty the workspace if it includes
#   # changes
#   git reset HEAD^
#   HAS_CHANGES=$(git status --porcelain | wc -l)
#   if [ "${HAS_CHANGES}" -ne "0" ]; then
#     echo "################################################################################"
#     echo "# After removing command commit, local workspace has changes"
#     echo "################################################################################"
#     echo git status
#     echo "################################################################################"
#     echo "# Command commits should not make changes, exiting"
#     echo "################################################################################"
#     exit 1
#   fi
#
#   VERSION=$(echo ${LAST_LOG} | sed -e 's/#release //g' | sed -e 's/^\s*//g' | sed -e 's/\s$//g')
# fi

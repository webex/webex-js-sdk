#!/bin/bash

set -e

echo "################################################################################"
echo "# REBUILDING WITHOUT NODE_ENV"
echo "################################################################################"
unset NODE_ENV
docker run ${DOCKER_RUN_OPTS} npm run build

echo "################################################################################"
echo "# BUILDING EXAMPLE APP"
echo "################################################################################"
docker run -e PACKAGE=example-phone -e NODE_ENV=production ${DOCKER_RUN_OPTS} npm run grunt:package -- webpack:build

echo "################################################################################"
echo "# BUILDING WIDGETS"
echo "################################################################################"
docker run -e PACKAGE=widget-message-meet -e NODE_ENV=production ${DOCKER_RUN_OPTS} npm run grunt:package build


echo "################################################################################"
echo "# BUILDING DOCS"
echo "################################################################################"
npm run grunt:concurrent -- build:docs

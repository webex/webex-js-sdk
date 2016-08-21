#!/bin/bash

#
# This is the entry point for the docker suite. Its purpose is to redirect all
# output produced by the container to a file
#

set -e

/work/retry.sh > reports/logs/docker-${PACKAGE}.log 2>&1

#!/bin/bash

set -e

export SAUCE=true

if [ -z "$SAUCE_USERNAME" ]; then
  export $(grep SAUCE_USERNAME .env | xargs)
  export $(grep SAUCE_ACCESS_KEY .env | xargs)
fi

if [ -n "${PACKAGE}" ]; then
  TID_FILE=.sauce/${PACKAGE}/sc.tid
else
  TID_FILE=.sauce/sc.tid
fi
mkdir -p .sauce/${PACKAGE}

set -e
export SC_TUNNEL_IDENTIFIER=$(cat ${TID_FILE} 2> /dev/null || true)
set +e

if [ -z $SC_TUNNEL_IDENTIFIER ]; then
  export SC_TUNNEL_IDENTIFIER=$(echo 'console.log(require("uuid").v4())' | node)
  echo $SC_TUNNEL_IDENTIFIER > ${TID_FILE}
fi

eval $@

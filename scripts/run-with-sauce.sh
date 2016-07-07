#!/bin/bash

set -e

export SAUCE=true

if [ -z "$SAUCE_USERNAME" ]; then
  export $(grep SAUCE_USERNAME .env | xargs)
  export $(grep SAUCE_ACCESS_KEY .env | xargs)
fi

set -e
export SC_TUNNEL_IDENTIFIER=$(cat .sauce.tid 2> /dev/null || true)
set +e

if [ -z $SC_TUNNEL_IDENTIFIER ]; then
  export SC_TUNNEL_IDENTIFIER=$(echo 'console.log(require("uuid").v4())' | node)
  echo $SC_TUNNEL_IDENTIFIER > .sauce.tid
fi

eval $@

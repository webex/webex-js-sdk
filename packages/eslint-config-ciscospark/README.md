# @ciscospark/eslint-rules

See https://ciscospark.github.io/spark-js-sdk/

Common eslint rules used by Cisco Spark

## Installation

Eslint doesn't let us put plugins in sharable configs, so use the following command to install all peer dependencies needed by `eslint-config-ciscospark`.

```bash
(
  export PKG=eslint-config-ciscospark
  npm info "$PKG@latest" peerDependencies --json \
    | command sed 's/[\{\},]//g ; s/: /@/g' \
    | xargs npm install --save-dev "$PKG@latest"
)
```

Which produces and runs a command like:

npm install --save-dev eslint-config-ciscospark eslint@^#.#.# eslint-plugin-import@^#.#.# eslint-plugin-jsx-a11y@^#.#.# eslint-plugin-mocha@^#.#.# eslint-plugin-react@^#.#.#

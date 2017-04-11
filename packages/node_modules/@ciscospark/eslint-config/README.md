# @ciscospark/eslint-rules

See https://ciscospark.github.io/spark-js-sdk/

Common eslint rules used by Cisco Spark

## Installation

Eslint doesn't let us put plugins in shareable configs, so use the following command to install all peer dependencies needed by `@ciscospark/eslint-config`.

```bash
(
  export PKG=@ciscospark/eslint-config
  npm info "$PKG@latest" peerDependencies --json \
    | command sed 's/[\{\},]//g ; s/: /@/g' \
    | xargs npm install --save-dev "$PKG@latest"
)
```

Which produces and runs a command like:

npm install --save-dev @ciscospark/eslint-config eslint@^#.#.# eslint-plugin-import@^#.#.# eslint-plugin-jsx-a11y@^#.#.# eslint-plugin-mocha@^#.#.# eslint-plugin-react@^#.#.#

## Usage

By default, we export a set of es2015 rules encouraging use of import/export. You can use this ruleset with simply

```yaml
extends: "@ciscospark"
```

Additionally, you may be interested in:

### ES5 Rules
```yaml
extends: "@ciscospark/eslint-config/es5"
root: true
```
### ES2015 rules without import/export
```yaml
extends: "@ciscospark/eslint-config/es2015"
root: true
```
### ES2015 with React additions
```yaml
extends:
- "@ciscospark"
- "@ciscospark/eslint-config/react"
root: true
```

### Mocha preset to avoid committing `.only`
> Note: this does not have a `root:true` so that you can drop in a subdirectory that will otherwise receive config from a higher-level file.
```yaml
extends: "@ciscospark/eslint-config/mocha"
```
### For writing scripts
```yaml
extends:
- "@ciscospark/eslint-config/es2015"
- "@ciscospark/eslint-config/bin"
root: true
```

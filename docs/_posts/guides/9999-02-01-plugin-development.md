---
layout:      guide
title:       "Plugin Development"
categories:  guides
description: "Adding new plugins to the Cisco Spark JavaScript SDK"
redirect_from:
  - /example/plugin-development/
---

# External Dependencies

- We test against the current LTS version of Node JS, but node 4 or later should work. We use [nvm](https://github.com/creationix/nvm) but there are numerous options available for getting the right node version.
- Depending on what you're working on, you'll need [graphicsmagick](http://www.graphicsmagick.org/)

# Get the code and build the SDK

1. Fork the sdk on github.com.
2. Clone your fork

    ```bash
    git clone git@github.com:<YOUR GITHUB USERNAME>/spark-js-sdk.git
    ```

3. Set up the upstream remote

    ```bash
    git remote add upstream git@github.com:ciscospark/spark-js-sdk.git
    git fetch upstream
    ```

4. Configure master to track and rebase from upstream

    ```bash
    git checkout master
    git branch --set-upstream-to upstream/master
    git config branch.master.rebase true
    ```

5. Install dependencies and build packages

    In order to interact with test users, we need a module that is not publicly available. You'll need access to the @ciscospark npm org which means that, for now, only Cisco employees will be able to run tests.

    ```bash
    npm install
    npm run build
    ```

6. Link the yeoman generator
    The sdk ships with a yeoman generator to aid in getting your plugin started. In order to stay in sync with the current preferred layout, use the generator that ships with the sdk rather than the one published to npm.

    ```bash
    cd packages/node_modules/generator-ciscospark
    npm link
    ```

7. Install the `yo` cli tool

    ```bash
    npm install -g yo
    ```

# Creating your plugin

Now that you've got your environment set up, adding a new plugin is as simple as

```bash
yo ciscospark:plugin plugin-PLUGINNAME
```

> If you're creating a new sdk package that's not intended to be a plugin (e.g helper-html), you can use `yo ciscospark:package PACKAGENAME`

You'll get a new folder in `/packages/node_modules` with eslint files in the right place, a `package.json` with the bare minimum to create a plugin, some scaffolding for your test directory, and just enough files for your plugin to load and do nothing.

## Plugin Structure

- ./src - source code
- ./test/unit/spec - unit tests
- ./test/integration/spec - integration tests
- ./test/automation/spec - automation tests

> See [SCRIPTS.md](SCRIPTS.md) for commands for building and testing the sdk.

## Tips
- During development, you can avoid rebuilding before each test run by replacing `"main": "dist/index.js"` with `"main": "src/index.js"` in `packages/node_modules/*/package.json`. This won't quite work in Karma, but if you apply the same replacement to *only* the package under test, that package will recompile on change; other packages will need to be rebuilt.
- If your git history has a comment containing `#no-push`, you can push to jenkins, run all your tests, and see the result without merging to master.
- CircleCI runs static-analysis and unit tests on every PR update.

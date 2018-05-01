---
layout:      guide
title:       "Plugin Development"
categories:  guides
description: "Adding new plugins to the Cisco Webex JS SDK"
redirect_from:
  - /example/plugin-development/
---

# External Dependencies

- We test against the current LTS version of Node JS, but node 4 or later should work. We use [nvm](https://github.com/creationix/nvm) but there are numerous options available for getting the right node version.
- Depending on what you're working on, you'll need [graphicsmagick](http://www.graphicsmagick.org/)

# Get the code and build the SDK

1. Fork the SDK on github.com.
2. Clone your fork

    ```bash
    git clone git@github.com:<YOUR GITHUB USERNAME>/spark-js-sdk.git
    ```

3. Set up the upstream remote

    ```bash
    git remote add upstream git@github.com:webex/spark-js-sdk.git
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

# Creating your plugin

  Use one of the existing packages or plugins as a template. It's important your package's name matches the folder it's in.

## Plugin Structure

- ./src - source code
- ./test/unit/spec - unit tests
- ./test/integration/spec - integration tests
- ./test/automation/spec - automation tests

> See [CONTRIBUTING.md](https://github.com/webex/spark-js-sdk/blob/master/CONTRIBUTING.md) for commands for building and testing the SDK.

## Tips
- During development, you can avoid rebuilding before each test run by replacing `"main": "dist/index.js"` with `"main": "src/index.js"` in `packages/node_modules/*/package.json`. This won't quite work in Karma, but if you apply the same replacement to *only* the package under test, that package will recompile on change; other packages will need to be rebuilt.
- If your git history has a comment containing `#no-push`, you can push to jenkins, run all your tests, and see the result without merging to master.
- CircleCI runs static-analysis and unit tests on every PR update.

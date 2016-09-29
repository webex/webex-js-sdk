---
layout:      example
title:       "Plugin Development"
categories:  example
description: "Adding new plugins to the Cisco Spark JavaScript SDK"
---

# External Dependencies

- You'll need node 4 or later (We use [nvm](https://github.com/creationix/nvm) but there are numerous options available for getting the right node version)
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

  In order to interact with test users, we need a module that is not publicly available, so point at the internal npm registry during install. Unless you completely blow away your node modules directory, you won't need to worry about this again. (Yes, this means that, for now, you'll need to be on a cisco network to setup your development environment)

  ```bash
  export NPM_CONFIG_REGISTRY=http://engci-maven-master.cisco.com/artifactory/api/npm/webex-npm-group
  npm install
  npm run bootstrap
  npm run build
  ```

6. Link the yeoman generator
  The sdk ships with a yeoman generator to aid in getting your plugin started. In order to stay in sync with the current preferred layout, use the generator that ships with the sdk rather than the one published to npm.

  ```bash
  cd packages/generator-ciscospark
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

> If you're creating a new sdk package that's not intended to be a plugin (e.g helper-html), you can use
```bash
yo ciscospark:package PACKAGENAME
```

You'll get a new folder in `/packages` with eslint files in the right place, a `package.json` with the bare minimum to create a plugin, some scaffolding for your test directory, and just enough files for your plugin to load and do nothing.

## Plugin Structure

./src - source code
./test/unit/spec - unit tests
./test/integration/spec - integration tests
./test/automation/spec - automation tests

## Useful Commands

In order to minimize duplicate dependencies and lots of directory switching, all commands can (and should) be run from the sdk root directory.

### Build

```bash
PACKAGE=PACKAGENAME npm run grunt:package -- build
```

### Run tests

```bash
PACKAGE=PACKAGENAME npm run grunt:package -- test
```

### Run just unit tests
Handy during early plugin development when you can write a bunch of unit tests.

```bash
UNIT_ONLY=true PACKAGE=PACKAGENAME npm run grunt:package -- test
```

### Run the tests, but only in nodejs
Usually faster, and can build on the fly, thus no need to rebuild everything between test runs

```bash
PACKAGE=PACKAGENAME npm run grunt:package -- express:test test:node
```

### Run tests in-browser in debug mode
Keeps the browser open so that you can reload set break points and reload the page

```bash
KARMA_DEBUG=true PACKAGE=PACKAGENAME npm run grunt:package -- express:test test:browser
```

### Serve the package
This is mostly useful for the the example app(s), but also comes in handy when debugging the credentials plugins automation tests.

```bash
PACKAGE=PACKAGENAME npm run grunt:package -- serve
```

### Run unit tests in watch mode

OK, this one's a handfull and requires a global package, but there were too many possible variants to hardcode it any where.

```bash
npm install -g nodemon
nodemon -w packages/PACKAGENAME/src -w packages/PACKAGENAME/test -x "UNIT_ONLY=true PACKAGE=PACKAGENAME npm run --silent grunt:package express:test test:node"
```

## Tips
- During development, you can avoid rebuilding before each test run by replacing `"main": "dist/index.js"` with `"main": "src/index.js"` in `packages/*/package.json`. This won't quite work in Karma, but if you apply the same replacement to *only* the package under test, that package will recompile on change; other packages will need to be rebuilt.
- If your git history has a comment containing `#no-push`, you can push to jenkins, run all your tests, and see the result without merging to master.
- CircleCI runs static-analysis and unit tests on every PR update.

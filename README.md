# spark-js-sdk

> Monorepo containing the Cisco Spark JavaScript SDKs (both current and legacy).

[ciscospark](/packages/ciscospark) is a collection of node modules targeting our [external APIs](https://developers.ciscospark.com). Its core libraries take inspiration from our web client's Legacy SDK.

This README primarily discusses the tooling required to develop the Cisco Spark SDK.

## Table of Contents

- [Install](#Install)
- [Usage](#Usage)
- [Contribute](#Contribute)
- [License](#License)

## Install

Install tooling dependencies with

```bash
npm install
```

Install module dependencies with
```bash
npm run bootstrap
```
(This installs dependencies to packages/\*/node_modules)

## Usage

The following commands should be run from the SDK root directory. Tooling dependencies are typically defined only in the root node_modules directory to avoid duplicates. (eslint is installed in each package directory because many editors, or at least Atom, get confused by the monorepo layout and which eslint binary to use).

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

## Contribute

Pull requests welcome. Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for more details.

## License

&copy; 2016 Cisco and/or its affiliates. All Rights Reserved.

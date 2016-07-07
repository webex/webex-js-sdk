# Cisco Spark JavaScript SDKs

## Ciscospark

[ciscospark](/packages/ciscospark) is a collection of node modules targeting our [external APIs](https://developers.ciscospark.com). Its core libraries take inspiration from our web client's Legacy SDK.

```bash
npm install --save ciscospark
```

### Building

At this time, a prebuilt version of ciscospark is not available. If your project already uses [browserify](http://browserify.org), this won't be an issue. If not, you'll need to clone the repository and build it with:

```bash
npm install -g browserify
npm install
npm run bootstrap
grunt --gruntfile Gruntfile.concurrent.js build
browserify --standalone ciscospark packages/ciscospark > bundle.js
```

Note that when when building for the browser, you'll need define one or more of `CISCOSPARK_ACCESS_TOKEN`, `COMMON_IDENTITY_CLIENT_ID`, `COMMON_IDENTITY_CLIENT_SECRET`, `COMMON_IDENTITY_REDIRECT_URI`, `COMMON_IDENTITY_SCOPE`, `SCOPE`, and `COMMON_IDENTITY_SERVICE` or use `ciscospark.init()` to set those values at runtime. See Environment Setup (below) and the ciscospark README for more info on those values.

## Legacy SDK

The Ciscospark Legacy SDK makes up the core of our web client. As its functionality gets further modularized, it will be superseded by the plugins that make up Ciscospark.

Note: the legacy sdk has an optional dependency on GraphicksMagic. In order to successfully create thumbnails when submitting files to a conversation, you must have GraphicksMagic installed.

### Building

At this time, a prebuilt version of the legacy sdk is not available. If your project already uses [browserify](http://browserify.org), this won't be an issue. If not, you'll need to clone the repository and build it with:

```bash
npm install -g browserify
browserify --standalone Spark . > bundle.js
```

## Running the Tests

### Environment Setup

Install dependencies:

```
# Install top-level dependencies
npm install
# Install dependencies for each module in ./packages and locally link unpublished modules as needed
npm run bootstrap
```

You'll to create a file called `.env` that defines, at a minimum:

- `COMMON_IDENTITY_CLIENT_ID`
- `COMMON_IDENTITY_CLIENT_SECRET`
- `COMMON_IDENTITY_REDIRECT_URI`
- `COMMON_IDENTITY_SCOPE`
- `SCOPE`
- `COMMON_IDENTITY_SERVICE`
- `PORT`
- `FIXTURE_PORT`
- `KARMA_PORT`

Yes, `SCOPE` and `COMMON_IDENTITY_SCOPE` are redundant and should have the same values. Don't ask, you need to define both.

`COMMON_IDENTITY_SERVICE` should probably always be `spark`.

`PORT`, `FIXTURE_PORT`, and `KARMA_PORT` can mostly be any valid port, but when running tests via Sauce Labs, be sure to check their acceptable ports list. Good defaults are `8000`, `9000`, `8001`, respectively.

To run tests via Sauce Labs, you'll also need to define:

- `SAUCE_USERNAME`
- `SAUCE_ACCESS_KEY`

### Packages

Build all packages
```bash
grunt --gruntfile Gruntfile.concurrent.js build
```

Build a single package
```bash
PACKAGE=<name> grunt --gruntfile Gruntfile.package.js build
```

Run all tests
```bash
grunt --gruntfile Gruntfile.concurrent.js test
```

Run tests for a single package
```bash
PACKGE=<name> grunt --gruntfile Gruntfile.package.js test
```

Test behavior can be modified via environment variables.

Run all tests via Sauce Labs with code coverage and xunit output
```bash
COVERAGE=true SAUCE=true XUNIT=true grunt --gruntfile Gruntfile.concurrent.js test
```

Run tests for a single package via Sauce Labs with code coverage and xunit output
```bash
PACKAGE=<name> COVERAGE=true SAUCE=true XUNIT=true grunt --gruntfile Gruntfile.package.js test
```

### Legacy

`grunt test:unit`

`grunt test:integration`

`grunt test:karma`

`grunt test[:<target>] [--coverage=TRUE] [--pipeline=TRUE] [--sauce=true] [--xunit=TRUE]`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

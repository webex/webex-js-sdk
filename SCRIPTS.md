# Scripts

> This is a placeholder to avoid merge conflicts. The contents of this file probably belong in CONTRIBUTING.md.

The following npm scripts are the main entrypoints for building and testing the Cisco Spark JavaScript SDK.

## build

Build all packages.

```bash
npm run build
```

## deps:generate

Detect dependencies for each package and insert into the appropriate `package.json`.

```bash
npm run deps:generate
```

## lint:js

Lint all JavaScript files.

```bash
npm run lint:js
```

## test

Options may be specified as switches or via environment variables.

Test all packages

```bash
npm test
```

See all options

```bash
npm test -- --help
```

Test a single package

```bash
npm test -- --package @ciscospark/spark-core
```

Test a single package, but only in a browser

```bash
npm test -- --package @ciscospark/spark-core --browser
```

Test a single package and generate coverage and xunit reports

```bash
npm test -- --package @ciscospark/spark-core --coverage --xunit
```

## sauce:start, sauce:run, sauce:stop

Start the sauce tunnel, run tests using Sauce Labs browsers, and stop the Sauce tunnel

```bash
npm run sauce:start
npm run sauce:run -- npm test
npm run sauce:stop
```

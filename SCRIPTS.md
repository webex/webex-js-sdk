# Scripts

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

Keeps the browser open in debug mode so that you can set break points and reload the page with code updates

```bash
npm test -- --package @ciscospark/spark-core --browser --karma-debug
```

## sauce:start, sauce:run, sauce:stop

Start the sauce tunnel, run tests using Sauce Labs browsers, and stop the Sauce tunnel

```bash
npm run sauce:start
npm run sauce:run -- npm test
npm run sauce:stop
```

## distsrc

Points all of the `package.json`s' main entry to their "src" folder. This is useful when testing because it doesn't require you to build a "dist" folder before every run of the test.

```bash
npm run distsrc
```

## srcdist

Used to undo the changes made with `distsrc`.

```bash
npm run srcdist
```

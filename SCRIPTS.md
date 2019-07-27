# Scripts

The following npm scripts are the main entrypoints for building and testing the Cisco Webex JS SDK.

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
npm test -- --packages @webex/webex-core
```

Test a single package, but only in a browser

```bash
npm test -- --packages @webex/webex-core --browser
```

Test a single package, but only in a specific browser

```bash
BROWSER=chrome npm test -- --packages @webex/webex-core --browser
```

Test a single package and generate coverage and xunit reports

```bash
npm test -- --packages @webex/webex-core --coverage --xunit
```

Test a single package using [snapshots](https://github.com/flickr/yakbak#yakbak) rather than live network requests. **The test must be run in Node.**

```bash
npm test -- --packages @webex/webex-core --node --snapshots
```

Keeps the browser open in debug mode so that you can set break points and reload the page with code updates

```bash
npm test -- --packages @webex/webex-core --browser --karma-debug
```

## SauceLabs

The SDK uses [SauceLabs](https://saucelabs.com/) to run its tests. Sign in to retrieve your *USERNAME* and *ACCESS KEY* from [User Settings](https://saucelabs.com/beta/user-settings) and add them to your `.env` file:

- `SAUCE_USERNAME`
- `SAUCE_ACCESS_KEY`

Start the SauceLabs tunnel, run tests using SauceLabs browsers, and stop the SauceLabs tunnel

```bash
# Run all tests on SauceLabs with default configuration
SAUCE=true npm run test
# Run the samples automation tests on SauceLabs
SAUCE=true npm run samples:test
# Run `plugin-teams` test suite on SauceLabs only only Edge and IE 11
SAUCE=true npm run test -- --packages @webex/plugin-teams --os Windows --browsers Edge IE
# Run all tests on SauceLabs only with Chrome on Mac and Windows
SAUCE=true npm run test -- --browsers Chrome
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

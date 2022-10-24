# Scripts

The following npm scripts are the main entry points for building and testing the Cisco Webex JS SDK.

## build

Build all packages.

```bash
yarn run build
```

Build a single package.

```bash
yarn run build:package @webex/webex-core
```

## lint:js

Lint all JavaScript files.

```bash
yarn run lint:js
```

## test

Options may be specified as switches or via environment variables.

Test all packages.

```bash
npm test
```

See all options.

```bash
npm test -- --help
```

Test a single package.

```bash
npm test -- --packages @webex/webex-core
```

Test a single package, but only in a browser.

```bash
npm test -- --packages @webex/webex-core --browser
```

Test a single package, but only in a specific browser.

```bash
BROWSER=chrome npm test -- --packages @webex/webex-core --browser
```

Test a single package and generate coverage and XUnit reports.

```bash
npm test -- --packages @webex/webex-core --coverage --xunit
```

Test a single package using [snapshots](https://github.com/flickr/yakbak#yakbak) rather than live network requests. **The test must be run in Node.**

```bash
npm test -- --packages @webex/webex-core --node --snapshots
```

Keeps the browser open in debug mode so that you can set break points and reload the page with code updates.

```bash
npm test -- --packages @webex/webex-core --browser --karma-debug
```

## Run the samples automation tests locally

Make sure Java JDK is installed on your machine to run test locally.

```bash
yarn run samples:test
```

### Sauce Labs

The SDK uses [Sauce Labs](https://saucelabs.com/) to run its tests. Sign in to retrieve your _USERNAME_ and _ACCESS KEY_ from [User Settings](https://saucelabs.com/beta/user-settings) and add them to your `.env` file:

- `SAUCE_USERNAME`
- `SAUCE_ACCESS_KEY`

Start the Sauce Labs tunnel, run tests using Sauce Labs browsers, and stop the Sauce Labs tunnel:

```bash
# Run all tests on Sauce Labs with default configuration
SAUCE=true yarn run test

# Run the samples automation tests on Sauce Labs
SAUCE=true yarn run samples:test

# Run `plugin-teams` test suite on Sauce Labs only only Edge and IE 11
SAUCE=true yarn run test --packages @webex/plugin-teams --os Windows --browsers Edge IE

# Run all tests on Sauce Labs only with Chrome on Mac and Windows
SAUCE=true yarn run test --browsers Chrome

```

### distsrc

Points all of the `package.json`s' main entry to their `src/` folder. This is useful when testing because it doesn't require you to build a `dist/` folder before every run of the test.

```bash
yarn run distsrc
```

### srcdist

Used to undo the changes made with `distsrc`.

```bash
yarn run srcdist
```

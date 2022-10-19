# Contributing Code

> Similar to the [standard contributing insructions](https://github.com/webex/webex-js-sdk/blob/master/CONTRIBUTING.md#contributing-code).

## Usage

## Build Dependencies

Before you can build the Cisco Webex JS SDK, you will need:

- [Node.js](https://nodejs.org/) (LTS)
  - We recommend using [nvm](https://github.com/creationix/nvm) (or [nvm-windows](https://github.com/coreybutler/nvm-windows))
    to easily switch between Node.js versions.
  - Install the latest Node.js Long Term Support using `nvm install --lts`
  - Install the latest npm to enable security audits using `npm install npm@latest -g`
- [Git](https://git-scm.com/)

### .env

Create a file called `.env` in the project root that defines:

WEBEX_CLIENT_SECRET="[get the shared client secret here](https://cisco.box.com/s/phyd6usx1ga6vf06tdzx5bxn9epnwc2w)"

WEBEX_ACCESS_TOKEN="[get your personal access token here](https://developer.webex.com/docs/api/getting-started#accounts-and-authentication)"

### npm

- [Enable 2-factor authentication](https://docs.npmjs.com/getting-started/using-two-factor-authentication)
- [Sign into NPM](https://docs.npmjs.com/private-modules/ci-server-config#how-to-create-a-new-authentication-token) so that you can install the private package `@webex/test-helper-test-users`. This package generates temporary test users.

### SauceLabs

[Follow these instructions](https://github.com/webex/webex-js-sdk/blob/master/SCRIPTS.md#saucelabs) to use SauceLabs.

## Build the SDK

Fork the [webex-js-sdk](https://github.com/webex/webex-js-sdk/) repository and `git clone` your fork:

```bash
git clone https://github.com/YOUR-USERNAME/webex-js-sdk.git
```

Install tooling dependencies.

> See [Build Dependencies](#build-dependencies) above for `nvm` and `npm` details.

```bash
npm install
```

*Build issues?* See [BUILD-ISSUES.md](https://github.com/webex/webex-js-sdk/blob/master/BUILD-ISSUES.md) for help.

## Contribute to the `plugin-meetings` branch

We will work off of the `plugin-meetings` branch from `master`.

### Set up remote

```bash
git remote add upstream git@github.com:webex/webex-js-sdk.git
```

### Track `plugin-meetings`

```bash
git checkout --track upstream/plugin-meetings
```

### Create a feature branch

> You may find prefixing feature branches with the JIRA ticket number helpful, like in this example.

```bash
git checkout -b 39555-new-feature plugin-meetings
```

### Run the sample

#### Developers

```bash
# Point all package.json files to the src directory instead of the dist directory.
npm run distsrc
```

#### Testers

```bash
# Transpile the code into the dist directory.
npm run build
```

> Individual packages containing samples can usually be run this way:
> ```
> npm run serve:package -- --env.package @webex/plugin-meetings
> ```
> However, `webex` does not get compiled properly for `plugin-meetings` using this method, so do the following instead.


```bash
# Run the "sample app" sample.
npm run samples:meetings
```

- Visit https://localhost:8000/
- Copy/paste **Your Personal Access Token** from [Cisco Webex for Developers](https://developer.webex.com/docs/api/getting-started) and click *connect*.
- Use the **Dialer** to *create* a Meeting object, *join* it, and *addMedia*, like video and audio.

> This sample does not join a meeting in one click on purpose. It is meant to demonstrate the different commands available, and their sequence, to developers. Other samples will be created in the future.
>
> See also https://github.com/webex/webex-js-sdk#samples.

---

🔮 Do your magical feature development here!

---

### Run tests

Use `npm run distsrc` to point each package's `main` entry at the raw src and let `babel` compile on the fly.

```bash
# Point all package.json files to the src directory instead of the dist directory.
npm run distsrc
# Run the package tests.
npm test -- --packages @webex/plugin-meetings
```

You can use the `--unit`, `--integration`, `--automation`, and `--documentation` switches to control what types of tests you run and `--node` and `--browser` to control which environments your tests run in.

`--browser --karma-debug` will run the browser tests with `{singleRun: false}`, thus allowing automatic rerunning everytime you save a file (though, karma does eventually get confused and you need to interrupt and restart the command).

```bash
# Example running browser tests in debug mode.
npm test -- --packages @webex/plugin-teams --browser --karma-debug
```

> See [SCRIPTS.md](https://github.com/webex/webex-js-sdk/blob/master/SCRIPTS.md) to learn how to run tests on [SauceLabs](https://saucelabs.com/) and more.

```bash
# Point all package.json files back to the dist directory.
npm run srcdist
```

### Commit changes

The SDK enforces relatively strict commit messages to version its packages and keep language similar.

Here is an example committing a new feature. Notice the *package name* in parentheses.

```bash
git commit -a -m 'feat(plugin-meetings): add ability to join a meeting'
```

See [Git Commit Guidelines](https://github.com/webex/webex-js-sdk/blob/plugin-meetings/CONTRIBUTING.md#git-commit-guidelines) for full details.

## Submit a pull request

Open a [new pull request](https://github.com/webex/webex-js-sdk/compare/plugin-meetings...master) against the `plugin-meetings` branch and select the people you wish to review it.

After it's approved, merge your changes into the `plugin-meetings` branch.

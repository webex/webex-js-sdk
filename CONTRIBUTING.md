# Contributing

We'd love for you to contribute to our source code and to make **Webex Javascript SDK** even better than it is today!
If you would like to contribute to this repository by adding features, enhancements or bug fixes, you must follow our process:

  1. Let core members know about your proposal by posting a message in the [contributor's Webex space](https://eurl.io/#Bk9WGfRcB)
  2. A core member will review your proposal and if necessary may suggest to have a meeting to better understand your approach
      - You are welcomed you join our [weekly review meeting](https://cisco.webex.com/m/f4ebbec6-c306-49ca-83f4-fb2d098fc946) (Thursdays, 11:30a-12:30p PST) to propose your contribution as well
  3. If your proposal is approved you should start coding at this point
  4. We recommend opening a draft PR to receive feedback before finalizing your solution
      - When opening a draft PR, specify with PR comments where in the code you would like to get feedback
  5. Before opening a PR ensure **all** [PR guidelines](#submitting-a-pull-request) are followed
  6. Let core members know about your PR by posting a message in the [contributor's Webex space](https://eurl.io/#Bk9WGfRcB)
  7. Core members will review the pull request and provide feedback when necessary
      - If a PR is too large, you may be asked to break it down into multiple smaller-scoped PRs
  8. Once the PR is approved by a core member, it will be merged
  9. Celebrate! Your code is released 🎈🎉🍻

## Table of Contents

- [Contributing](#contributing)
  - [Table of Contents](#table-of-contents)
  - [Reporting Issues](#reporting-issues)
  - [Contributing Code](#contributing-code)
    - [Build Dependencies](#build-dependencies)
    - [Building the SDK](#building-the-sdk)
    - [Environment Variables](#environment-variables)
      - [Advanced Environment Variables](#advanced-environment-variables)
    - [Running Tests](#running-tests)
      - [Running Samples Locally](#running-samples-locally)
      - [Samples Tests](#samples-tests)
        - [Local Samples Tests](#local-samples-tests)
        - [Mobile Samples Tests (Sauce)](#mobile-samples-tests-sauce)
        - [Local Mobile Samples Tests](#local-mobile-samples-tests)
    - [Git Commit Guidelines](#git-commit-guidelines)
      - [Commit Message Format](#commit-message-format)
      - [Revert](#revert)
      - [Type](#type)
      - [Scope](#scope)
      - [Subject](#subject)
      - [Body](#body)
      - [Footer](#footer)
      - [Special Commit Messages](#special-commit-messages)
        - [`[skip npm]`](#skip-npm)
        - [`[skip ci]`](#skip-ci)
    - [Submitting a Pull Request](#submitting-a-pull-request)
    - [Pull Request Checklist](#pull-request-checklist)
  - [Updating the Documentation](#updating-the-documentation)
    - [Set Up Environment (with Bundler)](#set-up-environment-with-bundler)
    - [Compile and Serve Docs](#compile-and-serve-docs)

## Reporting Issues

Please reach out to our developer support team for any issues you may be experiencings with the SDK.

- <https://developer.webex.com/support>
- <devsupport@webex.com>

## Contributing Code

### Build Dependencies

Before you can build the Cisco Webex JS SDK, you will need the following dependencies:

- [Node.js](https://nodejs.org/) (LTS)
  - We recommend using [nvm](https://github.com/creationix/nvm) (or [nvs](https://github.com/jasongin/nvs) on Windows _(not WSL)_) to easily switch between Node.js versions
  - Run `nvm use` to set your node version to the one this package expects
    - If the required node version is not installed, `nvm`/`nvs` will tell you the command needed to install it
  - Install the latest npm to enable security audits using `npm install -g npm@latest`
- [Git](https://git-scm.com/)
- [node-gyp](https://www.npmjs.com/package/node-gyp)
  - This is used during the dependency install process and is used to compile some native add-on modules
  - Install with `npm install -g node-gyp`
    - On Windows _(not WSL)_, follow [Option 1](https://github.com/nodejs/node-gyp#option-1) on node-gyp's repo, as this will automatically install python 2 and neccessary build dependencies
- [Python 2.7](https://www.python.org/download/releases/2.7/)
  - This is also used during the dependency install process
  - Attempting to update dependencies with a Python 3.x environment will fail
- [jq](https://github.com/stedolan/jq#jq)
  - jq processes JSON objects in bash. We use this command throughout our tooling
  - Follow [these instructions on how to install `jq` in your system](https://stedolan.github.io/jq/download/)

> #### NOTE FOR WINDOWS 10
>
> **We suggest using [Windows Subsystem for Linux](https://docs.microsoft.com/en-us/windows/wsl/about) (WSL) for the best experience on Windows.** We've seen multiple tooling/package related errors when trying to build on a regular Windows environment. The build errors are a result of third-party node_modules that we do not maintain. These issues are not seen when using WSL.

### Building the SDK

Ensure that you have followed all the steps outlined in [Build Dependencies](#build-dependencies).

Fork the [webex-js-sdk](https://github.com/webex/webex-js-sdk/) repository and `git clone` your fork:

```bash
git clone https://github.com/your-username/webex-js-sdk.git
```

Install tooling dependencies with:

```bash
nvm use
npm install
```

Build the SDK:

```bash
npm run build
```

If at any point your out-of-the-box builds or failing or if you are tests are failing with complaints of an invalid node version, the following commands will reset and rebuild everything:

```bash
nvm use; npm ci
```

By default npm uses `sh` which does not support the glob syntax and as such `distsrc` and `srcdist` will fail with *No such file or directory*. To fix this you can set npm to use bash instead using:

```bash
npm config set script-shell "/bin/bash"
```

### Environment Variables

You will need to create a file called `.env` that defines, at a minimum:

- `WEBEX_CLIENT_ID`
- `WEBEX_CLIENT_SECRET`
- `WEBEX_REDIRECT_URI`
- `WEBEX_SCOPE`

You can get these values by registering a new integration on [Cisco Webex for Developers](https://developer.webex.com/my-apps/new/integration).

#### Advanced Environment Variables

The JS SDK allows you to customize your experience via configuration and environment variables. In general, external developers will not need to set any of the URL related environment variables.

| **Environment Variable** | **Details** | **Default** |
|---|---|---|
| ATLAS_SERVICE_URL | Used to populate the atlasServiceUrl pre discovery config | https://atlas-a.wbx2.com/admin/api/v1 |
| CLIENT_LOGS_SERVICE_URL | Used to populate the clientLogsServiceUrl pre discovery config | https://client-logs-a.wbx2.com/api/v1 |
| CONVERSATION_SERVICE | Used for validating an auth token | https://conv-a.wbx2.com/conversation/api/v1 |
| ENABLE_MERCURY_LOGGING | When set, will log all mercury messages | undefined |
| ENABLE_VERBOSE_NETWORK_LOGGING | Utilized to enable interceptor logging | undefined |
| ENCRYPTION_SERVICE_URL | Used for plugin-board tests | https://encryption-a.wbx2.com |
| HYDRA_SERVICE_URL | Stores the public hydra api url for managing Webex resources. | https://api.ciscospark.com/v1/ |
| IDBROKER_BASE_URL | Used throughout the SDK as the endpoint for authorization | https://idbroker.webex.com |
| IDENTITY_BASE_URL | Used to communicate with the identity api | https://identity.webex.com |
| MERCURY_FORCE_CLOSE_DELAY | Milliseconds to wait for a before declaring the socket dead | 2000 |
| MERCURY_PING_INTERVAL | Milliseconds between pings sent up the socket | 15000 |
| MERCURY_PONG_TIMEOUT | Milliseconds to wait for a pong before declaring the connection dead | 14000 |
| METRICS_SERVICE_URL | Used to populate the metricsServiceUrl pre discovery config | https://metrics-a.wbx2.com/metrics/api/v1 |
| U2C_SERVICE_URL | Stores the service catalog collecting url, typically the **U2C** service. | https://u2c.wbx2.com/u2c/api/v1 |
| WEBEX_ACCESS_TOKEN | Used to provide access token when using "webex/env" | undefined |
| WEBEX_AUTHORIZE_URL | Populdates the Authorization URL which prompts for user's password. | https://idbroker.webex.com/idb/oauth2/v1/authorize |
| WEBEX_AUTHORIZATION_STRING | This is the authorization url for the integration from [Cisco Webex for Developers](https://developer.webex.com/my-apps) | undefined |
| WEBEX_CLIENT_ID | The Webex client ID used to authorize | undefined |
| WEBEX_CLIENT_SECRET | The Webex client secret used to authorize | undefined |
| WEBEX_CONVERSATION_CLUSTER_SERVICE | Service identifier used to lookup conversation servers in hostmap | identityLookup |
| WEBEX_CONVERSATION_DEFAULT_CLUSTER | Cluster used to convert from "us" cluster to actual cluster | urn:TEAM:us-east-2_a:identityLookup |
| WEBEX_LOG_LEVEL | Maximum log level that should be printed to the console. | log |
| WEBEX_REDIRECT_URI | The URI to redirect to after authorization | undefined |
| WEBEX_SCOPE | The Webex scope the users will authorize with | undefined |
| WDM_SERVICE_URL | The WDM service url before the catalog is downloaded | https://wdm-a.wbx2.com/wdm/api/v1 |
| WHISTLER_API_SERVICE_URL | The url to the whistler test service | https://whistler-prod.allnint.ciscospark.com/api/v1 |
| WHISTLER | Run (meetings) tests using Whistler users | FALSE |
| JENKINS | Run specific tests that should be run on (internal) Jenkins | FALSE |

### Running Tests

`npm test` is the entrypoint to our test runner, but its not practical to use without parameters; the full suite would take over two hours to run and cross talk would probably cause tests to break each other.

> Get the full test-runner docs via `npm test -- --help`.

A local development flow might look like

1. Edit source code in `MYPACKAGE`.
2. Use `npm run build` to build all packages .
3. Use `npm test -- --packages @webex/MYPACKAGE --node` to run the tests for just that package only in nodejs (Usually, we don't need to test both in node and the browser during development).
4. Repeats steps 1-3 until the tests pass.

`npm run build` is a bit tedious when making lots of changes, so instead, we can use `npm run distsrc` to point each package's `main` entry at the raw src and let `babel` compile on the fly.

1. At the start of development, run `npm run distsrc` once.
2. Edit source code in `MYPACKAGE`.
3. Use `npm test -- --packages @webex/MYPACKAGE --node` to run the tests for just that package only in nodejs.
4. Optionally, add environment variables to mimize logging and show any test specific logging, ie:
   - WEBEX_LOG_LEVEL - set this to "log" to minimize the default verbose output
   - DEBUG - if your test source includes the debug package set this to the appropriate string to enable debug output
   For exampe if you want to run only the plugin-messages test, and see the package specific logging, your command line would be:
   > `WEBEX_LOG_LEVEL=log DEBUG=messages npm test -- --packages @webex/plugin-messages --node`
5. Repeat steps 2-3 until the tests pass.
   > If you use VS Code, we've created a configuration to utilize the built-in debugger
   >    - Set breakpoints within the package you're working on
   >    - Select the `Test package` configuration
   >    - Enter the package you'd like to test (i.e. `MYPACKAGE`)
   >      - _The configuration already prepends `@webex/` for you unlike the cli command, so just `plugin-teams` is fine_
   >    - Add any _optional_ flags (i.e. `--node`)
   >      - _If you don't want to add any flags, just add a space (current workaround)_
6. Run `npm run srcdist` to restore the package.jsons to avoid committing those changes.

You can use the `--unit`, `--integration`, `--automation`, and `--documentation` switches to control what types of tests you run and `--node` and `--browser` to control which environments your tests run in.

The `--packages` flags will allow you to test multiple packages in one command instead of separate commands for each package `--packages @webex/plugin-meetings @webex/plugin-rooms @webex/plugin-teams`. Packages are still tested synchronously  to allow for proper output to the terminal.

`--browser --karma-debug` will run the browser tests with `{singleRun: false}`, thus allowing automatic rerunning everytime you save a file (though, karma does eventually get confused and you need to interrupt and restart the command).

You can use the `--browsers` _(not to be confused with the `--browser` tag)_ allows you to specify which browsers you want to run locally. This is restricted to what browsers are installed and available to you on your OS.
The default browsers that launch are _Headless_ version of Firefox and Chrome, so `--browsers Chrome Edge` will only launch a normal version of Chrome along with Edge. If you add `defaults` to the browsers flag, it will also launch `ChromeHeadless` and `FirefoxHeadless` along with other browsers you've specified. All browsers include flags to enable WebRTC features and permissions.

To run tests on [SauceLabs](https://saucelabs.com/) locally, you'll need to add a inline environment variable, `SAUCE=true`. Like mentioned above you can specify which browsers you'd like to test on with the `--browers` flag, but with SauceLabs service available to you, you can also specify which OS you'd like to test on. With the `--os` flag you have the option on testing on `Mac` and `Windows`. You can filter down the browsers that get launched by using the `--browsers` flag, so if you use `--os Windows --browsers Edge IE` it will launch only `Edge` and `IE`. Specifying just `--browsers` with `SAUCE=true` will launch that browsers in all available OSs, so `--browsers Firefox` will launch `Firefox` in `Mac` and `Windows`.
> **The default SauceLabs configuration _"`SAUCE=true npm run test`"_ is the latest versions of `Chrome` and `Firefox` on both `Mac` and `Windows`, along with `Edge` and `IE 11` on Windows, and `Safari` on Mac**
>
> `--os Mac` will launch `Chrome`, `Firefox`, and `Safari`
>
> `--os Windows` will launch `Chrome`, `Firefox`, `Edge`, and `IE 11`
>
> `--os Linux` WILL NEED `--browsers Firefox` as SauceLabs only supports `Firefox 45` for Linux. This is why it's also not included by default and requires two flags

> See more scripts at [SCRIPTS.md](SCRIPTS.md) to learn how to run tests and more.

#### Running Samples Locally

```bash
git clone git@github.com:webex/webex-js-sdk.git
cd webex-js-sdk
npm install
npm run build
npm run samples:serve
```

> NOTE: This installs all of the SDK's tooling dependencies, so you'll need `libgcrypt` and (possibly) `graphicsmagick`.
>
> - Mac
>   - You can install these with `brew install graphicsmagick libgcrypt`.
>
> - Ubuntu
>   - You can install these with `sudo apt-get install graphicsmagick libgcrypt-dev`
>
> - Windows
>   - You can install `graphicsmagick` using either [scoop](https://scoop.sh/) or [Chocolatey](https://chocolatey.org/)
>     - scoop: `scoop install graphicsmagick`
>     - chocolotey: `choco install graphicsmagick`
>     - Also *globally* install `win-node-env` to resolve `NODE_ENV` windows related command issues

Head to [https://localhost:8000/](https://localhost:8000/) to use the samples

> NOTE: The samples use a self-signed certificate generated by [Webpack Dev Server](https://webpack.js.org/configuration/dev-server/#devserverhttps).
> Some browsers such as Google Chrome (or any other Chromium-based browser) may not allow access by default for security reasons.
> You may need to configure browser settings to allow these at your own risk by enabling the `chrome://flags/#allow-insecure-localhost` flag.

#### Samples Tests

The samples tests are run by <https://webdriver.io> which spins up two browser instances and has them communicate between each other.

These tests are run with `npm run samples:test`.
We have found that due to the h.264 codec downloading in Firefox, the best way to run these test is on SauceLabs.
You can run them on SauceLabs with `SAUCE=true npm run samples:test`.

To run a specific sample test instead of the full suite, append the `--spec` flag to the `samples:test` command and the path to the specific test

```sh
npm run samples:test -- --spec docs/samples/browser-call-with-screenshare
```

If an error occurs when running the above command that appears to be related to a missing [Selenium](https://www.selenium.dev/) driver, the following command should install the needed external dependencies:

```sh
./node_modules/.bin/selenium-standalone install
```

> _Latest versions of chrome and firefox need to be installed for selenium to launch correctly._

##### Local Samples Tests

If you wish to run the samples tests locally, we suggest changing from the Chrome-to-Firefox multiremote setup to Chrome-to-Chrome.

You can do so by modifying the [wdio.conf.js](./wdio.conf.js) file.
Simply change the `browserFirefox`'s `capabilities` object to the same as `browserChrome` (the Chrome instance).
When you run, you should see two instances of Chrome open.

##### Mobile Samples Tests (Sauce)

> NOTE: You will need to off VPN for localhost to tunnel correctly

`SAUCE=true npm run samples:test:mobile`

- You will need to alias `localhost` which will require you to modify your `hosts` file and add that alias to your `.env` file with the name `LOCALHOST_ALIAS`.
- By default, the config will use `local.localhost` as the alias if `LOCALHOST_ALIAS` isn't provided.
  - on macOS/Linux, you will add `127.0.0.1 local.localhost` to `/etc/hosts`
  - on Windows, you will add `127.0.0.1 local.localhost` to `c:\Windows\System32\Drivers\etc\hosts`

##### Local Mobile Samples Tests

> NOTE: You will need to off VPN for localhost to tunnel correctly
> Testing on a iDevice only works on macOS due to the lockdown of `safaridriver`, you should probably switch to [two Android devices and changes to the `wdio.conf.mobile.js`](https://chromedriver.chromium.org/getting-started/getting-started---android#h.p_ID_306) or swap the iDevice config for a different browser installed on the machine.

`npm run samples:test:mobile`

By default the config will look for both a Android and iOS device attached to the system. If you wish to test on a specific/singular device and use Chrome installed on your machine, you can pass either `IOS=true` or `ANDROID=true` environment variables to the command above.
_Ex. `ANDROID=true npm run samples:test:mobile` will open Chrome on your local machine and Chrome on your attached Android device._

This process is more involved and requires both devices to be wired to the laptop/machine.

**_Machine/Laptop_**

- You will need to alias `localhost` which will require you to modify your `hosts` file and add that alias to your `.env` file with the name `LOCALHOST_ALIAS`..
- By default, the config will use `local.localhost` as the alias if `LOCALHOST_ALIAS` isn't provided.
  - on macOS/Linux, you will add `127.0.0.1 local.localhost` to `/etc/hosts`
  - on Windows, you will add `127.0.0.1 local.localhost` to `c:\Windows\System32\Drivers\etc\hosts`
- For iDevices, you'll need to enable `safaridriver`
  - `safaridriver --enable` (macOS only)
- For Android, you'll need `adb` installed
  - You can run `adb devices` which will autostart the server and show you the devices connected

**_iOS_**

- You will need to make sure that the device has already been trusted to be used by the machine/laptop or else it will not be discovered when webdriverio attempts to connect to the device
- You will need to enable remote debugging on your device
  - _Settings > Safari > Advanced > Remote automation_

**_Android_**

- On your device, you'll need to enable Developer Options & USB Debugging
  - _Settings > About Phone > Tap `Build Number` till Developer Options is enabled_
  - _Settings > Developer Options > USB Debugging > Enable USB Debugging_
- You will need to make sure that USB Debugging has trusted the machine/laptop or else it will not be discovered when webdriverio attempts to connect to the device

### Git Commit Guidelines

We follow the (Conventional Commits)[https://www.conventionalcommits.org/] specification when writing commits and are run/linted through [conventional changelog](https://github.com/conventional-changelog/conventional-changelog)
to generate the changelog. Please adhere to the following guidelines when formatting your commit messages.

#### Commit Message Format

Each commit message consists of a **header**, a **body** and a **footer**. The header has a special format that includes a **type**, a **scope** and a **subject**:

```
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

The **header** is mandatory and the scope of the header is optional.

Any line of the commit message cannot be longer 100 characters! This allows the message to be easier to read on GitHub as well as in various git tools.

#### Revert

If the commit reverts a previous commit, it should begin with `revert:`, followed by the header of the reverted commit. In the body it should say: `This reverts commit <hash>`., where the hash is the SHA of the commit being reverted.

#### Type

> Examples can be found on the (Conventional Commits website)[https://www.conventionalcommits.org/en/v1.0.0/#examples]

The following types will cause a version bump:

- **fix**: Patches a bug in the code and directly corresponds to the **PATCH**
- **perf**: A code change that improves performance and corresponds to the **PATCH**
- **feat**: Describes a new feature and corresponds to the **MINOR**
- **BREAKING CHANGE**: a commit that has a footer `BREAKING CHANGE:`, or appends a `!` after the type/scope, introduces a breaking API change (correlating with **MAJOR** in semantic versioning).

> Appending a `!` and/or a `BREAKING CHANGE:` footer to **ANY TYPE** will denote a **BREAKING CHANGE** and will cause a **MAJOR** bump

The following types will _**not**_ cause a version bump:

- **build**: Changes that affect the build system or external dependencies
- **ci**: Changes to our CI configuration files and scripts
- **docs**: Documentation only changes
- **refactor**: A code change that neither fixes a bug, adds a feature, nor changes affecting the public API and corresponds to the **PATCH**
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **test**: Adding missing tests or correcting existing tests

#### Scope

The scope should indicate what is being changed. Generally, these should match package names. For example, `http-core`, `common`, `webex`, etc. Other than package names, `tooling` tends to be the most common.

#### Subject

The subject contains succinct description of the change:

- use the imperative, present tense: "change" not "changed" nor "changes"
- don't capitalize first letter
- no dot (.) at the end

#### Body

Just as in the **subject** the imperative, present tense: "change" not "changed" nor "changes". The body should include the motivation for the change and contrast this with previous behavior.

#### Footer

The footer should contain any information about **Breaking changes** and is also the place to reference GitHub issues that this commit **closes**.

**Breaking Changes** should start with the word `BREAKING CHANGE:` with a space or two newlines. The rest of the commit message is then used for this.

#### Special Commit Messages

These are commit messages that will have an impact on how the build pipeline behaves. They are not to be used without prior approval.

All of these commit messages should include an explanation for why you're using them. You'll need to commit with `-n` or `--no-verify` to bypass the commit message linter.
> For example
> `git commit -m "docs(webex-core): [skip npm] - docs change" --no-verify`

##### `[skip npm]`

This will run through the all the Github Checks, but will skip any version bumping, tagging, and subsequent publishing to npm after a pull request is merged.

##### `[skip ci]`

This will skip the CircleCI pipeline entirely.

### Submitting a Pull Request

Prior to developing a new feature, be sure to search the [Pull Requests](https://github.com/webex/webex-js-sdk/pulls) for your idea to ensure you're not creating a duplicate change. Then, create a development branch in your forked repository for your idea and start coding!

When you're ready to submit your change, first check that new commits haven't been made in the upstream's `master` branch. If there are new commits, rebase your development branch to ensure a fast-forward merge when your Pull Request is approved:

```bash
# Fetch upstream master and update your local master branch
git fetch upstream
git checkout master
git merge upstream/master

# Rebase your development branch
git checkout feature
git rebase master
```

Finally, open a [new Pull Request](https://github.com/webex/webex-js-sdk/compare) with your changes. Be sure to mention the issues this request addresses in the body of the request. Once your request is opened, a developer will review, comment, and, when approved, merge your changes!

### Pull Request Checklist

Before you open that new pull request, make sure to have completed the following checklist:

- Code follows the style guidelines of this project
- I have performed a self-review of my own code
- I have commented my code, particularly in hard-to-understand areas
- I have made corresponding changes to the documentation
- My changes generate no new warnings
- I have added tests that prove my fix is effective or that my feature works
- New and existing unit tests pass locally with my changes
- Any dependent changes have been merged and published in downstream modules

## Updating the Documentation

To compile the documentation locally, make sure you have [Bundler](http://bundler.io/) or
[Jekyll](https://jekyllrb.com/) installed then run the following:

### Set Up Environment (with Bundler)

```bash
cd docs
bundle install
```

### Compile and Serve Docs

```bash
cd docs
npm run build:docs
bundle exec jekyll serve --config=_config.yml,_config.local.yml
```


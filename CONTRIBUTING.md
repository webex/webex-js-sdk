# Contributing

This project is open for contributions. This article serves as an entrypoint to begin contributing to this project.

- [Contributing](#contributing)
  - [Reporting an Issue](#reporting-an-issue)
  - [Providing Contributions](#providing-contributions)
    - [Setup](#setup)
      - [Requirements](#requirements)
      - [Downloading](#downloading)
      - [Environment](#environment)
      - [Dependencies](#dependencies)
      - [Prebuilding](#prebuilding)
    - [Contribute](#contribute)
      - [Project Changes](#project-changes)
        - [Automation](#automation)
        - [Configuration](#configuration)
          - [Modern Configuration](#modern-configuration)
          - [Legacy Configuration](#legacy-configuration)
        - [Documentation](#documentation)
          - [General Documentation](#general-documentation)
          - [Samples Documentation](#samples-documentation)
      - [Module Changes](#module-changes)
        - [Creating](#creating)
        - [Building](#building)
        - [Testing](#testing)
      - [Submitting Changes](#submitting-changes)
  - [Requesting Support](#requesting-support)

## Reporting an Issue

If any issues with this project are discovered, please raise a [GitHub Issue](https://github.com/features/issues) via this project's [GitHub Issues Page](https://github.com/webex/webex-js-sdk/issues).

If additional support is needed, please see our [Requesting Support](#requesting-support) section.

## Providing Contributions

This section outlines the expected workflow when providing contributions to this project.

### Setup

In order to prepare a local machine for making contributions to this project, please review the sections within this section.

#### Requirements

This project has platform requirements that must be met before providing contributions. For **Windows Developer Platforms**, it is recommended to use [Windows Subsystem for Linux](https://learn.microsoft.com/en-us/windows/wsl/about) before proceeding.

The following items are required before providing contributions:

* [Node Version Manager](https://github.com/nvm-sh/nvm) - *install the correct version for your platform*
* [NodeJS/NPM](https://nodejs.org/en) - *installed via `Node Version Manager`*
* [Yarn](https://yarnpkg.com/) - *installed via `corepack enable`*
* [Git](https://git-scm.com/) - *used for submitting contributions*

This project also has some additional requirements that are (sometimes) optional depending on your platform:

* [Python 2](https://www.python.org/download/releases/2.7/) - *used for some tooling, install as necessary*
* [JQ](https://github.com/stedolan/jq#jq) - *used for processing JSON in terminal, install as necessary*
* [libcrypt](https://gnupg.org/software/libgcrypt/index.html) - *general purpose cryptography, install as necessary*
* [graphicsmagick](http://www.graphicsmagick.org/) - *image processor, install as necessary*
* [FireFox](https://www.mozilla.org/en-US/firefox/) - *browser, required for browser testing, install as necessary*
* [Chrome](https://www.google.com/chrome/) - *browser, required for browser testing, install as necessary*

#### Downloading

This project must be [Forked on GitHub](https://github.com/webex/webex-js-sdk/fork) and downloaded locally using [Git](https://git-scm.com/) in order to begin providing contributions. Once the project is forked, perform the following `bash` operations to download the project.

```bash
# download the forked project
git clone {https/ssh-target-to-clone}

# move the focus into the directory
cd ./webex-js-sdk

# add the upstream remote
git remote add upstream git@github.com:webex/webex-js-sdk.git # for SSH
# OR
git remote add upstream https://github.com/webex/webex-js-sdk.git # for HTTPS
```

Some additional setup requirements for [Git](https://git-scm.com/) or [GitHub](https://github.com/) may be required, please review their respective documentation as needed.

#### Environment

In order to operate all parts of this project at runtime, the following `ENV` variables must be provided:

* `WEBEX_CLIENT_ID` - *used for client-type authorization*
* `WEBEX_CLIENT_SECRET` - *used for client-type authorization*
* `WEBEX_APPID_ORGID` - *used for test user generation*
* `WEBEX_APPID_SECRET` - *used for test user generation*
* `WEBEX_CONVERGED_ORG_ID` - *used for test user generation, meetings-plugin specific*

Note that the above values can also be provided via the `./.env` file within this project.

Additionally, a template for all available ENV values can be found within the `./.env.default` file, which is automatically incorporated when any runtime within this project requires `ENV` values.

#### Dependencies

Installation of this project's dependencies should be performed prior to executing any scripts associated with this project. Follow the below steps to ensure that all dependencies are installed as intended:

1. `nvm install` - Install and set the versions of [NodeJS and NPM](https://nodejs.org/en) identified in the `./.nvmrc` file.
2. `corepack enable` - Enables `corepack` locally for the current version of [NodeJS and NPM](https://nodejs.org/en). This enables [Yarn](https://yarnpkg.com/) usage.
3. `yarn` - Install all dependencies listed within this project and links localized modules (symlink)

#### Prebuilding

In order to make the development against this project as streamlined as possible, prebuilding all modules is recommended. The below command should be executed whenever new changes are ingested locally.

```bash
yarn prebuild:modules
```

Alternatively, the following commands can be executed in their provided order to fulfill the same effect as the above command. Note that in some cases, some of these commands may be unnecessary based on the changes that are ingested locally.

1. `yarn` - Installs any new dependencies or links any new localized modules (symlink)
2. `yarn @tools build:src` - Builds core tooling.
3. `yarn @legacy-tools build:src` - Builds legacy tooling.
4. `yarn workspace @webex/webex-core build:src` - Builds the module core.
5. `yarn @all build:src` - Build all remaining packages in the project.

After prebuilding has been completed, any script within any module should operate as intended. For more information on specifics for each module, please review their respective documentation. This documentation should be located within the module's `./README.md` or built documentation.

### Contribute

When contributing to this project, there are two major areas that can accept changes. The below sections outline those areas and how they operate.

#### Project Changes

Project changes include any changes to items outside of the `./packages/` folder. These changes typically impact all sub-modules within this project. Changes that occur against this scope will require a more strict review from the owners of this project.

##### Automation

Automation for this project exists entirely within the `./.github/workflows/` folder. This includes the following high-importance items:

* [**Deploy**](./.github/workflows/deploy.yml) - Continuous Delivery Workflow
* [**Pull Request**](./.github/workflows/pull-request.yml) - Pull Request Validation.

The workflows defined above are written using [GitHub Actions](https://github.com/features/actions) and can be reviewed from the projects [actions page](https://github.com/webex/webex-js-sdk/actions).

The [workflows folder](./.github/workflows/) may contain additional items as well, please review this folder to see all additional workflows.

##### Configuration

###### Modern Configuration

Global **modern configuration** for this project can be found exclusively within the [configuration folder](./config/) of this project. This folder contains configuration scopes based on their respective runtimes. Each of these folders *should* contain an associated `README.md` file that includes all necessary documentation to consume the contents. Be sure to inspect the documentation for each of the respective runtimes when making changes to a specific scope.

###### Legacy Configuration

Global **legacy configuration** is available within the `./packages/legacy/` folder. This configuration exclusively applies to the following modules scopes:

* `./packages/@webex` - Webex legacy modules.
* `./packages/webex` - Webex unified legacy modules.

These modules utilize older configuration formats that no longer align within the Webex JS SDK product direction, and will eventually be migrated to the newer configurations as resources permit.

##### Documentation

###### General Documentation

Documentation for this project can be broken down into various common files:

* [CONTRIBUTING.md](./CONTRIBUTING.md) - Contribution Guide
* [ENV.md](./ENV.md) - Environment Variable Documentation
* [README.md](./README.md) - Project Details
* [SCRIPTS.md](./SCRIPTS.md) - Script Information

The previous defined list of documentation articles are used to help provide both consumers and contributors with all of the necessary information needed to understand how to get started with this project.

###### Samples Documentation

In addition to the above documentation, there are **samples** that can be built and ran as well. This is done by performing the following actions after [setting up this project locally](#setup):

* `yarn samples:build` - Build the samples into the `./docs/samples` directory.
* `yarn samples:serve` - Build and Serve the samples in watch mode.

After the samples have been built, navigate to [https://localhost:8000/](https://localhost:8000/) to view the samples.

>**NOTE**: The samples use a self-signed certificate generated by [Webpack Dev Server](https://webpack.js.org/configuration/dev-server/#devserverhttps). Some browsers (such as Chromium-based browsers) may not allow access to view the samples for security reasons. Be sure to enable any flags necessary to allow for navigation to localhost over https.

#### Module Changes

All module changes within this project will be scoped to modules within the `./packages/**/{module}` folder. These modules are broken down as follows:

* `./packages/@webex` - Webex legacy modules.
* `./packages/webex` - Webex unified legacy module.
* `./packages/legacy` - Legacy configuration and tooling (used by `./packages/@webex` and `./packages/webex`).
* `./packages/tools` - Modern tooling (used for automation and scripts).

All modules within this scope should follow the common script naming rulesets defined within the [SCRIPTS.md](./SCRIPTS.md) file within this project. This allows for **automation** to run appropriately against these packages.

##### Creating

When creating a new module within this project, it is best to begin by identifying whether or not the new module will exist within one of the three types:

* **Legacy Module**
  * Module that will utilize the older tooling (such as [Ampersand](https://www.npmjs.com/package/ampersand) or [Babel](https://babeljs.io/))
  * This is typically any module that will exist within `./packages/@webex`.
  * [Legacy Module Example - Messaging Plugin](./packages/@webex/plugin-messages/)
* **Modern Module**
  * Module that will be built and tested using newer technology.
  * This is recommended for any module that will not need to access legacy dependencies (such as [Ampersand](https://www.npmjs.com/package/ampersand)).
  * [Modern Module Example - Package Tools](./packages/tools/package/)
* **Migration Module**
  * Any module that will be migrated into this project from an external project repository.
  * [Migration Module Example - Calling SDK](./packages/calling/)

Once a module type has been determined, [reach out to our support team](#requesting-support) to start a discussion on how the new module should be introduced. The linked example modules provide a template that can be followed when initializing the root files for the new module.

>**NOTE**: When creating a **Modern Module** or **Migration Module**, all tooling used within its scope can be unique to the module as long as the [respective scripts](./SCRIPTS.md) work in alignment with the rest of the project. It is recommended to use any [existing configurations and tooling](./config/) when possible.

##### Building

Building modules can be done by following common script semantics provided by [SCRIPTS.md](./SCRIPTS.md). The recommended tooling for each type of module will be listed below:

* **Legacy Module** - [Legacy Tools](./packages/legacy/tools/).
  * All tooling is ran through the CLI via `webex-legacy-tools`, which refers to the executable for the [@webex/legacy-tools](./packages/legacy/tools/) module listed above.
  * Use `yarn workspace @webex/legacy-tools start --help` to see help options for this module.
  * Use the [Legacy Module Example - Messaging Plugin](./packages/@webex/plugin-messages/) as a template.
* **Modern Module** - Any modern tooling that has [localized configuration](./config/).
  * Typically will use [TypeScript](https://www.typescriptlang.org/) with the modern [TypeScript configuration](./config/typescript/).
  * Will extract documentation using [API Extractor](https://api-extractor.com/) with the modern [API Extractor Configuration](./config/api-extractor/).
  * Will build documentation using [API Documenter](https://www.npmjs.com/package/@microsoft/api-documenter).
* **Migration Module**
  * Originally, the tooling that existed in the previous project will be consumed.
  * Ultimately, should be migrated to use **Modern Module Tooling**.

Building a module can be performed by using the following commands when present within the module's `./package.json` definition:

* `yarn workspace {module-name} build` - Generate documentation and consumption artifacts.
* `yarn workspace {module-name} build:docs{:...scopes?}` - Generate documentation artifacts.
* `yarn workspace {module-name} build:src{:...scopes?}` - Generate consumption artifacts.

##### Testing

Testing modules can be done by following common script semantics provided by [SCRIPTS.md](./SCRIPTS.md). The recommended tooling for each type of module will be listed below:

* **Legacy Module** - [Legacy Tools](./packages/legacy/tools/).
  * Uses [Mocha](https://mochajs.org/) or [Jest](https://jestjs.io/)
  * Runs in browser using [Karma](https://karma-runner.github.io/latest/index.html)
  * **Does not** need to pass coverage tests.
* **Modern Module** - Any modern tooling that has [localized configuration](./config/).
  * Uses [Jest](https://jestjs.io/) exclusively (while [Jasmine](https://jasmine.github.io/) was previously supported).
  * **Does not** test pre-compiled code (only test whats in `./dist/**`) for the module.
  * **Requires** coverage to be 100% for the pull request to pass automated testing.
* **Migration Module**
  * Originally, the tooling that existed in the previous project will be consumed.
  * Ultimately, should be migrated to use **Modern Module Tooling**.

Running tests against a module can be performed by using the following commands when present within the module's `./package.json` definition:

* `yarn workspace {module-name} test` - Run all tests.
* `yarn workspace {module-name} test:coverage` - Run a coverage test.
* `yarn workspace {module-name} test:unit` - Run unit tests.
* `yarn workspace {module-name} test:integration` - Run integration tests.
* `yarn workspace {module-name} test:style` - Run style tests.
* `yarn workspace {module-name} test:syntax` - Run syntax tests.
* `yarn workspace {module-name} test:browser` - Run browser tests.

**Note:** To run individual test files, use the `--targets` option along with the test command. An example is shown below:
* `yarn workspace {module name} test:unit --targets {filename}` - Run the unit test only for the target filename.

#### Submitting Changes

When submitting changes to this project, all changes must go through the [GitHub Pull Request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests) process. Below are the steps outlining the process:

* The pull request is created on this projects [pull request](https://github.com/webex/webex-js-sdk/pulls) page.
* The pull request is then **validated** by a code-owner [for any security violations](https://securitylab.github.com/research/github-actions-preventing-pwn-requests/#:%7E:text=of%20the%20PR.-,Having%20said%20that,-%2C%20mixing%20pull_request_target%20with).
* Once **validated**:
  * [Pull request automation](https://github.com/webex/webex-js-sdk/actions/workflows/pull-request.yml) tests run.
  * Code-owners review the changes.
* Once Automation tests pass, and code-owners approve of the changes:
  * The pull request is merged
* [Deployment automation](https://github.com/webex/webex-js-sdk/actions/workflows/deploy.yml) runs.
* Packages are deployed to their artifact repositories.

>**NOTE**: All pull requests will need to follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) in order to be accepted by our code-owners.

## Requesting Support

Please reach out to our developer support team in regards to any questions or issues related to the Webex JS SDK.

* <https://developer.webex.com/support>
* <devsupport@webex.com>

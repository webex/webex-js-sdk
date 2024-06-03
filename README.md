# Webex JS SDK

[![license: Cisco](https://img.shields.io/badge/License-Cisco-blueviolet?style=flat-square)](https://github.com/webex/webex-js-sdk/blob/master/LICENSE)
![state: Stable](https://img.shields.io/badge/State-Stable-blue?style=flat-square)
![scope: Public](https://img.shields.io/badge/Scope-Public-darkgreen?style=flat-square)

This project is designed as a mono-repository for all publicly-provided JavaScript packages from Cisco's Webex Developer Experience team. These packages consist of mostly API-related modules that allow for seamless integration with the collection of services that belong to the Webex platform.

* [Installation](#installation)
  * [Unified Modules](#unified-modules)
  * [Modular Modules](#modular-modules)
* [Usage](#usage)
  * [Modular Consumption](#modular-consumption)
  * [Browser Consumption](#browser-consumption)
  * [Updating the Modules](#updating-the-modules)
  * [Running and Viewing Samples](#running-and-viewing-samples)
* [Contribute](#contribute)
* [Issues](#issues)
* [Maintainers](#maintainers)
* [license](#license)

## Installation

Since this project is a mono-repository, it provides multiple ways to consume its distributables. Please see the respective sections below for information on how to install and consume this project.

### Unified Modules

Unified modules are the quickest way to begin development using the Webex JS SDK. These modules are meant to be consumed as **dependencies** of another project and can be installed by performing the following commands:

```bash
# using NPM
npm install {module}

# using Yarn
yarn add {module}
```

In addition to the module consumption via [NPMJS](https://www.npmjs.com/), these modules can also be consumed via our CDN. See the below examples of how to consume the unified modules via our CDN:

```html
<html>
  <head>
    <!-- via unpkg -->
    <script crossorigin src="https://unpkg.com/webex@^1/umd/webex.min.js"></script>

    <!-- via jsdelivr -->
    <script crossorigin src="https://cdn.jsdelivr.net/npm/webex/umd/webex.min.js"></script>
  </head>
  <!-- ...application html... -->
</html>
```

The available unified modules within this project are listed below:

* [webex](./packages/webex/) - The primary webex unified module.

### Modular Modules

Modular modules are an alternative to using a unified module, and require a greater understanding of how the modules are architected in order to consume them appropriately. These modules are typically consumed as **dependencies** of another project and can be installed by performing the following commands:

```bash
# using NPM
npm install {module}

# using Yarn
yarn add {module}
```

The available modular modules within this project are visible when inspecting the contents of the `./packages/@webex/` folder, as well as other published modules (see their `README.md` files) within the `./packages/` folder.

## Usage

This section will define the general usage examples for this project.

### Module Consumption

For general consumption documentation, please visit our [Cisco Webex for Developers portal](https://developer.webex.com/), as this will typically what is necessary to begin development using the various packages within the Webex JS SDK. Additionally, some of the modules within this project contain independent documentation available within each of their respective folder scopes. Please review these independent documentation articles as needed.

It is recommended to visit our [Getting Started with NodeJS](https://developer.webex.com/docs/sdks/node) guide for the most up-to-date documentation on consuming the Webex JS SDK via Module.

### Browser Consumption

This section outlines how to directly consume the Webex JS SDK unified `webex` bundle within your HTML document. This bundle can be consumed directly via [unpkg](https://unpkg.com/) or [jsdelivr](https://jsdelivr.com/) respectfully. See the below examples:

```html
<html>
  <head>
    <!-- via unpkg -->
    <script crossorigin src="https://unpkg.com/webex@^1/umd/webex.min.js"></script>

    <!-- via jsdelivr -->
    <script crossorigin src="https://cdn.jsdelivr.net/npm/webex/umd/webex.min.js"></script>
  </head>
  <!-- ...application html... -->
</html>
```

It is recommended to visit our [Getting Started with Browser Usage](https://developer.webex.com/docs/sdks/browser) guide for the most up-to-date documentation on consuming the Webex JS SDK via our CDN within a browser.

### Updating the Modules

Since this mono-repository includes a collection of packages that rely on each other to work as intended, it is best to utilize a static version of the Webex JS SDK modules consumed by your application. The best way to do this is by utilizing our helper package: `@webex/package-tools`.

```bash
# using NPM
npm install --dev @webex/package-tools

# using Yarn
yarn add --dev @webex/package-tools
```

After installation, the following `script` should be added to your `./package.json` for execution:

```jsonc
{
  /* ... */
  "scripts": {
    /* ... */
    "update:sdk": "webex-package-tools update --tag {target-dist-tag} --packages {...packages-to-update}"
  }
}
```

The above executable accepts a **distribution tag**, which will match an available `tag` from the [current tags section](https://www.npmjs.com/package/webex?activeTab=versions) of [NPMJS](https://www.npmjs.com/) as well as a list of packages that should be updated when the command executes (this will collect the latest synced version). It is recommended to provide the `--packages` argument with the complete list of `@webex`-scoped packages your project consumes in order to promote well-synchronized versions between all packages.

The `@webex/package-tools` package contains a collection of helpful tools used to manage packages within this project from both within and outside of this project. Please review the [documentation](./packages/tools/package/) associated with the `@webex/package-tools` package for more information.

### Running and Viewing Samples

Sample code can be found within the [samples documentation folder](./docs/samples). You can preview the contents of this folder by navigating to [https://webex.github.io/webex-js-sdk/samples/](https://webex.github.io/webex-js-sdk/samples/) or by building them locally. Please see our [contributing guide](./CONTRIBUTING.md) for more information.

## Contribute

For detailed instructions on how to contribute, please refer to the [contributing guide](./CONTRIBUTING.md).

## Issues

Please reach out to our developer support team in regards to any issues you may be experiencing within the Webex JS SDK.

* <https://developer.webex.com/support>
* <devsupport@webex.com>

## Maintainers

This project is maintained by [Cisco Webex for Developers](https://developer.webex.com/).

## License

See our [license](./LICENSE) for more information.
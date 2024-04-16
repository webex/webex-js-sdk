# Scripts

This file acts as documentation for running the script currently available within this project along with historical data on which scripts should be used when coming from version `2` of the **Webex JS SDK**.

Note that all scripts within this project require the designated version of [Yarn](https://yarnpkg.com/) from within the [package definition file](./package.json) of this project. [NPM](https://nodejs.org/en/learn/getting-started/an-introduction-to-the-npm-package-manager) will not operate correctly within this project.

* [Project Scripts](#project-scripts)
* [Module Scripts](#module-scripts)

## Project Scripts

Below is a list of project scripts that can be ran from the root of this project using either [Yarn](https://yarnpkg.com/):

* `yarn @all {script} {...args}` - Run the provided script on each module in this projects workspaces.
* `yarn @legacy {script} {...args}` - Run the provided script on all modules within the `legacy` scope.
* `yarn @legacy-tools {script} {...args}` - Run the provided script on all modules within the `legacy-tools` scope.
* `yarn @tools {script} {...args}` - Run the provided script on all modules within the `tools` scope.
* `yarn @workspaces {...args}` - Run the provided arguments against all workspaces with a common arglist.
* `yarn prebuild:modules` - Run to process all prebuilding workflows in the correct order.

Outside of these project scripts, general usage of [Yarn Workspace](https://yarnpkg.com/features/workspaces) commands. from the root level to access and iterate over all of its respective packages.

## Module Scripts

All modules within this project can be accessed via the [Yarn Workspace](https://yarnpkg.com/features/workspaces) `yarn workspace {package-name}` command.

To promote module consistency throughout this project, all sub-modules must align with the following scripts within their respective `./package.json` files:

* `build` - Generates all documentation and consumption artifacts.
* `build:docs` - Generates all documentation artifacts.
* `build:src` - Generates all consumption artifacts.
* `clean` - Removes all deployable artifacts.
* `deploy:npm` - Deploys this module to [NPMJS](https://www.npmjs.com/).
* `start` - Runs the primary execution workflow.
* `test` - Runs all tests associated.
* `test:coverage` - Runs a coverage test.
* `test:unit` - Runs unit tests.
* `test:integration` - Runs integration tests.
* `test:browser` - Runs browser tests.
* `test:style` - Runs style tests.
* `test:syntax` - Runs syntax tests.

Note that these scripts are **not** required on every module for them to exist within this project, but, will allow for our **CI** and **CD** workflows to run them during Pull Request validation and Deployment. If the respective module does not have a purpose for a script, do not include it within the `scripts` key of the package definition file (`./package.json`).

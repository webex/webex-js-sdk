# Contributing

- [Reporting Issues](#reporting-issues)
  - [Opening an Issue](#opening-an-issue)
- [Contributing Code](#contributing-code)
  - [Build Dependencies](#build-dependencies)
  - [Building the SDK](#building-the-sdk)
  - [Running Tests](#running-tests)
  - [Git Commit Guidelines](#git-commit-guidelines)
- [Updating the Documentation](#updating-the-documentation)

## Reporting Issues

### Opening an Issue

The title of a Bug or Enhancement should clearly indicate what is broken or desired. Use the description to
explain possible solutions or add details and (especially for Enhancemnts) explain *how* or *why* the issue is
broken or desired.

#### Grammar

While quibbling about grammar in issue titles may seem a bit pedantic, adhering to some simple rules can make it much
easier to understand a Bug or an Enhancement from the title alone. For example, is the title **"Browsers should support
blinking text"** a bug or a feature request?
- Enhancements: The title should be an imperative statement of how things should be. **"Add support for blinking text"**
- Bugs: The title should be a declarative statement of how things are. **"Text does not blink"**

## Contributing Code

### Build Dependencies

Before you can build the Cisco Spark JS SDK, you will need the following dependencies:
- [Node.js](https://nodejs.org/) 6.x (LTS)
  - We recommend using [nvm](https://github.com/creationix/nvm) (or [nvm-windows](https://github.com/coreybutler/nvm-windows))
    to easily switch between Node.js versions
- [Git](https://git-scm.com/)

You will need to create a file called `.env` that defines, at a minimum:

- `CISCOSPARK_CLIENT_ID`
- `CISCOSPARK_CLIENT_SECRET`
- `CISCOSPARK_REDIRECT_URI`
- `CISCOSPARK_SCOPE`

You can get these values by registering a new integration on the [Spark for Developers](https://developer.ciscospark.com/add-integration.html) portal.

### Building the SDK

Fork the [spark-js-sdk](https://github.com/ciscospark/spark-js-sdk/) repository and `git clone` your fork:

```bash
git clone https://github.com/your-username/spark-js-sdk.git
```

Install tooling dependencies with:

```bash
npm install
```

Build the SDK:

```bash
npm run build
```

> There used to be a means of building individual packages, but they now build quickly enough that there's no need.

### Running Tests

#### Run All Tests

```bash
npm test
```

#### Run Unit Tests
Handy during early plugin development when you can write a bunch of unit tests.

```bash
npm test -- --package PACKAGENAME --unit
```

### Run unit tests in watch mode
OK, this one's a handful and requires a global package, but there were too many possible variants to
hardcode it any where.

```bash
npm install -g nodemon
nodemon -w packages/PACKAGENAME/src -w packages/PACKAGENAME/test -x "npm test -- --package PACKAGENAME --node"
```

#### Run Node.js Tests
Usually faster, and can build on the fly, thus no need to rebuild everything between test runs

```bash
npm test -- --package PACKAGENAME --node
```

#### Run Browser Tests
Keeps the browser open so that you can reload set break points and reload the page

```bash
npm test -- --package PACKAGENAME --browser --karma-debug
```

### Git Commit Guidelines

As part of the build process, commits are run through [conventional changelog](https://github.com/conventional-changelog/conventional-changelog)
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

Must be one of the following:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests
- **chore**: Changes to the build process or auxiliary tools and libraries such as documentation generation

#### Scope

The scope should indicate what is being changed. Generally, these should match package names. For example, `http-core`, `common`, `ciscospark`, etc. Other than package names, `tooling` tends to be the most common.

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
bundle exec jekyll serve --config=_config.yml,_config.local.yml
```

# Contributing

- [Contributing](#Contributing)
  - [Reporting Issues](#Reporting-Issues)
    - [Opening an Issue](#Opening-an-Issue)
      - [Grammar](#Grammar)
      - [Logs](#Logs)
  - [Contributing Code](#Contributing-Code)
    - [Build Dependencies](#Build-Dependencies)
    - [Building the SDK](#Building-the-SDK)
    - [Running Tests](#Running-Tests)
    - [Git Commit Guidelines](#Git-Commit-Guidelines)
      - [Commit Message Format](#Commit-Message-Format)
      - [Revert](#Revert)
      - [Type](#Type)
      - [Scope](#Scope)
      - [Subject](#Subject)
      - [Body](#Body)
      - [Footer](#Footer)
      - [Special Commit Messages](#Special-Commit-Messages)
        - [`#force-publish`](#force-publish)
        - [`#ignore-tooling`](#ignore-tooling)
        - [`#no-push`](#no-push)
        - [`[ci skip]`](#ci-skip)
    - [Submitting a Pull Request](#Submitting-a-Pull-Request)
  - [Updating the Documentation](#Updating-the-Documentation)
    - [Set Up Environment (with Bundler)](#Set-Up-Environment-with-Bundler)
    - [Compile and Serve Docs](#Compile-and-Serve-Docs)

## Reporting Issues

### Opening an Issue

The title of a Bug or Enhancement should clearly indicate what is broken or desired. Use the description to
explain possible solutions or add details and (especially for Enhancemnts) explain *how* or *why* the issue is
broken or desired. Please see [ISSUE_TEMPLATE.md](https://github.com/webex/webex-js-sdk/blob/master/.github/ISSUE_TEMPLATE.MD) that outlines what we are looking for.

**If providing snippets of code**, use [Markdown code blocks](https://help.github.com/articles/markdown-basics/#multiple-lines).

#### Grammar

While quibbling about grammar in issue titles may seem a bit pedantic, adhering to some simple rules can make it much
easier to understand a Bug or an Enhancement from the title alone. For example, is the title **"Browsers should support
blinking text"** a bug or a feature request?

- Enhancements: The title should be an imperative statement of how things should be. **"Add support for blinking text"**
- Bugs: The title should be a declarative statement of how things are. **"Text does not blink"**

#### Logs

Please provide sufficient logging around the issue which you are reporting as this will help with our investigation.
**DO NOT** include access tokens or other sensitive information. If you need to supply logs with sensitive information, supply them to developer support rather than posting them here; even when sending logs to developer support, **DO NOT** include access tokens.

## Contributing Code

### Build Dependencies

Before you can build the Cisco Webex JS SDK, you will need the following dependencies:

- [Node.js](https://nodejs.org/) (LTS)
  - We recommend using [nvm](https://github.com/creationix/nvm) (or [nvm-windows](https://github.com/coreybutler/nvm-windows))
    to easily switch between Node.js versions.
  - Install the latest Node.js Long Term Support using `nvm install --lts`
  - Install the latest npm to enable security audits using `npm install npm@latest -g`
- [Git](https://git-scm.com/)
- [node-gyp](https://www.npmjs.com/package/node-gyp)
  - This is used during the dependency install process and is used to compile some native add-on modules.
  - Install with `npm install -g node-gyp`
- [Python 2.7](https://www.python.org/download/releases/2.7/)
  - This is also used during the dependency install process.
  - Attempting to update dependencies with a Python 3.x environment will fail

You will need to create a file called `.env` that defines, at a minimum:

- `WEBEX_CLIENT_ID`
- `WEBEX_CLIENT_SECRET`
- `WEBEX_REDIRECT_URI`
- `WEBEX_SCOPE`

You can get these values by registering a new integration on the [Cisco Webex for Developers](https://developer.webex.com/add-integration.html) portal.

### Building the SDK

Fork the [webex-js-sdk](https://github.com/webex/webex-js-sdk/) repository and `git clone` your fork:

```bash
git clone https://github.com/your-username/webex-js-sdk.git
```

Install tooling dependencies with:

```bash
npm install
```

Build the SDK:

```bash
npm run build
```

*Build issues?* See [BUILD-ISSUES.md](./BUILD-ISSUES.md) for help.

### Running Tests

`npm test` is the entrypoint to our test runner, but its not practical to use without parameters; the full suite would take over two hours to run and cross talk would probably cause tests to break each other.

> Get the full test-runner docs via `npm test -- --help`.

A local development flow might look like

1. Edit source code in `MYPACKAGE`.
2. Use `npm run build` to build all packages .
3. Use `npm test -- --package MYPACKAGE --node` to run the tests for just that package only in nodejs (Usually, we don't need to test both in node and the browser during development).
4. Repeats steps 1-3 until the tests pass.

`npm run build` is a bit tedious when making lots of changes, so instead, we can use `npm run distsrc` to point each package's `main` entry at the raw src and let `babel` compile on the fly.

1. At the start of development, run `npm run distsrc` once.
2. Edit source code in `MYPACKAGE`.
3. Use `npm test -- --package MYPACKAGE --node` to run the tests for just that package only in nodejs.
4. Repeat steps 2-3 until the tests pass.
   > If you use VS Code, we've created a configuration to utilize the built-in debugger
   >    - Set breakpoints within the package you're working on
   >    - Select the `Test package` configuration
   >    - Enter the package you'd like to test (i.e. `MYPACKAGE`)
   >      - _The configuration already prepends `@webex/` for you unlike the cli command, so just `plugin-teams` is fine_
   >    - Add any _optional_ flags (i.e. `--node`)
5. Run `npm run srcdist` to restore the package.jsons to avoid committing those changes.

You can use the `--unit`, `--integration`, `--automation`, and `--documentation` switches to control what types of tests you run and `--node` and `--browser` to control which environments your tests run in.

`--browser --karma-debug` will run the browser tests with `{singleRun: false}`, thus allowing automatic rerunning everytime you save a file (though, karma does eventually get confused and you need to interrupt and restart the command).

> See [SCRIPTS.md](SCRIPTS.md) to learn how to run tests on [SauceLabs](https://saucelabs.com/) and more.

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

#### Special Commit Messages

These are commit messages that will have an impact on how the build pipeline behaves. With the exception of `#no-push`, they are not to be used without prior approval.

All of these commit messages should include an explanation for why you're using them. You'll need to commit with `-n` or `--no-verify` to bypass the commit message linter.

##### `#force-publish`

Force all packages to be published under the new version, not just the changed packages.

##### `#ignore-tooling`

Normally, we run all test suites when tooling changes, however, not all categories of tooling changes need to be tested quite so strictly. This message will omit the `tooling` meta package when determining what packages to test.

##### `#no-push`

Have Jenkins run all the tests, but abort the build before merging into master.

##### `[ci skip]`

Do not run tests for this build.

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

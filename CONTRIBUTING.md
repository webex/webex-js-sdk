# Contributing

## Opening an Issue
The title of a Bug or Enhancement should clearly indicate what is broken or desired. Use the description to explain possible solutions or add details and (especially for Enhancemnts) explain *how* or *why* the issue is broken or desired.

### Grammar
While quibbling about grammar in issue titles may seem a bit pedantic, adhering to some simple rules can make it much easier to understand a Bug or an Enhancement from the title alone. For example, is the title **"Browsers should support blinking text"** a bug or a feature request?

- Enhancements: The title should be an imperative statement of how things should be. **"Add support for blinking text"**

- Bugs: The title should be a declarative statement of how things are. **"Text does not blink"**

## Git Commit Guidelines

As part of the build process, commits are run through [conventional changelog](https://github.com/ajoslin/conventional-changelog) to generate the changelog. Please adhere to the following guidelines when formatting your commit messages.

### Commit Message Format

Each commit message consists of a <b>header</b>, a <b>body</b> and a <b>footer</b>. The header has a special format that includes a <b>type</b>, a <b>scope</b> and a <b>subject</b>:

```
<type>(<scope>): <subject>
<BLANK LINE>
<body>
<BLANK LINE>
<footer>
```

The <b>header</b> is mandatory and the scope of the header is optional.

Any line of the commit message cannot be longer 100 characters! This allows the message to be easier to read on GitHub as well as in various git tools.

### Revert

If the commit reverts a previous commit, it should begin with `revert:`, followed by the header of the reverted commit. In the body it should say: `This reverts commit <hash>`., where the hash is the SHA of the commit being reverted.

### Type

Must be one of the following:

- <b>feat</b>: A new feature
- <b>fix</b>: A bug fix
- <b>docs</b>: Documentation only changes
- <b>style</b>: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- <b>refactor</b>: A code change that neither fixes a bug nor adds a feature
- <b>perf</b>: A code change that improves performance
- <b>test</b>: Adding missing tests
- <b>chore</b>: Changes to the build process or auxiliary tools and libraries such as documentation generation

### Scope

The scope could be anything specifying place of the commit change. Generally, these should match package names.For example, `http-core`, `common`, `ciscospark`, etc...

### Subject

The subject contains succinct description of the change:

use the imperative, present tense: "change" not "changed" nor "changes"
don't capitalize first letter
no dot (.) at the end

### Body

Just as in the <b>subject<b>, use the imperative, present tense: "change" not "changed" nor "changes". The body should include the motivation for the change and contrast this with previous behavior.

### Footer

The footer should contain any information about <b>Breaking Changes</b> and is also the place to reference GitHub issues that this commit <b>Closes</b>.

<b>Breaking Changes</b> should start with the word `BREAKING CHANGE:` with a space or two newlines. The rest of the commit message is then used for this.

## Running the Tests

### Environment Setup

Install dependencies:

```
# Install top-level dependencies
npm install
# Install dependencies for each module in ./packages and locally link unpublished modules as needed
npm run bootstrap
```

You'll to create a file called `.env` that defines, at a minimum:

- `COMMON_IDENTITY_CLIENT_ID`
- `COMMON_IDENTITY_CLIENT_SECRET`
- `COMMON_IDENTITY_REDIRECT_URI`
- `COMMON_IDENTITY_SCOPE`
- `SCOPE`
- `COMMON_IDENTITY_SERVICE`
- `PORT`
- `FIXTURE_PORT`
- `KARMA_PORT`

Yes, `SCOPE` and `COMMON_IDENTITY_SCOPE` are redundant and should have the same values. Don't ask, you need to define both.

`COMMON_IDENTITY_SERVICE` should probably always be `spark`.

`PORT`, `FIXTURE_PORT`, and `KARMA_PORT` can mostly be any valid port, but when running tests via Sauce Labs, be sure to check their acceptable ports list. Good defaults are `8000`, `9000`, `8001`, respectively.

To run tests via Sauce Labs, you'll also need to define:

- `SAUCE_USERNAME`
- `SAUCE_ACCESS_KEY`

### Packages

Build all packages
```bash
npm run build
```

Build a single package
```bash
PACKAGE=<name> npm run grunt:package -- build
```

Run all tests
```bash
npm run grunt:concurrent -- test
```

Run tests for a single package
```bash
PACKGE=<name> npm run grunt:package -- test
```

Test behavior can be modified via environment variables.

Run all tests via Sauce Labs with code coverage and xunit output
```bash
COVERAGE=true SAUCE=true XUNIT=true npm run grunt:concurrent -- test
```

Run tests for a single package via Sauce Labs with code coverage and xunit output
```bash
PACKAGE=<name> COVERAGE=true SAUCE=true XUNIT=true PACKGE=<name> npm run grunt:package -- test
```

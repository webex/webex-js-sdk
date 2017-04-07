# Contributing

## Opening an Issue
The title of a Bug or Enhancement should clearly indicate what is broken or desired. Use the description to explain possible solutions or add details and (especially for Enhancemnts) explain *how* or *why* the issue is broken or desired.

### Grammar
While quibbling about grammar in issue titles may seem a bit pedantic, adhering to some simple rules can make it much easier to understand a Bug or an Enhancement from the title alone. For example, is the title **"Browsers should support blinking text"** a bug or a feature request?

- Enhancements: The title should be an imperative statement of how things should be. **"Add support for blinking text"**

- Bugs: The title should be a declarative statement of how things are. **"Text does not blink"**

## Git Commit Guidelines

As part of the build process, commits are run through [conventional changelog](https://github.com/conventional-changelog/conventional-changelog) to generate the changelog. Please adhere to the following guidelines when formatting your commit messages.

### Commit Message Format

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

### Revert

If the commit reverts a previous commit, it should begin with `revert:`, followed by the header of the reverted commit. In the body it should say: `This reverts commit <hash>`., where the hash is the SHA of the commit being reverted.

### Type

Must be one of the following:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **perf**: A code change that improves performance
- **test**: Adding missing tests
- **chore**: Changes to the build process or auxiliary tools and libraries such as documentation generation

### Scope

The scope should indicate what is being changed. Generally, these should match package names. For example, `http-core`, `common`, `ciscospark`, etc. Other than package names, `tooling` tends to be the most common.

### Subject

The subject contains succinct description of the change:

- use the imperative, present tense: "change" not "changed" nor "changes"
- don't capitalize first letter
- no dot (.) at the end

### Body

Just as in the **subject** the imperative, present tense: "change" not "changed" nor "changes". The body should include the motivation for the change and contrast this with previous behavior.

### Footer

The footer should contain any information about **Breaking changes** and is also the place to reference GitHub issues that this commit **closes**.

**Breaking Changes** should start with the word `BREAKING CHANGE:` with a space or two newlines. The rest of the commit message is then used for this.

## Running the tests

Install dependencies:

```
npm install
```

You'll need to create a file called `.env` that defines, at a minimum:

- `CISCOSPARK_CLIENT_ID`
- `CISCOSPARK_CLIENT_SECRET`
- `CISCOSPARK_REDIRECT_URI`
- `CISCOSPARK_SCOPE`

You can get these values by registering a new integration on the [developer portal](https://developer.ciscospark.com/add-integration.html).

Finally, to run all tests:

```bash
npm run grunt:concurrent -- test
```

And to run the tests for a specific package

```bash
PACKAGE=<package name> npm run grunt:package -- test
```

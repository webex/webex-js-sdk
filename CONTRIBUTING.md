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

## Creating a Pull Request

`spark-js-sdk` is gated by Jenkins Validated Merge - nothing goes into master without going through tests first. Before you can start opening pull requests, you'll want to set up your local copy of the SDK to work with Jenkins.

### Setting Up Your Local Copy

1. Fork the repo using the GitHub UI.
2. Clone your new fork.
3. Open the cloned project in your terminal.
4. Add the remote `upstream`
5. Make sure you're on `master`
  ```bash
  git checkout master
  ```
6. Update `master` to the latest `upstream`

  ```bash
  git fetch upstream
  ```
7. Set `master` to track `upstream` instead of `origin`

  ```bash
  git branch --set-upstream-to upstream/master
  ```
8. Configure `master` to automatically rebase

  ```bash
  git config branch.master.rebase true
  ```
9. Add the remote for `jenkins`

  The command to add Jenkins as a remote git repository can be found by accessing the project's Jenkins job and viewing the __Git Repository for Validated Merge__ tab.

This will setup your local copy with three remotes:
- `origin` will point at your fork
- `upstream` will point at the official repo
- `jenkins` will point at the Jenkins build job for the project.

`master` will track `upstream/master` instead of `origin/master` and `git pull` while on the `master` branch will automatically rebase. Note: you probably never want to commit to `master`.

### Creating a PR
To submit a PR, start by creating a feature branch.

1. Open the cloned project in your terminal.
2. Make sure you're on the `master` branch

  ```bash
  git checkout master
  ```
3. Make sure you're up to date with `upstream`

  ```bash
  git pull
  ```
4. Create a feature branch

  ```bash
  git checkout -b <feature-name>
  ```
5. Make your code changes and commit to your feature branch
6. Push the changes to a branch on your fork

  ```bash
  git push -u origin <feature-name>
  ```
7. Open a pull request using the GitHub UI or the [hub](https://github.com/github/hub) command line tool.
8. Once you're changes have been reviewed and approved, push your feature branch to Jenkins

  ```bash
  git push jenkins <feature-name>:master
 ```
> If you push your changes without an approved review, they will be reverted

#### If Your PR Can't Be Merged
If GitHub can't figure out how to merge your PR, it probably means there were upstream changes. You'll need to merge them manually and update your pull request.

1. Change back to master.

  ```bash
  git checkout master
  ```
2. Rebase master against the latest upstream.

  ```bash
  git pull
  ```
3. Return to your feature branch.

  ```bash
  git checkout <feature-name>
  ```
4. rebase your feature branch against the updated master.

  ```bash
  git rebase master
  ```
5. Use whatever tool you prefer for solving merge conflicts.
6. Force-push your changes to the feature branch on your fork.

  ```bash
  git push --force-with-lease
  ```

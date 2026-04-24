# Environment
The code in this repository requires node version 22.14, so use nvm to install and use the correct node version:
```
nvm install 22.14
nvm use 22.14
```

# Code structure
This repository contains JS-SDK library which is split into multiple plugins. Each plugin has its own folder inside `packages/@webex/`.

Each plugin has its own `src` folder with the source code and `test` folder with unit tests. Their subfolders structure is the same.
For example, the file `packages/@webex/plugin-meetings/src/meeting/index.ts` contains the source code for the Meeting class of the meetings plugin, while `packages/@webex/plugin-meetings/test/unit/spec/meeting/index.js` contains unit tests for this class.

Usually, when working on new features or fixing bugs, you will be working on a single plugin, so when analyzing the code or running the tests, focus only on that single plugin.

# Building
To build the source code for a specific plugin, use:
`yarn workspace @webex/<plugin-name> build:src`

# Unit tests
To run unit tests for a specific plugin, use the following command:
`yarn workspace @webex/<plugin-name> test:unit`

for example, for plugin-meetings use:
`yarn workspace @webex/plugin-meetings test:unit`

## Running a specific test file
To run a single test file, use `--targets` with a path relative to the test type's spec directory:
- `test:unit` resolves from `test/unit/spec/`
- `test:integration` and `test:browser` resolve from `test/integration/spec/`

```
yarn workspace @webex/<plugin-name> test:unit --targets <path-relative-to-spec>
```

For example, to run `packages/@webex/plugin-meetings/test/unit/spec/locus-info/controlsUtils.js`:
```
yarn workspace @webex/plugin-meetings test:unit --targets locus-info/controlsUtils.js
```

**Common mistake:** passing just the filename (`--targets controlsUtils.js`) or a full path. The `--targets` value must be the path starting from inside the spec directory for that test type.

## Test writing guidelines
When adding tests to existing test files, use same coding style as the existing tests
Use sinon for mocks and stubs.
Use assert from '@webex/test-helper-chai' for asserts and checks.
Use assert.calledOnceWithExactly instead of multiple calls like assert.calledOnce() followed by assert.calledWith()
Use sinon.useFakeTimers() to control time progression in unit tests.
Whenever there are more than 3 similar test cases, use parametrized tests
Avoid test code duplication and re-use existing helper test methods or write new ones

# Refactoring guidelines
When asked to refactor, encapsulate, or redesign a method/API, do upfront design thinking before writing any code:
1. Reason about what the ideal method signature looks like after the change
2. Reason about what each call site should look like — if logic is being moved inside a method, the caller should no longer need to know about it
3. Consider whether TypeScript's type system can enforce correct usage patterns (e.g. discriminated unions to prevent invalid argument combinations)
4. Only then implement — starting from the signature design, not from a minimal diff

Do not do incremental half-steps. Follow the request to its logical conclusion in a single pass.

# Searching for patterns in the codebase
When asked to find all occurrences of a logical pattern (e.g. "where state is LEFT and reason is MOVED"):
1. Search for **both** named constants (e.g. `_LEFT_`, `_MOVED_`) **and** raw string literals (e.g. `'LEFT'`, `'MOVED'`, `"LEFT"`, `"MOVED"`). The codebase is inconsistent — some call sites use imported constants while others use inline strings.
2. Also search for related enum values (e.g. `LOCUS.STATE.*`, `MEETING_STATE.STATES.*`) that may represent the same logical concept.
3. After finding all matches, **list every occurrence** and confirm the full set with the user before making changes, to avoid missing any.


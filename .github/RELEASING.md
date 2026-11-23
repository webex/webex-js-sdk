# SDK npm releases

| Release | Workflow filename | Package selection | npm tag |
| --- | --- | --- | --- |
| Automatic | `deploy.yml` | Changed packages and their dependents from the release matrix | `next` |
| Manual | `manual-deploy.yml` | The publishable packages in the resolved deploy plan | `latest` |

The SDK builds with Yarn 3.4.1. The publish jobs use the same pinned Yarn 4.10.3 publisher as
Widgets. The publish script converts the runner's lockfile before running each selected
workspace's `deploy:npm` script. Live publishes use GitHub OIDC and include provenance.
[Yarn release](https://github.com/yarnpkg/berry/releases/tag/%40yarnpkg/cli/4.10.3)

## npm package owner setup

For each package in the planned release, a package maintainer with settings access and 2FA adds
a **GitHub Actions** trusted publisher in the npm package settings.

| Setting | Value |
| --- | --- |
| Organization | `webex` |
| Repository | `webex-js-sdk` |
| Workflow filename | `deploy.yml` for automatic releases or `manual-deploy.yml` for manual releases |
| Environment | Leave empty |
| Allowed action | Enable **Allow npm publish** |

Add both entries for a package that uses both workflows. Use the manual workflow's dry-run
summary for the `latest` list. The manual workflow excludes `@webex/byods`, `@webex/cli-tools`,
`@webex/package-tools`, and `@webex/plugin-presence`.

To preview the `next` list before a release, run these commands from a clean checkout of the
proposed release commit with its dependencies installed. Use the commit on `next` before the
release as `<before-sha>`. The publisher runs only for workspaces that define `deploy:npm`.

```sh
yarn run build:tools
yarn package-tools list --mode node --recursive --committed --since <before-sha>
```

Create the entries close to release time. Each new entry needs its first successful publish
within two days of creation. [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/)

## Release verification

1. Check the package names, planned versions, and tag. For manual releases, run with
   `dry-run` enabled to check the same Yarn publisher and packaging path before the live release.
2. During the live release, confirm the npm publish job succeeds. Check the new versions and tags
   on npm and match their provenance to the Actions run and commit.
3. Record evidence for the automatic and manual releases in
   [CAI-8747](https://jira-eng-sjc12.cisco.com/jira/browse/CAI-8747). Remove obsolete publish
   tokens after their release workflows have switched to OIDC.

If a release publishes only part of its package list, check the registry before retrying.
The manual workflow skips versions that already exist on npm.

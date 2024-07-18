const packagesData = [
  {
    name: 'webex',
    data: {
      location: '/Users/someUser/webex-js-sdk/packages/webex',
      name: 'webex',
      packageInfo: {
        version: '3.3.1',
        'dist-tags': {
          bnr: '3.0.0-bnr.5',
          beta: '3.0.0-beta.424',
          latest: '3.3.1',
          test: '3.3.1-test.6',
        },
      },
      version: {
        major: 3,
        minor: 3,
        patch: 1,
        release: 6,
        tag: 'test',
      },
    },
    get version() {
      return '3.3.1-test.6';
    },
  },
  {
    name: '@webex/package-tools',
    data: {
      location: '/Users/someUser/webex-js-sdk/packages/tools/package',
      name: '@webex/package-tools',
      packageInfo: {
        version: '0.0.0-test.1',
        'dist-tags': { test: '0.0.0-test.2', latest: '0.0.0-test.1' },
      },
      version: {
        major: 0,
        minor: 0,
        patch: 0,
        release: 2,
        tag: 'test',
      },
    },
    get version() {
      return '0.0.0-test.1';
    },
  },
];

const packageDataChangelog = [
  {
    webex: {
      '3.3.1-test.6': {
        published_date: 123456,
        commits: { mockCommitId: 'mock commit message' },
        alongWith: { '@webex/package-tools': '0.0.0-test.1' },
      },
    },
  },
  {
    '@webex/package-tools': {
      '0.0.0-test.1': {
        published_date: 123456,
        commits: { mockCommitId: 'mock commit message' },
        alongWith: { webex: '3.3.1-test.6' },
      },
    },
  },
];

const changelogData = `{
  "@webex/plugin-meetings": {
    "3.3.1-test.13": {
      "commits": {
        "abc3cd5365e87b568049c2cbec47c27bd652ccb1": "feat(tooling): add-logic-to-generate-changelogs"
      },
      "alongWith": {
        "webex": "3.3.1-test.13"
      }
    }
  },
  "webex": {
    "3.3.1-test.13": {
      "commits": {
        "abc3cd5365e87b568049c2cbec47c27bd652ccb1": "feat(tooling): add-logic-to-generate-changelogs"
      },
      "alongWith": {
        "@webex/plugin-meetings": "3.3.1-test.13"
      }
    }
  }
}`;

const fixtures = {
  packagesData,
  packageDataChangelog,
  changelogData,
};

module.exports = fixtures;

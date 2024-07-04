const packagesData = {
  webex: {
    data: {
      location: '/Users/shreysh2/Desktop/Repo/webex-js-sdk/packages/webex',
      name: 'webex',
      packageInfo: {
        version: '3.3.1',
        'dist-tags': {
          bnr: '3.0.0-bnr.5',
          beta: '3.0.0-beta.424',
          latest: '3.3.1',
          next: '3.3.1-next.6',
        },
      },
      version: {
        major: 3, minor: 3, patch: 1, release: 6, tag: 'next',
      },
    },
  },
  '@webex/package-tools': {
    data: {
      location: '/Users/shreysh2/Desktop/Repo/webex-js-sdk/packages/tools/package',
      name: '@webex/package-tools',
      packageInfo: {
        version: '0.0.0-next.1',
        'dist-tags': { next: '0.0.0-next.2', latest: '0.0.0-next.1' },
      },
      version: {
        major: 0, minor: 0, patch: 0, release: 2, tag: 'next',
      },
    },
  },
};

const fixtures = {
  packagesData,
};

module.exports = fixtures;

const changelogUtils = require('@webex/package-tools/dist/module/commands/changelog/changelog.utils');
const changelogExecutor = require('@webex/package-tools/dist/module/commands/changelog/changelog.executor');
const fs = require('fs');
const fixtures = require('./changelog.fixtures');

jest.mock('@webex/package-tools/dist/module/commands/changelog/changelog.executor', () => ({
  getCommits: jest.fn().mockResolvedValue('{"mockCommitId": "mock commit message"}'),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

describe('changelogUtils', () => {
  afterEach(() => jest.clearAllMocks());
  fs.readFileSync.mockReturnValue(fixtures.changelogData);
  describe('createOrUpdateChangelog', () => {
    const filePath331 = fixtures.packagesData[0].version.split('-')[0].replace(/\./g, '_');

    it('should "getCommits" with correct arguments', async () => {
      await changelogUtils.createOrUpdateChangelog(fixtures.packagesData, 'mock_commit_id');
      expect(changelogExecutor.getCommits).toHaveBeenCalledTimes(2);
      expect(changelogExecutor.getCommits).toHaveBeenCalledWith(
        'mock_commit_id',
      );
    });

    it('read changelog data if version file exists', async () => {
      fs.readFileSync.mockReturnValue(fixtures.changelogData);
      await changelogUtils.createOrUpdateChangelog(fixtures.packagesData, 'mock_commit_id');
      expect(fs.readFileSync).toHaveBeenCalledWith(`./docs/changelog/v${filePath331}.json`);
    });

    it('creates changelog data and creates or put the data in the respective file', async () => {
      jest.spyOn(Date, 'now').mockReturnValue('123456789');
      fs.readFileSync.mockReturnValue(fixtures.changelogData);
      await changelogUtils.createOrUpdateChangelog(fixtures.packagesData, 'mock_commit_id');
      const filePath000 = fixtures.packagesData[1].data.packageInfo.version
        .split('-')[0]
        .replace(/\./g, '_');
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
      // writeFileSync will be called for each package
      // Here, according to the fixtures first it will be called for webex which is at version 3.3.1
      // and second, it will be called for @webex/package-tools which is at version 3.3.
      expect(fs.writeFileSync.mock.calls).toEqual([
        [
          `./docs/changelog/v${filePath331}.json`,
          JSON.stringify(fixtures.packageDataChangelog1, null, 2),
        ],
        [
          `./docs/changelog/v${filePath000}.json`,
          JSON.stringify(fixtures.packageDataChangelog2, null, 2),
        ],
      ]);
    });
  });
});

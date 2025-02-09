const changelogUtils = require('@webex/package-tools/dist/module/commands/changelog/changelog.utils');
const changelogExecutor = require('@webex/package-tools/dist/module/commands/changelog/changelog.executor');
const fs = require('fs');
const fixtures = require('./changelog.fixtures');

jest.mock('@webex/package-tools/dist/module/commands/changelog/changelog.executor', () => ({
  getCommits: jest.fn(),
}));

jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}));

describe('changelogUtils', () => {
  afterEach(() => {
    changelogExecutor.getCommits.mockResolvedValue('{"mockCommitId": "mock commit message"}');
    jest.clearAllMocks();
  });
  fs.readFileSync.mockReturnValue(fixtures.changelogData);
  describe('createOrUpdateChangelog', () => {
    const filePath331 = fixtures.packagesData[0].version.split('-')[0].replace(/\./g, '_');
    const filePath000 = fixtures.packagesData[1].data.packageInfo.version
      .split('-')[0]
      .replace(/\./g, '_');

    it('should "getCommits" with correct arguments', async () => {
      await changelogUtils.createOrUpdateChangelog(fixtures.packagesData, 'mock_commit_id');
      expect(changelogExecutor.getCommits).toHaveBeenCalledTimes(2);
      expect(changelogExecutor.getCommits).toHaveBeenCalledWith(
        'mock_commit_id',
      );
    });

    it('should log error if "getCommits" fails', async () => {
      // To avoid logging the error while running tests.
      const logSpy = jest.spyOn(console, 'log').mockImplementation((msg) => msg);
      changelogExecutor.getCommits.mockImplementation(() => { throw new Error('mockError'); });

      await changelogUtils.createOrUpdateChangelog(fixtures.packagesData, 'mock_commit_id');
      expect(changelogExecutor.getCommits).toHaveBeenCalledTimes(2);
      expect(changelogExecutor.getCommits).toHaveBeenCalledWith(
        'mock_commit_id',
      );
      expect(logSpy).toHaveBeenCalledTimes(2);
      expect(logSpy).toHaveBeenCalledWith('Changelog Error: Error while getting commits', Error('mockError'));
    });

    it('read changelog data and main.json data if file exists', async () => {
      fs.readFileSync.mockReturnValue(fixtures.changelogData);
      await changelogUtils.createOrUpdateChangelog(fixtures.packagesData, 'mock_commit_id');
      // Twice to read changelog data and twice to read main.json
      expect(fs.readFileSync).toHaveBeenCalledTimes(4);
      expect(fs.readFileSync).toHaveBeenCalledWith(`./docs/changelog/logs/v${filePath331}.json`);
      expect(fs.readFileSync).toHaveBeenCalledWith(`./docs/changelog/logs/v${filePath000}.json`);
      expect(fs.readFileSync).toHaveBeenCalledWith('./docs/changelog/logs/main.json');
    });

    it('creates changelog data and main.json data and creates or put the data in the respective file', async () => {
      jest.spyOn(Date, 'now').mockReturnValue('123456789');
      fs.readFileSync
        .mockReturnValueOnce(fixtures.changelogData)
        .mockReturnValueOnce(fixtures.mainJsonData)
        .mockReturnValueOnce(fixtures.changelogData)
        .mockReturnValueOnce(fixtures.mainJsonData);

      await changelogUtils.createOrUpdateChangelog(fixtures.packagesData, 'mock_commit_id');
      // Twice to write changelog data and twice to read main.json
      expect(fs.writeFileSync).toHaveBeenCalledTimes(4);
      // writeFileSync will be called for each package
      // Here, according to the fixtures first it will be called for webex which is at version 3.3.1
      // and second, it will be called for @webex/package-tools which is at version 3.3.
      expect(fs.writeFileSync.mock.calls).toEqual([
        [
          `./docs/changelog/logs/v${filePath331}.json`,
          JSON.stringify(fixtures.packageDataChangelog1, null, 2),
        ],
        [
          './docs/changelog/logs/main.json',
          JSON.stringify({
            '1.2.3': 'logs/v1_2_3.json',
            '3.2.1': 'logs/v3_2_1.json',
            '3.3.1': 'logs/v3_3_1.json',
          }, null, 2),
        ],
        [
          `./docs/changelog/logs/v${filePath000}.json`,
          JSON.stringify(fixtures.packageDataChangelog2, null, 2),
        ],
        [
          './docs/changelog/logs/main.json',
          JSON.stringify({
            '1.2.3': 'logs/v1_2_3.json',
            '3.2.1': 'logs/v3_2_1.json',
            '0.0.0': 'logs/v0_0_0.json',
          }, null, 2),
        ],
      ]);
    });
  });
});

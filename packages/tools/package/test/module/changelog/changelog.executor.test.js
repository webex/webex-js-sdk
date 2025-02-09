const changelogExecutor = require('@webex/package-tools/dist/module/commands/changelog/changelog.executor');
const { Executor } = require('@webex/cli-tools');

describe('changelogExecutor', () => {
  it('should call getCommits', () => {
    const mockCommit = 'mockCommit';
    const getCommitsSpy = jest.spyOn(changelogExecutor, 'getCommits');
    const executorSpy = jest.spyOn(Executor, 'execute').mockResolvedValue('{ mockCommit: \'mockCommitMessage\' }');
    changelogExecutor.getCommits(mockCommit);
    expect(getCommitsSpy).toHaveBeenCalledWith(mockCommit);
    // eslint-disable-next-line no-useless-escape
    expect(executorSpy).toHaveBeenCalledWith(`git log --pretty=format:'\"%H\":\"%s\",' ${mockCommit}..HEAD`);
  });
});

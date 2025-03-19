const changelogExecutor = require('@webex/package-tools/dist/module/commands/changelog/changelog.executor');
const { Executor } = require('@webex/cli-tools');

describe('changelogExecutor', () => {
  it('should call getCommits', () => {
    const mockCommit = 'mockCommit';
    const getCommitsSpy = jest.spyOn(changelogExecutor, 'getCommits');
    const executorSpy = jest.spyOn(Executor, 'execute').mockResolvedValue('{ mockCommit: \'mockCommitMessage\' }');
    changelogExecutor.getCommits(mockCommit);
    expect(getCommitsSpy).toHaveBeenCalledWith(mockCommit);
    expect(executorSpy).toHaveBeenCalledWith(
      // eslint-disable-next-line no-useless-escape
      `git log --pretty=format:'escape\"%Hescape\":escape\"%sescape\",' ${mockCommit}..HEAD`,
    );
  });
});

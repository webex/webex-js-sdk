const path = require('path');
const { changelog, Package, Yarn } = require('@webex/package-tools');
const changelogUtils = require('@webex/package-tools/dist/module/commands/changelog/changelog.utils');
const fixtures = require('./changelog.fixtures');

describe('changelog', () => {
  const options = {
    packages: ['webex', '@webex/package-tools'],
    tag: 'next',
    commit: 'example_commit_id',
  };

  const rootDir = '/path/to/project';
  const spies = {};
  const listResolve = [
    { location: 'packages/@webex/plugin-tools', name: '@webex/package-tools' },
    { location: 'packages/webex', name: 'webex' },
  ];

  beforeEach(() => {
    spies.Yarn = {
      list: jest.spyOn(Yarn, 'list').mockResolvedValue(listResolve),
    };

    spies.package = {
      inspect: jest.spyOn(Package.prototype, 'inspect').mockImplementation(function func() {
        return Promise.resolve(this);
      }),
    };

    spies.path = {
      join: jest.spyOn(path, 'join').mockImplementation((...params) => params.join('/')),
    };

    spies.process = {
      cwd: jest.spyOn(process, 'cwd').mockReturnValue(rootDir),
      stdout: {
        write: jest.spyOn(process.stdout, 'write').mockReturnValue(undefined),
      },
    };
  });

  describe('config', () => {
    it('should include all expected top-level keys', () => {
      expect(Object.keys(changelog.config)).toEqual(['name', 'description', 'options']);
    });

    it('should include the fully qualified "packages" option', () => {
      const found = changelog.config.options.find((option) => option.name === 'packages');

      expect(!!found).toBeTruthy();
      expect(found.type).toBe('string...');
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "tag" option', () => {
      const found = changelog.config.options.find((option) => option.name === 'tag');

      expect(!!found).toBeTruthy();
      expect(found.type).toBe('string');
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "commit" option', () => {
      const found = changelog.config.options.find((option) => option.name === 'commit');

      expect(!!found).toBeTruthy();
      expect(found.type).toBe('string');
      expect(typeof found.description).toBe('string');
    });
  });

  describe('handler()', () => {
    it('should not call "Yarn.list()" if packages are not present', async () => {
      const noPackages = {
        tag: 'next',
        commit: 'example_commit_id',
      };
      await changelog.handler(noPackages);
      expect(spies.Yarn.list).not.toHaveBeenCalledWith();
    });

    it('should call "Yarn.list() and create paths for location"', async () => {
      jest.spyOn(changelogUtils, 'createOrUpdateChangelog').mockResolvedValue(true);
      await changelog.handler(options);
      expect(spies.Yarn.list).toHaveBeenCalledTimes(1);
      expect(spies.Yarn.list).toHaveBeenCalledWith();
      expect(spies.path.join).toHaveBeenCalledTimes(2);
      expect(spies.path.join).toHaveBeenCalledWith('/path/to/project', 'packages/@webex/plugin-tools');
      expect(spies.path.join).toHaveBeenCalledWith('/path/to/project', 'packages/webex');
    });

    it('should call "package.inspect()" for each located package', async () => {
      jest.spyOn(changelogUtils, 'createOrUpdateChangelog').mockResolvedValue(true);
      await changelog.handler(options);
      expect(spies.package.inspect).toHaveBeenCalledTimes(listResolve.length);
    });

    it('should call "createOrUpdateChangelog" with correct arguments', async () => {
      spies.package.inspect
        .mockReturnValueOnce(fixtures.packagesData['@webex/package-tools'])
        .mockReturnValueOnce(fixtures.packagesData.webex);
      const changelogSpy = jest
        .spyOn(changelogUtils, 'createOrUpdateChangelog')
        .mockResolvedValue(true);

      await changelog.handler(options);

      expect(changelogSpy).toHaveBeenCalledTimes(1);
      expect(changelogSpy).toHaveBeenCalledWith(
        [fixtures.packagesData['@webex/package-tools'], fixtures.packagesData.webex],
        options.commit,
      );
    });
  });
});

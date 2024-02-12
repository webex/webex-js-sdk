const path = require('path');
const { increment, Package, Yarn } = require('@webex/package-tools');

describe('increment', () => {
  describe('config', () => {
    it('should include all expected top-level keys', () => {
      expect(Object.keys(increment.config)).toEqual([
        'name',
        'description',
        'options',
      ]);
    });

    it('should include the fully qualified "major" option', () => {
      const found = increment.config.options.find((option) => option.name === 'major');

      expect(!!found).toBeTruthy();
      expect(found.type).toBe('number');
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "minor" option', () => {
      const found = increment.config.options.find((option) => option.name === 'minor');

      expect(!!found).toBeTruthy();
      expect(found.type).toBe('number');
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "packages" option', () => {
      const found = increment.config.options.find((option) => option.name === 'packages');

      expect(!!found).toBeTruthy();
      expect(found.type).toBe('string...');
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "patch" option', () => {
      const found = increment.config.options.find((option) => option.name === 'patch');

      expect(!!found).toBeTruthy();
      expect(found.type).toBe('number');
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "release" option', () => {
      const found = increment.config.options.find((option) => option.name === 'release');

      expect(!!found).toBeTruthy();
      expect(found.type).toBe('number');
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "since" option', () => {
      const found = increment.config.options.find((option) => option.name === 'since');

      expect(!!found).toBeTruthy();
      expect(found.type).toBe('string');
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "tag" option', () => {
      const found = increment.config.options.find((option) => option.name === 'tag');

      expect(!!found).toBeTruthy();
      expect(found.type).toBe('string');
      expect(typeof found.description).toBe('string');
    });
  });

  describe('handler()', () => {
    const rootDir = '/path/to/project';
    const spies = {};
    const listResolve = [
      { location: 'packages/scope/example-a', name: '@scope/example-a' },
      { location: 'packages/scope/example-b', name: '@scope/example-b' },
      { location: 'packages/scope/example-c', name: '@scope/example-c' },
    ];
    const options = {
      major: 1,
      minor: 2,
      packages: ['@scope/example-a', '@scope/example-b', '@scope/example-c'],
      patch: 3,
      release: 4,
      since: 'example-reference',
      tag: 'example/of/example-tag',
    };

    beforeEach(() => {
      spies.Yarn = {
        list: jest.spyOn(Yarn, 'list').mockResolvedValue(listResolve),
      };

      spies.package = {
        inspect: jest.spyOn(Package.prototype, 'inspect')
          .mockImplementation(function func() { return Promise.resolve(this); }),
        syncVersion: jest.spyOn(Package.prototype, 'syncVersion')
          .mockImplementation(function func() { return Promise.resolve(this); }),
        incrementVersion: jest.spyOn(Package.prototype, 'incrementVersion').mockReturnThis(),
        apply: jest.spyOn(Package.prototype, 'apply').mockReturnThis(),
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

    it('should call "Yarn.list()" with the since option', () => increment.handler(options)
      .then(() => {
        expect(spies.Yarn.list).toHaveBeenCalledTimes(1);
        expect(spies.Yarn.list).toHaveBeenCalledWith(expect.objectContaining({
          since: options.since,
        }));
      }));

    it('should return a Promise that resolves to the Package class Objects', () => increment.handler(options)
      .then((results) => {
        results.forEach((result) => {
          expect(result instanceof Package).toBeTruthy();
        });
      }));

    it('should call "package.inspect()" for each located package', () => increment.handler(options)
      .then(() => {
        expect(spies.package.inspect).toHaveBeenCalledTimes(listResolve.length);
      }));

    it('should call "package.syncVersion()" for each located package', () => increment.handler(options)
      .then(() => {
        expect(spies.package.syncVersion).toHaveBeenCalledTimes(listResolve.length);
      }));

    it('should not increment any packages when the version details provided are undefined', () => increment.handler({})
      .then((results) => {
        const expected = {
          major: undefined,
          minor: undefined,
          patch: undefined,
          release: undefined,
        };

        expect(spies.package.incrementVersion).toHaveBeenCalledTimes(options.packages.length);

        results.forEach((item, index) => {
          expect(spies.package.incrementVersion).toHaveBeenNthCalledWith(index + 1, expected);
        });
      }));

    it('should only resolve with Package objects included in the packages option', () => {
      const targetPackages = [options.packages[0], options.packages[1]];

      return increment.handler({ ...options, packages: targetPackages })
        .then((results) => {
          expect(results).toHaveLength(2);
          expect(results[0].name).toBe(targetPackages[0]);
          expect(results[1].name).toBe(targetPackages[1]);
        });
    });

    it(
      'should write the list of packages updated and their corresponding new versions',
      () => increment.handler({ ...options })
        .then(() => {
          const generatedString = options.packages.map(
            (pack) => `${pack} => 0.0.0-${options.tag.split('/').pop()}.0`,
          ).join('\n');

          expect(spies.process.stdout.write).toHaveBeenCalledTimes(1);
          expect(spies.process.stdout.write).toHaveBeenCalledWith(generatedString);
        }),
    );

    it(
      'should return all packages when packages is not provided',
      () => increment.handler({ ...options, packages: undefined })
        .then((results) => {
          expect(results).toHaveLength(3);
        }),
    );
  });
});

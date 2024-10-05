const path = require('path');
const { sync, Package, Yarn } = require('@webex/package-tools');

describe('sync', () => {
  describe('config', () => {
    it('should include all expected top-level keys', () => {
      expect(Object.keys(sync.config)).toEqual([
        'name',
        'description',
        'options',
      ]);
    });

    it('should include the fully qualified "tag" option', () => {
      const found = sync.config.options.find((option) => option.name === 'tag');

      expect(!!found).toBeTruthy();
      expect(found.type).toBe('string');
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "packages" option', () => {
      const found = sync.config.options.find((option) => option.name === 'packages');

      expect(!!found).toBeTruthy();
      expect(found.type).toBe('string...');
      expect(typeof found.description).toBe('string');
    });
  });

  describe('handler', () => {
    const rootDir = '/path/to/project';
    const spies = {};

    const listResolve = [
      { location: 'packages/scope/example-a', name: '@scope/example-a' },
      { location: 'packages/scope/example-b', name: '@scope/example-b' },
      { location: 'packages/scope/example-c', name: '@scope/example-c' },
    ];

    const viewResolve = {
      dependencies: {
        dependency1: '1.2.3',
      },
      devDependencies: {
        dependency2: '4.5.6',
      },
    };

    const options = {
      tag: 'next',
      packages: ['@scope/example-a', '@scope/example-b', '@scope/example-c'],
    };

    beforeEach(() => {
      spies.Yarn = {
        list: jest.spyOn(Yarn, 'list').mockResolvedValue(listResolve),
        view: jest.spyOn(Yarn, 'view').mockResolvedValue(viewResolve),
      };

      spies.package = {
        inspect: jest.spyOn(Package.prototype, 'inspect')
          .mockImplementation(function func() { return Promise.resolve(this); }),
        syncVersion: jest.spyOn(Package.prototype, 'syncVersion')
          .mockImplementation(function func() { return Promise.resolve(this); }),
        apply: jest.spyOn(Package.prototype, 'apply')
          .mockImplementation(function func() { return Promise.resolve(this); }),
      };

      spies.path = {
        join: jest.spyOn(path, 'join').mockImplementation((...params) => params.join('/')),
      };

      spies.process = {
        cwd: jest.spyOn(process, 'cwd').mockReturnValue(rootDir),
        stdout: {
          write: jest.spyOn(process.stdout, 'write').mockImplementation(() => undefined),
        },
      };
    });

    it('should call "Yarn.list()"', () => sync.handler(options)
      .then(() => {
        expect(spies.Yarn.list).toHaveBeenCalledTimes(1);
        expect(spies.Yarn.list).toHaveBeenCalledWith();
      }));

    it('should return a Promise that resolves to the Package class Objects', () => sync.handler(options)
      .then((results) => {
        results.forEach((result) => {
          expect(result instanceof Package).toBeTruthy();
        });
      }));

    it('should call "package.inspect()" for each located package', () => sync.handler(options)
      .then(() => {
        expect(spies.package.inspect).toHaveBeenCalledTimes(3);
      }));

    it(
      'should write the list of packages updated and their corresponding new versions',
      () => sync.handler({ ...options })
        .then(() => {
          const generatedString = options.packages.map(
            (pack) => `${pack} => 0.0.0-${options.tag.split('/').pop()}.0`,
          ).join('\n');

          expect(spies.process.stdout.write).toHaveBeenCalledWith(generatedString);
        }),
    );

    it(
      'should return all packages when packages is not provided',
      () => sync.handler({ ...options, packages: undefined })
        .then((results) => {
          expect(results).toHaveLength(3);
        }),
    );
  });
});

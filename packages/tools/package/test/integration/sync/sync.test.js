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

      expect(!!found).toBeTrue();
      expect(found.type).toBe('string');
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "packages" option', () => {
      const found = sync.config.options.find((option) => option.name === 'packages');

      expect(!!found).toBeTrue();
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
      packages: '@scope/example-b',
    };

    beforeEach(() => {
      spies.Yarn = {
        list: spyOn(Yarn, 'list').and.resolveTo(listResolve),
        view: spyOn(Yarn, 'view').and.resolveTo(viewResolve),
      };

      spies.package = {
        inspect: spyOn(Package.prototype, 'inspect').and.callFake(function func() { return Promise.resolve(this); }),
        syncVersion: spyOn(Package.prototype, 'syncVersion').and.callFake(function func() { return Promise.resolve(this); }),
        syncDependency: spyOn(Package.prototype, 'syncDependency').and.callFake(function func() { return Promise.resolve(this); }),
      };

      spies.path = {
        join: spyOn(path, 'join').and.callFake((...params) => params.join('/')),
      };

      spies.process = {
        cwd: spyOn(process, 'cwd').and.returnValue(rootDir),
        stdout: {
          write: spyOn(process.stdout, 'write').and.callFake(() => undefined),
        },
      };
    });

    it('should call "Yarn.list()"', () => sync.handler(options)
      .then(() => {
        expect(spies.Yarn.list).toHaveBeenCalledOnceWith();
      }));

    it('should return a Promise that resolves to the Package class Objects', () => {
      sync.handler(options)
        .then((results) => {
          results.forEach((result) => {
            expect(result instanceof Package).toBeTrue();
          });
        });
    });

    it('should call "package.inspect()" for each located package', () => sync.handler(options)
      .then(() => {
        expect(spies.package.inspect).toHaveBeenCalledTimes(1);
      }));

    it('should call "package.syncVersion()" for each located package', () => sync.handler(options)
      .then(() => {
        expect(spies.package.syncVersion).toHaveBeenCalledTimes(1);
      }));

    it('should call "Yarn.view()"', () => sync.handler(options)
      .then(() => {
        expect(spies.Yarn.view).toHaveBeenCalledTimes(1);
      }));

    it('should call "package.syncDependency()" for dependencies', () => sync.handler(options)
      .then(() => {
        expect(spies.package.syncDependency).toHaveBeenCalledTimes(2);
        expect(spies.package.syncDependency).toHaveBeenCalledWith(viewResolve.dependencies);
        expect(spies.package.syncDependency)
          .toHaveBeenCalledWith(viewResolve.devDependencies, true);
      }));
  });
});

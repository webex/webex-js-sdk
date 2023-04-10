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

      expect(!!found).toBeTrue();
      expect(found.type).toBe('number');
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "minor" option', () => {
      const found = increment.config.options.find((option) => option.name === 'minor');

      expect(!!found).toBeTrue();
      expect(found.type).toBe('number');
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "packages" option', () => {
      const found = increment.config.options.find((option) => option.name === 'packages');

      expect(!!found).toBeTrue();
      expect(found.type).toBe('string...');
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "patch" option', () => {
      const found = increment.config.options.find((option) => option.name === 'patch');

      expect(!!found).toBeTrue();
      expect(found.type).toBe('number');
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "release" option', () => {
      const found = increment.config.options.find((option) => option.name === 'release');

      expect(!!found).toBeTrue();
      expect(found.type).toBe('number');
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "since" option', () => {
      const found = increment.config.options.find((option) => option.name === 'since');

      expect(!!found).toBeTrue();
      expect(found.type).toBe('string');
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "tag" option', () => {
      const found = increment.config.options.find((option) => option.name === 'tag');

      expect(!!found).toBeTrue();
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
      tag: 'example-tag',
    };

    beforeEach(() => {
      spies.Yarn = {
        list: spyOn(Yarn, 'list').and.resolveTo(listResolve),
      };

      spies.package = {
        inspect: spyOn(Package.prototype, 'inspect').and.callFake(function func() { return Promise.resolve(this); }),
        incrementVersion: spyOn(Package.prototype, 'incrementVersion').and.callFake(function func() { return this; }),
        apply: spyOn(Package.prototype, 'apply').and.callFake(function func() { return Promise.resolve(this); }),
      };

      spies.path = {
        join: spyOn(path, 'join').and.callFake((...params) => params.join('/')),
      };

      spies.process = {
        cwd: spyOn(process, 'cwd').and.returnValue(rootDir),
      };
    });

    it('should call "Yarn.list()" with the since option', () => increment.handler(options)
      .then(() => {
        expect(spies.Yarn.list).toHaveBeenCalledOnceWith(jasmine.objectContaining({
          since: options.since,
        }));
      }));

    it('should return a Promise that resolves to the Package class Objects', () => {
      increment.handler(options)
        .then((results) => {
          results.forEach((result) => {
            expect(result instanceof Package).toBeTrue();
          });
        });
    });

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
          expect(spies.package.incrementVersion.calls.all()[index].args[0]).toEqual(expected);
        });
      }));

    it('should only resolve with Package objects included in the packages option', () => {
      const targetPackages = [options.packages[0], options.packages[1]];

      return increment.handler({ ...options, packages: targetPackages })
        .then((results) => {
          expect(results.length).toBe(2);
          expect(results[0].name).toBe(targetPackages[0]);
          expect(results[1].name).toBe(targetPackages[1]);
        });
    });

    it('should return all packages when packages is not provided', () => increment.handler({ ...options, packages: undefined })
      .then((results) => {
        expect(results.length).toBe(3);
      }));
  });
});

const path = require('path');

const { scripts, Package, Yarn } = require('@webex/package-tools');

describe('scripts', () => {
  describe('config', () => {
    it('should include all expected top-level keys', () => {
      expect(Object.keys(scripts.config)).toEqual([
        'name',
        'description',
        'options',
      ]);
    });

    it('should include the fully qualified "package" option', () => {
      const found = scripts.config.options.find((option) => option.name === 'package');

      expect(!!found).toBeTrue();
      expect(found.type).toBe('string');
      expect(found.required).toBe(true);
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "script" option', () => {
      const found = scripts.config.options.find((option) => option.name === 'script');

      expect(!!found).toBeTrue();
      expect(found.type).toBe('string');
      expect(found.required).toBe(true);
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
      package: listResolve[0].name,
      script: 'example-script',
    };

    beforeEach(() => {
      spies.Yarn = {
        list: spyOn(Yarn, 'list').and.resolveTo(listResolve),
      };

      spies.package = {
        hasScript: spyOn(Package.prototype, 'hasScript').and.resolveTo(true),
      };

      spies.path = {
        join: spyOn(path, 'join').and.callFake((...params) => params.join('/')),
      };

      spies.process = {
        cwd: spyOn(process, 'cwd').and.returnValue(rootDir),
        stdout: {
          write: spyOn(process.stdout, 'write').and.returnValue(),
        },
      };
    });

    it('should call "Yarn.list()" with the since option', () => scripts.handler(options)
      .then(() => {
        expect(spies.Yarn.list).toHaveBeenCalledTimes(1);
      }));

    it('should return a Promise that resolves to true if the script exists', () => scripts.handler(options)
      .then((results) => {
        expect(results).toBe(true);
      }));

    it('should return a Promise that resolves to false if the script does not exist', () => {
      spies.package.hasScript.and.resolveTo(false);

      return scripts.handler(options)
        .then((results) => {
          expect(results).toBe(false);
        });
    });

    it('should return false if the provided package is not found', () => scripts.handler({ ...options, package: 'invalid-package' })
      .then((results) => {
        expect(results).toBe(false);
      }));

    it('should call "process.stdout.write()" with the resulting value', () => scripts.handler(options)
      .then((results) => {
        expect(spies.process.stdout.write).toHaveBeenCalledWith(`${results}`);
      }));
  });
});

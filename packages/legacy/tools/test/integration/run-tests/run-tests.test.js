const { runTests, Package } = require('@webex/legacy-tools');

describe('runTests', () => {
  describe('config', () => {
    it('should include all expected top-level keys', () => {
      expect(Object.keys(runTests.config)).toEqual([
        'name',
        'description',
        'options',
      ]);
    });

    it('should include the fully qualified "automation" option', () => {
      const found = runTests.config.options.find((option) => option.name === 'automation');

      expect(!!found).toBeTrue();
      expect(typeof found.description).toBe('string');
      expect(found.type).toBe('boolean');
    });

    it('should include the fully qualified "documentation" option', () => {
      const found = runTests.config.options.find((option) => option.name === 'documentation');

      expect(!!found).toBeTrue();
      expect(typeof found.description).toBe('string');
      expect(found.type).toBe('boolean');
    });

    it('should include the fully qualified "integration" option', () => {
      const found = runTests.config.options.find((option) => option.name === 'integration');

      expect(!!found).toBeTrue();
      expect(typeof found.description).toBe('string');
      expect(found.type).toBe('boolean');
    });

    it('should include the fully qualified "karma-browsers" option', () => {
      const found = runTests.config.options.find((option) => option.name === 'karma-browsers');

      expect(!!found).toBeTrue();
      expect(found.alias).toBe('browsers');
      expect(found.default).toEqual(['chrome', 'firefox']);
      expect(typeof found.description).toBe('string');
      expect(found.type).toBe('array');
    });

    it('should include the fully qualified "karma-debug" option', () => {
      const found = runTests.config.options.find((option) => option.name === 'karma-debug');

      expect(!!found).toBeTrue();
      expect(found.alias).toBe('debug');
      expect(typeof found.description).toBe('string');
      expect(found.type).toBe('boolean');
    });

    it('should include the fully qualified "runner" option', () => {
      const found = runTests.config.options.find((option) => option.name === 'runner');

      expect(!!found).toBeTrue();
      expect(typeof found.description).toBe('string');
      expect(found.type).toBe('array');
    });

    it('should include the fully qualified "target" option', () => {
      const found = runTests.config.options.find((option) => option.name === 'target');

      expect(!!found).toBeTrue();
      expect(typeof found.description).toBe('string');
      expect(found.type).toBe('string');
    });

    it('should include the fully qualified "unit" option', () => {
      const found = runTests.config.options.find((option) => option.name === 'unit');

      expect(!!found).toBeTrue();
      expect(typeof found.description).toBe('string');
      expect(found.type).toBe('boolean');
    });
  });

  describe('handler()', () => {
    const spies = {};
    const options = {
      a: 1,
      b: 'two',
      c: true,
    };

    beforeEach(() => {
      spies.Package = {
        test: spyOn(Package.prototype, 'test').and.callFake(() => Promise.resolve(undefined)),
      };
    });

    it('should attempt to build a new package with the provided options', () => runTests.handler(options)
      .then((response) => {
        expect(spies.Package.test).toHaveBeenCalledOnceWith(options);
        expect(response).toBeUndefined();
      }));
  });
});

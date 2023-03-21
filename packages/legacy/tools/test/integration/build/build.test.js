const { build, Package } = require('@webex/legacy-tools');

describe('build', () => {
  describe('config', () => {
    it('should include all expected top-level keys', () => {
      expect(Object.keys(build.config)).toEqual([
        'name',
        'description',
        'options',
      ]);
    });

    it('should include the fully qualified "destination" option', () => {
      const found = build.config.options.find((option) => option.name === 'destination');

      expect(!!found).toBeTrue();
      expect(found.alias).toBe('dest');
      expect(typeof found.description).toBe('string');
      expect(found.required).toBeTrue();
      expect(found.type).toBe('string');
    });

    it('should include the fully qualified "generate-source-maps" option', () => {
      const found = build.config.options.find((option) => option.name === 'generate-source-maps');

      expect(!!found).toBeTrue();
      expect(found.alias).toBe('maps');
      expect(typeof found.description).toBe('string');
      expect(found.type).toBe('boolean');
    });

    it('should include the fully qualified "javascript" option', () => {
      const found = build.config.options.find((option) => option.name === 'javascript');

      expect(!!found).toBeTrue();
      expect(found.alias).toBe('js');
      expect(typeof found.description).toBe('string');
      expect(found.type).toBe('boolean');
    });

    it('should include the fully qualified "source" option', () => {
      const found = build.config.options.find((option) => option.name === 'source');

      expect(!!found).toBeTrue();
      expect(found.alias).toBe('src');
      expect(typeof found.description).toBe('string');
      expect(found.required).toBeTrue();
      expect(found.type).toBe('string');
    });

    it('should include the fully qualified "typescript" option', () => {
      const found = build.config.options.find((option) => option.name === 'typescript');

      expect(!!found).toBeTrue();
      expect(found.alias).toBe('ts');
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
        build: spyOn(Package.prototype, 'build').and.callFake(() => Promise.resolve(undefined)),
      };
    });

    it('should attempt to build a new package with the provided options', () => build.handler(options)
      .then((response) => {
        expect(spies.Package.build).toHaveBeenCalledOnceWith(options);
        expect(response).toBeUndefined();
      }));
  });
});

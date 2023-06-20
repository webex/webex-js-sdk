const { list, Yarn } = require('@webex/package-tools');

describe('list', () => {
  describe('config', () => {
    it('should include all expected top-level keys', () => {
      expect(Object.keys(list.config)).toEqual([
        'name',
        'description',
        'options',
      ]);
    });

    it('should include the fully qualified "private" option', () => {
      const found = list.config.options.find((option) => option.name === 'private');

      expect(!!found).toBeTrue();
      expect(found.type).toBeUndefined();
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "recursive" option', () => {
      const found = list.config.options.find((option) => option.name === 'recursive');

      expect(!!found).toBeTrue();
      expect(found.type).toBeUndefined();
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "since" option', () => {
      const found = list.config.options.find((option) => option.name === 'since');

      expect(!!found).toBeTrue();
      expect(found.type).toBe('string');
      expect(typeof found.description).toBe('string');
    });
  });

  describe('handler()', () => {
    const spies = {};
    const listResolve = [
      { location: 'packages/scope/example-a', name: '@scope/example-a' },
      { location: 'packages/scope/example-b', name: '@scope/example-b' },
      { location: 'packages/scope/example-c', name: '@scope/example-c' },
    ];
    const options = {
      private: true,
      recursive: true,
      since: 'example-reference',
    };

    beforeEach(() => {
      spies.Yarn = {
        list: spyOn(Yarn, 'list').and.resolveTo(listResolve),
      };

      spies.stdout = {
        write: spyOn(process.stdout, 'write').and.returnValue(undefined),
      };
    });

    it('should call "Yarn.list()" with the provided options', () => list.handler(options)
      .then(() => {
        expect(spies.Yarn.list).toHaveBeenCalledOnceWith(jasmine.objectContaining({
          noPrivate: !options.private,
          recursive: options.recursive,
          since: options.since,
        }));
      }));

    it('should call "process.stdout.write()" with the package list items as a string array when more than 1 is found when mode is "yarn"', () => list.handler({ ...options, mode: 'yarn' })
      .then(() => {
        const expected = `{${listResolve.map(({ name }) => name).join(',')}}`;

        expect(spies.stdout.write).toHaveBeenCalledOnceWith(expected);
      }));

    it('should call "process.stdout.write()" with a single package name when the found packages is 1 when mode is "yarn"', () => {
      spies.Yarn.list.and.resolveTo([listResolve[0]]);

      return list.handler({ ...options, mode: 'yarn' })
        .then(() => {
          const expected = listResolve[0].name;

          expect(spies.stdout.write).toHaveBeenCalledOnceWith(expected);
        });
    });

    it('should call "process.stdout.write()" with "{}" when the found packages is 0 when mode is "yarn"', () => {
      spies.Yarn.list.and.resolveTo([]);

      return list.handler({ ...options, mode: 'yarn' })
        .then(() => {
          const expected = '{}';

          expect(spies.stdout.write).toHaveBeenCalledOnceWith(expected);
        });
    });

    it('should call "process.stdout.write()" with the package list items as a string array when more than 1 is found when mode is "node"', () => list.handler({ ...options, mode: 'node' })
      .then(() => {
        const expected = `${listResolve.map(({ name }) => name).join(' ')}`;

        expect(spies.stdout.write).toHaveBeenCalledOnceWith(expected);
      }));

    it('should call "process.stdout.write()" with a single package name when the found packages is 1 when mode is "node"', () => {
      spies.Yarn.list.and.resolveTo([listResolve[0]]);

      return list.handler({ ...options, mode: 'node' })
        .then(() => {
          const expected = listResolve[0].name;

          expect(spies.stdout.write).toHaveBeenCalledOnceWith(expected);
        });
    });

    it('should call "process.stdout.write()" with an empty string when the found packages is 0 when mode is "node"', () => {
      spies.Yarn.list.and.resolveTo([]);

      return list.handler({ ...options, mode: 'node' })
        .then(() => {
          const expected = '';

          expect(spies.stdout.write).toHaveBeenCalledOnceWith(expected);
        });
    });
  });
});

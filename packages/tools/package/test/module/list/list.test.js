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

      expect(!!found).toBeTruthy();
      expect(found.type).toBeUndefined();
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "recursive" option', () => {
      const found = list.config.options.find((option) => option.name === 'recursive');

      expect(!!found).toBeTruthy();
      expect(found.type).toBeUndefined();
      expect(typeof found.description).toBe('string');
    });

    it('should include the fully qualified "since" option', () => {
      const found = list.config.options.find((option) => option.name === 'since');

      expect(!!found).toBeTruthy();
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
        list: jest.spyOn(Yarn, 'list').mockResolvedValue(listResolve),
      };

      spies.stdout = {
        write: jest.spyOn(process.stdout, 'write').mockReturnValue(undefined),
      };
    });

    it('should call "Yarn.list()" with the provided options', () => list.handler(options)
      .then(() => {
        expect(spies.Yarn.list).toHaveBeenCalledTimes(1);
        expect(spies.Yarn.list).toHaveBeenCalledWith(expect.objectContaining({
          noPrivate: !options.private,
          recursive: options.recursive,
          since: options.since,
        }));
      }));

    describe('when mode is "yarn"', () => {
      it(
        'should call "process.stdout.write()" with the package list items as a string array when more than 1 is found',
        () => list.handler({ ...options, mode: 'yarn' })
          .then(() => {
            const expected = `{${listResolve.map(({ name }) => name).join(',')}}`;

            expect(spies.stdout.write).toHaveBeenCalledTimes(1);
            expect(spies.stdout.write).toHaveBeenCalledWith(expected);
          }),
      );

      it(
        'should call "process.stdout.write()" with a single package name when the found packages is 1',
        () => {
          spies.Yarn.list.mockResolvedValue([listResolve[0]]);

          return list.handler({ ...options, mode: 'yarn' })
            .then(() => {
              const expected = listResolve[0].name;

              expect(spies.stdout.write).toHaveBeenCalledTimes(1);
              expect(spies.stdout.write).toHaveBeenCalledWith(expected);
            });
        },
      );

      it(
        'should call "process.stdout.write()" with "{}" when the found packages is 0',
        () => {
          spies.Yarn.list.mockResolvedValue([]);

          return list.handler({ ...options, mode: 'yarn' })
            .then(() => {
              const expected = '{}';

              expect(spies.stdout.write).toHaveBeenCalledTimes(1);
              expect(spies.stdout.write).toHaveBeenCalledWith(expected);
            });
        },
      );
    });

    describe('when mode is "node"', () => {
      it(
        'should call "process.stdout.write()" with the package list items as a string array when more than 1 is found',
        () => list.handler({ ...options, mode: 'node' })
          .then(() => {
            const expected = `${listResolve.map(({ name }) => name).join(' ')}`;

            expect(spies.stdout.write).toHaveBeenCalledTimes(1);
            expect(spies.stdout.write).toHaveBeenCalledWith(expected);
          }),
      );

      it(
        'should call "process.stdout.write()" with a single package name when the found packages is 1',
        () => {
          spies.Yarn.list.mockResolvedValue([listResolve[0]]);

          return list.handler({ ...options, mode: 'node' })
            .then(() => {
              const expected = listResolve[0].name;

              expect(spies.stdout.write).toHaveBeenCalledTimes(1);
              expect(spies.stdout.write).toHaveBeenCalledWith(expected);
            });
        },
      );

      it('should call "process.stdout.write()" with an empty string when the found packages is 0', () => {
        spies.Yarn.list.mockResolvedValue([]);

        return list.handler({ ...options, mode: 'node' })
          .then(() => {
            const expected = '';

            expect(spies.stdout.write).toHaveBeenCalledTimes(1);
            expect(spies.stdout.write).toHaveBeenCalledWith(expected);
          });
      });
    });
  });
});

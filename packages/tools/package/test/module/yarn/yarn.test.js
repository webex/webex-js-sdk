const { Executor } = require('@webex/cli-tools');
const { Yarn } = require('@webex/package-tools');

describe('Yarn', () => {
  const executorExecuteResolve = '{ "key": "value" }';
  const spies = {};

  beforeEach(() => {
    spies.Executor = {
      execute: jest.spyOn(Executor, 'execute').mockResolvedValue(executorExecuteResolve),
    };

    spies.JSON = {
      parse: jest.spyOn(JSON, 'parse').mockReturnValue({ key: 'value' }),
    };
  });

  describe('static', () => {
    describe('CONSTANTS', () => {
      it('should return all keys from constants', () => {
        expect(Object.keys(Yarn.CONSTANTS)).toEqual([
          'COMMANDS',
          'LIST_CONFIG',
          'VIEW_CONFIG',
        ]);
      });
    });

    describe('list()', () => {
      it('should execute the default commands when no config is provided', () => Yarn.list()
        .then(() => {
          const calledWith = spies.Executor.execute.mock.calls[0][0];
          // const calledWith = spies.Executor.execute.mock.calls[0][0];;

          expect(calledWith.includes('--json')).toBeTruthy();
          expect(calledWith.includes('--no-private')).toBeTruthy();
          expect(calledWith.includes('--recursive')).toBeTruthy();
        }));

      it('should inject "--json" into the command when "json" boolean is "true"', () => {
        const json = true;

        return Yarn.list({ json })
          .then(() => {
            const calledWith = spies.Executor.execute.mock.calls[0][0];

            expect(calledWith.includes('--json')).toBeTruthy();
          });
      });

      it('should not inject "--json" into the command when "json" boolean is "false"', () => {
        const json = false;

        return Yarn.list({ json })
          .then(() => {
            const calledWith = spies.Executor.execute.mock.calls[0][0];

            expect(calledWith.includes('--json')).toBeFalsy();
          });
      });

      it('should inject "--json" into the command when "json" boolean is not provided', () => Yarn.list({})
        .then(() => {
          const calledWith = spies.Executor.execute.mock.calls[0][0];

          expect(calledWith.includes('--json')).toBeTruthy();
        }));

      it('should inject "--no-private" into the command when "noPrivate" boolean is "true"', () => {
        const noPrivate = true;

        return Yarn.list({ noPrivate })
          .then(() => {
            const calledWith = spies.Executor.execute.mock.calls[0][0];

            expect(calledWith.includes('--no-private')).toBeTruthy();
          });
      });

      it('should not inject "--no-private" into the command when "noPrivate" boolean is "false"', () => {
        const noPrivate = false;

        return Yarn.list({ noPrivate })
          .then(() => {
            const calledWith = spies.Executor.execute.mock.calls[0][0];

            expect(calledWith.includes('--no-private')).toBeFalsy();
          });
      });

      it('should inject "--no-private" into the command when "noPrivate" boolean is not provided', () => Yarn.list({})
        .then(() => {
          const calledWith = spies.Executor.execute.mock.calls[0][0];

          expect(calledWith.includes('--no-private')).toBeTruthy();
        }));

      it('should inject "--recursive" into the command when "recursive" boolean is "true"', () => {
        const recursive = true;

        return Yarn.list({ recursive })
          .then(() => {
            const calledWith = spies.Executor.execute.mock.calls[0][0];

            expect(calledWith.includes('--recursive')).toBeTruthy();
          });
      });

      it('should not inject "--recursive" into the command when "recursive" boolean is "false"', () => {
        const recursive = false;

        return Yarn.list({ recursive })
          .then(() => {
            const calledWith = spies.Executor.execute.mock.calls[0][0];

            expect(calledWith.includes('--recursive')).toBeFalsy();
          });
      });

      it('should inject "--recursive" into the command when "recursive" boolean is not provided', () => Yarn.list({})
        .then(() => {
          const calledWith = spies.Executor.execute.mock.calls[0][0];

          expect(calledWith.includes('--recursive')).toBeTruthy();
        }));

      it('should inject "--since" with the provided value into the command when "since" is provided', () => {
        const since = 'example-since';

        return Yarn.list({ since })
          .then(() => {
            const calledWith = spies.Executor.execute.mock.calls[0][0];

            expect(calledWith.includes(`--since="${since}"`)).toBeTruthy();
          });
      });

      it('should not inject "--since" into the command when "since" is not provided', () => Yarn.list({})
        .then(() => {
          const calledWith = spies.Executor.execute.mock.calls[0][0];

          expect(calledWith.includes('--since')).toBeFalsy();
        }));

      it('should inject "--verbose" into the command when "verbose" boolean is "true"', () => {
        const verbose = true;

        return Yarn.list({ verbose })
          .then(() => {
            const calledWith = spies.Executor.execute.mock.calls[0][0];

            expect(calledWith.includes('--verbose')).toBeTruthy();
          });
      });

      it('should not inject "--verbose" into the command when "verbose" boolean is "false"', () => {
        const verbose = false;

        return Yarn.list({ verbose })
          .then(() => {
            const calledWith = spies.Executor.execute.mock.calls[0][0];

            expect(calledWith.includes('--verbose')).toBeFalsy();
          });
      });

      it('should inject "--verbose" into the command when "verbose" boolean is not provided', () => Yarn.list({})
        .then(() => {
          const calledWith = spies.Executor.execute.mock.calls[0][0];

          expect(calledWith.includes('--verbose')).toBeFalsy();
        }));

      it('should attempt to parse the results of the "Executor.execute()" method', () => Yarn.view({})
        .then(() => {
          expect(spies.JSON.parse).toHaveBeenCalledTimes(1);
          expect(spies.JSON.parse).toHaveBeenCalledWith(executorExecuteResolve);
        }));
    });

    describe('view()', () => {
      it('should inject the provided package into the execute command', () => {
        const pack = 'example-package';

        return Yarn.view({ package: pack })
          .then(() => {
            const calledWith = spies.Executor.execute.mock.calls[0][0];

            expect(calledWith.includes(pack)).toBeTruthy();
          });
      });

      it('should inject "version" into the command when "version" boolean is "true"', () => {
        const version = true;

        return Yarn.view({ version })
          .then(() => {
            const calledWith = spies.Executor.execute.mock.calls[0][0];

            expect(calledWith.includes('version')).toBeTruthy();
          });
      });

      it('should not inject "version" into the command when "version" boolean is "false"', () => {
        const version = false;

        return Yarn.view({ version })
          .then(() => {
            const calledWith = spies.Executor.execute.mock.calls[0][0];

            expect(calledWith.includes('version')).toBeFalsy();
          });
      });

      it('should inject "dist-tags" into the command when "distTags" boolean is "true"', () => {
        const distTags = true;

        return Yarn.view({ distTags })
          .then(() => {
            const calledWith = spies.Executor.execute.mock.calls[0][0];

            expect(calledWith.includes('dist-tags')).toBeTruthy();
          });
      });

      it('should not inject "dist-tags" into the command when "distTags" boolean is "false"', () => {
        const distTags = false;

        return Yarn.view({ distTags })
          .then(() => {
            const calledWith = spies.Executor.execute.mock.calls[0][0];

            expect(calledWith.includes('dist-tags')).toBeFalsy();
          });
      });

      it('should inject "--json" into the command when "json" boolean is "true"', () => {
        const json = true;

        return Yarn.view({ json })
          .then(() => {
            const calledWith = spies.Executor.execute.mock.calls[0][0];

            expect(calledWith.includes('--json')).toBeTruthy();
          });
      });

      it('should not inject "--json" into the command when "json" boolean is "false"', () => {
        const json = false;

        return Yarn.view({ json })
          .then(() => {
            const calledWith = spies.Executor.execute.mock.calls[0][0];

            expect(calledWith.includes('--json')).toBeFalsy();
          });
      });

      it('should not inject "--json" into the command by default', () => Yarn.view({})
        .then(() => {
          const calledWith = spies.Executor.execute.mock.calls[0][0];

          expect(calledWith.includes('--json')).toBeTruthy();
        }));

      it('should attempt to parse the results of the "Executor.execute()" method', () => Yarn.view({})
        .then(() => {
          expect(spies.JSON.parse).toHaveBeenCalledTimes(1);
          expect(spies.JSON.parse).toHaveBeenCalledWith(executorExecuteResolve);
        }));
    });
  });
});

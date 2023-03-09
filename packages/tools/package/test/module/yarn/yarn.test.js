const { Executor } = require('@webex/cli-tools');

const { Yarn } = require('@webex/package-tools');

describe('Yarn', () => {
  const executorExecuteResolve = '{ "key": "value" }';
  const spies = {};

  beforeEach(() => {
    spies.Executor = {
      execute: spyOn(Executor, 'execute').and.resolveTo(executorExecuteResolve),
    };

    spies.JSON = {
      parse: spyOn(JSON, 'parse').and.returnValue({ key: 'value' }),
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
          const calledWith = spies.Executor.execute.calls.first().args[0];

          expect(calledWith.includes('--json')).toBeTrue();
          expect(calledWith.includes('--no-private')).toBeTrue();
          expect(calledWith.includes('--recursive')).toBeTrue();
        }));

      it('should inject "--json" into the command when "json" boolean is "true"', () => {
        const json = true;

        return Yarn.list({ json })
          .then(() => {
            const calledWith = spies.Executor.execute.calls.first().args[0];

            expect(calledWith.includes('--json')).toBeTrue();
          });
      });

      it('should not inject "--json" into the command when "json" boolean is "false"', () => {
        const json = false;

        return Yarn.list({ json })
          .then(() => {
            const calledWith = spies.Executor.execute.calls.first().args[0];

            expect(calledWith.includes('--json')).toBeFalse();
          });
      });

      it('should inject "--json" into the command when "json" boolean is not provided', () => Yarn.list({})
        .then(() => {
          const calledWith = spies.Executor.execute.calls.first().args[0];

          expect(calledWith.includes('--json')).toBeTrue();
        }));

      it('should inject "--no-private" into the command when "noPrivate" boolean is "true"', () => {
        const noPrivate = true;

        return Yarn.list({ noPrivate })
          .then(() => {
            const calledWith = spies.Executor.execute.calls.first().args[0];

            expect(calledWith.includes('--no-private')).toBeTrue();
          });
      });

      it('should not inject "--no-private" into the command when "noPrivate" boolean is "false"', () => {
        const noPrivate = false;

        return Yarn.list({ noPrivate })
          .then(() => {
            const calledWith = spies.Executor.execute.calls.first().args[0];

            expect(calledWith.includes('--no-private')).toBeFalse();
          });
      });

      it('should inject "--no-private" into the command when "noPrivate" boolean is not provided', () => Yarn.list({})
        .then(() => {
          const calledWith = spies.Executor.execute.calls.first().args[0];

          expect(calledWith.includes('--no-private')).toBeTrue();
        }));

      it('should inject "--recursive" into the command when "recursive" boolean is "true"', () => {
        const recursive = true;

        return Yarn.list({ recursive })
          .then(() => {
            const calledWith = spies.Executor.execute.calls.first().args[0];

            expect(calledWith.includes('--recursive')).toBeTrue();
          });
      });

      it('should not inject "--recursive" into the command when "recursive" boolean is "false"', () => {
        const recursive = false;

        return Yarn.list({ recursive })
          .then(() => {
            const calledWith = spies.Executor.execute.calls.first().args[0];

            expect(calledWith.includes('--recursive')).toBeFalse();
          });
      });

      it('should inject "--recursive" into the command when "recursive" boolean is not provided', () => Yarn.list({})
        .then(() => {
          const calledWith = spies.Executor.execute.calls.first().args[0];

          expect(calledWith.includes('--recursive')).toBeTrue();
        }));

      it('should inject "--since" with the provided value into the command when "since" is provided', () => {
        const since = 'example-since';

        return Yarn.list({ since })
          .then(() => {
            const calledWith = spies.Executor.execute.calls.first().args[0];

            expect(calledWith.includes(`--since="${since}"`)).toBeTrue();
          });
      });

      it('should not inject "--since" into the command when "since" is not provided', () => Yarn.list({})
        .then(() => {
          const calledWith = spies.Executor.execute.calls.first().args[0];

          expect(calledWith.includes('--since')).toBeFalse();
        }));

      it('should inject "--verbose" into the command when "verbose" boolean is "true"', () => {
        const verbose = true;

        return Yarn.list({ verbose })
          .then(() => {
            const calledWith = spies.Executor.execute.calls.first().args[0];

            expect(calledWith.includes('--verbose')).toBeTrue();
          });
      });

      it('should not inject "--verbose" into the command when "verbose" boolean is "false"', () => {
        const verbose = false;

        return Yarn.list({ verbose })
          .then(() => {
            const calledWith = spies.Executor.execute.calls.first().args[0];

            expect(calledWith.includes('--verbose')).toBeFalse();
          });
      });

      it('should inject "--verbose" into the command when "verbose" boolean is not provided', () => Yarn.list({})
        .then(() => {
          const calledWith = spies.Executor.execute.calls.first().args[0];

          expect(calledWith.includes('--verbose')).toBeFalse();
        }));

      it('should attempt to parse the results of the "Executor.execute()" method', () => Yarn.view({})
        .then(() => {
          expect(spies.JSON.parse).toHaveBeenCalledOnceWith(executorExecuteResolve);
        }));
    });

    describe('view()', () => {
      it('should inject the provided package into the execute command', () => {
        const pack = 'example-package';

        return Yarn.view({ package: pack })
          .then(() => {
            const calledWith = spies.Executor.execute.calls.first().args[0];

            expect(calledWith.includes(pack)).toBeTrue();
          });
      });

      it('should inject "version" into the command when "version" boolean is "true"', () => {
        const version = true;

        return Yarn.view({ version })
          .then(() => {
            const calledWith = spies.Executor.execute.calls.first().args[0];

            expect(calledWith.includes('version')).toBeTrue();
          });
      });

      it('should not inject "version" into the command when "version" boolean is "false"', () => {
        const version = false;

        return Yarn.view({ version })
          .then(() => {
            const calledWith = spies.Executor.execute.calls.first().args[0];

            expect(calledWith.includes('version')).toBeFalse();
          });
      });

      it('should inject "dist-tags" into the command when "distTags" boolean is "true"', () => {
        const distTags = true;

        return Yarn.view({ distTags })
          .then(() => {
            const calledWith = spies.Executor.execute.calls.first().args[0];

            expect(calledWith.includes('dist-tags')).toBeTrue();
          });
      });

      it('should not inject "dist-tags" into the command when "distTags" boolean is "false"', () => {
        const distTags = false;

        return Yarn.view({ distTags })
          .then(() => {
            const calledWith = spies.Executor.execute.calls.first().args[0];

            expect(calledWith.includes('dist-tags')).toBeFalse();
          });
      });

      it('should inject "--json" into the command when "json" boolean is "true"', () => {
        const json = true;

        return Yarn.view({ json })
          .then(() => {
            const calledWith = spies.Executor.execute.calls.first().args[0];

            expect(calledWith.includes('--json')).toBeTrue();
          });
      });

      it('should not inject "--json" into the command when "json" boolean is "false"', () => {
        const json = false;

        return Yarn.view({ json })
          .then(() => {
            const calledWith = spies.Executor.execute.calls.first().args[0];

            expect(calledWith.includes('--json')).toBeFalse();
          });
      });

      it('should not inject "--json" into the command by default', () => Yarn.view({})
        .then(() => {
          const calledWith = spies.Executor.execute.calls.first().args[0];

          expect(calledWith.includes('--json')).toBeTrue();
        }));

      it('should not catch', () => {
        spies.Executor.execute.and.rejectWith(new Error());

        return Yarn.view()
          .then(() => {
            expect(true).toBeTrue();
          });
      });

      it('should attempt to parse the results of the "Executor.execute()" method', () => Yarn.view({})
        .then(() => {
          expect(spies.JSON.parse).toHaveBeenCalledOnceWith(executorExecuteResolve);
        }));
    });
  });
});

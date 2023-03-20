const shell = require('shelljs');

const { Executor } = require('@webex/cli-tools');

describe('Executor', () => {
  describe('static', () => {
    describe('#CONSTANTS', () => {
      it('should contain all expected keys', () => {
        expect(Executor.CONSTANTS.CONFIG).toBeDefined();
      });
    });

    describe('execute()', () => {
      const exampleCommand = 'hello world';
      let execSpy;

      afterEach(() => {
        execSpy.calls.reset();
      });

      it('should return a promise', () => {
        execSpy = spyOn(shell, 'exec').and.callFake((command, func) => {
          func(0, { command }, undefined);
        });

        const results = Executor.execute();

        expect(results.then).toBeDefined();
        expect(results.catch).toBeDefined();
      });

      it('should call "shell.exec" with the provided configuration', () => {
        execSpy = spyOn(shell, 'exec').and.callFake((command, func) => {
          func(0, { command }, undefined);
        });

        return Executor.execute(exampleCommand)
          .then(() => {
            expect(execSpy).toHaveBeenCalledTimes(1);
            expect(execSpy).toHaveBeenCalledOnceWith(exampleCommand, jasmine.any(Function));
          });
      });

      it('should set the shell config to silent if provided, then set to false after execution', () => {
        let { silent } = shell.config;

        execSpy = spyOn(shell, 'exec').and.callFake((command, func) => {
          func(0, { command }, undefined);
        });

        shell.config = {
          ...shell.config,
          get silent() { return silent; },
          set silent(val) { silent = val; },
        };

        const silentSpy = spyOnProperty(shell.config, 'silent', 'set').and.callThrough();

        return Executor.execute(exampleCommand, { silent: true })
          .then(() => {
            expect(silentSpy.calls.allArgs()).toEqual([[true], [false]]);
          });
      });

      it('should not modify the shell config silent option if silent is set to false', () => {
        let { silent } = shell.config;

        execSpy = spyOn(shell, 'exec').and.callFake((command, func) => {
          func(0, { command }, undefined);
        });

        shell.config = {
          ...shell.config,
          get silent() { return silent; },
          set silent(val) { silent = val; },
        };

        const silentSpy = spyOnProperty(shell.config, 'silent', 'set').and.callThrough();

        return Executor.execute(exampleCommand, { silent: false })
          .then(() => {
            expect(silentSpy).toHaveBeenCalledOnceWith(false);
          });
      });

      it('should throw an error if the resulting code is not 0', () => {
        execSpy = spyOn(shell, 'exec').and.callFake((command, func) => {
          func(1, { command }, 'example-error');
        });

        return expectAsync(Executor.execute(exampleCommand)).toBeRejected();
      });
    });
  });
});

const MochaRunner = require('mocha');

const { Mocha } = require('@webex/legacy-tools');

describe('Mocha', () => {
  describe('static', () => {
    describe('test()', () => {
      let config;
      const spies = {};
      const mocks = {};

      beforeEach(() => {
        config = {
          files: ['file1.js', 'file2.js', 'file3.js'],
        };

        mocks.MochaRunner = {
          run: (method) => method(0),
          runWithFailures: (method) => method(1),
        };

        spies.MochaRunner = {
          addFile: spyOn(MochaRunner.prototype, 'addFile').and.returnValue(undefined),
          run: spyOn(MochaRunner.prototype, 'run').and.callFake(mocks.MochaRunner.run),
        };

        spies.process = {
          exit: spyOn(process, 'exit').and.returnValue(undefined),
        };
      });

      it('should add files to the mocha runner for each provided file', () => Mocha.test(config)
        .then(() => {
          expect(spies.MochaRunner.addFile).toHaveBeenCalledTimes(config.files.length);
        }));

      it('should attempt to run the mocha runner', () => Mocha.test(config)
        .then(() => {
          expect(spies.MochaRunner.run).toHaveBeenCalledTimes(1);
        }));

      it('should exit the process with 1 if failures were detected', () => {
        spies.MochaRunner.run.and.callFake(mocks.MochaRunner.runWithFailures);

        return Mocha.test(config)
          .then(() => {
            expect(spies.process.exit).toHaveBeenCalledOnceWith(1);
          });
      });
    });

    describe('CONSTANTS', () => {
      it('should return an object with all necessary keys', () => {
        expect(Object.keys(Mocha.CONSTANTS)).toEqual(['CONFIG']);
      });
    });
  });
});

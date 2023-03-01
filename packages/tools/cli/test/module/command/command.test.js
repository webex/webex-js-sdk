const yargs = require('yargs');

const { Command } = require('@webex/cli-tools');

const { configFixture, optionFixture, parseSyncFixture } = require('./command.fixture');

describe('Command', () => {
  const argv = [...process.argv];

  beforeEach(() => {
    process.argv.push(`--${optionFixture.name}`, `"${optionFixture.default}"`);
  });

  afterEach(() => {
    process.argv = [...argv];
  });

  describe('instance', () => {
    let command;

    beforeEach(() => {
      command = new Command(configFixture);
    });

    describe('results', () => {
      let parseSyncSpy;

      beforeEach(() => {
        parseSyncSpy = spyOn(command.args, 'parseSync')
          .and.callFake(() => parseSyncFixture);
      });

      it('should call the "parseSync" method of "command.args" and return results', () => {
        const { results } = command;

        expect(parseSyncSpy).toHaveBeenCalledTimes(1);
        expect(results).toBeDefined();
      });

      it('should map all values into an explicit keyed object for returning', () => {
        const { results } = command;

        expect(results).toEqual({
          [optionFixture.name]: parseSyncFixture[optionFixture.name],
        });
      });

      it('should return an empty object when no configuration options are provided', () => {
        command.setConfig({});

        const { results } = command;

        expect(results).toEqual({});
      });
    });

    describe('setConfig()', () => {
      let setOptionSpy;

      beforeEach(() => {
        setOptionSpy = spyOn(command, 'setOption');
      });

      it('should attempt to call "setOption" for each option in the provided config', () => {
        command.setConfig(configFixture);

        expect(setOptionSpy).toHaveBeenCalledTimes(configFixture.options.length);
      });

      it('should return itself', () => {
        const result = command.setConfig(configFixture);

        expect(result).toBe(command);
      });
    });

    describe('setOption()', () => {
      let setOptionSpy;

      beforeEach(() => {
        setOptionSpy = spyOn(Command, 'setOption');
      });

      it('should call the "Command.setOption" static method', () => {
        command.setOption(optionFixture);

        expect(setOptionSpy).toHaveBeenCalledTimes(1);
      });

      it('should call the "Command.setOption" static method with the provided option', () => {
        command.setOption(optionFixture);

        expect(setOptionSpy).toHaveBeenCalledWith(command.args, optionFixture);
      });

      it('should return itself', () => {
        const result = command.setOption(optionFixture);

        expect(result).toBe(command);
      });
    });
  });

  describe('static', () => {
    describe('args', () => {
      it('should be an interpreted yargs object', () => {
        const yargsObject = yargs(process.argv.slice(Command.CONSTANTS.ARGS_INDEX));

        expect(Command.args).toEqual(yargsObject);
      });
    });

    describe('CONSTANTS', () => {
      it('should contain all expected keys', () => {
        expect(Object.keys(Command.CONSTANTS)).toEqual([
          'ARGS_INDEX',
        ]);
      });
    });

    describe('setOption()', () => {
      let args;
      let optionSpy;

      beforeEach(() => {
        args = { option: () => {} };
        optionSpy = spyOn(args, 'option');
      });

      it('should call the provided "args.option" object method', () => {
        Command.setOption(args, optionFixture);

        expect(optionSpy).toHaveBeenCalledTimes(1);
      });

      it('should provide the option to the "args.option" object method', () => {
        Command.setOption(args, optionFixture);

        expect(optionSpy).toHaveBeenCalledOnceWith(optionFixture.name, {
          alias: optionFixture.alias,
          default: optionFixture.default,
          describe: optionFixture.description,
          demandOption: optionFixture.required,
          type: optionFixture.type,
        });
      });

      it('should return the provided "args" object', () => {
        const result = Command.setOption(args, optionFixture);

        expect(result).toBe(args);
      });
    });
  });
});

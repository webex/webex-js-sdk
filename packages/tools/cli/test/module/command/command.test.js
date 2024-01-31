const { Command: Commander } = require('commander');
const { Commands } = require('@webex/cli-tools');

const { generateCommandFixture } = require('./command.fixture');

describe('Commands', () => {
  describe('instance', () => {
    describe('constructor()', () => {
      it('should create a new program', () => {
        const commands = new Commands();

        expect(commands.program instanceof Commander).toBe(true);
      });
    });

    describe('mount()', () => {
      const spies = {};
      let commands;
      let fixture;

      beforeEach(() => {
        fixture = generateCommandFixture();
        commands = new Commands();
        const { program } = commands;

        spies.command = jest.spyOn(program, 'command').mockReturnValue(program);
        spies.description = jest.spyOn(program, 'description').mockReturnValue(program);
        spies.option = jest.spyOn(program, 'option').mockReturnValue(program);
        spies.requiredOption = jest.spyOn(program, 'requiredOption').mockReturnValue(program);
        spies.action = jest.spyOn(program, 'action');
        spies.handler = jest.spyOn(fixture, 'handler');
      });

      it('should call "program.command" with the provided name', () => {
        commands.mount(fixture);

        expect(spies.command).toHaveBeenCalledWith(fixture.config.name);
      });

      it('should call "program.description" with the provided description', () => {
        commands.mount(fixture);

        expect(spies.description).toHaveBeenCalledWith(fixture.config.description);
      });

      it('should call "program.option" for each provided option', () => {
        commands.mount(fixture);

        expect(spies.option).toHaveBeenCalledTimes(2);
      });

      it('should call "program.requiredOption" for each required option', () => {
        commands.mount(fixture);

        expect(spies.requiredOption).toHaveBeenCalledTimes(1);
      });

      it('should mount only the name of the option as a param when no type or alias is provided', () => {
        fixture.config.options = fixture.config.options.slice(0, 1);
        const [option] = fixture.config.options;

        delete option.alias;
        delete option.type;

        commands.mount(fixture);

        const expected = `--${option.name}`;
        expect(spies.option).toHaveBeenCalledWith(
          expected,
          expect.any(String),
          expect.any(String),
        );
      });

      it('should mount only the name and alias of the option as a param when no type is provided', () => {
        fixture.config.options = fixture.config.options.slice(0, 1);
        const [option] = fixture.config.options;

        delete option.type;

        commands.mount(fixture);

        const expected = `-${option.alias}, --${option.name}`;

        expect(spies.option).toHaveBeenCalledWith(
          expected,
          expect.any(String),
          expect.any(String),
        );
      });

      it('should mount name, type, and alias when all are provided', () => {
        fixture.config.options = fixture.config.options.slice(0, 1);
        const [option] = fixture.config.options;

        commands.mount(fixture);

        const expected = `-${option.alias}, --${option.name} <${option.type}>`;

        expect(spies.option).toHaveBeenCalledWith(
          expected,
          expect.any(String),
          expect.any(String),
        );
      });

      it('should mount the description', () => {
        fixture.config.options = fixture.config.options.slice(0, 1);
        const [option] = fixture.config.options;

        commands.mount(fixture);

        expect(spies.option).toHaveBeenCalledWith(
          expect.any(String),
          option.description,
          expect.any(String),
        );
      });

      it('should mount the default when provided', () => {
        fixture.config.options = fixture.config.options.slice(0, 1);
        const [option] = fixture.config.options;

        commands.mount(fixture);

        expect(spies.option).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          option.default,
        );
      });

      it('should mount undefined when the default is not provided', () => {
        fixture.config.options = fixture.config.options.slice(0, 1);
        const [option] = fixture.config.options;

        delete option.default;

        commands.mount(fixture);

        expect(spies.option).toHaveBeenCalledWith(
          expect.any(String),
          expect.any(String),
          undefined,
        );
      });

      it('should call the provided handler', () => {
        const opts = 'example-opts';

        spies.action.mockImplementation((func) => func(opts));
        commands.mount(fixture);

        expect(spies.handler).toHaveBeenCalledTimes(1);
        expect(spies.handler).toHaveBeenCalledWith(opts);
      });
    });

    describe('process()', () => {
      const spies = {};
      let commands;

      beforeEach(() => {
        commands = new Commands();
        const { program } = commands;
        spies.parse = jest.spyOn(program, 'parse').mockReturnValue(undefined);
      });

      it('should return itself', () => {
        expect(commands.process()).toBe(commands);
      });

      it('should call the local "program" method: "parse"', () => {
        commands.process();
        expect(spies.parse).toHaveBeenCalledTimes(1);
      });
    });
  });
});

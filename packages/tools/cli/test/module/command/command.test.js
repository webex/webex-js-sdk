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

        spies.command = spyOn(program, 'command').and.returnValue(program);
        spies.description = spyOn(program, 'description').and.returnValue(program);
        spies.option = spyOn(program, 'option').and.returnValue(program);
        spies.action = spyOn(program, 'action').and.returnValue();
      });

      it('should call "program.command" with the provided name', () => {
        commands.mount(fixture);

        expect(spies.command).toHaveBeenCalledOnceWith(fixture.config.name);
      });

      it('should call "program.description" with the provided description', () => {
        commands.mount(fixture);

        expect(spies.description).toHaveBeenCalledOnceWith(fixture.config.description);
      });

      it('should call "program.option" for each provided option', () => {
        commands.mount(fixture);

        expect(spies.option).toHaveBeenCalledTimes(2);
      });

      it('should mount only the name of the option as a param when no type or alias is provided', () => {
        fixture.config.options.pop();
        const [option] = fixture.config.options;

        delete option.alias;
        delete option.type;

        commands.mount(fixture);

        const expected = `--${option.name}`;

        expect(spies.option).toHaveBeenCalledOnceWith(
          expected,
          jasmine.any(String),
          jasmine.any(String),
        );
      });

      it('should mount only the name and alias of the option as a param when no type is provided', () => {
        fixture.config.options.pop();
        const [option] = fixture.config.options;

        delete option.type;

        commands.mount(fixture);

        const expected = `-${option.alias}, --${option.name}`;

        expect(spies.option).toHaveBeenCalledOnceWith(
          expected,
          jasmine.any(String),
          jasmine.any(String),
        );
      });

      it('should mount name, type, and alias when all are provided', () => {
        fixture.config.options.pop();
        const [option] = fixture.config.options;

        commands.mount(fixture);

        const expected = `-${option.alias}, --${option.name} <${option.type}>`;

        expect(spies.option).toHaveBeenCalledOnceWith(
          expected,
          jasmine.any(String),
          jasmine.any(String),
        );
      });

      it('should mount the description', () => {
        fixture.config.options.pop();
        const [option] = fixture.config.options;

        commands.mount(fixture);

        expect(spies.option).toHaveBeenCalledOnceWith(
          jasmine.any(String),
          option.description,
          jasmine.any(String),
        );
      });

      it('should mount the default when provided', () => {
        fixture.config.options.pop();
        const [option] = fixture.config.options;

        commands.mount(fixture);

        expect(spies.option).toHaveBeenCalledOnceWith(
          jasmine.any(String),
          jasmine.any(String),
          option.default,
        );
      });

      it('should mount undefined when the default is not provided', () => {
        fixture.config.options.pop();
        const [option] = fixture.config.options;

        delete option.default;

        commands.mount(fixture);

        expect(spies.option).toHaveBeenCalledOnceWith(
          jasmine.any(String),
          jasmine.any(String),
          undefined,
        );
      });
    });

    describe('process()', () => {
      const spies = {};
      let commands;

      beforeEach(() => {
        commands = new Commands();
        const { program } = commands;

        spies.parse = spyOn(program, 'parse').and.returnValue(undefined);
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

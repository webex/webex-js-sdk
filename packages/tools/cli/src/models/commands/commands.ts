import { Command as Commander } from 'commander';

import type { Command } from './commands.types';

/**
 * The Commands class.
 *
 * @remarks
 * This class is used as a foundation for CLI command management.
 *
 * @example
 * ```js
 * const { Commands } = require('@webex/cli-tools');
 *
 * const commands = new Commands()
 *   .mount(configuration)
 *   .process();
 * ```
 *
 * @public
 */
class Commands {
  /**
   * Local Commander Command mutable.
   */
  protected program: Commander;

  /**
   * Construct ta new Commands instance.
   */
  public constructor() {
    this.program = new Commander();
  }

  /**
   * Mount a new command configuration to this Commands instance.
   *
   * @param command - Command to mount to this Commands instance.
   * @returns - This Commands instance.
   */
  public mount<Options>(command: Command<Options>): this {
    const { name, description, options } = command.config;
    const cmd = this.program
      .command(name)
      .description(description);

    options.forEach((option) => {
      const definition = option.type ? `--${option.name} <${option.type}>` : `--${option.name}`;
      const namespace = option.alias ? `-${option.alias}, ${definition}` : definition;

      cmd.option(namespace, option.description, option.default);
    });

    cmd.action((opts) => command.handler(opts));

    return this;
  }

  /**
   * Process this Commands instance.
   *
   * @returns - This Commands instance.
   */
  public process(): this {
    this.program.parse();

    return this;
  }
}

export default Commands;

import yargs from 'yargs';
import type { Argv } from 'yargs';

import CONSTANTS from './command.constants';
import type { Config, Option } from './command.types';

/**
 * The command class.
 *
 * @remarks
 * This class is used as a foundation for CLI commands.
 *
 * @example
 * ```js
 * const { Command } = require('@webex/cli-tools');
 *
 * const arguments = new Command(configuration).results;
 * ```
 *
 * @public
 */
class Command {
  /**
   * Local arguments mutable.
   */
  protected args: Argv;

  /**
   * Provided configuration object.
   */
  protected config: Config;

  /**
   * Construct a new Command instance.
   *
   * @param config - Configuration object.
   */
  public constructor(config: Config) {
    this.args = Command.args;
    this.config = {};

    this.setConfig(config);
  }

  /**
   * Results extracted from the execution arguments.
   */
  public get results() {
    const parsedArgs = this.args.parseSync();
    const results: Record<string, any> = {};

    this.config.options?.forEach((option) => {
      results[option.name] = parsedArgs[option.name];
    });

    return results;
  }

  /**
   * Set a new configuration for this Command instance.
   *
   * @param config - Configuration object.
   * @returns - This Command instance.
   */
  public setConfig(config: Config) {
    this.config = config;
    this.args = Command.args;

    this.config.options?.forEach((option) => {
      this.setOption(option);
    });

    return this;
  }

  /**
   * Set an option on this Command instance.
   *
   * @param option - Option to set on this Command instance.
   * @returns - This Command instance.
   */
  public setOption(option: Option) {
    Command.setOption(this.args, option);

    return this;
  }

  /**
   * Provided execution arguments.
   */
  public static get args() {
    return yargs(process.argv.slice(CONSTANTS.ARGS_INDEX));
  }

  /**
   * Constants associated with the Command class.
   */
  public static get CONSTANTS() {
    return CONSTANTS;
  }

  /**
   * Set an option on the provided arguments mutable.
   *
   * @param args - Arguments mutable to assign the provided option to.
   * @param option - Option to assign to the provided arguments mutable.
   * @returns - The provided arguments mutable after mutation.
   */
  public static setOption(args: Argv, option: Option) {
    args.option(
      option.name,
      {
        alias: option.alias,
        default: option.default,
        describe: option.description,
        demandOption: option.required,
        type: option.type,
      },
    );

    return args;
  }
}

export default Command;

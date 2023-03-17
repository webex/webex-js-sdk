/**
 * Option to be provided within a Command object to a Commands instance.
 *
 * @public
 */
export interface Option {
  /**
   * Shorthand identifier for this option.
   */
  alias?: string;

  /**
   * Default value to use when no value is provided.
   */
  default?: string;

  /**
   * Description to present when requestiong help for this Option.
   */
  description: string;

  /**
   * Identifier for this Option.
   */
  name: string;

  /**
   * Whether this option is required to process the associated Command.
   */
  required?: boolean;

  /**
   * Type of this Option.
   */
  type?: string;
}

/**
 * Configuration object to be provided with a Command to a Commands instance.
 *
 * @public
 */
export interface Config {
  /**
   * Identifier for the associated Command instance.
   */
  name: string;

  /**
   * Description to present when requesting help for the associated Command instance.
   */
  description: string;

  /**
   * Options to be provided with the associated Command to a Commands instance.
   */
  options: Array<Option>
}

/**
 * Command to be provided to a Commands instance using the new Commands().mount() method.
 *
 * @public
 */
export interface Command<Options> {
  /**
   * Configuration object to be provided with this Command to a Commands instance.
   */
  config: Config,

  /**
   * Handler used to perform logic based on the parsed Command options.
   *
   * @param options - Parsed options from a Commands instance.
   * @returns - Empty Promise.
   */
  handler: (options: Options) => Promise<any>;
}

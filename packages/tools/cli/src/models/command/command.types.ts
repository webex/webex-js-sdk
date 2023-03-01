/**
 * Potential Option types.
 *
 * @public
 */
export type OptionType = Array<string> | boolean | number | string;

/**
 * Option to be provided to a Command instance.
 *
 * @public
 */
export interface Option<Type = OptionType> {
  /**
   * Shorthand identifier for this option within the argument processor.
   */
  alias?: string;

  /**
   * Default value to use when no argument was provided.
   */
  default?: Type;

  /**
   * Description to present when requesting help for this Option.
   */
  description: string;

  /**
   * Identifier for this Option within the argument processor.
   */
  name: string;

  /**
   * Whether this Option is required or not.
   */
  required?: boolean;

  /**
   * Type of this Option.
   */
  type: 'array' | 'boolean' | 'number' | 'string';
}

/**
 * Configuration to be provided to a Command instance.
 *
 * @public
 */
export interface Config {
  /**
   * Options to be provided to a Command instance.
   */
  options?: Array<Option>;
}

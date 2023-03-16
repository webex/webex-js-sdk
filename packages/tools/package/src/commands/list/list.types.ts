/**
 * List Command Options inteface.
 *
 * @public
 */
export interface Options {
  /**
   * Whether or not to include private packages when listing packages.
   */
  private?: boolean;

  /**
   * Whether or not to include dependencies of the listed packages.
   *
   * @remarks
   * This option is meant to be used in tandem with the `Options.since` value
   * set to `true`.
   */
  recursive?: boolean;

  /**
   * Git reference to collect changed packages since.
   */
  since?: string;
}

/**
 * Compatability mode for finalized output.
 *
 * @public
 */
export type Mode = 'node' | 'yarn';

/**
 * List Command Options inteface.
 *
 * @public
 */
export interface Options {
  /**
   * Compatability mode for finalized output.
   *
   * @remarks
   * 'node' will wrap the output for CLI usage. 'yarn' will wrap the output for
   * yarn workspace usage.
   */
  mode?: Mode;

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

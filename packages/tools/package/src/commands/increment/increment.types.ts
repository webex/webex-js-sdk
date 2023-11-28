/**
 * Increment Command Options inteface.
 *
 * @public
 */
export interface Options {
  /**
   * Major version to increment by.
   */
  major?: string;

  /**
   * Minor version to increment by.
   */
  minor?: string;

  /**
   * Packages to increment
   *
   * @remarks
   * If no packages are defined, this will collect all workspace packages.
   */
  packages?: Array<string>;

  /**
   * Patch version to increment by.
   */
  patch?: string;

  /**
   * Release version to increment by.
   */
  release?: string;

  /**
   * Git reference to collect changed packages since.
   *
   * @remarks
   * This option can not be used in tandem with the Options.packages value.
   */
  since?: string;

  /**
   * Tag to increment the version on.
   */
  tag?: string;
}

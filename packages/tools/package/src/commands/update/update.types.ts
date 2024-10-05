/**
 * Update Command Options interface.
 *
 * @public
 */
export interface Options {
  /**
   * Packages to update.
   */
  packages: Array<string>;

  /**
   * Tag to update the versions on.
   */
  tag?: string;
}

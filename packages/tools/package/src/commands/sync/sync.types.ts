/**
 * Sync Command Options interface.
 *
 * @public
 */
export interface Options {
  /**
   * Packages to synchronize
   *
   * @remarks
   * If no packages are defined, this will collect all workspace packages.
   */
  packages?: Array<string>;

  /**
   * Tag to synchronize the version on.
   */
  tag: string;
}

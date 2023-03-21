/**
 * The Configuration Object for a PackageFile instance.
 *
 * @public
 */
export interface Config {
  /**
   * Scoped directory for a file.
   *
   * @remarks
   * Used to negotiate the destination directory from the source directory.
   */
  directory: string;

  /**
   * Location of a file relative to the packageRoot + directory.
   */
  location: string;

  /**
   * Absolute path to the root of the package this file resides within.
   */
  packageRoot: string;
}

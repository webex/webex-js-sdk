/**
 * The Configuration Object for a Package instance's build method.
 *
 * @public
 */
export interface BuildConfig {
  /**
   * Destination path to build files to.
   */
  destination: string;

  /**
   * Whether to generate source map files in tandem with distributable files.
   */
  generateSourceMaps?: boolean;

  /**
   * Whether to select JavaScript files for building.
   */
  javascript?: boolean;

  /**
   * Source path to collect files from.
   */
  source: string;

  /**
   * Whether to select Typescript files for building.
   */
  typescript?: boolean;
}

/**
 * A Package instance's locally stored data.
 *
 * @internal
 */
export interface Data {
  /**
   * The Package instance's root path.
   */
  packageRoot: string;
}

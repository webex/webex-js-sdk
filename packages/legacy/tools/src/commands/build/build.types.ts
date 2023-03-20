/**
 * Build Command Options interface.
 *
 * @public
 */
export interface Options {
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

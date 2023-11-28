/**
 * Package and version information from the registry.
 *
 * @public
 */
export interface PackageInfo {
  /**
   * Primary version for this Package on the registry.
   */
  version: string;

  /**
   * Record of all distribution tags and their versions availble for this
   * package on the registry.
   */
  'dist-tags': Record<string, string>;
}

/**
 * Version Object for defining a Package instance version.
 *
 * @public
 */
export interface Version {
  /**
   * Semantic major version for this Version Object.
   */
  major: number;

  /**
   * Semantic minor version for this Verison Object.
   */
  minor: number;

  /**
   * Semantic patch verison for this Version Object.
   */
  patch: number;

  /**
   * Release version for the provided tag for this Version Object.
   */
  release: number;

  /**
   * Tag that this Version Object applies to.
   */
  tag: string;
}

/**
 * Package definition object.
 *
 * @remarks
 * This is a common shape for `package.json` files.
 *
 * @public
 */
export interface Definition {
  /**
   * Version of the parsed package definition.
   */
  version?: string;

  /**
   * Scripts associated with the parsed package definition.
   */
  scripts?: Record<string, string>;
}

/**
 * Package constructor configuration Object.
 *
 * @public
 */
export interface Config {
  /**
   * Absolute path to the associated Package instance's root.
   */
  location: string;

  /**
   * Package name for the associated Package instance.
   */
  name: string;

  /**
   * Registry tag for the associated Package instance.
   */
  tag?: string;
}

/**
 * Data of an associated Package instance.
 *
 * @internal
 */
export interface Data {
  /**
   * Absolute path to the associated Package instance's root.
   */
  location: string;

  /**
   * Package name for the associated Package instance.
   */
  name: string;

  /**
   * Inspected package and version info from the registry.
   */
  packageInfo: PackageInfo;

  /**
   * Version of the associated Package instance.
   */
  version: Version;
}

/**
 * Options to be provided to Package.Inspect().
 *
 * @public
 */
export interface InspectOptions {
  /**
   * Package to inspect on the registry.
   */
  package: string;
}

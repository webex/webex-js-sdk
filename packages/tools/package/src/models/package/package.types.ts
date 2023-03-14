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
   * Version of the associated Package instance.
   */
  version: Version;
}

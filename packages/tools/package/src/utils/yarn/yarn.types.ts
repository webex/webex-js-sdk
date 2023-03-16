/**
 * `Yarn.list()` configuration Object parameter.
 *
 * @public
 */
export interface ListConfig {
  /**
   * Whether to output the results as JSON.
   */
  json?: boolean;

  /**
   * Whether to ignore private packages.
   */
  noPrivate?: boolean;

  /**
   * Whether to also include dependants of the originally located packages.
   */
  recursive?: boolean;

  /**
   * Git Reference to collect a list of packages from based on local changes.
   */
  since?: string;

  /**
   * Whether to emit messages to console.
   */
  verbose?: boolean;
}

/**
 * Object reflecting the return type of `Yarn.list()`.
 *
 * @public
 */
export interface ListPackage {
  /**
   * Location of the package relative to the workspace root.
   */
  location: string,

  /**
   * Name of the located package.
   */
  name: string,
}

/**
 * `Yarn.view()` configuration Object parameter.
 *
 * @public
 */
export interface ViewConfig {
  /**
   * Whether to return the deployed tags for the provided package.
   */
  distTags?: boolean;

  /**
   * Whether to render the results as a JSON Object.
   */
  json?: boolean;

  /**
   * Name of the target package, when applicable.
   */
  package: string;

  /**
   * Whether to render the versions in the results.
   */
  version?: boolean;
}

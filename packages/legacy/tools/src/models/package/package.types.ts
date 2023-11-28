/**
 * Browser for Karma tests.
 *
 * @public
 */
export type TestBrowser = 'chrome' | 'edgium' | 'firefox' | 'ie' | 'node' | 'opera' | 'safari';

/**
 * Test runner.
 *
 * @public
 */
export type TestRunner = 'jest' | 'karma' | 'mocha';

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

/**
 * Test Command Options interface.
 *
 * @public
 */
export interface TestConfig {
  /**
   * Whether to run automation-scoped tests.
   */
  automation?: boolean;

  /**
   * Whether to run documentation-scoped tests.
   */
  documentation?: boolean;

  /**
   * Whether to run integration-scoped tests.
   */
  integration?: boolean;

  /**
   * Which browsers to use when running Karma tests.
   */
  karmaBrowsers?: Array<TestBrowser>;

  /**
   * Whether to use Karma's debug mode.
   */
  karmaDebug?: boolean;

  /**
   * Which port to use for karma debugging and fixtures.
   */
  karmaPort?: string;

  /**
   * Which test runner to use.
   */
  runner?: TestRunner;

  /**
   * Override the default test targets for reading files.
   */
  targets?: string;

  /**
   * Whether to run unit-scoped tests.
   */
  unit?: boolean;
}

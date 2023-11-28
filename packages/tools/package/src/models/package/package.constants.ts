/**
 * Default version to set version information to if no data is available.
 *
 * @internal
 */
const DEFAULT_VERSION = '0.0.0';

/**
 * Default, production tag for NPM.
 *
 * @internal
 */
const STABLE_TAG = 'latest';

/**
 * Path, relative to the package root, to the package definition file.
 *
 * @internal
 */
const PACKAGE_DEFINITION_FILE = './package.json';

const CONSTANTS = {
  DEFAULT_VERSION,
  PACKAGE_DEFINITION_FILE,
  STABLE_TAG,
};

export default CONSTANTS;

/**
 * Patterns used for collecting files with a glob.
 */
const PATTERNS = {
  JAVASCRIPT: './**/*.js',
  TYPESCRIPT: './**/*.ts',
  TEST: './**/*.*',
};

/**
 * Test directories for organizing test runners.
 */
const TEST_DIRECTORIES = {
  INTEGRATION: './integration',
  ROOT: './test',
  UNIT: './unit',
};

const CONSTANTS = {
  PATTERNS,
  TEST_DIRECTORIES,
};

export default CONSTANTS;

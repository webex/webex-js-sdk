/**
 * Patterns used for collecting files with a glob.
 */
const PATTERNS = {
  JAVASCRIPT: './**/*.js',
  TYPESCRIPT: './**/*.ts',
  TEST: './**/*.*',
  BYODS: './*.test.ts',
};

/**
 * Test directories for organizing test runners.
 */
const TEST_DIRECTORIES = {
  INTEGRATION: './integration/spec',
  ROOT: './test',
  UNIT: './unit/spec',
  SRC: './src',
};

const CONSTANTS = {
  PATTERNS,
  TEST_DIRECTORIES,
};

export default CONSTANTS;

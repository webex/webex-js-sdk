/**
 * Core configuration Object for Mocha.
 *
 * @public
 */
const CONFIG = {
  diff: true,
  bail: false,
  require: ['@babel/register', '@webex/env-config-legacy'],
  retries: 0,
  timeout: 30000,
};

const CONSTANTS = {
  CONFIG,
};

export default CONSTANTS;

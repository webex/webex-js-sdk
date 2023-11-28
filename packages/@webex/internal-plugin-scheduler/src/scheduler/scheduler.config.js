/**
 * The configuration object for this plugin.
 *
 * Each of the values can be retreived from `this.webex.config.scheduler.{property}.
 * When these properties mount/update, `this.webex` object emits `change:config`.
 */
const config = {
  scheduler: {
    configurationBoolean: true,
    configurationString: 'hello',
    configurationNumber: 1234,
    configurationArray: [1, 2, 3, 4],
    configurationObject: {a: 1, b: 2, c: 3},
  },
};

export default config;

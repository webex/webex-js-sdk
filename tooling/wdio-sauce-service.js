/* eslint-disable no-plusplus, require-jsdoc, valid-jsdoc */
const SauceLabs = require('saucelabs').default;

const jobDataProperties = ['name', 'tags', 'public', 'build', 'custom-data'];

export default class SauceService {
  before() {
    this.testCnt = 0;
    this.failures = 0;
  }

  beforeSession(config) {
    this.api = new SauceLabs(config);
  }

  beforeSuite(suite) {
    this.suiteTitle = suite.title;
  }

  afterSuite(suite) {
    if (Object.prototype.hasOwnProperty.call(suite, 'error')) {
      ++this.failures;
    }
  }

  afterTest(test) {
    if (!test.passed) {
      ++this.failures;
    }
  }

  afterScenario(uri, feature, pickle, result) {
    if (result.status === 'failed') {
      ++this.failures;
    }
  }

  /**
   * update Sauce Labs job
   */
  after(result) {
    let {failures} = this;

    /**
     * set failures if user has bail option set in which case afterTest and
     * afterSuite aren't executed before after hook
     */
    if (global.browser.config.mochaOpts && global.browser.config.mochaOpts.bail && Boolean(result)) {
      failures = 1;
    }

    const status = `status: ${failures > 0 ? 'failing' : 'passing'}`;

    if (!global.browser.isMultiremote) {
      console.info(`Update job with sessionId ${global.browser.sessionId}, ${status}`);

      return this.updateJob(global.browser.sessionId, failures);
    }

    return Promise.all(Object.keys(this.capabilities).map((browserName) => {
      console.info(`Update multiremote job for browser "${browserName}" and sessionId ${global.browser[browserName].sessionId}, ${status}`);

      return this.updateJob(global.browser[browserName].sessionId, failures);
    }));
  }

  onReload(oldSessionId, newSessionId) {
    const status = `status: ${this.failures > 0 ? 'failing' : 'passing'}`;

    if (!global.browser.isMultiremote) {
      console.info(`Update (reloaded) job with sessionId ${oldSessionId}, ${status}`);

      return this.updateJob(oldSessionId, this.failures);
    }

    const browserName = global.browser.instances.filter(
      (browserName) => global.browser[browserName].sessionId === newSessionId
    )[0];

    console.info(`Update (reloaded) multiremote job for browser "${browserName}" and sessionId ${oldSessionId}, ${status}`);

    return this.updateJob(oldSessionId, this.failures);
  }

  async updateJob(sessionId, failures) {
    await this.api.updateTest(sessionId, {passed: failures === 0});
    this.failures = 0;
  }

  /**
   * VM message data
   */
  getBody(failures, calledOnReload = false, browserName) {
    const body = {};

    /**
     * set default values
     */
    body.name = this.suiteTitle;

    if (browserName) {
      body.name = `${browserName}: ${body.name}`;
    }

    /**
     * add reload count to title if reload is used
     */
    if (calledOnReload || this.testCnt) {
      let testCnt = ++this.testCnt;

      if (global.browser.isMultiremote) {
        testCnt = Math.ceil(testCnt / global.browser.instances.length);
      }

      body.name += ` (${testCnt})`;
    }

    for (const prop of jobDataProperties) {
      if (!this.capabilities[prop]) {
        // eslint-disable-next-line no-continue
        continue;
      }

      body[prop] = this.capabilities[prop];
    }

    body.passed = failures === 0;

    return body;
  }
}

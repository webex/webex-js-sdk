import CONSTANTS from './browsers.constants';

/**
 * Karma test runner browser configuration utility methods.
 *
 * @public
 */
class Browsers {
  /**
   * Constants associated with this Karma Browsers configuration class.
   */
  public static get CONSTANTS() {
    return CONSTANTS;
  }

  /**
   * Get a formatted configuration for browsers within Karma based on the
   * provided options.
   *
   * @param options - Options Object.
   * @returns - Formatted browser configuration object for Karma test runner.
   */
  public static get({ debug, browsers }: { debug?: boolean, browsers?: Array<string> }) {
    let config: any = {};

    if (!browsers) {
      config = {
        ...(debug ? Browsers.CONSTANTS.CHROME.HEADED : Browsers.CONSTANTS.CHROME.HEADLESS),
        ...(debug ? Browsers.CONSTANTS.FIREFOX.HEADED : Browsers.CONSTANTS.FIREFOX.HEADLESS),
      };

      return config;
    }

    browsers.forEach((browser) => {
      switch (browser) {
        case 'chrome':
          config = {
            ...config,
            ...(debug ? Browsers.CONSTANTS.CHROME.HEADED : Browsers.CONSTANTS.CHROME.HEADLESS),
          };
          break;

        case 'firefox':
          config = {
            ...config,
            ...(debug ? Browsers.CONSTANTS.FIREFOX.HEADED : Browsers.CONSTANTS.FIREFOX.HEADLESS),
          };
          break;

        default:
          config = {};
      }
    });

    return config;
  }
}

export default Browsers;

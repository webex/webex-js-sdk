import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import BrowserDetection from '@webex/plugin-meetings/src/common/browser-detection';

const USER_AGENT_CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.85 Safari/537.36';

const USER_AGENT_EDGE_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.85 ' +
  'Safari/537.36 Edg/90.0.818.49';

const USER_AGENT_SAFARI_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) ' +
  ' AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15';

const USER_AGENT_FIREFOX_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:87.0) ' + 'Gecko/20100101 Firefox/87.0';

const mockDetectionObject = {
  /* eslint-disable global-require */
  getOSName: () => require('os').platform(),
  getOSVersion: () => require('os').release(),
  /* eslint-enable global-require */
  getBrowserName: () => '',
  getBrowserVersion: () => '',
  isBrowser: () => false,
};

describe('common/browser-detection', () => {
  it('returns the correct browser name.', () => {
    assert.equal(
      BrowserDetection(USER_AGENT_CHROME_MAC).getBrowserName(),
      'Chrome',
      'Browser detection should return the correct browser name'
    );
  });

  it('returns the correct browser version.', () => {
    assert.equal(
      BrowserDetection(USER_AGENT_CHROME_MAC).getBrowserVersion(),
      '90.0.4430.85',
      'Browser detection should return the correct browser version'
    );
  });

  it('returns the correct OS name.', () => {
    assert.equal(
      BrowserDetection(USER_AGENT_CHROME_MAC).getOSName(),
      'macOS',
      'Browser detection should return the correct OS name'
    );
  });

  it('returns the correct OS version.', () => {
    assert.equal(
      BrowserDetection(USER_AGENT_CHROME_MAC).getOSVersion(),
      '10.15.7',
      'Browser detection should return the correct OS version'
    );
  });

  it('returns the fact it is not Firefox', () => {
    assert.isFalse(
      BrowserDetection(USER_AGENT_CHROME_MAC).isBrowser('firefox'),
      'This browser is Firefox'
    );
  });

  it('returns the fact it is not Safari', () => {
    assert.isFalse(
      BrowserDetection(USER_AGENT_CHROME_MAC).isBrowser('safari'),
      'This browser is Safari'
    );
  });

  it('returns the fact it is not MS Edge', () => {
    assert.isFalse(
      BrowserDetection(USER_AGENT_CHROME_MAC).isBrowser('edge'),
      'This browser is Microsoft Edge'
    );
  });

  it('returns the fact it is MS Edge', () => {
    assert.isTrue(
      BrowserDetection(USER_AGENT_EDGE_MAC).isBrowser('edge'),
      'This browser is NOT Microsoft Edge'
    );
  });

  it('returns the fact it is Safari', () => {
    assert.isTrue(
      BrowserDetection(USER_AGENT_SAFARI_MAC).isBrowser('safari'),
      'This browser is NOT Safari'
    );
  });

  it('returns the fact it is Firefox', () => {
    assert.isTrue(
      BrowserDetection(USER_AGENT_FIREFOX_MAC).isBrowser('firefox'),
      'This browser is NOT Firefox'
    );
  });

  it('returns the mock object when there is no userAgent', () => {
    Object.defineProperty(global.window.navigator, 'userAgent', {
      get: () => undefined,
      configurable: true,
    });

    const {getBrowserName, getBrowserVersion, getOSName, getOSVersion} = BrowserDetection(null);

    assert.equal(getBrowserName(), mockDetectionObject.getBrowserName());
    assert.equal(getBrowserVersion(), mockDetectionObject.getBrowserVersion());
    assert.equal(getOSName(), mockDetectionObject.getOSName());
    assert.equal(getOSVersion(), mockDetectionObject.getOSVersion());
  });
});

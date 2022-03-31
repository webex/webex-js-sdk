/* globals browser */
import {expect} from 'chai';
import {flaky} from '@webex/test-helper-mocha';
import testUsers from '@webex/test-helper-test-users';

describe('Meetings Plugin', () => {
  let mccoy, spock;

  before('create test users', () => testUsers.create({count: 2})
    .then((users) => {
      [mccoy, spock] = users;

      // Adding pause to let test users propagate through integration
      browser.pause(2500);
    }));

  before('reload browser', () => {
    browser.refresh();
  });

  it('loads the app', () => {
    browser.url('/samples/browser-plugin-meetings');
    browser.$('#access-token').waitForExist({timeout: 1500});
  });

  it('connects mccoys\'s browser', () => {
    expect(browserChrome.getTitle()).to.equal('Webex JavaScript SDK Sample: Meetings Plugin');
    browserChrome.execute((token) => {
      // eslint-disable-next-line no-undef
      document.getElementById('access-token').value += token;
    }, mccoy.token.access_token);
    browserChrome.$('#access-token-save').click();

    // registeration
    browserChrome.$('#registration-register').click();
    browserChrome.waitUntil(() => {
      // Test runs too quickly sometimes and tries to click before call is fully established
      if (browserChrome.$('#access-token-status').getText() !== 'Saved access token!') {
        return false;
      }

      return true;
    }, {
      timeout: 10000,
      timeoutMsg: 'Timed-out waiting for login'
    });
  });

  it('connects spock\'s browser', () => {
    expect(browserFirefox.getTitle()).to.equal('Webex JavaScript SDK Sample: Meetings Plugin');
    browserFirefox.execute((token) => {
      // eslint-disable-next-line no-undef
      document.getElementById('access-token').value += token;
    }, spock.token.access_token);
    browserFirefox.$('#access-token-save').click();

    // registeration
    browserFirefox.$('#registration-register').click();

    browserFirefox.waitUntil(() => {
      // Test runs too quickly sometimes and tries to click before call is fully established
      if (browserFirefox.$('#access-token-status').getText() !== 'Saved access token!') {
        return false;
      }

      return true;
    }, {
      timeout: 10000,
      timeoutMsg: 'Timed-out waiting for login'
    });
  });

  it('places call from spock to mccoy', () => {
    browserFirefox.$('#create-meeting-destination').setValue(mccoy.emailAddress);
    browserFirefox.$('#create-meeting-action').click();
    browserFirefox.pause(5000);
    browserFirefox.$('#meetings-list label').click();
    browserFirefox.$('#btn-join').click();
    browserFirefox.pause(5000);
  });

  flaky(it, process.env.SKIP_FLAKY_TESTS)('mccoy answers the call', () => {
    browserChrome.pause(5000);
    browserChrome.$('#answer').waitForDisplayed({timeout: 20000});
    browserChrome.$('#answer').click();
    browserChrome.pause(5000);
  }, 4);

  it('ends the call', () => {
    browser.$('#meetings-leave').click();
  });
});

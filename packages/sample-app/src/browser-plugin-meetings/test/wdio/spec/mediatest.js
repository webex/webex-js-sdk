/* globals browser */
import {flaky} from '@webex/test-helper-mocha';
import testUsers from '@webex/test-helper-test-users';

describe('Meetings Plugin', () => {
let mccoy, spock;

  before('create test users', () => testUsers.create({count: 2})
    .then((users) => {
      [mccoy, spock] = users;

      // Adding pause to let test users propagate through integration
    }));

  before('reload browser', async () => {
    await browser.refresh();
  });

  it('loads the app', async () => {
    await browser.url('/samples/browser-plugin-meetings');
    await browser.$('#access-token').waitForExist({timeout: 1500});
  });

  it('connects mccoys\'s browser', async () => {
    await expect(browserChrome).toHaveTitle('Webex JavaScript SDK Sample: Meetings Plugin')
   
    await browserChrome.execute((token) => {
      // eslint-disable-next-line no-undef
      document.getElementById('access-token').value += token;
    }, mccoy.token.access_token);
    const element = await browserChrome.$('#access-token-save');
    await element.scrollIntoView();
    await element.click();

    // registeration
    await (await browserChrome.$('#registration-register')).click();
    await browserChrome.waitUntil(async () => {
      // Test runs too quickly sometimes and tries to click before call is fully established
      if ((await (await browserChrome.$('#access-token-status')).getText()) !== 'Saved access token!') {
        return false;
      }

      return true;
    }, {
      timeout: 10000,
      timeoutMsg: 'Timed-out waiting for login'
    });
  });

  it('connects spock\'s browser', async () => {
    await expect(browserFirefox).toHaveTitle('Webex JavaScript SDK Sample: Meetings Plugin')
    await browserFirefox.execute((token) => {
      // eslint-disable-next-line no-undef
      document.getElementById('access-token').value += token;
    }, spock.token.access_token);
    const element = await browserFirefox.$('#access-token-save');
    await element.scrollIntoView();
    await element.click();

    // registeration
    await (await browserFirefox.$('#registration-register')).click();

    await browserFirefox.waitUntil(async () => {
      // Test runs too quickly sometimes and tries to click before call is fully established
      if ((await (await browserFirefox.$('#access-token-status')).getText()) !== 'Saved access token!') {
        return false;
      }

      return true;
    }, {
      timeout: 10000,
      timeoutMsg: 'Timed-out waiting for login'
    });
  });

  it('places call from spock to mccoy', async () => {
    const createMeetingButton = await browserFirefox.$('#create-meeting-destination')
    await createMeetingButton.scrollIntoView()
    await createMeetingButton.setValue(mccoy.emailAddress);
    await (await browserFirefox.$('#create-meeting-action')).click();
    await browserFirefox.pause(5000);
    await (await browserFirefox.$('#meetings-list label')).click();
    await (await browserFirefox.$('#btn-join')).click();
    await browserFirefox.pause(5000);
  });

  flaky(it, process.env.SKIP_FLAKY_TESTS)('mccoy answers the call', async () => {
    await browserChrome.pause(5000);
    await (await browserChrome.$('#answer')).waitForDisplayed({timeout: 20000});
    await (await browserChrome.$('#answer')).click();
    await browserChrome.pause(5000);
  }, 4);

  // skipping because spock could not join meeting
  it.skip('ends the call', async () => {
    await (await browser.$('#meetings-leave')).click();
  });
});

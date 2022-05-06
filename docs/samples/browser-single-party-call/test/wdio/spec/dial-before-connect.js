import testUsers from '@webex/test-helper-test-users';
import {expect} from 'chai';

describe('Single Party Calling - Dial before connecting', () => {
  let mccoy, spock;


  before('create test users', () => testUsers.create({count: 2})
    .then((users) => {
      [spock, mccoy] = users;

      // Adding pause to let test users propagate through integration
    }));

  before('reload browser', async () => {
    await browser.refresh();
  });

  it('loads the app', async () => {
    await browser.url('/samples/browser-single-party-call');
  });

  it('connects mccoy\'s browser', async () => {
    await expect(await browserChrome.getTitle()).to.equal('Sample: Single Party Calling');
    await (await browserChrome.$('#token-input')).click();
    await (await browserChrome.$('#token-auth')).waitForExist({timeout: 2000});
    await browserChrome.execute((token) => {
      // eslint-disable-next-line no-undef
      document.querySelector('[placeholder="Your access token"]').value += token;
    }, mccoy.token.access_token);
    await (await browserChrome.$('#webexInit')).click();
    await browserChrome.waitUntil(
      async () => (await (await browserChrome.$('#webex-status')).getText()) === 'webex is initialized',
      {
        timeout: 10000,
        timeoutMsg: 'webex was not initialized for mccoy'
      }
    );
  });

  it('connects spock\'s browser', async () => {
    await expect(await browserFirefox.getTitle()).to.equal('Sample: Single Party Calling');
    await (await browserFirefox.$('#token-input')).click();
    await (await browserFirefox.$('#token-auth')).waitForExist({timeout: 2000});
    await browserFirefox.execute((token) => {
      // eslint-disable-next-line no-undef
      document.querySelector('[placeholder="Your access token"]').value += token;
    }, spock.token.access_token);
    await (await browserFirefox.$('#webexInit')).click();
    await browserFirefox.waitUntil(
      async () => (await (await browserFirefox.$('#webex-status')).getText()) === 'webex is initialized',
      {
        timeout: 10000,
        timeoutMsg: 'webex was not initialized for spock'
      }
    );
  });

  it('register device for spock', async () => {
    await browserFirefox.waitUntil(async () => (await (await browserFirefox.$('#register')).isEnabled()) === true, {
      timeout: 5000,
      timeoutMsg: 'register button was not enabled for spock'
    });
    await (await browserFirefox.$('#register')).click();
    await browserFirefox.waitUntil(
      async () => (await (await browserFirefox.$('#register-status')).getText()) === 'device is registered',
      {
        timeout: 10000,
        timeoutMsg: 'device was not registered'
      }
    );
    await (await browserFirefox.$('.listening')).waitForExist();
  });

  it('register device for mccoy', async () => {
    await browserChrome.waitUntil(async () => (await (await browserChrome.$('#register')).isEnabled()) === true, {
      timeout: 5000,
      timeoutMsg: 'register button was not enabled for mccoy'
    });
    await (await browserChrome.$('#register')).click();
    await browserChrome.waitUntil(
      async () => (await (await browserChrome.$('#register-status')).getText()) === 'device is registered',
      {
        timeout: 10000,
        timeoutMsg: 'device was not registered'
      }
    );
    await (await browserChrome.$('.listening')).waitForExist();
  });

  it('places call from spock to mccoy', async () => {
    await (await browserFirefox.$('[placeholder="Person ID or Email Address or SIP URI or Room ID"]')).setValue(mccoy.emailAddress);
    await (await browserFirefox.$('[title="dial"]')).click();

    await browserFirefox.waitUntil(async () => (await (await browserFirefox.$('#call-status-local')).getText()) === 'IN_MEETING',
      {
        timeout: 10000,
        timeoutMsg: 'Timed-out waiting for local user to connect to meeting'
      });
  });

  it('joins the call on mccoy', async () => {
    await browserChrome.waitUntil(async () => {
      try {
        const alerttext = await browserChrome.getAlertText();

        return alerttext === 'Answer incoming call';
      }
      catch (error) {
        // Error is thrown when alert isn't open which is fine
        return false;
      }
    }, {
      timeout: 10000,
      timeoutMsg: 'Timed out waiting for incoming call alert'
    });
    await browserChrome.acceptAlert();
  });

  it('ends the call', async () => {
    await browserFirefox.waitUntil(async () => (await (await browserFirefox.$('#call-status-remote')).getText()) === 'IN_MEETING',
      {
        timeout: 10000,
        timeoutMsg: 'Timed-out waiting for remote user to connect to meeting'
      });
    await (await browserFirefox.$('[title="hangup"]')).click();
    await browserFirefox.waitUntil(async () => (await (await browserFirefox.$('#call-status-local')).getText()) === 'NOT_IN_MEETING',
      {
        timeout: 10000,
        timeoutMsg: 'Timed-out waiting for local user to disconnect from meeting'
      });
  });
});

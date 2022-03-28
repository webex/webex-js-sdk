import testUsers from '@webex/test-helper-test-users';
import {expect} from 'chai';

describe('Single Party Calling - Dial before connecting', () => {
  let mccoy, spock;


  before('create test users', () => testUsers.create({count: 2})
    .then((users) => {
      [spock, mccoy] = users;

      // Adding pause to let test users propagate through integration
      browser.pause(2500);
    }));

  before('reload browser', () => {
    browser.refresh();
  });

  it('loads the app', () => {
    browser.url('/browser-single-party-call');
  });

  it('connects mccoy\'s browser', () => {
    expect(browserChrome.getTitle()).to.equal('Sample: Single Party Calling');
    browserChrome.$('#token-input').click();
    browserChrome.$('#token-auth').waitForExist({timeout: 2000});
    browserChrome.execute((token) => {
      // eslint-disable-next-line no-undef
      document.querySelector('[placeholder="Your access token"]').value += token;
    }, mccoy.token.access_token);
    browserChrome.$('#webexInit').click();
    browserChrome.waitUntil(
      () => browserChrome.$('#webex-status').getText() === 'webex is initialized',
      {
        timeout: 10000,
        timeoutMsg: 'webex was not initialized for mccoy'
      }
    );
  });

  it('connects spock\'s browser', () => {
    expect(browserFirefox.getTitle()).to.equal('Sample: Single Party Calling');
    browserFirefox.$('#token-input').click();
    browserFirefox.$('#token-auth').waitForExist({timeout: 2000});
    browserFirefox.execute((token) => {
      // eslint-disable-next-line no-undef
      document.querySelector('[placeholder="Your access token"]').value += token;
    }, spock.token.access_token);
    browserFirefox.$('#webexInit').click();
    browserFirefox.waitUntil(
      () => browserFirefox.$('#webex-status').getText() === 'webex is initialized',
      {
        timeout: 10000,
        timeoutMsg: 'webex was not initialized for spock'
      }
    );
  });

  it('register device for spock', () => {
    browserFirefox.waitUntil(() => browserFirefox.$('#register').isEnabled() === true, {
      timeout: 5000,
      timeoutMsg: 'register button was not enabled for spock'
    });
    browserFirefox.$('#register').click();
    browserFirefox.waitUntil(
      () => browserFirefox.$('#register-status').getText() === 'device is registered',
      {
        timeout: 10000,
        timeoutMsg: 'device was not registered'
      }
    );
    browserFirefox.$('.listening').waitForExist();
  });

  it('register device for mccoy', () => {
    browserChrome.waitUntil(() => browserChrome.$('#register').isEnabled() === true, {
      timeout: 5000,
      timeoutMsg: 'register button was not enabled for mccoy'
    });
    browserChrome.$('#register').click();
    browserChrome.waitUntil(
      () => browserChrome.$('#register-status').getText() === 'device is registered',
      {
        timeout: 10000,
        timeoutMsg: 'device was not registered'
      }
    );
    browserChrome.$('.listening').waitForExist();
  });

  it('places call from spock to mccoy', () => {
    browserFirefox.$('[placeholder="Person ID or Email Address or SIP URI or Room ID"]').setValue(mccoy.emailAddress);
    browserFirefox.$('[title="dial"]').click();

    browserFirefox.waitUntil(() =>
      (browserFirefox.$('#call-status-local').getText() === 'IN_MEETING'),
    {
      timeout: 10000,
      timeoutMsg: 'Timed-out waiting for local user to connect to meeting'
    });
  });

  it('joins the call on mccoy', () => {
    browserChrome.waitUntil(() => {
      try {
        const alerttext = browserChrome.getAlertText();

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
    browserChrome.acceptAlert();
  });

  it('ends the call', () => {
    browserFirefox.waitUntil(() =>
      (browserFirefox.$('#call-status-remote').getText() === 'IN_MEETING'),
    {
      timeout: 10000,
      timeoutMsg: 'Timed-out waiting for remote user to connect to meeting'
    });
    browserFirefox.$('[title="hangup"]').click();
    browserFirefox.waitUntil(() =>
      (browserFirefox.$('#call-status-local').getText() === 'NOT_IN_MEETING'),
    {
      timeout: 10000,
      timeoutMsg: 'Timed-out waiting for local user to disconnect from meeting'
    });
  });
});

import testUsers from '@webex/test-helper-test-users';
import {expect} from 'chai';

describe('Single Party Calling with Mute - Normal Dialing', () => {
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
    browser.url('/browser-single-party-call-with-mute');
  });

  it('connects mccoy\'s browser', () => {
    expect(browserChrome.getTitle()).to.equal('Sample: Local Mute/Unmute');
    browserChrome.execute((token) => {
      // eslint-disable-next-line no-undef
      document.querySelector('[placeholder="Your access token"]').value += token;
    }, mccoy.token.access_token);
    browserChrome.$('[title="connect"]').click();
    browserChrome.$('.listening').waitForExist();
  });

  it('connects spock\'s browser', () => {
    expect(browserFirefox.getTitle()).to.equal('Sample: Local Mute/Unmute');
    browserFirefox.execute((token) => {
      // eslint-disable-next-line no-undef
      document.querySelector('[placeholder="Your access token"]').value += token;
    }, spock.token.access_token);
    browserFirefox.$('[title="connect"]').click();
    browserFirefox.$('.listening').waitForExist();
  });

  it('places call from spock to mccoy', () => {
    browserFirefox.$('[placeholder="Person ID or Email Address or SIP URI or Room ID"]').setValue(mccoy.emailAddress);
    browserFirefox.$('[title="dial"]').click();

    browserFirefox.waitUntil(() =>
      (browserFirefox.$('#call-status-local').getText() === 'IN_MEETING'),
    {
      timeout: 10000,
      timeoutMsg:
        'Timed-out waiting for local user to connect to meeting'
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
    browserFirefox.waitUntil(() =>
      (browserFirefox.$('#call-status-remote').getText() === 'IN_MEETING'),
    {
      timeout: 10000,
      timeoutMsg: 'Timed-out waiting for remote user to connect to meeting'
    });
  });

  it('turns the local camera off', () => {
    browserFirefox.$('[title="stop sending video"]').click();
    // Test runs too quickly sometimes and tries to click before call is fully established
    browserFirefox.waitUntil(() =>
      (browserFirefox.$('#camera-state').getText() === 'off'),
    {
      timeout: 10000,
      timeoutMsg: 'Timed-out waiting for camera state to chage'
    });
  }, 4);

  it('turns the local camera back on', () => {
    browserFirefox.$('[title="start sending video"]').click();
    // Test runs too quickly sometimes and tries to click before call is fully established
    browserFirefox.waitUntil(() =>
      (browserFirefox.$('#camera-state').getText() === 'on'),
    {
      timeout: 10000,
      timeoutMsg: 'Timed-out waiting for camera state to change'
    });
  }, 4);

  it('turns sending audio off', () => {
    browserFirefox.$('[title="stop sending audio"]').click();
    // Test runs too quickly sometimes and tries to click before call is fully established
    browserFirefox.waitUntil(() =>
      (browserFirefox.$('#microphone-state').getText() === 'off'),
    {
      timeout: 10000,
      timeoutMsg: 'Timed-out waiting for microphone state to chage'
    });
  }, 4);

  it('turns sending audio on', () => {
    browserFirefox.$('[title="start sending audio"]').click();
    // Test runs too quickly sometimes and tries to click before call is fully established
    browserFirefox.waitUntil(() =>
      (browserFirefox.$('#microphone-state').getText() === 'on'),
    {
      timeout: 10000,
      timeoutMsg: 'Timed-out waiting for microphone state to chage'
    });
  }, 4);

  it('ends the call', () => {
    browserFirefox.$('[title="hangup"]').click();
    browserFirefox.waitUntil(() =>
      (browserFirefox.$('#call-status-local').getText() === 'NOT_IN_MEETING'),
    {
      timeout: 10000,
      timeoutMsg: 'Timed-out waiting for local user to disconnect from meeting'
    });
  });
});

/* eslint-disable no-unused-expressions */
/* eslint-env browser */
import testUsers from '@webex/test-helper-test-users';
import {flaky} from '@webex/test-helper-mocha';
import {expect} from 'chai';

describe('Call With Screenshare', () => {
  describe('normal dialing with token', () => {
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
      browser.url('/samples/browser-call-with-screenshare');
    });

    it('select the token option and token form appears for spock', () => {
      browserFirefox.$('#token-input').click();
      browserFirefox.$('#token-auth').waitForExist({timeout: 2000});
      expect(browserFirefox.$('#token-auth').isDisplayed()).to.be.true;
      expect(browserFirefox.$('#oauth').isDisplayed()).to.be.false;
    });

    it('select the token option and token form appears for mccoy', () => {
      browserChrome.$('#token-input').click();
      browserChrome.$('#token-auth').waitForExist({timeout: 2000});
      expect(browserChrome.$('#token-auth').isDisplayed()).to.be.true;
      expect(browserChrome.$('#oauth').isDisplayed()).to.be.false;
    });

    it('initialize webex for spock', () => {
      expect(browserFirefox.getTitle()).to.equal('Sample: Local Screensharing');
      browserFirefox.execute((token) => {
        document.getElementById('access-token').value += token;
      }, spock.token.access_token);
      browserFirefox.$('#webexInit').click();
      browserFirefox.$('#webexInit').click();
      browserFirefox.waitUntil(
        () => browserFirefox.$('#webex-status').getText() === 'webex is initialized',
        {
          timeout: 10000,
          timeoutMsg: 'device was not registered'
        }
      );
      expect(browserFirefox.$('#webexInit').isEnabled()).to.be.false;
    });

    it('initialize webex for mccoy', () => {
      expect(browserChrome.getTitle()).to.equal('Sample: Local Screensharing');
      browserChrome.execute((token) => {
        document.getElementById('access-token').value += token;
      }, mccoy.token.access_token);
      browserChrome.$('#webexInit').click();
      browserChrome.waitUntil(
        () => browserChrome.$('#webex-status').getText() === 'webex is initialized',
        {
          timeout: 10000,
          timeoutMsg: 'device was not registered'
        }
      );
      expect(browserChrome.$('#webexInit').isEnabled()).to.be.false;
    });

    it('register device for spocky', () => {
      browserFirefox.waitUntil(() => browserFirefox.$('#register').isEnabled() === true, {
        timeout: 5000,
        timeoutMsg: 'register button was not enabled'
      });
      browserFirefox.$('#register').click();
      browserFirefox.waitUntil(
        () => browserFirefox.$('#register-status').getText() === 'device is registered',
        {
          timeout: 10000,
          timeoutMsg: 'device was not registered'
        }
      );

      expect(browserFirefox.$('#register').isEnabled()).to.be.false;
      expect(browserFirefox.$('#unregister').isEnabled()).to.be.true;
      expect(browserFirefox.$('#dial').isEnabled()).to.be.true;
      expect(browserFirefox.$('#hangup').isEnabled()).to.be.true;
      expect(browserFirefox.$('#share-screen').isEnabled()).to.be.true;
      expect(browserFirefox.$('#stop-screen-share').isEnabled()).to.be.true;

      browserFirefox.$('.listening').waitForExist();
    });

    it('register device for mccoy', () => {
      browserChrome.waitUntil(() => browserChrome.$('#register').isEnabled() === true, {
        timeout: 5000,
        timeoutMsg: 'register button was not enabled'
      });
      browserChrome.$('#register').click();
      browserChrome.waitUntil(
        () => browserChrome.$('#register-status').getText() === 'device is registered',
        {
          timeout: 10000,
          timeoutMsg: 'device was not registered'
        }
      );

      expect(browserChrome.$('#register').isEnabled()).to.be.false;
      expect(browserChrome.$('#unregister').isEnabled()).to.be.true;
      expect(browserChrome.$('#dial').isEnabled()).to.be.true;
      expect(browserChrome.$('#hangup').isEnabled()).to.be.true;
      expect(browserChrome.$('#share-screen').isEnabled()).to.be.true;
      expect(browserChrome.$('#stop-screen-share').isEnabled()).to.be.true;

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
      browserFirefox.waitUntil(() =>
        (browserFirefox.$('#call-status-remote').getText() === 'IN_MEETING'),
      {
        timeout: 10000,
        timeoutMsg: 'Timed-out waiting for remote user to connect to meeting'
      });
    });

    it('starts screensharing', () => {
      browserFirefox.$('button[title="share screen"]').click();

      browserFirefox.waitUntil(() =>
        (browserFirefox.$('#screenshare-tracks').getText() === 'SHARING'),
      {
        timeout: 20000,
        timeoutMsg: 'Timed-out waiting for screenshare to start'
      });
    });

    it('stops screensharing', () => {
      // Pausing for screenshare to establish because we don't currently have stream stats displayed
      browser.pause(2500);
      browserFirefox.$('button[title="stop screen share"]').click();
      browserFirefox.waitUntil(() =>
        (browserFirefox.$('#screenshare-tracks').getText() === 'STOPPED'),
      {
        timeout: 10000,
        timeoutMsg: 'Timed-out waiting for screenshare to stop'
      });
    }, 4);

    it('starts screensharing remote', () => {
      browserChrome.$('button[title="share screen"]').click();

      browserChrome.waitUntil(() =>
        (browserChrome.$('#screenshare-tracks').getText() === 'SHARING'),
      {
        timeout: 20000,
        timeoutMsg: 'Timed-out waiting for screenshare to start'
      });
    });

    flaky(it, process.env.SKIP_FLAKY_TESTS)('stops screensharing remote', () => {
      // Pausing for screenshare to establish because we don't currently have stream stats displayed
      browser.pause(2500);
      browserChrome.$('button[title="stop screen share"]').click();
      browserChrome.waitUntil(() =>
        (browserChrome.$('#screenshare-tracks').getText() === 'STOPPED'),
      {
        timeout: 10000,
        timeoutMsg: 'Timed-out waiting for screenshare to stop'
      });
    });

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

  describe('normal dialing with oauth flow', () => {
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

    it('browses to sample app and verifies the user is not authenticated', () => {
      browser.url('/samples/browser-call-with-screenshare');
      expect(browserFirefox.$('#login-status').getText()).to.equal('not logged in');
      expect(browserChrome.$('#login-status').getText()).to.equal('not logged in');
    });

    it('verifies that we selected oauth as the option, not token option ', () => {
      expect(browserFirefox.$('#oauth-input').isSelected()).to.be.true;
      expect(browserFirefox.$('#token-input').isSelected()).to.be.false;

      expect(browserChrome.$('#oauth-input').isSelected()).to.be.true;
      expect(browserChrome.$('#token-input').isSelected()).to.be.false;
    });

    it('checking if the login button is enabled and other buttons is disabled', () => {
      expect(browserChrome.$('#login').isEnabled()).to.be.true;
      expect(browserChrome.$('#logout').isEnabled()).to.be.false;
      expect(browserChrome.$('#register').isEnabled()).to.be.false;
      expect(browserChrome.$('#unregister').isEnabled()).to.be.false;
      expect(browserChrome.$('#dial').isEnabled()).to.be.false;
      expect(browserChrome.$('#invitee').isEnabled()).to.be.false;
      expect(browserChrome.$('#hangup').isEnabled()).to.be.false;
      expect(browserChrome.$('#share-screen').isEnabled()).to.be.false;
      expect(browserChrome.$('#stop-screen-share').isEnabled()).to.be.false;

      expect(browserFirefox.$('#login').isEnabled()).to.be.true;
      expect(browserFirefox.$('#logout').isEnabled()).to.be.false;
      expect(browserFirefox.$('#register').isEnabled()).to.be.false;
      expect(browserFirefox.$('#unregister').isEnabled()).to.be.false;
      expect(browserFirefox.$('#dial').isEnabled()).to.be.false;
      expect(browserFirefox.$('#invitee').isEnabled()).to.be.false;
      expect(browserFirefox.$('#hangup').isEnabled()).to.be.false;
      expect(browserFirefox.$('#share-screen').isEnabled()).to.be.false;
      expect(browserFirefox.$('#stop-screen-share').isEnabled()).to.be.false;
    });

    it('click login button for both browsers', () => {
      browserChrome.$('#login').click();
      browserFirefox.$('#login').click();
    });

    it('enters user login information for both browsers', () => {
      const spockEmailInput = browserFirefox.$('#IDToken1');
      const spockEmailButton = browserFirefox.$('#IDButton2');
      const spockPasswordInput = browserFirefox.$('#IDToken2');
      const spockPasswordButton = browserFirefox.$('#Button1');

      const mccoyEmailInput = browserChrome.$('#IDToken1');
      const mccoyEmailButton = browserChrome.$('#IDButton2');
      const mccoyPasswordInput = browserChrome.$('#IDToken2');
      const mccoyPasswordButton = browserChrome.$('#Button1');


      // Wait upto 2s to redirect to idbroker and wait for form to render
      spockEmailInput.waitForExist({timeout: 2000});
      mccoyEmailInput.waitForExist({timeout: 2000});

      // the login pages aren't known for their consistency, so we'll break with
      // out pattern of using accessibility labels for test selectors in favor
      // of using the well known (if not a11y helpful) ids.
      spockEmailInput.setValue(spock.email);
      spockEmailButton.click();

      mccoyEmailInput.setValue(mccoy.email);
      mccoyEmailButton.click();

      spockPasswordInput.waitForExist();
      spockPasswordInput.setValue(spock.password);
      spockPasswordButton.click();

      mccoyPasswordInput.waitForExist();
      mccoyPasswordInput.setValue(mccoy.password);
      mccoyPasswordButton.click();
    });

    it('accepts the permissions grant if it appears', () => {
      const acceptButton = $('button[name="accept"]');

      acceptButton.waitForExist({timeout: 5000});
      acceptButton.click();
    });

    it('redirect to sample app for spock and verify auth', () => {
      browserFirefox.waitUntil(
        () => browserChrome.getTitle() === 'Sample: Local Screensharing',
        {
          timeout: 10000,
          timeoutMsg: 'device is not at the correct url'
        }
      );

      expect(browserFirefox.$('#login-status').getText()).to.equal('login completed');
      expect(browserFirefox.$('#login').isEnabled()).to.be.false;
      expect(browserFirefox.$('#logout').isEnabled()).to.be.true;
      expect(browserFirefox.$('#register').isEnabled()).to.be.true;
      expect(browserFirefox.$('#oauth-input').isEnabled()).to.be.false;
    });

    it('redirects to sample app for mccoy and verify auth', () => {
      browserChrome.waitUntil(
        () => browserChrome.getTitle() === 'Sample: Local Screensharing',
        {
          timeout: 10000,
          timeoutMsg: 'device is not at the correct title'
        }
      );

      expect(browserChrome.$('#login-status').getText()).to.equal('login completed');
      expect(browserChrome.$('#login').isEnabled()).to.be.false;
      expect(browserChrome.$('#logout').isEnabled()).to.be.true;
      expect(browserChrome.$('#register').isEnabled()).to.be.true;
      expect(browserChrome.$('#oauth-input').isEnabled()).to.be.false;
    });

    it('register device for spock', () => {
      browserFirefox.$('#register').click();
      browserFirefox.waitUntil(
        () => browserFirefox.$('#register-status').getText() === 'device is registered',
        {
          timeout: 10000,
          timeoutMsg: 'device was not able to registered'
        }
      );

      expect(browserFirefox.$('#register').isEnabled()).to.be.false;
      expect(browserFirefox.$('#unregister').isEnabled()).to.be.true;
      expect(browserFirefox.$('#dial').isEnabled()).to.be.true;
      expect(browserFirefox.$('#hangup').isEnabled()).to.be.true;
      expect(browserFirefox.$('#share-screen').isEnabled()).to.be.true;
      expect(browserFirefox.$('#stop-screen-share').isEnabled()).to.be.true;

      browserFirefox.$('.listening').waitForExist();
    });

    it('register device for mccoy', () => {
      browserChrome.$('#register').click();
      browserChrome.waitUntil(
        () => browserChrome.$('#register-status').getText() === 'device is registered',
        {
          timeout: 10000,
          timeoutMsg: 'device was not able to registered'
        }
      );

      expect(browserChrome.$('#register').isEnabled()).to.be.false;
      expect(browserChrome.$('#unregister').isEnabled()).to.be.true;
      expect(browserChrome.$('#dial').isEnabled()).to.be.true;
      expect(browserChrome.$('#hangup').isEnabled()).to.be.true;
      expect(browserChrome.$('#share-screen').isEnabled()).to.be.true;
      expect(browserChrome.$('#stop-screen-share').isEnabled()).to.be.true;
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
      browserFirefox.waitUntil(() =>
        (browserFirefox.$('#call-status-remote').getText() === 'IN_MEETING'),
      {
        timeout: 10000,
        timeoutMsg: 'Timed-out waiting for remote user to connect to meeting'
      });
    });

    it('starts screensharing', () => {
      browserFirefox.$('button[title="share screen"]').click();

      browserFirefox.waitUntil(() =>
        (browserFirefox.$('#screenshare-tracks').getText() === 'SHARING'),
      {
        timeout: 20000,
        timeoutMsg: 'Timed-out waiting for screenshare to start'
      });
    });

    it('stops screensharing', () => {
      // Pausing for screenshare to establish because we don't currently have stream stats displayed
      browser.pause(2500);
      browserFirefox.$('button[title="stop screen share"]').click();
      browserFirefox.waitUntil(() =>
        (browserFirefox.$('#screenshare-tracks').getText() === 'STOPPED'),
      {
        timeout: 10000,
        timeoutMsg: 'Timed-out waiting for screenshare to stop'
      });
    }, 4);

    it('starts screensharing remote', () => {
      browserChrome.$('button[title="share screen"]').click();

      browserChrome.waitUntil(() =>
        (browserChrome.$('#screenshare-tracks').getText() === 'SHARING'),
      {
        timeout: 20000,
        timeoutMsg: 'Timed-out waiting for screenshare to start'
      });
    });

    flaky(it, process.env.SKIP_FLAKY_TESTS)('stops screensharing remote', () => {
      // Pausing for screenshare to establish because we don't currently have stream stats displayed
      browser.pause(2500);
      browserChrome.$('button[title="stop screen share"]').click();
      browserChrome.waitUntil(() =>
        (browserChrome.$('#screenshare-tracks').getText() === 'STOPPED'),
      {
        timeout: 10000,
        timeoutMsg: 'Timed-out waiting for screenshare to stop'
      });
    });

    it('ends the call', () => {
      browserFirefox.$('[title="hangup"]').click();
      browserFirefox.waitUntil(() => (browserFirefox.$('#call-status-local').getText() === 'NOT_IN_MEETING'),
        {
          timeout: 10000,
          timeoutMsg:
        'Timed-out waiting for local user to disconnect from meeting'
        });
    });
  });
});

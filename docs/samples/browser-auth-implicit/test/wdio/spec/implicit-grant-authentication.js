// import testUsers from '@webex/test-helper-test-users';
// import {flaky} from '@webex/test-helper-mocha';
// import {expect} from 'chai';
const testUsers = require('@webex/test-helper-test-users');
const {flaky} = require('@webex/test-helper-mocha');
const {expect} = require('chai');

describe('Authentication - Implicit Grant Flow', () => {
  describe('authenticate using implicit grant flow', () => {
    let spock;

    before('creates spock', () => testUsers.create({count: 1, config: {displayName: 'Spock'}})
      .then((users) => {
        [spock] = users;
      }));

    before('reload browser', () => {
      browser.refresh();
    });

    it('browses to sample app and verifies the user is not authenticated', () => {
      browser.url('/browser-auth-implicit');
      expect(browserFirefox.$('#authentication-status').getText()).to.equal('Not Authenticated');
      expect(browserChrome.$('#authentication-status').getText()).to.equal('Not Authenticated');
    });

    it('initiates implicit grant authentication flow', () => {
      browser.$('#authenticate-button').click();
    });

    it('enters user login information', () => {
      // const idToken1 = $('#IDToken1');
      const idToken1 = $('#IDToken1');
      const idToken2 = $('#IDToken2');
      const button1 = $('#Button1');
      const idButton2 = $('#IDButton2');

      // Wait upto 2s to redirect to idbroker and wait for form to render
      idToken1.waitForExist({timeout: 2000});

      // the login pages aren't known for their consistency, so we'll break with
      // out pattern of using accessibility labels for test selectors in favor
      // of using the well known (if not a11y helpful) ids.
      idToken1.setValue(spock.email);
      idButton2.click();

      idToken2.waitForExist();
      idToken2.setValue(spock.password);
      button1.click();

      // I feel like there's a better way to do this...
      // if (browser.isDisplayed('#generic-error')) {
      //   throw new Error('Failed to login after several attempts');
      // }
    });

    it('accepts the permissions grant if it appears', () => {
      const acceptButton = $('button[name="accept"]');

      // Wait upto 2s for grant page to render
      // Optionally handle the grant page, but don't fail if this is an app that
      // doesn't show the grant page.
      acceptButton.waitForExist({timeout: 5000});
      acceptButton.click();
    });

    it('verifies authentication was successful', () => {
      // Wait upto 2s to redirect back from idbroker and wait for logout button to render
      browser.$('[title="logout"]').waitForExist({tieout: 2000});

      expect(browserFirefox.getTitle()).to.equal('Authentication - Implicit Grant Flow');
      expect(browserChrome.getTitle()).to.equal('Authentication - Implicit Grant Flow');

      expect(browserFirefox.$('#authentication-status').getText()).to.equal('Authenticated');
      expect(browserChrome.$('#authentication-status').getText()).to.equal('Authenticated');

      expect(browserFirefox.$('[title="logout"]').getValue()).to.equal('logout');
      expect(browserChrome.$('[title="logout"]').getValue()).to.equal('logout');
    });

    // Flaky return from idbroker logout either browser fails with `returnURL not allowed`
    flaky(it, process.env.SKIP_FLAKY_TESTS)('logs out', () => {
      browser.$('[title="logout"]').click();
      // Wait 1s for idbroker
      browser.pause(1000);

      // idbroker spits out returnURL is not defined error
      // check if one of the browsers return correctly
      if (
        expect(browserFirefox.$('#authentication-status').getText()).to.equal('Not Authenticated') ||
          expect(browserChrome.$('#authentication-status').getText()).to.equal('Not Authenticated')
      ) return true;

      return false;
    });
  });
});

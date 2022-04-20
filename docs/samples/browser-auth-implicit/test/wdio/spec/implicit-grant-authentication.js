import testUsers from '@webex/test-helper-test-users';
import {flaky} from '@webex/test-helper-mocha';
import {expect} from 'chai';

describe('Authentication - Implicit Grant Flow', () => {
  describe('authenticate using implicit grant flow', () => {
    let spock;

    before('creates spock', () => testUsers.create({count: 1, config: {displayName: 'Spock'}})
      .then((users) => {
        [spock] = users;
      }));

    before('reload browser', async () => {
      await browser.refresh();
      await browser.url('/samples/browser-auth-implicit');
    });

    it('browses to sample app and verifies the user is not authenticated', async () => {
      const auth = await browserFirefox.$('#authentication-status');
      const authText = await auth.getText();

      expect(authText).to.equal('Not Authenticated');
    });

    it('initiates implicit grant authentication flow', async () => {
      await (await browser.$('#authenticate-button')).click();
    });

    it('enters user login information', async () => {
      // const idToken1 = $('#IDToken1');
      const idToken1 = $('#IDToken1');
      const idToken2 = $('#IDToken2');
      const button1 = $('#Button1');
      const idButton2 = $('#IDButton2');

      // Wait upto 2s to redirect to idbroker and wait for form to render
      await idToken1.waitForExist({timeout: 2000});

      // the login pages aren't known for their consistency, so we'll break with
      // out pattern of using accessibility labels for test selectors in favor
      // of using the well known (if not a11y helpful) ids.
      await idToken1.setValue(spock.email);
      await idButton2.click();

      await idToken2.waitForExist();
      await idToken2.setValue(spock.password);
      await button1.click();

      // I feel like there's a better way to do this...
      // if (browser.isDisplayed('#generic-error')) {
      //   throw new Error('Failed to login after several attempts');
      // }
    });

    it('accepts the permissions grant if it appears', async () => {
      const acceptButton = $('button[name="accept"]');

      // Wait upto 2s for grant page to render
      // Optionally handle the grant page, but don't fail if this is an app that
      // doesn't show the grant page.
      await acceptButton.waitForExist({timeout: 5000});
      await acceptButton.click();
    });

    it('verifies authentication was successful', async () => {
      // Wait upto 2s to redirect back from idbroker and wait for logout button to render
      await (await browser.$('[title="logout"]')).waitForExist({tieout: 2000});

      await expect(await browserFirefox.getTitle()).to.equal('Authentication - Implicit Grant Flow');
      await expect(await browserChrome.getTitle()).to.equal('Authentication - Implicit Grant Flow');

      await expect(await (await browserFirefox.$('#authentication-status')).getText()).to.equal('Authenticated');
      await expect(await (await browserChrome.$('#authentication-status')).getText()).to.equal('Authenticated');

      await expect(await (await browserFirefox.$('[title="logout"]')).getValue()).to.equal('logout');
      await expect(await (await browserChrome.$('[title="logout"]')).getValue()).to.equal('logout');
    });

    // Flaky return from idbroker logout either browser fails with `returnURL not allowed`
    flaky(it, process.env.SKIP_FLAKY_TESTS)('logs out', async () => {
      await browser.$('[title="logout"]').click();
      // Wait 1s for idbroker

      // idbroker spits out returnURL is not defined error
      // check if one of the browsers return correctly
      if (
        (await expect(await (await browserFirefox.$('#authentication-status')).getText()).to.equal('Not Authenticated')) ||
          (await expect(await (await browserChrome.$('#authentication-status')).getText()).to.equal('Not Authenticated'))
      ) return true;

      return false;
    });
  });
});

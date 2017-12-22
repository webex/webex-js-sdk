import testUsers from '@ciscospark/test-helper-test-users';

describe('samples/browser-auth-implicit', () => {
  describe('authenticate using implicit grant flow', () => {
    const browserSpock = browser.select('browserSpock');
    let spock;

    before('creates spock', () => testUsers.create({count: 1, config: {displayName: 'Spock'}})
      .then((users) => {
        [spock] = users;
      }));

    before('reload browser', () => {
      browser.select('browserSpock').reload();
      browser.select('browserMccoy').reload();
    });

    it('browses to sample app and verifies the user is not authenticated', () => {
      browserSpock.url('/browser-auth-implicit');
      browserSpock.assertText('#authentication-status', 'Not Authenticated');
    });

    it('initiates implicit grant authentication flow', () => {
      browserSpock.click('[title="authenticate"]');
    });

    it('enters user login information', () => {
      // the login pages aren't known for their consistency, so we'll break with
      // out pattern of using accessibility labels for test selectors in favor
      // of using the well known (if not a11y helpful) ids.
      browserSpock.waitForExist('#IDToken1');

      // Enter Email if we haven't already filled it in
      if (!browserSpock.isVisible('#IDToken1[readonly]')) {
        browserSpock.setValue('#IDToken1', spock.email);
        browserSpock.click('#IDButton2');
      }
      for (let i = 0; i < 3; i += 1) {
        browserSpock.waitForExist('#IDToken2');


        browserSpock.setValue('#IDToken2', spock.password);
        browserSpock.click('#Button1');

        if (!browserSpock.isVisible('.generic-error')) {
          break;
        }
      }

      // I feel like there's a better way to do this...
      if (browserSpock.isVisible('.generic-error')) {
        throw new Error('Failed to login after several attempts');
      }
    });

    it('accepts the permissions grant if it appears', () => {
      // Optionally handle the grant page, but don't fail if this is an app that
      // doesn't show the grant page.
      try {
        browserSpock.waitForExist('input[value="Accept"]');
        browserSpock.click('input[value="Accept"]');
      }
      catch (err) {
        //
      }
    });

    it('verifies authentication was successful', () => {
      browserSpock.assertTitle('Authentication - Implicit Grant Flow');
      browserSpock.assertText('#authentication-status', 'Authenticated');
      browserSpock.assertAttribute('[title="logout"]', 'value', 'logout');
    });

    it('logs out', () => {
      browserSpock.click('[title="logout"]');
      browserSpock.assertTitle('Authentication - Implicit Grant Flow');
      browserSpock.assertText('#authentication-status', 'Not Authenticated');
    });
  });
});

import testUsers from '@ciscospark/test-helper-test-users';

describe('samples/browser-single-party-call', () => {
  describe('dial before connecting', () => {
    let mccoy, spock;

    const browserSpock = browser.select('browserSpock');
    const browserMccoy = browser.select('browserMccoy');

    before('create test users', () => testUsers.create({count: 2})
      .then((users) => {
        [spock, mccoy] = users;
      }));

    before('reload browser', () => {
      browser.select('browserSpock').reload();
      browser.select('browserMccoy').reload();
    });

    it('loads the app', () => {
      browser.url('/browser-single-party-call');
    });

    it('places call from spock to mccoy', () => {
      browserSpock.assertTitle('Sample: Single Party Calling');
      browserSpock.setValueInDOM('[placeholder="Your access token"]', spock.token.access_token);

      browserSpock.setValue('[placeholder="Person ID or Email Address or SIP URI or Room ID"]', mccoy.emailAddress);
      browserSpock.click('[title="dial"]');

      browserSpock.waitForExist('.listening');
    });

    it('connects mccoy\'s browser', () => {
      browserMccoy.assertTitle('Sample: Single Party Calling');
      browserMccoy.setValueInDOM('[placeholder="Your access token"]', mccoy.token.access_token);
      // Throw some more delay in to make sure the call is definitely ready to go

      browserMccoy.click('[title="connect"]');
      browserMccoy.waitForExist('.listening');

      browserMccoy.acceptAlert(20000);
    });

    it('ends the call', () => {
      browser.pause(5000);
      // TODO add assertions around streams

      browserSpock.click('[title="hangup"]');
    });
  });
});

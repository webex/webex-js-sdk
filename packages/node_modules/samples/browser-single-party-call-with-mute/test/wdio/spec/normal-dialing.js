import testUsers from '@ciscospark/test-helper-test-users';

const noStreamText = '{\n  "local": null,\n  "remote": null\n}';

describe('samples/browser-single-party-call-with-mute', () => {
  describe('normal dialing', () => {
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
      browser.url('/browser-single-party-call-with-mute');
    });

    it('connects mccoy\'s browser', () => {
      browserMccoy.assertTitle('Sample: Local Mute/Unmute');
      browserMccoy.setValueInDOM('[placeholder="Your access token"]', mccoy.token.access_token);
      browserMccoy.assertValue('[placeholder="Your access token"]', mccoy.token.access_token);
      browserMccoy.click('[title="connect"]');
      browserMccoy.waitForExist('.listening');
    });

    it('connects spock\'s browser', () => {
      browserSpock.assertTitle('Sample: Local Mute/Unmute');
      browserSpock.setValueInDOM('[placeholder="Your access token"]', spock.token.access_token);
      browserSpock.assertValue('[placeholder="Your access token"]', spock.token.access_token);
      browserSpock.click('[title="connect"]');
      browserSpock.waitForExist('.listening');
    });

    it('places call from spock to mccoy', () => {
      browserSpock.setValue('[placeholder="Person ID or Email Address or SIP URI or Room ID"]', mccoy.emailAddress);
      browserSpock.click('[title="dial"]');

      browserMccoy.acceptAlert(20000);
    });

    it('turns the local camera off', () => {
      browserSpock.assertNotText('#outgoing-video-stats', noStreamText);
      browserSpock.click('[title="stop sending video"]');
      browserSpock.waitForSpecificText('#outgoing-video-stats', noStreamText);
    });

    it('turns the local camera back on', () => {
      browserSpock.assertText('#outgoing-video-stats', noStreamText);
      browserSpock.click('[title="start sending video"]');
      browserSpock.waitForSpecificText('#outgoing-video-stats', noStreamText, true);
    });

    it('ends the call', () => {
      browser.pause(5000);
      // TODO add assertions around streams

      browserSpock.click('[title="hangup"]');
    });
  });
});

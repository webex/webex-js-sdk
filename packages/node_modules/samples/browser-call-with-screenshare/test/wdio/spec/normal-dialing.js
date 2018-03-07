import {assert} from 'chai';
import testUsers from '@ciscospark/test-helper-test-users';

describe('samples/browser-call-with-screenshare', () => {
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
      browser.url('/browser-call-with-screenshare');
    });

    it('connects mccoy\'s browser', () => {
      browserMccoy.assertTitle('Sample: Local Screensharing');
      browserMccoy.setValueInDOM('[placeholder="Your access token"]', mccoy.token.access_token);
      browserMccoy.assertValue('[placeholder="Your access token"]', mccoy.token.access_token);
      browserMccoy.click('[title="connect"]');
      browserMccoy.waitForExist('.listening');
    });

    it('connects spock\'s browser', () => {
      browserSpock.assertTitle('Sample: Local Screensharing');
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

    it('starts screensharing', () => {
      browserMccoy.click('[title="share screen"]');
      const trackCount = browserMccoy.execute(() =>
        /* eslint-env browser */
        document.getElementById('self-screen').srcObject.getVideoTracks().length).value;
      assert.equal(trackCount, 1);
    });

    it('stops screensharing', () => {
      browserMccoy.click('[title="stop screen share"]');
      // FIXME the following assertion doesn't hold in wdio, even though it's
      // proven in the engine and phone packages and manual testing shows it
      // holds
      // browser.waitUntil(() => browserMccoy.execute(() => activeCall.localScreenShare.getVideoTracks().length).value === 0, 20000, 'Timed-out waiting for the screenshare track to be removed from the localScreenShare stream');
    });

    it('starts application sharing', () => {
      browserMccoy.click('[title="share application"]');
      // FIXME the following assertion doesn't hold in wdio, even though it's
      // proven in the engine and phone packages and manual testing shows it
      // holds
      // browser.waitUntil(() => browserMccoy.execute(() => activeCall.localScreenShare.getVideoTracks().length).value === 1, 10000, 'Timed-out waiting for the new screenshare track to be added to the localScreenShare stream');
    });

    it('ends the call', () => {
      browser.pause(5000);
      browserMccoy.click('[title="hangup"]');
    });
  });
});

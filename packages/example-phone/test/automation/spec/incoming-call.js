import createBrowser from '../lib/create-browser';
import testUsers from '@ciscospark/test-helper-test-users';
import pkg from '../../../package';

describe.skip(`example-phone`, () => {
  describe(`incoming-call`, () => {
    let browser, callee, caller;

    beforeEach(`create users`, () => testUsers.create({count: 2})
      .then(([u1, u2]) => {
        caller = u1;
        callee = u2;
      }));

    beforeEach(`create browser`, () => createBrowser(pkg, {
      name: `caller`
    })
      .then((b) => {browser = b;})
      .then(() => browser
        .loginWithLocalStorage(callee)
        .bdInit(caller)
        .clickOnTitle(`Link to Call Page`)));

    afterEach(`quit browser`, () => browser && browser.quit()
      .catch((reason) => {console.warn(reason);}));

    describe(`As an authenticated user`, () => {
      describe(`when there is an incoming call`, () => {
        it(`answers the call`, () => browser
          .bdPlaceCall(callee.email)
          .waitForElementByClassName(`alert`)
          .answerCall()
          .assertIsInCallWith(caller));

        it(`answers the call with audio-only`, () => browser
          .bdPlaceCall(callee.email)
          .clickOnTitle(`Answer Call with Audio`)
          .assertIsInCallWith(caller)
          .assertLocalAudioDirection(`sendrecv`)
          .assertLocalVideoDirection(`inactive`)
        );

        // FIXME seems broken
        it.skip(`answers the call with video-only`, () => browser
          .bdPlaceCall(callee.email)
          .clickOnTitle(`Answer Call with Video`)
          .assertIsInCallWith(caller)
          .assertLocalAudioDirection(`inactive`)
          .assertLocalVideoDirection(`sendrecv`)
        );

        it(`declines the call`);

        describe(`when the page is reloaded`, () => {
          it(`answers the incoming call`);
        });
      });
    });
  });
});

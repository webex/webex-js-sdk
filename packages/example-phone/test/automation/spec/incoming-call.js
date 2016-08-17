import {createBrowser} from '@ciscospark/test-helper-automation';
import testUsers from '@ciscospark/test-helper-test-users';
import pkg from '../../../package.json';

describe(`example-phone`, () => {
  let browser, callee, caller;

  beforeEach(() => testUsers.create({count: 2})
    .then(([u1, u2]) => {
      caller = u1;
      callee = u2;
    }));

  beforeEach(() => createBrowser(pkg, {
    platform: `Linux`,
    browserName: `firefox`,
    version: `latest`,
    name: `caller`
  })
    .then((b) => {browser = b;})
    .then(() => browser
      .loginWithLocalStorage(callee)
      .bdInit(caller)
      .clickOnTitle(`Link to Call Page`)));

  afterEach(() => Promise.resolve(browser && browser.quit())
    .catch((reason) => {console.warn(reason);}));

  describe(`As an authenticated user`, () => {
    describe(`when there is an incoming call`, () => {
      // FIXME firefox is weird with vp8 vs h264
      it.skip(`answers the call`, () => browser
        .bdPlaceCall(callee.email)
        .waitForElementByClassName(`alert`)
        .answerCall()
        .assertIsInCallWith(caller));

      // FIXME firefox is weird with vp8 vs h264
      it.skip(`answers the call with audio only`, () => browser
        .bdPlaceCall(callee.email)
        .clickOnTitle(`Answer Call with Audio`)
        .assertIsInCallWith(caller)
        .assertLocalAudioDirection(`sendrecv`)
        .assertLocalVideoDirection(`inactive`)
      );

      // FIXME firefox is weird with vp8 vs h264
      it.skip(`answers the call with video only`, () => browser
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

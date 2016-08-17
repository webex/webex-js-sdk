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
      .loginWithLocalStorage(caller)
      .bdInit(callee)
      .clickOnTitle(`Link to Call Page`)));

  afterEach(() => Promise.resolve(browser && browser.quit())
    .catch((reason) => {console.warn(reason);}));

  afterEach(() => browser.bdDeinit()
    .catch((reason) => {console.warn(reason);}));

  describe(`As an authenticated user not in a call`, () => {
    // FIXME firefox is weird with vp8 vs h264
    it.skip(`starts a call`, () => browser
      .placeCall(callee.email)
      .bdAnswerCall()
      .assertIsInCallWith(callee));

    // FIXME firefox is weird with vp8 vs h264
    it.skip(`starts a call without audio then adds audio to the call`, () => browser
      .placeVideoOnlyCall(callee.email)
      .bdAnswerCall()
      .assertIsInCallWith(callee)
      .assertLocalAudioDirection(`inactive`)
      .assertLocalVideoDirection(`sendrecv`)
      .clickOnTitle(`Start sending audio`)
      .clickOnTitle(`Start receiving audio`)
      .assertLocalAudioDirection(`sendrecv`)
      .assertLocalVideoDirection(`sendrecv`)
    );

    // FIXME firefox is weird with vp8 vs h264
    it.skip(`starts a call without video then adds video the call`, () => browser
      .placeAudioOnlyCall(callee.email)
      .bdAnswerCall()
      .assertIsInCallWith(callee)
      .assertLocalAudioDirection(`sendrecv`)
      .assertLocalVideoDirection(`inactive`)
      .clickOnTitle(`Start sending video`)
      .clickOnTitle(`Start receiving video`)
      .assertLocalAudioDirection(`sendrecv`)
      .assertLocalVideoDirection(`sendrecv`)
    );
  });

  describe(`As a user progressing through a call`, () => {
    it.skip(`sees the call status`, () => browser
      .placeCall(callee.email)
      .assertCallStatus(`initiated`)
      .assertCallStatus(`ringing`)
      .bdAnswerCall()
      .assertCallStatus(`connected`)
      .assertIsInCall()
      .bdEndCall()
      .assertCallStatus(`disconnected`));
  });

  describe(`As an authenticated user in a call`, () => {
    beforeEach(() => browser
      .placeCall(callee.email)
      .bdAnswerCall()
      .assertIsInCallWith(callee));

    // FIXME firefox is weird with vp8 vs h264
    it.skip(`ends the call`, () => browser
      .clickOnTitle(`Hang up`)
      .assertCallStatus(`disconnected`)
      .waitForElementNotPresent(`.remote-party-name`));

    // FIXME firefox is weird with vp8 vs h264
    it.skip(`toggles sending its audio`, () => browser
      .clickOnTitle(`Stop sending audio`)
      .assertLocalAudioDirection(`recvonly`)
      // FIXME reenable the next block once locus fixes #3939
      // .bdGet()
      //   .then((drone) => drone
      //     .waitForElementByCssSelector(`.remote-view .audio-direction`)
      //       .text()
      //         .should.eventually.equal(`sendonly`))
      .clickOnTitle(`Start sending audio`)
      .assertLocalAudioDirection(`sendrecv`)
      // FIXME reenable the next block once locus fixes #3939
      // .bdGet()
      //   .then((drone) => drone
      //     .waitForElementByCssSelector(`.remote-view .audio-direction`)
      //       .text()
      //         .should.eventually.equal(`sendrecv`))
      );

    // FIXME disabled for pipeline transition work
    it.skip(`toggles sending its video`, () => browser
      .clickOnTitle(`Stop sending video`)
      .assertLocalVideoDirection(`recvonly`)
      // FIXME reenable the next block once locus fixes #3939
      // .bdGet()
      //   .then((drone) => drone
      //     .waitForElementByCssSelector(`.remote-view .video-direction`)
      //       .text()
      //         .should.eventually.equal(`sendonly`))
      .clickOnTitle(`Start sending video`)
      .assertLocalVideoDirection(`sendrecv`)
      // FIXME reenable the next block once locus fixes #3939
      // .bdGet()
      //   .then((drone) => drone
      //     .waitForElementByCssSelector(`.remote-view .video-direction`)
      //       .text()
      //         .should.eventually.equal(`sendrecv`))
      );

    // FIXME enable this test once mozilla fixes
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1285009
    it.skip(`toggles receiving its audio`, () => browser
      .clickOnTitle(`Stop receiving audio`)
      .waitForElementByCssSelector(`.self-view .audio-direction`)
        .text()
          .should.eventually.equal(`sendonly`));

    // FIXME enable this test once mozilla fixes
    // https://bugzilla.mozilla.org/show_bug.cgi?id=1285009
    it.skip(`toggles receiving its video`, () => browser
      .clickOnTitle(`Stop receiving video`)
      .waitForElementByCssSelector(`.self-view .video-direction`)
        .text()
          .should.eventually.equal(`recvonly`));
  });

  describe(`As an authenticated user that completed a call`, () => {
    beforeEach(() => browser
      .placeCall(callee.email)
      .bdAnswerCall()
      .waitForElementByClassName(`remote-party-name`)
        .text()
          .should.eventually.equal(callee.name)
      .endCall());

    it.skip(`rates the call`, () => browser
      .rateCall({
        score: 5,
        feedback: `Just the greatest`,
        includeLogs: false
      })
      .waitForElementNotPresent(`.rate-call-dialog`));

    it.skip(`chooses not to rate the call`, () => browser
      .clickOnTitle(`Skip`)
      .waitForElementNotPresent(`.rate-call-dialog`));
  });
});

import {createBrowser} from '@ciscospark/test-helper-automation';
import testUsers from '@ciscospark/test-helper-test-users';
import pkg from '../../../package.json';

describe(`active call`, () => {
  let browser, callee, caller;

  before(() => testUsers.create({count: 2})
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
      .setImplicitWaitTimeout(20000)
      .bdInit(callee)
      .clickOnTitle(`Link to Call Page`)));

  afterEach(() => Promise.resolve(browser && browser.quit())
    .catch((reason) => {console.warn(reason);}));

  afterEach(() => browser.bdDeinit()
    .catch((reason) => {console.warn(reason);}));

  describe(`As an authenticated user not in a call`, () => {
    it(`starts a call`, () => browser
      .placeCall(callee.email)
      .bdAnswerCall()
      .waitForElementByClassName(`remote-party-name`)
        .text()
          .should.eventually.equal(callee.name));

    it.skip(`starts a call without audio`, () => browser
      .placeAudioOnlyCall(callee.email)
      .bdAnswerCall()
      .waitForElementByClassName(`remote-party-name`)
        .text()
          .should.eventually.equal(callee.name)
      .bdGet()
        .then((drone) => drone
          .waitForElementByCssSelector(`.remote-media-status .video-status`)
            .text()
              .should.eventually.equal(`inactive`)));

    it.skip(`starts a call without video`, () => browser
      .placeVideoOnlyCall(callee.email)
      .bdAnswerCall()
      .waitForElementByClassName(`remote-party-name`)
        .text()
          .should.eventually.equal(callee.name)
      .bdGet()
        .then((drone) => drone
          .waitForElementByCssSelector(`.remote-media-status .audio-status`)
            .text()
              .should.eventually.equal(`inactive`)));
  });

  describe(`As a user progressing through a call`, () => {
    it.skip(`sees the call status`, () => browser
      .placeCall(callee.email)
      .waitForElementByClassName(`call-status`)
        .text()
          .should.eventually.become(`initiated`)
      .waitForElementByClassName(`call-status`)
        .text()
          .should.eventually.become(`ringing`)
      .bdAnswerCall()
      .waitForElementByClassName(`call-status`)
        .text()
          .should.eventually.become(`connected`)
      .bdEndCall()
      .waitForElementByClassName(`call-status`)
        .text()
          .should.eventually.become(`disconnected`));
  });

  describe(`As an authenticated user in a call`, () => {
    beforeEach(() => browser
      .placeCall(callee.email)
      .bdAnswerCall()
      .waitForElementByClassName(`remote-party-name`)
        .text()
          .should.eventually.equal(callee.name));

    it(`ends the call`, () => browser
      .clickOnTitle(`Hang up`)
      .waitForElementNotPresent(`.remote-party-name`));

    it.skip(`stops sending its audio`, () => browser
      .clickOnTitle(`Stop sending audio`)
      .bdGet()
        .then((drone) => drone
          .waitForElementByCssSelector(`.remote-media-status .audio-status`)
            .text()
              .should.eventually.equal(`recvonly`)));

    it.skip(`stops sending its video`, () => browser
      .clickOnTitle(`Stop sending video`)
      .bdGet()
        .then((drone) => drone
          .waitForElementByCssSelector(`.remote-media-status .video-status`)
            .text()
              .should.eventually.equal(`recvonly`)));

    it.skip(`stops receiving audio`, () => browser
      .clickOnTitle(`Stop receiving audio`)
      .bdGet()
        .then((drone) => drone
          .waitForElementByCssSelector(`.remote-media-status .video-status`)
            .text()
              .should.eventually.equal(`sendonly`)));

    it.skip(`stops receiving video`, () => browser
      .clickOnTitle(`Stop receiving video`)
      .bdGet()
        .then((drone) => drone
          .waitForElementByCssSelector(`.remote-media-status .video-status`)
            .text()
              .should.eventually.equal(`sendonly`)));
  });

  describe.skip(`As an authenticated user that completed a call`, () => {
    beforeEach(() => browser
      .placeCall(callee.email)
      .bdAnswerCall()
      .waitForElementByClassName(`remote-party-name`)
        .text()
          .should.eventually.equal(callee.name)
      .endCall());

    it(`rates the call`, () => browser
      .rateCall({
        score: 5,
        feedback: `Just the greatest`,
        includeLogs: false
      })
      .waitForElementNotPresent(`.rate-call-dialog`));

    it(`chooses not to rate the call`, () => browser
      .clickOnTitle(`Skip`)
      .waitForElementNotPresent(`.rate-call-dialog`));
  });
});

import {createBrowser} from '@ciscospark/test-helper-automation';
import testUsers from '@ciscospark/test-helper-test-users';
import pkg from '../../../package.json';

describe.skip(`incoming calls`, () => {
  let browser, user;

  before(() => testUsers.create({count: 1})
    .then((users) => {user = users[0];}));

  beforeEach(() => createBrowser(pkg, {
    platform: `Linux`,
    browserName: `firefox`,
    version: `latest`
  })
    .then((b) => {browser = b;})
    .then(() => browser.loginWithLocalStorage(user)));

  afterEach(() => Promise.resolve(browser && browser.quit())
    .catch((reason) => {console.warn(reason);}));

  describe(`As an authenticated user`, () => {
    describe(`when there is an incoming call`, () => {
      it(`answers the call`, () => browser
        .setWindowSize(1024, 768)
        .setImplicitWaitTimeout(30000)
        .setDroneUser(user)
        .clickOnTitle(`Link to Call Page`)
        .createDrone(`oneOnOneCall`, user, {callDuration: 30})
        .clickOnTitle(`Answer Call`)
        .getDrone(`oneOnOneCall`)
          .then((drone) => browser
            .waitForElementByClassName(`remote-party-name`)
              .text()
                .should.eventually.equal(drone.drones[0].participant_display_name))
        .clickOnTitle(`Hang Up`)
        .waitForElementByCssSelector(`[title="Enter your feedback (optional)"]`));

      it(`declines the call`, () => browser
        .setWindowSize(1024, 768)
        .setImplicitWaitTimeout(30000)
        .setDroneUser(user)
        .clickOnTitle(`Link to Call Page`)
        .createDrone(`oneOnOneCall`, user, {callDuration: 30})
        .clickOnTitle(`Decline Call`)
        .hasElementByCssSelector(`[title="Decline Call"]`)
          .should.eventually.equal(false));

      describe(`when the page is reloaded`, () => {
        it(`answers the incoming call`, () => browser
          .setWindowSize(1024, 768)
          .setImplicitWaitTimeout(30000)
          .setDroneUser(user)
          .clickOnTitle(`Link to Call Page`)
          .createDrone(`oneOnOneCall`, user, {callDuration: 30})
          .getMainPage()
          .clickOnTitle(`Link to Call Page`)
          .clickOnTitle(`Answer Call`)
          .getDrone(`oneOnOneCall`)
            .then((drone) => browser
              .waitForElementByClassName(`remote-party-name`)
                .text()
                  .should.eventually.equal(drone.drones[0].participant_display_name))
          .clickOnTitle(`Hang Up`)
          .waitForElementByCssSelector(`[title="Enter your feedback (optional)"]`));
      });
    });
  });
});

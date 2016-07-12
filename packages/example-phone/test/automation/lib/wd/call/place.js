import {wd} from '@ciscospark/test-helper-automation';

wd.addPromiseChainMethod(`placeCall`, function(dialString) {
  return this
    .waitForElementByCssSelector(`[title="Enter email address"]`)
      .sendKeys(dialString)
    .clickOnTitle(`Dial`);
});

wd.addPromiseChainMethod(`placeAudioOnlyCall`, function(dialString) {
  return this
    .waitForElementByCssSelector(`[title="Enter email address"]`)
      .sendKeys(dialString)
    .clickOnTitle(`Dial (Audio Only)`);
});

wd.addPromiseChainMethod(`placeVideoOnlyCall`, function(dialString) {
  return this
    .waitForElementByCssSelector(`[title="Enter email address"]`)
      .sendKeys(dialString)
    .clickOnTitle(`Dial (Video Only)`);
});

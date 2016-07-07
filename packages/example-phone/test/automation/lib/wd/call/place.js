import {wd} from '@ciscospark/test-helper-automation';

wd.addPromiseChainMethod(`placeCall`, function(dialString) {
  return this
    .waitForElementByCssSelector(`[title="Enter email address"]`)
      .sendKeys(dialString)
    .clickOnTitle(`Dial`);
});

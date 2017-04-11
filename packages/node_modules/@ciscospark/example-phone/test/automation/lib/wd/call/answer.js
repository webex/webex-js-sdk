import {wd} from '@ciscospark/test-helper-automation';

wd.addPromiseChainMethod(`answerCall`, function() {
  return this
    .clickOnTitle(`Answer Call`);
});

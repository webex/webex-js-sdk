import {wd} from '@ciscospark/test-helper-automation';

wd.addPromiseChainMethod(`endCall`, function() {
  return this
    .clickOnTitle(`Hang Up`);
});

import {wd} from '@ciscospark/test-helper-automation';

wd.addPromiseChainMethod(`declineCall`, function() {
  return this
    .clickOnTitle(`Decline Call`);
});

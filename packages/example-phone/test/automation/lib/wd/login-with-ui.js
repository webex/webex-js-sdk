/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 */

import {wd} from '@ciscospark/test-helper-automation';

wd.addPromiseChainMethod(`loginWithUI`, function(user) {
  return this
    .getMainPage()
    .clickOnTitle(`Link to Auth Page`)
    .clickOnTitle(`Login with UI`)
    .login(user)
    .waitForElementByClassName(`ready`);
});

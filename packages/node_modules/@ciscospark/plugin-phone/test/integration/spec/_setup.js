/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {Call} from '../..';
import sinon from '@ciscospark/test-helper-sinon';
import {maxWaitForPromise} from '@ciscospark/test-helper-mocha';

beforeEach(() => {
  sinon.spy(Call, `make`);
});

afterEach(`end all calls`, function() {
  this.timeout(30000);
  const promises = Call.make.returnValues.map((c) => maxWaitForPromise(2000, c.spark.canAuthorize && c.spark.device.url && c.hangup())
    .catch((reason) => console.warn(reason)));

  Call.make.restore();

  return Promise.all(promises);
});

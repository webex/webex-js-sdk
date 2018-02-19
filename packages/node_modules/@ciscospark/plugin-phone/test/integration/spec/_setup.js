/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

// Too much stuff can go wrong with during call cleanup, so it's really helpful
// to log what it's doing
/* eslint-disable no-console */

import {Call} from '@ciscospark/plugin-phone';
import sinon from '@ciscospark/test-helper-sinon';
import {maxWaitForPromise} from '@ciscospark/test-helper-mocha';

beforeEach(() => {
  sinon.spy(Call, 'make');
});

afterEach('end all calls', function () {
  if (!Call.make.restore) {
    return Promise.resolve();
  }
  return Promise.resolve()
    .then(() => {
      console.log('ending all calls started by this test');
      this.timeout(30000);
      const promises = Call.make.returnValues && Call.make.returnValues.map((c) => {
        console.log(`ending call ${c.internalCallId}`);
        if (c.spark.canAuthorize && c.spark.internal.device.url) {
          // We need to stop listening to events, otherwise this function gets
          // weird, unexplained errors on nextTick.
          c.off();
          return maxWaitForPromise(2000, c.hangup())
            .then(() => console.log(`ended call ${c.internalCallId}`))
            .catch((reason) => console.warn(reason.toString()));
        }

        console.log(`can't end call ${c.internalCallId}, so attempting to brick it`);
        return maxWaitForPromise(2000, c.cleanup());
      });

      Call.make.restore();

      return maxWaitForPromise(15000, Promise.all(promises))
        .then(() => console.log('done ending calls'))
        .catch((reason) => console.warn(reason.stack || reason.toString()));
    })
    .catch((err) => {
      console.warn('something went wrong in the phone plugin afterEach hook');
      console.warn(err);
    });
});

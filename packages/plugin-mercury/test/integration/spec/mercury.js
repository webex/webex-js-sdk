/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '../..';

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';

describe(`plugin-mercury`, function() {
  this.timeout(30000);
  describe(`Mercury`, () => {
    let spark;

    beforeEach(() => testUsers.create({count: 1})
      .then((users) => {
        spark = new CiscoSpark({
          credentials: {
            authorization: users[0].token
          }
        });
      }));

    afterEach(() => spark && spark.mercury.disconnect());

    describe(`#connect()`, () => {
      it(`connects to mercury`, () => assert.isFulfilled(spark.mercury.connect()));
    });

    it(`emits messages that arrive before authorization completes`, () => {
      const spy = sinon.spy();
      spark.mercury.on(`event:mercury.buffer_state`, spy);
      return spark.mercury.connect()
        .then(() => {
          assert.calledOnce(spy);
        });
    });
  });
});

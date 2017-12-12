/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/internal-plugin-mercury';

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';

describe('plugin-mercury', function () {
  this.timeout(30000);

  let spark;

  beforeEach('create users', () => testUsers.create({count: 1})
    .then((users) => {
      spark = new CiscoSpark({
        credentials: {
          supertoken: users[0].token
        }
      });
      sinon.spy(spark.internal.mercury, 'disconnect');
      sinon.spy(spark.internal.device, 'unregister');
      return spark.internal.mercury.connect();
    }));

  describe('onBeforeLogout()', () => {
    it('disconnects the web socket', () => spark.logout({noRedirect: true})
      .then(() => {
        assert.called(spark.internal.mercury.disconnect);
        assert.isFalse(spark.internal.mercury.connected);
        assert.called(spark.internal.device.unregister);
        assert.isFalse(spark.internal.device.registered);
      }));
  });
});

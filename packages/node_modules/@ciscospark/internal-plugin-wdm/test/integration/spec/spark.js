/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/internal-plugin-wdm';

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';

describe('plugin-wdm', function () {
  this.timeout(30000);

  let spark;

  beforeEach('create users', () => testUsers.create({count: 1})
    .then((users) => {
      spark = new CiscoSpark({
        credentials: {
          supertoken: users[0].token
        }
      });
      sinon.spy(spark.internal.device, 'unregister');
      return spark.internal.device.register();
    }));

  describe('onBeforeLogout()', () => {
    it('unregisters the device', () => spark.logout({noRedirect: true})
      .then(() => {
        assert.called(spark.internal.device.unregister);
        assert.isFalse(spark.internal.device.registered);
      }));
  });
});

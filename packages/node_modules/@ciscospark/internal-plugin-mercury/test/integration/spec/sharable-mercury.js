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
  describe('Sharable Mercury', () => {
    let spark;

    beforeEach(() => testUsers.create({count: 1})
      .then((users) => {
        spark = new CiscoSpark({
          credentials: {
            supertoken: users[0].token
          }
        });
        return spark.internal.device.register()
          .then(() => spark.internal.feature.setFeature('developer', 'web-shared-mercury', true));
      }));

    afterEach(() => spark && spark.internal.mercury.disconnect());

    describe('#connect()', () => {
      it('connects to mercury', () => spark.internal.mercury.connect());
    });

    it('emits messages that arrive before authorization completes', () => {
      const spy1 = sinon.spy();
      const spy2 = sinon.spy();
      spark.internal.mercury.on('event:mercury.buffer_state', spy1);
      spark.internal.mercury.on('event:mercury.registration_status', spy2);
      return spark.internal.mercury.connect()
        .then(() => {
          assert.notCalled(spy1);
          assert.calledOnce(spy2);
          const data = spy2.args[0][0].data;
          assert.property(data, 'bufferState');
          assert.property(data, 'localClusterServiceUrls');

          assert.deepEqual(spark.internal.mercury.localClusterServiceUrls, data.localClusterServiceUrls);
        });
    });
  });
});

/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import testUsers from '@ciscospark/test-helper-test-users';
import CiscoSpark from 'ciscospark';

describe('ciscospark', function () {
  this.timeout(60000);
  describe('CiscoSpark', () => {
    describe('.init', () => {
      it('merges config correctly', () => {
        const spark = CiscoSpark.init({
          config: {
            credentials: {
              /* eslint-disable camelcase */
              client_id: 'id',
              client_secret: 'secret'
            }
          }
        });

        assert.equal(spark.config.credentials.client_id, 'id');
        assert.equal(spark.config.credentials.client_secret, 'secret');
      });

      it('produces an authorized sdk instance', () => testUsers.create({count: 1})
        .then(([user]) => {
          const spark = CiscoSpark.init({
            credentials: user.token
          });

          assert.isTrue(spark.canAuthorize);
          return spark.request({
            service: 'hydra',
            resource: '/build_info'
          });
        }));
    });
  });
});

/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import testUsers from '@webex/test-helper-test-users';
import Webex from 'webex';

describe('webex', function () {
  this.timeout(60000);
  describe('Webex', () => {
    describe('.init', () => {
      it('merges config correctly', () => {
        const webex = Webex.init({
          config: {
            credentials: {
              /* eslint-disable camelcase */
              client_id: 'id',
              client_secret: 'secret',
            },
          },
        });

        assert.equal(webex.config.credentials.client_id, 'id');
        assert.equal(webex.config.credentials.client_secret, 'secret');
      });

      it('produces an authorized sdk instance', () =>
        testUsers.create({count: 1}).then(([user]) => {
          const webex = Webex.init({
            credentials: user.token,
          });

          assert.isTrue(webex.canAuthorize);

          return webex.request({
            service: 'hydra',
            resource: '/build_info',
          });
        }));
    });
  });
});

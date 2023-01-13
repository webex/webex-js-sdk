/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {DryError} from '@webex/internal-plugin-encryption';
import {assert} from '@webex/test-helper-chai';
import {base64} from '@webex/common';
import WebexCore from '@webex/webex-core';
import testUsers from '@webex/test-helper-test-users';

describe('plugin-encryption', () => {
  let other, webex;

  before('create test user', () =>
    testUsers.create({count: 2}).then(([user, o]) => {
      other = o;
      console.log(o);
      webex = new WebexCore({
        credentials: {
          authorization: user.token,
        },
      });
      assert.isTrue(webex.isAuthenticated || webex.canAuthorize);
    })
  );

  before('register with wdm', () => webex.internal.device.register());

  describe('when a DRY response has an error', () => {
    it('decrypts the error message', () =>
      assert
        .isRejected(
          webex.request({
            method: 'POST',
            service: 'conversation',
            resource: 'conversations',
            body: {
              activities: {
                items: [
                  {
                    actor: {
                      objectType: 'person',
                      id: webex.internal.device.userId,
                    },
                    objectType: 'activity',
                    verb: 'create',
                  },
                  {
                    actor: {
                      objectType: 'person',
                      id: webex.internal.device.userId,
                    },
                    object: {
                      objectType: 'person',
                      id: webex.internal.device.userId,
                    },
                    objectType: 'activity',
                    verb: 'add',
                  },
                  {
                    actor: {
                      objectType: 'person',
                      id: webex.internal.device.userId,
                    },
                    object: {
                      objectType: 'person',
                      id: other.id,
                    },
                    objectType: 'activity',
                    verb: 'add',
                  },
                ],
              },
              defaultActivityEncryptionKeyUrl: 'kms://fakeuri',
              objectType: 'conversation',
              kmsMessage: {
                method: 'create',
                uri: '/resource',
                userIds: [webex.internal.device.userId, other.id],
                keyUris: ['kms://fakeuri'],
              },
            },
          })
        )
        .then((err) => {
          assert.statusCode(err, 400);
          assert.throws(() => {
            base64.decode(err.body.message.split('.')[0]);
          });
          assert.match(err.toString(), /POST .+\s/);
          assert.match(err.toString(), /WEBEX_TRACKING_ID: .+\s/);
          assert.match(err.toString(), /KMS_RESPONSE_STATUS: .+\s/);
          assert.match(err.toString(), /KMS_REQUEST_ID: .+/);
          assert.instanceOf(err, DryError);
        }));
  });
});

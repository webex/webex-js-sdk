/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';

import {transforms} from '@webex/internal-plugin-conversation/src/encryption-transforms';


describe('plugin-conversation', () => {
  describe('encryption transforms', () => {
    describe('encryptActivity()', () => {
      it('does not call transfom when created is True', () => {
        const transform = transforms.find((t) => t.name === 'encryptActivity');

        const ctx = {
          transform
        };
        const key = null;
        const activity = {
          object: {
            created: 'True'
          },
          objectType: 'activity',
          verb: 'update'
        };

        // should just resolve immediately and return nothing
        transform.fn(ctx, key, activity).then((result) => {
          assert.equal(undefined, result, 'should just return nothing');
        }).catch(() => {
          assert.equal(false, true, 'something unexpected happened');
        });
      });

      it('does transfom when created is not True', async () => {
        const transform = transforms.find((t) => t.name === 'encryptActivity');
        const transformStub = sinon.stub().resolves();

        const ctx = {
          transform: transformStub
        };
        const key = null;
        const activity = {
          object: {
            created: 'false'
          },
          objectType: 'activity',
          verb: 'update'
        };

        // should go through the promise chain and last thing called is prepareActivityKmsMessage
        await transform.fn(ctx, key, activity);
        assert.equal(transformStub.lastCall.args[0], 'prepareActivityKmsMessage', key, activity);
      });

      it('does not have key and has verb delete', async () => {
        const transform = transforms.find((t) => t.name === 'prepareActivityKmsMessage');

        const ctx = {
          transform
        };
        const key = null;
        const activity = {
          object: {
            created: 'false'
          },
          target: {
            defaultActivityEncryptionKeyUrl: 'fakeEncryptionKey',
            kmsResourceObjectUrl: 'meetingContainerKRO'
          },
          objectType: 'activity',
          verb: 'delete',
          kmsMessage: {
            uri: '<KRO>/authorizations?authId=123',
            method: 'delete'
          }
        };

        transform.fn(ctx, key, activity);

        assert.equal(activity.kmsMessage.uri, 'meetingContainerKRO/authorizations?authId=123', 'did not properly transform KRO for delete meeting container activity');
      });
    });
  });
});

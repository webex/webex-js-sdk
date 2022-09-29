/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import User from '@webex/internal-plugin-user';

describe('plugin-user', () => {
  describe('UserUUIDBatcher', () => {
    let batcher;
    let webex;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          user: User
        }
      });
      batcher = webex.internal.user.batcher.creator;
    });

    describe('#fingerprints', () => {
      const email = 'test@example.com';

      it('fingerprintRequest returns \'email\'', () => batcher.fingerprintRequest(email)
        .then((res) => assert.deepEqual(res, email)));
      it('fingerprintResponse returns \'email\'', () => batcher.fingerprintRequest({email})
        .then((res) => assert.deepEqual(res, email)));
    });

    describe('#submitHttpRequest()', () => {
      const email = 'test@example.com';
      const mockRequest = {
        method: 'POST',
        service: 'conversation',
        resource: '/users',
        body: email,
        qs: {
          shouldCreateUsers: true
        }
      };

      it('calls webex.request with expected params', () => {
        webex.request = function (options) {
          return Promise.resolve(options);
        };

        return batcher.submitHttpRequest(mockRequest.body)
          .then((req) => assert.deepEqual(req, mockRequest));
      });
    });

    describe('#handleHttpSuccess()', () => {
      const email = 'test@example.com';
      let failureSpy, successSpy;

      beforeEach(() => {
        successSpy = sinon.stub(batcher, 'handleItemSuccess');
        failureSpy = sinon.stub(batcher, 'handleItemFailure');
      });

      it('handles item success', () => {
        const mockResponse = {
          [email]: {
            id: '11111'
          }
        };

        return batcher.handleHttpSuccess({
          body: mockResponse
        })
          .then(() => {
            assert.calledWith(successSpy, email, mockResponse[email]);
          });
      });

      it('handles item failure', () => {
        const mockResponse = {
          [email]: {
            errorCode: 11111
          }
        };

        return batcher.handleHttpSuccess({
          body: mockResponse
        })
          .then(() => {
            assert.calledWith(failureSpy, email, mockResponse[email]);
          });
      });
    });
  });
});

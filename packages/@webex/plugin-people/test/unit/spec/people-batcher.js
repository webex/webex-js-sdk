/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import People from '@webex/plugin-people';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';

describe('people-batcher', () => {
  describe('PersonUUIDRequestBatcher', () => {
    let batcher;
    let webex;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          people: People,
        },
        config: {
          people: {showAllTypes: false},
        },
      });
      batcher = webex.people.batcher;
    });

    describe('#fingerprints', () => {
      it("fingerprintRequest returns encrypted 'hydraId'", () =>
        batcher
          .fingerprintRequest('hydraId')
          .then((result) =>
            assert.deepEqual(result, webex.people.inferPersonIdFromUuid('hydraId'))
          ));
    });

    describe('#submitHttpRequest()', () => {
      const ids = ['id1'];
      const mockRequest = {
        service: 'hydra',
        resource: `people/?id=${ids}&showAllTypes=false`,
      };

      it('calls webex.request with expected params', () => {
        webex.request = function (options) {
          return Promise.resolve(options);
        };

        return batcher.submitHttpRequest(ids).then((req) => assert.deepEqual(req, mockRequest));
      });
    });

    describe('#handleHttpSuccess()', () => {
      let failureSpy, successSpy;

      beforeEach(() => {
        successSpy = sinon.stub(batcher, 'handleItemSuccess');
        failureSpy = sinon.stub(batcher, 'handleItemFailure');
      });

      it('handles item success', () => {
        const mockResponse = {
          items: [
            {
              id: 'hydra1',
              displayName: 'name1',
            },
          ],
        };

        return batcher
          .handleHttpSuccess({
            body: mockResponse,
          })
          .then(() => {
            assert.calledWith(successSpy, 'hydra1', mockResponse.items[0]);
            assert.notCalled(failureSpy);
          });
      });

      it('handles item failure', () => {
        const mockResponse = {
          items: [
            {
              id: 'hydra1',
              displayName: 'name1',
            },
            {
              id: 'hydra2',
              displayName: 'name2',
            },
          ],
          notFoundIds: ['hydra3'],
        };

        return batcher
          .handleHttpSuccess({
            body: mockResponse,
          })
          .then(() => {
            assert.calledTwice(successSpy);
            assert.calledWith(failureSpy, 'hydra3');
          });
      });
    });
  });
});

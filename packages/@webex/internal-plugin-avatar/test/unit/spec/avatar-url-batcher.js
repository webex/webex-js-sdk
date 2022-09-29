/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import Avatar from '@webex/internal-plugin-avatar';
import MockWebex from '@webex/test-helper-mock-webex';

describe('plugin-avatar', () => {
  describe('AvatarUrlBatcher', () => {
    let batcher;
    let webex;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          avatar: Avatar
        }
      });
      batcher = webex.internal.avatar.batcher;
    });

    describe('#fingerprints', () => {
      it('fingerprintRequest returns \'uuid-size\'', () => batcher.fingerprintRequest({uuid: 'uuid1', size: 80})
        .then((result) => assert.deepEqual(result, 'uuid1-80')));
      it('fingerprintResponse returns \'uuid-size\'', () => batcher.fingerprintRequest({uuid: 'uuid1', size: 80})
        .then((result) => assert.deepEqual(result, 'uuid1-80')));
    });

    describe('#submitHttpRequest()', () => {
      const mockRequest = {
        method: 'POST',
        api: 'avatar',
        resource: 'profiles/urls',
        body: 'foo'
      };

      it('calls webex.request with expected params', () => {
        webex.request = function (options) {
          return Promise.resolve(options);
        };

        // webex.requestPromise = Promise.resolve(mockRequest);
        return batcher.submitHttpRequest(mockRequest.body)
          .then((req) => assert.deepEqual(req, mockRequest));
      });
    });

    describe('#didItemFail()', () => {
      let warn;
      let loggerWarned;

      beforeEach(() => {
        warn = batcher.logger.warn;
        loggerWarned = false;
        batcher.logger.warn = (msg) => {
          loggerWarned = (msg === 'Avatar: substituted size "256" for "80"');
        };
      });

      afterEach(() => {
        batcher.logger.warn = warn;
      });

      it('returns true if no response in item', () => batcher.didItemFail({})
        .then((res) => assert.isTrue(res)));

      it('returns false, warns reqested size does not equal response size', () => batcher.didItemFail({size: 80, response: {size: 256}})
        .then((res) => assert.isFalse(res && loggerWarned)));

      it('returns false no warning', () => batcher.didItemFail({size: 80, response: {size: 80}})
        .then((res) => assert.isFalse(res && !loggerWarned)));
    });
  });
});

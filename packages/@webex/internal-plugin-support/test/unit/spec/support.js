/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable no-underscore-dangle */

import Support from '@webex/internal-plugin-support';
import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';

describe('plugin-support', function () {
  this.timeout(20000);

  let webex;

  beforeEach(() => {
    webex = new MockWebex({
      children: {
        support: Support
      }
    });

    webex.internal.device.userId = 'user-abc-123';
    webex.internal.device.orgId = 'org-abc-123';
  });

  describe('#_constructFileMetadata()', () => {
    it('constructs a sample File Meta Data', () => {
      const result = webex.internal.support._constructFileMetadata({});

      assert.equal(result.length, 3);
      assert.deepEqual(result, [{
        key: 'trackingId',
        value: 'mock-webex_88888888-4444-4444-4444-aaaaaaaaaaaa'
      },
      {
        key: 'userId',
        value: webex.internal.device.userId
      },
      {
        key: 'orgId',
        value: webex.internal.device.orgId
      }]);
    });

    it('does not send sessionId key if sessionId is not defined', () => {
      webex.sessionId = null;

      const result = webex.internal.support._constructFileMetadata({});

      assert.isTrue(result.filter((r) => r.key === 'sessionId').length === 0);
    });

    it('does not send userID key if device userId is not defined', () => {
      webex.internal.device.userId = null;

      const result = webex.internal.support._constructFileMetadata({});

      assert.isTrue(result.filter((r) => r.key === 'userId').length === 0);
    });

    it('does not send orgId key if device orgId is not defined', () => {
      webex.internal.device.orgId = null;

      const result = webex.internal.support._constructFileMetadata({});

      assert.isTrue(result.filter((r) => r.key === 'orgId').length === 0);
    });
  });

  describe('#submitLogs()', () => {
    it('calls getUserToken', () => {
      webex.internal.support.submitLogs({});
      assert.calledOnce(webex.credentials.getUserToken);
    });
  });
});

/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MediaEncryptionService from '../../../../src/e2ee/MediaEncryptionService';

describe('plugin-meetings', () => {
  describe('MediaEncryptionService', () => {
    let webexRequest;
    let service;

    beforeEach(() => {
      webexRequest = sinon.stub().resolves({body: {result: 'ok', n: 1}});
      service = new MediaEncryptionService({webexRequest});
    });

    afterEach(() => {
      sinon.restore();
    });

    it('posts the request object to the media-encryption service and resolves with the response body', async () => {
      const requestBody = {op: 'join', epoch: 2};

      const result = await service.request('https://mes.webex.com/op', requestBody);

      assert.calledOnceWithExactly(webexRequest, {
        method: 'POST',
        service: 'media-encryption',
        url: 'https://mes.webex.com/op',
        body: requestBody,
      });
      assert.deepEqual(result, {result: 'ok', n: 1});
    });

    it('rejects when webex.request rejects', async () => {
      webexRequest.rejects(new Error('boom'));

      await assert.isRejected(service.request('https://mes.webex.com/op', {}), /boom/);
    });
  });
});

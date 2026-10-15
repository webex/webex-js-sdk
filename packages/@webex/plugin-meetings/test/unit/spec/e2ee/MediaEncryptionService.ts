/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import MediaEncryptionService from '@webex/plugin-meetings/src/e2ee/MediaEncryptionService';

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

    it('posts to the media-encryption service, decoding request and encoding response bytes', async () => {
      const requestBody = {op: 'join', epoch: 2};
      const bodyBytes = new TextEncoder().encode(JSON.stringify(requestBody));

      const result = await service.request('https://mes.webex.com/op', bodyBytes);

      assert.calledOnce(webexRequest);
      const args = webexRequest.firstCall.args[0];

      assert.equal(args.method, 'POST');
      assert.equal(args.service, 'media-encryption');
      assert.equal(args.url, 'https://mes.webex.com/op');
      assert.deepEqual(args.body, requestBody);

      assert.instanceOf(result, Uint8Array);
      assert.deepEqual(JSON.parse(new TextDecoder().decode(result)), {result: 'ok', n: 1});
    });

    it('rejects when webex.request rejects', async () => {
      webexRequest.rejects(new Error('boom'));

      await assert.isRejected(
        service.request('https://mes.webex.com/op', new TextEncoder().encode('{}')),
        /boom/
      );
    });
  });
});

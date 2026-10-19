/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import StaticAssetLoader from '@webex/plugin-meetings/src/common/static-asset-loader';

describe('plugin-meetings', () => {
  describe('StaticAssetLoader', () => {
    let webexRequestStub;

    beforeEach(() => {
      webexRequestStub = sinon.stub();
    });

    afterEach(() => {
      sinon.restore();
    });

    it('rejects a successful response with an HTML content type', async () => {
      webexRequestStub.resolves({
        statusCode: 200,
        headers: {'content-type': 'text/html; charset=utf-8'},
        body: new ArrayBuffer(0),
      });
      const loader = new StaticAssetLoader({webexRequest: webexRequestStub, baseUrl: '/assets/'});

      await assert.isRejected(
        loader.getBytes('some-big-binary-file.dat'),
        'Failed to fetch static asset /assets/some-big-binary-file.dat: unexpected HTML content type "text/html"'
      );
    });

    it('detects an HTML response even when it has a binary content type', async () => {
      const html = new TextEncoder().encode('\uFEFF \t<!doctype html><html>not found</html>');

      webexRequestStub.resolves({
        statusCode: 200,
        headers: {'content-type': 'application/octet-stream'},
        body: html.buffer,
      });
      const loader = new StaticAssetLoader({webexRequest: webexRequestStub, baseUrl: '/assets/'});

      await assert.isRejected(
        loader.getBytes('some-big-binary-file.dat'),
        'Failed to fetch static asset /assets/some-big-binary-file.dat: response body looks like an HTML document'
      );
    });

    it('returns bytes from a successful binary response', async () => {
      const bytes = new Uint8Array([0x30, 0x01, 0x00]);

      webexRequestStub.resolves({
        statusCode: 200,
        headers: {'content-type': 'application/octet-stream'},
        body: bytes.buffer,
      });
      const loader = new StaticAssetLoader({webexRequest: webexRequestStub, baseUrl: '/assets/'});

      assert.deepEqual(await loader.getBytes('some-big-binary-file.dat'), bytes);
    });
  });
});

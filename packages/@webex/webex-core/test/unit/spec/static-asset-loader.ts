/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import 'jsdom-global/register';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {StaticAssetLoader} from '@webex/webex-core';

describe('StaticAssetLoader', () => {
  let webexRequestStub: sinon.SinonStub;
  let webex: {request: sinon.SinonStub};

  beforeEach(() => {
    webexRequestStub = sinon.stub();
    webex = {request: webexRequestStub};
  });

  afterEach(() => {
    sinon.restore();
  });

  const createLoader = (baseUrl = '/assets/') =>
    new StaticAssetLoader({baseUrl}, {parent: webex});

  const resolveWith = (overrides: Record<string, any> = {}) => {
    webexRequestStub.resolves({
      statusCode: 200,
      headers: {'content-type': 'application/octet-stream'},
      body: new Uint8Array([0x01, 0x02, 0x03]).buffer,
      ...overrides,
    });
  };

  describe('getUrl', () => {
    it('joins the base url and asset name with a single slash', () => {
      assert.equal(createLoader('/assets/').getUrl('file.dat'), '/assets/file.dat');
    });

    it('strips leading slashes from the asset name', () => {
      assert.equal(createLoader('/assets/').getUrl('///file.dat'), '/assets/file.dat');
    });

    it('strips trailing slashes from the base url', () => {
      assert.equal(createLoader('/assets///').getUrl('file.dat'), '/assets/file.dat');
    });

    it('handles a base url without a trailing slash', () => {
      assert.equal(createLoader('/assets').getUrl('file.dat'), '/assets/file.dat');
    });
  });

  it('requests the resolved asset url as a binary GET without auth or custom headers', async () => {
    resolveWith();

    await createLoader('/assets/').getBytes('/some-big-binary-file.dat');

    sinon.assert.calledOnceWithExactly(webexRequestStub, {
      method: 'GET',
      uri: '/assets/some-big-binary-file.dat',
      responseType: 'buffer',
      addAuthHeader: false,
      headers: {
        trackingid: null,
        'spark-user-agent': null,
        'cisco-no-http-redirect': null,
      },
    });
  });

  it('rejects a successful response with an HTML content type', async () => {
    webexRequestStub.resolves({
      statusCode: 200,
      headers: {'content-type': 'text/html; charset=utf-8'},
      body: new ArrayBuffer(0),
    });
    const loader = new StaticAssetLoader({baseUrl: '/assets/'}, {parent: webex});

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
    const loader = new StaticAssetLoader({baseUrl: '/assets/'}, {parent: webex});

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
    const loader = new StaticAssetLoader({baseUrl: '/assets/'}, {parent: webex});

    assert.deepEqual(await loader.getBytes('some-big-binary-file.dat'), bytes);
  });

  it('rejects a response with an application/xhtml+xml content type', async () => {
    resolveWith({headers: {'content-type': 'application/xhtml+xml'}, body: new ArrayBuffer(0)});

    await assert.isRejected(
      createLoader().getBytes('some-big-binary-file.dat'),
      'Failed to fetch static asset /assets/some-big-binary-file.dat: unexpected HTML content type "application/xhtml+xml"'
    );
  });

  it('matches the HTML content type case-insensitively', async () => {
    resolveWith({headers: {'content-type': 'TEXT/HTML; charset=UTF-8'}, body: new ArrayBuffer(0)});

    await assert.isRejected(
      createLoader().getBytes('some-big-binary-file.dat'),
      'Failed to fetch static asset /assets/some-big-binary-file.dat: unexpected HTML content type "text/html"'
    );
  });

  it('returns bytes when the response has no content-type header', async () => {
    const bytes = new Uint8Array([0x10, 0x20, 0x30]);

    resolveWith({headers: {}, body: bytes.buffer});

    assert.deepEqual(await createLoader().getBytes('some-big-binary-file.dat'), bytes);
  });

  [199, 300, 404, 503].forEach((statusCode) => {
    it(`rejects a non-2xx (${statusCode}) response`, async () => {
      resolveWith({statusCode});

      await assert.isRejected(
        createLoader().getBytes('some-big-binary-file.dat'),
        `Failed to fetch static asset /assets/some-big-binary-file.dat: HTTP ${statusCode}`
      );
    });
  });

  it('accepts a response at the upper 2xx boundary', async () => {
    const bytes = new Uint8Array([0x0a, 0x0b]);

    resolveWith({statusCode: 299, body: bytes.buffer});

    assert.deepEqual(await createLoader().getBytes('some-big-binary-file.dat'), bytes);
  });

  it('extracts bytes from a typed-array body with a non-zero byte offset', async () => {
    const backing = new Uint8Array([0xaa, 0x01, 0x02, 0x03, 0xbb]);
    const view = new Uint8Array(backing.buffer, 1, 3);

    resolveWith({body: view});

    assert.deepEqual(
      await createLoader().getBytes('some-big-binary-file.dat'),
      new Uint8Array([0x01, 0x02, 0x03])
    );
  });

  it('rejects a response whose body is not binary data', async () => {
    resolveWith({body: 'not binary'});

    await assert.isRejected(
      createLoader().getBytes('some-big-binary-file.dat'),
      'Failed to fetch static asset /assets/some-big-binary-file.dat: response body is not binary data'
    );
  });

  it('shares a single request between concurrent and repeated callers', async () => {
    const bytes = new Uint8Array([0x05, 0x06, 0x07]);

    resolveWith({body: bytes.buffer});
    const loader = createLoader();

    const [first, second] = await Promise.all([
      loader.getBytes('some-big-binary-file.dat'),
      loader.getBytes('some-big-binary-file.dat'),
    ]);
    const third = await loader.getBytes('some-big-binary-file.dat');

    assert.deepEqual(first, bytes);
    assert.deepEqual(second, bytes);
    assert.deepEqual(third, bytes);
    sinon.assert.calledOnce(webexRequestStub);
  });

  it('evicts a failed request so a later call retries', async () => {
    const bytes = new Uint8Array([0x08, 0x09]);

    webexRequestStub.onFirstCall().rejects(new Error('network down'));
    webexRequestStub.onSecondCall().resolves({
      statusCode: 200,
      headers: {'content-type': 'application/octet-stream'},
      body: bytes.buffer,
    });
    const loader = createLoader();

    await assert.isRejected(loader.getBytes('some-big-binary-file.dat'), 'network down');
    assert.deepEqual(await loader.getBytes('some-big-binary-file.dat'), bytes);
    sinon.assert.calledTwice(webexRequestStub);
  });

  it('returns an isolated copy that cannot mutate the cached asset', async () => {
    resolveWith({body: new Uint8Array([0x01, 0x02, 0x03]).buffer});
    const loader = createLoader();

    const first = await loader.getBytes('some-big-binary-file.dat');
    first[0] = 0xff;
    const second = await loader.getBytes('some-big-binary-file.dat');

    assert.deepEqual(second, new Uint8Array([0x01, 0x02, 0x03]));
    sinon.assert.calledOnce(webexRequestStub);
  });
});

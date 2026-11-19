/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';

import addAssetDiagnostics from '../../../dist/lib/static-asset-diagnostics';

describe('static asset diagnostics', () => {
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers({now: 1050, toFake: ['Date']});
  });

  afterEach(() => sinon.restore());

  const diagnose = (body: unknown, overrides: Record<string, any> = {}) => {
    const error = addAssetDiagnostics(
      new Error('asset failed'),
      {statusCode: 200, body, headers: {'content-type': 'text/html'}, ...overrides},
      1000,
      'html'
    );

    return (error as any).assetDiagnostics;
  };

  it('retains bounded allowlisted headers and no request or response content', () => {
    const body = new TextEncoder().encode(
      '<html><body>Access denied: private@example.com</body></html>'
    );
    const result = diagnose(body.buffer, {
      headers: {
        'Content-Type': 'TEXT/HTML; charset=utf-8',
        server: 'CloudFront',
        via: '1.1 proxy.private.corp',
        'x-cache': 'Error from cloudfront',
        'x-amz-cf-id': 'request-id',
        'x-amz-cf-pop': 'IAD55-P1',
        'set-cookie': 'secret-cookie',
        authorization: 'secret-token',
        location: 'https://secret.example/?token=secret',
      },
    });

    const {htmlStructureHash, ...metadata} = result;

    assert.match(htmlStructureHash, /^[a-f0-9]{64}$/);
    assert.deepEqual(metadata, {
      failureKind: 'html',
      httpStatus: 200,
      durationMs: 50,
      responseBytes: body.byteLength,
      inspectedBytes: body.byteLength,
      responseContentType: 'text/html',
      responseServer: 'CloudFront',
      responseCache: 'Error from cloudfront',
      cdnRequestId: 'request-id',
      cdnPop: 'IAD55-P1',
      htmlKind: 'access-denied',
      htmlVendorHint: 'unknown',
    });
    assert.notInclude(JSON.stringify(result), 'private@example.com');
    assert.notInclude(JSON.stringify(result), 'secret');
    assert.notInclude(JSON.stringify(result), 'proxy.private.corp');
  });

  [
    ['zscaler', 'Zscaler'],
    ['netskope', 'Netskope'],
    ['umbrella', 'Cisco Umbrella'],
    ['forcepoint', 'Websense'],
    ['bluecoat', 'ProxySG'],
    ['unknown', 'Unrecognized gateway'],
  ].forEach(([hint, text]) => {
    it(`classifies the bounded ${hint} HTML vendor hint`, () => {
      assert.equal(diagnose(`<html><body>${text}</body></html>`).htmlVendorHint, hint);
    });
  });

  [
    {html: '<div id="root"></div>', kind: 'app-shell'},
    {html: '<main id="app"></main>', kind: 'app-shell'},
    {html: '<div id="reactRoot"></div>', kind: 'app-shell'},
    {html: '<html><body>Request blocked</body></html>', kind: 'access-denied'},
    {html: '<html><body>Unknown page</body></html>', kind: 'unknown'},
  ].forEach(({html, kind}) => {
    it(`classifies ${JSON.stringify(html)} as ${kind}`, () => {
      assert.equal(diagnose(html).htmlKind, kind);
    });
  });

  it('hashes tag structure independently of text, attributes, comments, scripts and styles', () => {
    const first = diagnose(
      '<html><body><p id="user-a">alice@example.com</p><!-- a --><script>tokenA</script><style>privateA</style></body></html>'
    );
    const second = diagnose(
      '<html><body><p id="user-b">bob@example.com</p><!-- b --><script>tokenB</script><style>privateB</style></body></html>'
    );
    const different = diagnose('<html><body><div>alice@example.com</div></body></html>');

    assert.equal(first.htmlStructureHash, second.htmlStructureHash);
    assert.notEqual(first.htmlStructureHash, different.htmlStructureHash);
  });

  it('does not treat HTML-looking attribute values as template structure', () => {
    const first = diagnose('<html><p data-private="<secret-one>">first</p></html>');
    const second = diagnose('<html><p data-private="<secret-two>">second</p></html>');

    assert.equal(first.htmlStructureHash, second.htmlStructureHash);
  });

  it('bounds UTF-8 inspection and honors typed-array offsets', () => {
    const html = new TextEncoder().encode(`<html><body>${'x'.repeat(9000)}Zscaler</body></html>`);
    const backing = new Uint8Array(html.length + 2);

    backing.set(html, 1);
    const result = diagnose(new DataView(backing.buffer, 1, html.length));

    assert.equal(result.responseBytes, html.length);
    assert.equal(result.inspectedBytes, 8192);
    assert.equal(result.htmlVendorHint, 'unknown');
  });

  it('bounds string inspection and does not invent its complete byte length', () => {
    const result = diagnose(`<html>${'é'.repeat(9000)}Netskope`);

    assert.equal(result.inspectedBytes, 8192);
    assert.notProperty(result, 'responseBytes');
    assert.equal(result.htmlVendorHint, 'unknown');
  });

  it('bounds and sanitizes header values and ignores non-string values', () => {
    const result = diagnose(undefined, {
      headers: {'content-type': 123, server: `CloudFront\r\n\u0000${'a'.repeat(300)}`, via: []},
    });

    assert.isAtMost(result.responseServer.length, 256);
    ['\r', '\n', '\u0000'].forEach((control) => assert.notInclude(result.responseServer, control));
    assert.notProperty(result, 'responseContentType');
    assert.notProperty(result, 'responseVia');
  });

  it('does not classify binary responses or infer absent headers', () => {
    assert.deepEqual(diagnose(new Uint8Array([1, 2, 3]), {headers: {}}), {
      failureKind: 'html',
      httpStatus: 200,
      durationMs: 50,
      responseBytes: 3,
      inspectedBytes: 3,
    });
  });

  it('does not hash missing HTML structure', () => {
    assert.notProperty(diagnose('plain error text'), 'htmlStructureHash');
  });

  [undefined, null, 0, {}, true].forEach((body) => {
    it(`omits unavailable body diagnostics for ${JSON.stringify(body)}`, () => {
      assert.deepEqual(diagnose(body, {headers: null}), {
        failureKind: 'html',
        httpStatus: 200,
        durationMs: 50,
      });
    });
  });

  it('uses HTTP rejection response context while preserving the original error identity', () => {
    const error = Object.assign(new Error('denied'), {
      statusCode: 403,
      headers: {'x-amz-cf-id': 'edge-id'},
      body: '<html>denied</html>',
    });
    const result = addAssetDiagnostics(error, undefined, 1000, 'network');

    assert.equal(result, error);
    assert.equal((result as any).assetDiagnostics.failureKind, 'http');
    assert.equal((result as any).assetDiagnostics.httpStatus, 403);
    assert.equal((result as any).assetDiagnostics.cdnRequestId, 'edge-id');
    assert.notProperty({...result}, 'assetDiagnostics');
  });

  [0, 99, 600, NaN, '403', undefined].forEach((statusCode) => {
    it(`does not invent an HTTP response from status ${String(statusCode)}`, () => {
      const error = addAssetDiagnostics({statusCode}, undefined, 1000, 'network');

      assert.deepEqual((error as any).assetDiagnostics, {
        failureKind: 'network',
        httpStatus: 0,
        durationMs: 50,
      });
    });
  });

  it('wraps a frozen HTTP error without masking its message, status or request options', () => {
    const options = {uri: '/assets/roots.p7b'};
    const reason = Object.freeze(
      Object.assign(new Error('original error'), {statusCode: 403, options})
    );
    const result = addAssetDiagnostics(reason, undefined, 1000, 'network');

    assert.notEqual(result, reason);
    assert.equal(result.message, 'original error');
    assert.equal((result as any).statusCode, 403);
    assert.equal((result as any).options, options);
  });

  [
    {reason: 'connection closed', message: 'connection closed'},
    {reason: {message: 'plain rejection'}, message: 'plain rejection'},
    {reason: undefined, message: 'Unknown asset download error'},
    {reason: 123, message: 'Unknown asset download error'},
  ].forEach(({reason, message}) => {
    it(`normalizes ${JSON.stringify(reason)} without serializing arbitrary objects`, () => {
      assert.equal(addAssetDiagnostics(reason, undefined, 1000, 'network').message, message);
    });
  });

  it('clamps a backwards clock to zero duration', () => {
    clock.setSystemTime(900);
    assert.equal(diagnose(undefined).durationMs, 0);
  });
});

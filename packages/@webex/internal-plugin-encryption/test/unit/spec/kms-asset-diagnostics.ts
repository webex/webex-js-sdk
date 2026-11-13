/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';

import {getAssetFailureDiagnostics, getKmsFailureReason} from '../../../dist/kms-asset-diagnostics';

describe('KMS failure diagnostics', () => {
  const diagnostics = {
    failureKind: 'html',
    httpStatus: 200,
    durationMs: 15,
    responseBytes: 120,
    inspectedBytes: 120,
    responseContentType: 'text/html',
    responseServer: 'CloudFront',
    responseCache: 'Error from cloudfront',
    cdnRequestId: 'request-id',
    cdnPop: 'IAD55-P1',
    htmlKind: 'access-denied',
    htmlVendorHint: 'zscaler',
    htmlStructureHash: 'a'.repeat(64),
  };

  it('projects the complete allowlisted contract with identifiers as fields', () => {
    assert.deepEqual(getAssetFailureDiagnostics({assetDiagnostics: diagnostics}), {
      fields: {
        httpStatus: 200,
        durationMs: 15,
        responseBytes: 120,
        inspectedBytes: 120,
        responseContentType: 'text/html',
        responseServer: 'CloudFront',
        responseCache: 'Error from cloudfront',
        cdnRequestId: 'request-id',
        cdnPop: 'IAD55-P1',
        htmlStructureHash: 'a'.repeat(64),
      },
      tags: {failureKind: 'html', htmlKind: 'access-denied', htmlVendorHint: 'zscaler'},
    });
  });

  it('drops arbitrary properties, raw content and headers', () => {
    assert.deepEqual(
      getAssetFailureDiagnostics({
        assetDiagnostics: {
          failureKind: 'network',
          httpStatus: 0,
          durationMs: 0,
          body: '<html>secret@example.com</html>',
          title: 'private title',
          headers: {authorization: 'token'},
          url: 'https://private.example/?token=secret',
          extra: 'secret',
          responseVia: '1.1 proxy.private.corp',
        },
      }),
      {fields: {httpStatus: 0, durationMs: 0}, tags: {failureKind: 'network'}}
    );
  });

  [undefined, null, 'error', {}, {assetDiagnostics: null}, {assetDiagnostics: false}].forEach(
    (reason) => {
      it(`does not invent diagnostics for ${JSON.stringify(reason)}`, () => {
        assert.deepEqual(getAssetFailureDiagnostics(reason), {fields: {}, tags: {}});
      });
    }
  );

  [-1, Infinity, NaN, '200', null].forEach((invalid) => {
    it(`rejects nonnumeric or negative numeric metadata ${String(invalid)}`, () => {
      assert.deepEqual(
        getAssetFailureDiagnostics({
          assetDiagnostics: {
            httpStatus: invalid,
            durationMs: invalid,
            responseBytes: invalid,
            inspectedBytes: invalid,
          },
        }),
        {fields: {}, tags: {}}
      );
    });
  });

  it('rejects unknown or malformed tag values and empty fields', () => {
    assert.deepEqual(
      getAssetFailureDiagnostics({
        assetDiagnostics: {
          failureKind: 'secret',
          htmlKind: 'someone@example.com',
          htmlVendorHint: 123,
          responseServer: '',
          responseVia: '  ',
          cdnRequestId: false,
          responseContentType: '\u0000\r\n',
        },
      }),
      {fields: {}, tags: {}}
    );
  });

  it('bounds and sanitizes permitted string fields', () => {
    assert.deepEqual(
      getAssetFailureDiagnostics({
        assetDiagnostics: {
          responseServer: 'a'.repeat(300),
          responseCache: 'edge\r\n\u0000',
        },
      }),
      {fields: {responseServer: 'a'.repeat(256), responseCache: 'edge'}, tags: {}}
    );
  });

  [
    {reason: new Error('certificate rejected'), expected: 'certificate rejected'},
    {reason: 'string rejection', expected: 'string rejection'},
    {reason: {message: 'plain rejection'}, expected: 'plain rejection'},
    {reason: {message: '', resultMessage: 'chain rejected'}, expected: 'chain rejected'},
    {reason: {message: 1, errorMessage: 'crypto rejected'}, expected: 'crypto rejected'},
    {reason: undefined, expected: 'Unknown KMS certificate validation failure'},
    {reason: null, expected: 'Unknown KMS certificate validation failure'},
    {reason: {}, expected: 'Unknown KMS certificate validation failure'},
    {reason: '', expected: 'Unknown KMS certificate validation failure'},
    {reason: '  ', expected: 'Unknown KMS certificate validation failure'},
    {reason: `${' '.repeat(600)}rejected`, expected: 'rejected'},
  ].forEach(({reason, expected}) => {
    it(`normalizes a certificate reason to ${expected}`, () => {
      assert.equal(getKmsFailureReason(reason), expected);
    });
  });

  it('bounds certificate error messages', () => {
    assert.equal(getKmsFailureReason({message: 'a'.repeat(600)}), 'a'.repeat(512));
  });
});

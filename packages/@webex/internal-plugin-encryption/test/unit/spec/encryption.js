/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
/* eslint-disable no-underscore-dangle */
import Url from 'url';
import {EventEmitter} from 'events';

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import Encryption from '@webex/internal-plugin-encryption';

describe('internal-plugin-encryption', () => {
  describe('download', () => {
    let webex;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          encryption: Encryption,
        },
      });
    });

    describe('file download headers', () => {
      const fileUrl = 'https://example.com/encrypted-file';
      const downloadUrl = 'https://storage.example.com/encrypted-file';
      const headers = Object.freeze({Authorization: 'Bearer download-token', 'X-File-Version': '1'});
      const scr = {};
      const encryptedBytes = Buffer.from('encrypted file');
      const decryptedBytes = Buffer.from('decrypted file');
      let request;
      let decryptBinary;
      let downloadEvents;

      beforeEach(() => {
        downloadEvents = new EventEmitter();
        request = sinon.stub(webex.internal.encryption, 'request').callsFake((options) => {
          if (options.method === 'POST') {
            return Promise.resolve({body: {endpoints: {[fileUrl]: downloadUrl}}});
          }

          options.download = downloadEvents;

          return Promise.resolve({body: encryptedBytes});
        });
        decryptBinary = sinon.stub(webex.internal.encryption, 'decryptBinary').resolves(decryptedBytes);
      });

      afterEach(() => {
        sinon.restore();
      });

      ['Authorization', 'authorization', 'AUTHORIZATION', 'aUtHoRiZaTiOn'].forEach((headerName) => {
        it(`should allow ${headerName} and ignore other supplied download headers`, async () => {
          const inputHeaders = Object.freeze({[headerName]: 'Bearer download-token', 'X-File-Version': '1'});
          request.callsFake((options) => {
            options.headers['X-Request-Id'] = 'request-id';
            options.download = downloadEvents;

            return Promise.resolve({body: encryptedBytes});
          });

          const result = await webex.internal.encryption.download(fileUrl, scr, {
            useFileService: false,
            headers: inputHeaders,
          });

          assert.calledOnceWithExactly(request, {
            method: 'GET',
            uri: fileUrl,
            responseType: 'buffer',
            headers: {authorization: 'Bearer download-token', 'X-Request-Id': 'request-id'},
            download: downloadEvents,
          });
          assert.calledOnceWithExactly(decryptBinary, scr, encryptedBytes);
          assert.strictEqual(result, decryptedBytes);
          assert.notProperty(inputHeaders, 'X-Request-Id');
        });
      });

      it('should send custom headers only to the resolved file download URL', async () => {
        await webex.internal.encryption.download(fileUrl, scr, {
          useFileService: true,
          headers,
        });

        assert.calledTwice(request);
        assert.deepEqual(request.firstCall.args, [{
          method: 'POST',
          uri: 'https://example.com/v1/download/endpoints',
          body: {endpoints: [fileUrl]},
        }]);
        assert.deepEqual(request.secondCall.args, [{
          method: 'GET',
          uri: downloadUrl,
          responseType: 'buffer',
          headers: {authorization: 'Bearer download-token'},
          download: downloadEvents,
        }]);
        assert.calledOnceWithExactly(decryptBinary, scr, encryptedBytes);
      });

      it('should ignore supplied headers when none are allowed', async () => {
        await webex.internal.encryption.download(fileUrl, scr, {
          useFileService: false,
          headers: {'X-Api-Key': 'test-value', Cookie: 'test-cookie'},
        });

        assert.calledOnceWithExactly(request, {
          method: 'GET',
          uri: fileUrl,
          responseType: 'buffer',
          headers: {},
          download: downloadEvents,
        });
      });

      it('should download a presigned URL without custom headers', async () => {
        const result = await webex.internal.encryption.download(fileUrl, scr);

        assert.deepEqual(request.secondCall.args, [{
          method: 'GET',
          uri: downloadUrl,
          responseType: 'buffer',
          headers: {},
          download: downloadEvents,
        }]);
        assert.strictEqual(result, decryptedBytes);
      });

      it('should reject direct HTTP URLs before sending headers', async () => {
        await assert.isRejected(
          webex.internal.encryption.download('http://example.com/encrypted-file', scr, {
            useFileService: false,
            headers,
          }),
          'Direct file URLs must use HTTPS'
        );

        assert.notCalled(request);
        assert.notCalled(decryptBinary);
      });

      [401, 403].forEach((statusCode) => {
        it(`should propagate a ${statusCode} download failure without decrypting`, async () => {
          const error = Object.assign(new Error('Artifact access denied'), {statusCode});
          request.callsFake((options) => {
            options.download = downloadEvents;

            return Promise.reject(error);
          });

          const result = await assert.isRejected(
            webex.internal.encryption.download(fileUrl, scr, {useFileService: false, headers})
          );

          assert.strictEqual(result, error);
          assert.notCalled(decryptBinary);
        });
      });
    });

    describe('check _fetchDownloadUrl()', () => {
      const fileArray = [
        {
          url: 'https://files-api-intb1.ciscospark.com/v1/spaces/a0cba376-fc05-4b88-af4b-cfffa7465f9a/contents/1d3931e7-9e31-46bc-8084-d766a8f72c99/versions/5fa9caf87a98410aae49e0173856a974/bytes',
          options: undefined
        },
        {
          url: 'https://files-api-intb2.ciscospark.com/v1/spaces/a0cba376-fc05-4b88-af4b-cfffa7465f9a/contents/1d3931e7-9e31-46bc-8084-d766a8f72c99/versions/5fa9caf87a98410aae49e0173856a974/bytes',
          options: {params: {allow: false}}
        },
        {
          url: 'https://www.test-api.com/v1/spaces/test-path-name-space/contents/test-path-name-contents/versions/test-version/bytes',
          options: {useFileService: true}
        },
        {
          url: 'http://www.test-api.com/v1/spaces/test-path-name-space/contents/test-path-name-contents/versions/test-version/bytes',
          options: {useFileService: true, params: {allow: false}}
        },
      ];
      let spyStub;

      beforeEach(() => {
        const returnStub = (obj) => Promise.resolve(obj);

        spyStub = sinon.stub(webex.internal.encryption, 'request').callsFake(returnStub);

        fileArray.forEach((file) => webex.internal.encryption._fetchDownloadUrl(file.url, file.options));
      });

      it('verifying file service uris', () => {
        assert.equal(
          spyStub.args[0][0].uri,
          'https://files-api-intb1.ciscospark.com/v1/download/endpoints'
        );
        assert.equal(
          spyStub.args[1][0].uri,
          'https://files-api-intb2.ciscospark.com/v1/download/endpoints'
        );
        assert.equal(spyStub.args[2][0].uri, 'https://www.test-api.com/v1/download/endpoints');
        assert.equal(spyStub.args[3][0].uri, 'https://www.test-api.com/v1/download/endpoints');
      });

      it('verifying https', () => {
        assert.equal(Url.parse(spyStub.args[0][0].uri).protocol, 'https:');
        assert.equal(Url.parse(spyStub.args[1][0].uri).protocol, 'https:');
        assert.equal(Url.parse(spyStub.args[2][0].uri).protocol, 'https:');
        assert.equal(Url.parse(spyStub.args[3][0].uri).protocol, 'https:');
      });

      it('verifying endpoints', () => {
        assert.equal(spyStub.args[0][0].body.endpoints[0], fileArray[0].url);
        assert.equal(spyStub.args[1][0].body.endpoints[0], fileArray[1].url);
        assert.equal(spyStub.args[2][0].body.endpoints[0], fileArray[2].url);
        assert.equal(spyStub.args[3][0].body.endpoints[0], fileArray[3].url);
      });

      afterEach(() => {
        spyStub.resetHistory();
      });
    });
  });

  describe('decryptBinaryData', () => {
    let webex;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          encryption: Encryption,
        },
      });
    });

    describe('check decryptBinaryData()', () => {
      const testKey = 'https://kms.example.com/keys/test-key-id';
      const testJWE = 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..test.encrypted.data';
      const testOptions = {onBehalfOf: 'test-user-uuid'};
      const mockJwk = {kty: 'oct', k: 'test-key-material'};
      const mockKey = {jwk: mockJwk};
      const mockDecryptedResult = {payload: Buffer.from('decrypted binary data')};
      let getKeyStub;
      let joseDecryptStub;

      beforeEach(() => {
        getKeyStub = sinon.stub(webex.internal.encryption, 'getKey').resolves(mockKey);
        
        // Mock the jose.JWE.createDecrypt chain
        const mockDecryptor = {
          decrypt: sinon.stub().resolves(mockDecryptedResult)
        };
        joseDecryptStub = sinon.stub(require('node-jose').JWE, 'createDecrypt').returns(mockDecryptor);
      });

      it('should call getKey and jose.JWE.createDecrypt with correct parameters', async () => {
        await webex.internal.encryption.decryptBinaryData(testKey, testJWE, testOptions);
        
        assert.equal(getKeyStub.calledOnce, true);
        assert.equal(getKeyStub.args[0][0], testKey);
        assert.deepEqual(getKeyStub.args[0][1], testOptions);

        assert.equal(joseDecryptStub.calledOnce, true);
        assert.equal(joseDecryptStub.args[0][0], mockJwk);
      });

      it('should call decrypt with ciphertext', async () => {
        await webex.internal.encryption.decryptBinaryData(testKey, testJWE, testOptions);
        
        const mockDecryptor = joseDecryptStub.returnValues[0];
        assert.equal(mockDecryptor.decrypt.calledOnce, true);
        assert.equal(mockDecryptor.decrypt.args[0][0], testJWE);
      });

      it('should return the payload buffer', async () => {
        const result = await webex.internal.encryption.decryptBinaryData(testKey, testJWE, testOptions);
        
        assert.equal(result, mockDecryptedResult.payload);
        assert.equal(Buffer.isBuffer(result), true);
      });

      it('should work without options parameter', async () => {
        await webex.internal.encryption.decryptBinaryData(testKey, testJWE);
        
        assert.equal(getKeyStub.calledOnce, true);
        assert.equal(getKeyStub.args[0][0], testKey);
        assert.equal(getKeyStub.args[0][1], undefined);
      });

      afterEach(() => {
        getKeyStub.restore();
        joseDecryptStub.restore();
      });
    });
  });

  describe('encryptBinaryData', () => {
    let webex;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          encryption: Encryption,
        },
      });
    });

    describe('check encryptBinaryData()', () => {
      const testKey = 'https://kms.example.com/keys/test-key-id';
      const testData = Buffer.from('binary data to encrypt');
      const testOptions = {onBehalfOf: 'test-user-uuid'};
      const mockJwk = {kty: 'oct', k: 'test-key-material'};
      const mockKey = {jwk: mockJwk};
      const mockEncryptedJWE = 'eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0..encrypted.data.here';
      let getKeyStub;
      let joseEncryptStub;
      let mockEncryptor;

      beforeEach(() => {
        getKeyStub = sinon.stub(webex.internal.encryption, 'getKey').resolves(mockKey);
        
        // Mock the jose.JWE.createEncrypt chain
        mockEncryptor = {
          final: sinon.stub().resolves(mockEncryptedJWE)
        };
        joseEncryptStub = sinon.stub(require('node-jose').JWE, 'createEncrypt').returns(mockEncryptor);
      });

      it('should call getKey and jose.JWE.createEncrypt with correct parameters', async () => {
        await webex.internal.encryption.encryptBinaryData(testKey, testData, testOptions);
        
        assert.equal(getKeyStub.calledOnce, true);
        assert.equal(getKeyStub.args[0][0], testKey);
        assert.deepEqual(getKeyStub.args[0][1], testOptions);

        assert.equal(joseEncryptStub.calledOnce, true);
        assert.deepEqual(joseEncryptStub.args[0][1], {
          key: mockJwk,
          header: {
            alg: 'dir',
          },
          reference: null,
        });
      });

      it('should call final with buffer', async () => {
        await webex.internal.encryption.encryptBinaryData(testKey, testData, testOptions);
        
        assert.equal(mockEncryptor.final.calledOnce, true);
        assert.equal(Buffer.isBuffer(mockEncryptor.final.args[0][0]), true);
      });

      it('should return the encrypted JWE string', async () => {
        const result = await webex.internal.encryption.encryptBinaryData(testKey, testData, testOptions);
        
        assert.equal(result, mockEncryptedJWE);
        assert.equal(typeof result, 'string');
      });

      it('should work without options parameter', async () => {
        await webex.internal.encryption.encryptBinaryData(testKey, testData);
        
        assert.equal(getKeyStub.calledOnce, true);
        assert.equal(getKeyStub.args[0][0], testKey);
        assert.equal(getKeyStub.args[0][1], undefined);
      });

      afterEach(() => {
        getKeyStub.restore();
        joseEncryptStub.restore();
      });
    });
  });
});

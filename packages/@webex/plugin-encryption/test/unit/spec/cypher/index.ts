import MockWebex from '@webex/test-helper-mock-webex';
import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {Buffer} from 'buffer';
import Cypher from '../../../../src/cypher';

import Encryption from '@webex/internal-plugin-encryption';

describe('Cypher', () => {
  let cypher: Cypher;
  let webex: any;

  beforeEach(() => {
    webex = new MockWebex({
      children: {
        cypher: Cypher,
        encryption: Encryption
      },
      logger: {
        log: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
      },
      credentials: {
        getOrgId: jest.fn(() => 'mockOrgId'),
      },
      once: jest.fn((event, callback) => callback()),
    });

    cypher = new Cypher({parent: webex});
    webex.cypher = cypher;

    webex.internal.encryption.decryptScr = jest.fn();
    webex.internal.encryption.download = jest.fn();
    webex.internal.device.register = jest.fn(() => Promise.resolve());
    webex.internal.device.unregister = jest.fn(() => Promise.resolve());
  });

  afterEach(() => {
    sinon.restore();
    jest.clearAllMocks();
  });

  describe('downloadAndDecryptFile', () => {
    const fileUri =
      'https://example.com/encrypted-file?JWE=eyJhbGci&keyUri=kms://example.com/keys/1234';
    const options = {useFileService: false};

    it('should throw an error if keyUri and JWE are not present in fileUri or options', async () => {
      await expect(
        cypher.downloadAndDecryptFile('https://example.com/encrypted-file', {})
      ).rejects.toThrow(
        'KeyUri and JWE are required to decrypt the file. Either provide them in the fileUri or in the options.'
      );
    });

    it('should use keyUri and JWE from options if not present in fileUri', async () => {
      const customOptions = {...options ,keyUri: 'kms://example.com/keys/1234', jwe: 'eyJhbGci'};
      webex.internal.encryption.decryptScr.mockResolvedValue('scr');
      webex.internal.encryption.download.mockResolvedValue(new ArrayBuffer(8));

      const result = await cypher.downloadAndDecryptFile('https://example.com/encrypted-file', customOptions);

      expect(webex.internal.encryption.decryptScr).toHaveBeenCalledWith('kms://example.com/keys/1234', 'eyJhbGci');
      expect(webex.internal.encryption.download).toHaveBeenCalledWith('https://example.com/encrypted-file', 'scr', {useFileService: false, headers: undefined});
      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    it('should decrypt and download the file successfully', async () => {
      webex.internal.encryption.decryptScr.mockResolvedValue('scr');
      webex.internal.encryption.download.mockResolvedValue(new ArrayBuffer(8));

      const result = await cypher.downloadAndDecryptFile(fileUri, options);

      expect(webex.internal.encryption.decryptScr).toHaveBeenCalledWith('kms://example.com/keys/1234', 'eyJhbGci');
      expect(webex.internal.encryption.download).toHaveBeenCalledWith(fileUri, 'scr', {useFileService: false, headers: undefined});
      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    [false, true].forEach((useFileService) => {
      it(`should forward custom download headers with useFileService=${useFileService}`, async () => {
        const headers = {Authorization: 'Bearer download-token'};
        const keyUri = 'kms://example.com/keys/1234';
        const jwe = 'eyJhbGci';
        const decryptedBytes = new ArrayBuffer(8);
        const decryptScr = sinon.stub(webex.internal.encryption, 'decryptScr').resolves('scr');
        const download = sinon.stub(webex.internal.encryption, 'download').resolves(decryptedBytes);
        const uri = 'https://example.com/encrypted-file';

        const result = await cypher.downloadAndDecryptFile(uri, {
          keyUri,
          jwe,
          useFileService,
          headers,
        });

        assert.calledOnceWithExactly(decryptScr, keyUri, jwe);
        assert.calledOnceWithExactly(download, uri, 'scr', {useFileService, headers});
        assert.strictEqual(result, decryptedBytes);
      });
    });

    it('should use URL metadata when options are omitted', async () => {
      const decryptScr = sinon.stub(webex.internal.encryption, 'decryptScr').resolves('scr');
      const download = sinon.stub(webex.internal.encryption, 'download').resolves(new ArrayBuffer(8));

      await cypher.downloadAndDecryptFile(fileUri);

      assert.calledOnceWithExactly(decryptScr, 'kms://example.com/keys/1234', 'eyJhbGci');
      assert.calledOnceWithExactly(download, fileUri, 'scr', {
        useFileService: false,
        headers: undefined,
      });
    });

    it('should reject an invalid URL before decryption', async () => {
      const decryptScr = sinon.stub(webex.internal.encryption, 'decryptScr');

      await assert.isRejected(cypher.downloadAndDecryptFile('invalid-url'), 'Failed to decrypt the JWE');

      assert.notCalled(decryptScr);
    });

    it('should throw an error if decryption fails', async () => {
      webex.internal.encryption.decryptScr.mockRejectedValue(new Error('Decryption failed'));

      await expect(cypher.downloadAndDecryptFile(fileUri, options)).rejects.toThrow('Decryption failed');
    });

    it('should throw an error if download fails', async () => {
      webex.internal.encryption.decryptScr.mockResolvedValue('scr');
      webex.internal.encryption.download.mockRejectedValue(new Error('Download failed'));

      await expect(cypher.downloadAndDecryptFile(fileUri, options)).rejects.toThrow('Download failed');
    });
  });

  describe('decryptFile', () => {
    const options = {keyUri: 'kms://example.com/keys/1234', jwe: 'eyJhbGci'};
    const inputFormats = [
      {name: 'an ArrayBuffer', convert: (bytes) => Uint8Array.from(bytes).buffer},
      {name: 'a Uint8Array', convert: (bytes) => Uint8Array.from(bytes)},
      {name: 'a Buffer', convert: (bytes) => Buffer.from(bytes)},
      {name: 'a Blob', convert: (bytes) => new Blob([bytes])},
      {
        name: 'a Blob slice',
        convert: (bytes) => new Blob([Buffer.from([0]), bytes, Buffer.from([0])]).slice(1, -1),
      },
      {
        name: 'a Uint8Array slice',
        convert: (bytes) => {
          const padded = new Uint8Array(bytes.length + 4);
          padded.set(bytes, 2);

          return padded.subarray(2, -2);
        },
      },
      {
        name: 'a Buffer slice',
        convert: (bytes) => Buffer.concat([Buffer.from([0]), bytes, Buffer.from([0])]).subarray(1, -1),
      },
    ];

    inputFormats.forEach(({name, convert}) => {
      it(`should decrypt ${name} without downloading the file`, async () => {
        const plaintext = Buffer.from('file contents');
        const {scr, cdata} = await webex.internal.encryption.encryptBinary(plaintext);
        const decryptScr = sinon.stub(webex.internal.encryption, 'decryptScr').resolves(scr);
        const download = sinon.stub(webex.internal.encryption, 'download');
        const request = sinon.stub(webex.internal.encryption, 'request');

        const result = await cypher.decryptFile(convert(cdata), options);

        assert.calledOnceWithExactly(decryptScr, options.keyUri, options.jwe);
        assert.instanceOf(result, ArrayBuffer);
        assert.deepEqual(new Uint8Array(result), Uint8Array.from(plaintext));
        assert.notCalled(download);
        assert.notCalled(request);
      });
    });

    ['keyUri', 'jwe'].forEach((field) => {
      it(`should reject a missing ${field}`, async () => {
        const decryptScr = sinon.stub(webex.internal.encryption, 'decryptScr');
        const decryptBinary = sinon.stub(webex.internal.encryption, 'decryptBinary');

        await assert.isRejected(
          cypher.decryptFile(new ArrayBuffer(8), {...options, [field]: ''}),
          'KeyUri and JWE are required to decrypt the file.'
        );

        assert.notCalled(decryptScr);
        assert.notCalled(decryptBinary);
      });
    });

    it('should propagate a JWE decryption failure', async () => {
      const error = new Error('JWE decryption failed');
      sinon.stub(webex.internal.encryption, 'decryptScr').rejects(error);
      const decryptBinary = sinon.stub(webex.internal.encryption, 'decryptBinary');

      const result = await assert.isRejected(cypher.decryptFile(new ArrayBuffer(8), options));

      assert.strictEqual(result, error);
      assert.notCalled(decryptBinary);
    });

    it('should reject empty encrypted bytes', async () => {
      const {scr} = await webex.internal.encryption.encryptBinary(Buffer.from('file contents'));
      sinon.stub(webex.internal.encryption, 'decryptScr').resolves(scr);

      await assert.isRejected(
        cypher.decryptFile(new ArrayBuffer(0), options),
        'Attempted to decrypt zero-length buffer'
      );
    });

    it('should reject encrypted bytes that fail authentication', async () => {
      const {scr, cdata} = await webex.internal.encryption.encryptBinary(Buffer.from('file contents'));
      sinon.stub(webex.internal.encryption, 'decryptScr').resolves(scr);
      cdata[0] ^= 1;

      await assert.isRejected(cypher.decryptFile(cdata, options));
    });
  });

  describe('register', () => {
    it('should register the device and connect to Mercury', async () => {
      await cypher.register();

      expect(webex.internal.device.register).toHaveBeenCalled();
    });

    it('should log already registered message if device is already registered', async () => {
      cypher.registered = true;

      await cypher.register();
      expect(webex.logger.info).toHaveBeenCalledWith('Cypher: webex.internal.device.register already done');
    });

    it('should log an error if device registration fails', async () => {
      webex.internal.device.register.mockRejectedValue(new Error('Device registration failed'));

      try {
        await cypher.register();
      } catch (error) {
        expect(error).toEqual(new Error('Device registration failed'));
      }

      expect(webex.logger.error).toHaveBeenCalledWith('Error occurred during device.register() Error: Device registration failed');
    });
  });

  describe('deregister', () => {
    it('should deregister the device from WDM', async () => {
      cypher.registered = true;

      await cypher.deregister();

      expect(webex.internal.device.unregister).toHaveBeenCalled();
    });

    it('should log an error if device deregistration fails', async () => {
      cypher.registered = true;
      webex.internal.device.unregister.mockRejectedValue(new Error('Device deregistration failed'));

      try {
        await cypher.deregister();
      } catch (error) {
        expect(error).toEqual(new Error('Device deregistration failed'));
      }

      expect(webex.logger.error).toHaveBeenCalledWith('Error occurred during device.deregister() Error: Device deregistration failed');
    });

    it('should not deregister if device is not registered', async () => {
      await cypher.deregister();

      expect(webex.logger.info).toHaveBeenCalledWith('Cypher: webex.internal.device.deregister already done');
    });
  });
});

import MockWebex from '@webex/test-helper-mock-webex';
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
      expect(webex.internal.encryption.download).toHaveBeenCalledWith('https://example.com/encrypted-file', 'scr', {useFileService: false});
      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    it('should decrypt and download the file successfully', async () => {
      webex.internal.encryption.decryptScr.mockResolvedValue('scr');
      webex.internal.encryption.download.mockResolvedValue(new ArrayBuffer(8));

      const result = await cypher.downloadAndDecryptFile(fileUri, options);

      expect(webex.internal.encryption.decryptScr).toHaveBeenCalledWith('kms://example.com/keys/1234', 'eyJhbGci');
      expect(webex.internal.encryption.download).toHaveBeenCalledWith(fileUri, 'scr', {useFileService: false});
      expect(result).toBeInstanceOf(ArrayBuffer);
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

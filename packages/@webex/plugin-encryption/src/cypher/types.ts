/**
 * The metadata required to decrypt file bytes.
 */
interface FileDecryptionOptions {
  /**
   * The JSON Web Encryption (JWE) string that contains the encrypted SCR.
   */
  jwe: string;

  /**
   * The URI of the KMS key used to decrypt the JWE.
   */
  keyUri: string;
}

/**
 * Options for downloading and decrypting a file.
 * Provide jwe and keyUri here if the URL does not contain them.
 */
interface FileDownloadOptions extends Partial<FileDecryptionOptions> {
  /**
   * Indicates whether to use the file service for downloading.
   * If true, the webex files service will be used.
   * If false or undefined, the file will be downloaded directly from the URL.
   */
  useFileService?: boolean;

  /**
   * HTTP headers for the file download request.
   * Only Authorization is forwarded. Header names are case-insensitive.
   * Other supplied headers are ignored.
   */
  headers?: Record<string, string>;
}
interface IEncryption {
  downloadAndDecryptFile(fileUri: string, options?: FileDownloadOptions): Promise<ArrayBuffer>;
  decryptFile(
    encryptedFile: ArrayBuffer | Uint8Array | Blob,
    options: FileDecryptionOptions
  ): Promise<ArrayBuffer>;
}

export type {IEncryption, FileDownloadOptions, FileDecryptionOptions};

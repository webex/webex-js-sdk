/**
 * Options for downloading a file with encryption.
 */
interface FileDownloadOptions {
  /**
   * Indicates whether to use the file service for downloading.
   * If true, the webex files service will be used.
   * If false or undefined, the file will be downloaded directly from the URL.
   */
  useFileService?: boolean;

  /**
   * The JSON Web Encryption (JWE) string used for decrypting the file.
   * This is a required parameter if the url does not contain the JWE.
   */
  jwe?: string;

  /**
   * The URI of the key used for decrypting the file.
   * This is a required parameter if the url does not contain the keyUri.
   */
  keyUri?: string;
}
interface IEncryption {
  downloadAndDecryptFile(fileUri: string, options: FileDownloadOptions): Promise<ArrayBuffer>;
}

export type {IEncryption, FileDownloadOptions};

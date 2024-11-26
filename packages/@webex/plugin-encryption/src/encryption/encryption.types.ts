interface IEncryption {
  downloadAndDecryptFile(fileUri: string): Promise<File>;
}

export type {IEncryption};

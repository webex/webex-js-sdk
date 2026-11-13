/**
 * Logging related types
 */
export type Logger = {
  log: (payload: string) => void;
  error: (payload: string) => void;
  warn: (payload: string) => void;
  info: (payload: string) => void;
  trace: (payload: string) => void;
  debug: (payload: string) => void;
};

interface SecureContentResource {
  decrypt(buffer: Uint8Array): Promise<Uint8Array>;
}

interface IWebexInternal {
  mercury: {
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
  };
  device: {
    register: () => Promise<void>;
    unregister: () => Promise<void>;
  };
  encryption: {
    decryptScr: (keyUri: string, jwe: string) => Promise<SecureContentResource>;
    decryptBinary: (scr: SecureContentResource, buffer: Uint8Array) => Promise<Uint8Array>;
    download: (
      fileUri: string,
      scr: SecureContentResource,
      options: {useFileService: boolean; headers?: Record<string, string>}
    ) => Promise<ArrayBuffer>;
  };
}

export interface WebexSDK {
  version: string;
  canAuthorize: boolean;
  credentials: {
    getUserToken: () => Promise<string>;
    getOrgId: () => string;
  };
  ready: boolean;
  once: (event: string, callBack: () => void) => void;
  // internal plugins
  internal: IWebexInternal;
  // public plugins
  logger: Logger;
}

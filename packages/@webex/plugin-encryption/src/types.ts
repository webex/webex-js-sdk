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
    decryptScr: (keyUri: string, jwe: string) => Promise<string>;
    download: (
      fileUri: string,
      scr: string,
      options: {useFileService: boolean}
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

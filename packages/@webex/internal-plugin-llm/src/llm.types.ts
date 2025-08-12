interface ILLMChannel {
  registerAndConnect: (
    locusUrl: string,
    datachannelUrl: string,
    connectionId?: string
  ) => Promise<void>;
  isConnected: (connectionId?: string) => boolean;
  getBinding: (connectionId?: string) => string;
  getLocusUrl: (connectionId?: string) => string;
  getDatachannelUrl: (connectionId?: string) => string;
  disconnectLLM: (options: {code: number; reason: string}, connectionId?: string) => Promise<void>;
  disconnectAllLLM: (options?: {code: number; reason: string}) => Promise<void>;
  getAllConnections: () => Map<
    string,
    {
      webSocketUrl?: string;
      binding?: string;
      locusUrl?: string;
      datachannelUrl?: string;
    }
  >;
}
// eslint-disable-next-line import/prefer-default-export
export type {ILLMChannel};

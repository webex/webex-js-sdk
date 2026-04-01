interface ILLMChannel {
  registerAndConnect: (
    locusUrl: string,
    datachannelUrl: string,
    datachannelToken?: string,
    sessionId?: string
  ) => Promise<void>;
  isConnected: (sessionId?: string) => boolean;
  getBinding: (sessionId?: string) => string;
  getLocusUrl: (sessionId?: string) => string;
  getDatachannelUrl: (sessionId?: string) => string;
  disconnectLLM: (options: {code: number; reason: string}, sessionId?: string) => Promise<void>;
  disconnectAllLLM: (options?: {code: number; reason: string}) => Promise<void>;
  getAllConnections: () => Map<
    string,
    {
      webSocketUrl?: string;
      binding?: string;
      locusUrl?: string;
      datachannelUrl?: string;
      datachannelToken?: string;
    }
  >;
}

export enum DataChannelTokenType {
  Default = 'llm-default-session',
  PracticeSession = 'llm-practice-session',
}

// eslint-disable-next-line import/prefer-default-export
export type {ILLMChannel};

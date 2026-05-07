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
  setOwnerMeetingId: (ownerMeetingId: string | undefined, sessionId?: string) => void;
  getOwnerMeetingId: (sessionId?: string) => string | undefined;
  getDatachannelToken: (tokenKey?: DataChannelTokenKey) => string;
  setDatachannelToken: (datachannelToken: string, tokenKey?: DataChannelTokenKey) => void;
  setRefreshHandler: (
    handler: () => Promise<{
      body: {datachannelToken: string; datachannelTokenType: DataChannelTokenType};
    }>,
    sessionId?: string
  ) => void;
  refreshDataChannelToken: (sessionId?: string) => Promise<{
    body: {datachannelToken: string; datachannelTokenType: DataChannelTokenType};
  } | null>;
  getLocusUrlByDatachannelUrl: (requestUrl: string) => string | undefined;
  getSessionIdByDatachannelUrl: (requestUrl: string) => string | undefined;
  getAllConnections: () => Map<
    string,
    {
      webSocketUrl?: string;
      binding?: string;
      locusUrl?: string;
      datachannelUrl?: string;
      datachannelToken?: string;
      ownerMeetingId?: string;
    }
  >;
}

export enum DataChannelTokenType {
  Default = 'llm-default-session',
  PracticeSession = 'llm-practice-session',
}

type DataChannelTokenKey = DataChannelTokenType | string;

// eslint-disable-next-line import/prefer-default-export
export type {ILLMChannel, DataChannelTokenKey};

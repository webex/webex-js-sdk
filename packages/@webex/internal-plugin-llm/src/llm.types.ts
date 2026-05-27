export enum DataChannelTokenType {
  Default = 'llm-default-session',
  PracticeSession = 'llm-practice-session',
}

type DataChannelTokenKey = DataChannelTokenType | string;

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
  disconnectLLM: (
    options: {code: number; reason: string},
    sessionId?: string,
    ownerMeetingId?: string
  ) => Promise<boolean>;
  disconnectAllLLM: (options?: {code: number; reason: string}) => Promise<void>;
  setOwnerMeetingId: (ownerMeetingId: string | undefined, sessionId?: string) => void;
  getOwnerMeetingId: (sessionId?: string) => string | undefined;
  resolveSessionOwnership: (
    ownerMeetingId?: string,
    sessionId?: string
  ) => {
    currentOwner: string | undefined;
    isOwner: boolean;
  };
  getDatachannelToken: (
    tokenKey?: DataChannelTokenKey,
    ownerMeetingId?: string
  ) => string | undefined;
  setDatachannelToken: (
    datachannelToken: string,
    tokenKey?: DataChannelTokenKey,
    ownerMeetingId?: string
  ) => void;
  clearDatachannelToken: (tokenKey: DataChannelTokenKey, ownerMeetingId: string) => void;
  setRefreshHandler: (
    handler: () => Promise<{
      body: {datachannelToken: string; datachannelTokenType: DataChannelTokenType};
    }>,
    sessionId?: string,
    ownerMeetingId?: string
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
      ownerMeetingId?: string;
    }
  >;
}

// eslint-disable-next-line import/prefer-default-export
export type {ILLMChannel, DataChannelTokenKey};

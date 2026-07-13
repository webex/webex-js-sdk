// Kept for consumers in plugin-meetings that have not yet been migrated (PR 3).
export enum DataChannelTokenType {
  Default = 'llm-default-session',
  PracticeSession = 'llm-practice-session',
}

interface ILLMChannel {
  registerAndConnect: (
    locusUrl: string,
    datachannelUrl: string,
    datachannelToken?: string
  ) => Promise<void>;
  isConnected: () => boolean;
  getBinding: () => string | undefined;
  getLocusUrl: () => string | undefined;
  getDatachannelUrl: () => string | undefined;
  getDatachannelToken: () => string | undefined;
  setDatachannelToken: (token: string | undefined) => void;
  setRefreshHandler: (handler: () => Promise<{body: {datachannelToken: string}}>) => void;
  refreshDataChannelToken: () => Promise<{body: {datachannelToken: string}} | null>;
  disconnectLLM: (options: {code: number; reason: string}) => Promise<void>;
  isDataChannelTokenEnabled: () => Promise<boolean>;
}

// eslint-disable-next-line import/prefer-default-export
export type {ILLMChannel};

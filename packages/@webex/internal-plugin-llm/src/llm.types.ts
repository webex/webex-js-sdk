interface ILLMChannel {
  registerAndConnect: (
    locusUrl: string,
    datachannelUrl: string,
    datachannelToken?: string,
    sessionId?: string
  ) => Promise<LLMConnectionTimings>;
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

/**
 * Timing measurements captured during LLM registration and WebSocket connection.
 */
export interface LLMConnectionTimings {
  /** Time in ms for the datachannel API call (HTTP POST to get WebSocket URL) */
  clientLLMDatachannelResponseTime: number;
  /** Time in ms for the WebSocket connection establishment */
  clientLLMWebSocketConnectTime?: number;
}

export enum DataChannelTokenType {
  Default = 'llm-default-session',
  PracticeSession = 'llm-practice-session',
}

// eslint-disable-next-line import/prefer-default-export
export type {ILLMChannel};

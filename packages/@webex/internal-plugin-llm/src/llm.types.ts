export enum DataChannelTokenType {
  Default = 'llm-default-session',
  PracticeSession = 'llm-practice-session',
}

type DataChannelTokenKey = DataChannelTokenType | string;

/**
 * Latencies (in milliseconds) captured during register + websocket connect.
 */
type RegisterAndConnectTiming = {
  clientLLMDatachannelResponseTime?: number;
  clientLLMWebSocketConnectTime?: number;
};

/**
 * ILLMChannel — interface for a single LLM WebSocket connection.
 * Created via `webex.internal.llm.createConnection()`.
 */
interface ILLMChannel {
  /** Register with the server and connect the WebSocket. */
  registerAndConnect: (
    locusUrl: string,
    datachannelUrl: string,
    datachannelToken?: string
  ) => Promise<void>;

  /** Returns true if the WebSocket is connected. */
  isConnected: () => boolean;

  /** Get the underlying WebSocket. */
  getSocket: () => any;

  /** Get the binding ID for this connection. */
  getBinding: () => string | undefined;

  /** Get the Locus URL associated with this connection. */
  getLocusUrl: () => string | undefined;

  /** Get the datachannel URL for this connection. */
  getDatachannelUrl: () => string | undefined;

  /** Get the stored datachannel token. */
  getDatachannelToken: () => string | undefined;

  /** Store a datachannel token for this connection. */
  setDatachannelToken: (datachannelToken: string) => void;

  /** Clear the stored datachannel token. */
  clearDatachannelToken: () => void;

  /** Set the handler used to refresh the datachannel token. */
  setRefreshHandler: (
    handler: () => Promise<{
      body: {datachannelToken: string; datachannelTokenType: DataChannelTokenType};
    }>
  ) => void;

  /** Refresh the datachannel token using the injected handler. */
  refreshDataChannelToken: () => Promise<{
    body: {datachannelToken: string; datachannelTokenType: DataChannelTokenType};
  } | null>;

  /** Disconnect the WebSocket and clean up state. */
  disconnect: (options?: {code: number; reason: string}) => Promise<void>;

  /** Check if the datachannel token feature flag is enabled. */
  isDataChannelTokenEnabled: () => Promise<boolean>;
}

/**
 * ILLMPlugin — interface for the LLM plugin factory.
 * Accessed via `webex.internal.llm`.
 */
interface ILLMPlugin {
  /** Create a new LLM connection instance. */
  createConnection: () => ILLMChannel;

  /** Check if the datachannel token feature flag is enabled globally. */
  isDataChannelTokenEnabled: () => Promise<boolean>;

  /** Find a connection by matching a request URL to its datachannel URL. */
  getConnectionByDatachannelUrl: (url: string) => ILLMChannel | undefined;

  /** Find a locus URL by matching a request URL to an active connection. */
  getLocusUrlByDatachannelUrl: (requestUrl: string) => string | undefined;

  /** Get all active connections. */
  getAllConnections: () => Set<ILLMChannel>;

  /** Disconnect all active connections. */
  disconnectAll: (options?: {code: number; reason: string}) => Promise<void>;
}

// eslint-disable-next-line import/prefer-default-export
export type {ILLMChannel, ILLMPlugin, DataChannelTokenKey, RegisterAndConnectTiming};

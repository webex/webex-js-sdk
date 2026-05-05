import type {SocketCloseEvent, SocketOpenOptions, SocketResponse} from './socket/types';

export type MobiusSocketLogger = Pick<Console, 'debug' | 'error' | 'info' | 'log' | 'warn'>;

export type MobiusSocketCloseOptions = {
  code?: number;
  reason?: string;
};

export type MobiusSocketRequestPayload = SocketResponse & {
  trackingId: string;
  type: string;
};

export type MobiusSocketRequestOptions = {
  timeout?: number;
};

export type MobiusSocketResponseError = Error & {
  name: 'MobiusSocketResponseError';
  response?: SocketResponse;
  statusCode?: number;
  statusMessage?: string;
  trackingId?: string;
};

export type MobiusSocketWebex = {
  config: Record<string, unknown> & {
    defaultMobiusSocketOptions?: Partial<SocketOpenOptions>;
  };
  credentials: Record<string, unknown> & {
    canRefresh?: boolean;
    getUserToken: () => Promise<string | {toString(): string}>;
    refresh?: (options: {force: boolean}) => Promise<unknown>;
  };
  internal: {
    device: Record<string, unknown> & {
      register?: () => Promise<unknown>;
      refresh?: () => Promise<unknown>;
      registered?: boolean;
      webSocketUrl?: string;
    };
    feature?: {
      updateFeature?: (featureToggle: unknown) => void;
    };
    services: Record<string, unknown> & {
      invalidateCache?: (timestamp: unknown) => void;
      switchActiveClusterIds?: (activeClusters: unknown) => void;
    };
  };
  logger?: MobiusSocketLogger;
  sessionId?: string;
};

export type MobiusSocketDisconnectResult = Promise<void | SocketCloseEvent>;

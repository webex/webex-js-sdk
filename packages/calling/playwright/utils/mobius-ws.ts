import {BrowserContext, Page, WebSocketRoute} from '@playwright/test';

export const MOBIUS_WS_MESSAGE = {
  AUTH: 'auth',
  REGISTER: 'register',
  UNREGISTER: 'unregister',
  DEVICE_STATUS: 'device_status',
  CALL_SETUP: 'call_setup',
  CALL_STATUS: 'call_status',
  CALL_MEDIA: 'call_media',
  CALL_HOLD: 'call_hold',
  CALL_RESUME: 'call_resume',
} as const;

type MobiusWsFrame = {
  type?: string;
  subtype?: string;
  trackingId?: string;
  statusCode?: number;
  statusMessage?: string;
  metadata?: Record<string, unknown>;
  data?: any;
  [key: string]: unknown;
};

type MockResponse = {
  statusCode: number;
  statusMessage?: string;
  metadata?: Record<string, unknown>;
  data?: any;
};

type RouteContext = {
  url: string;
  requestCount: number;
  responseCount: number;
};

type MobiusWsInterceptorOptions = {
  onRequest?: (
    frame: MobiusWsFrame,
    context: RouteContext
  ) => MockResponse | void | Promise<MockResponse | void>;
  onResponse?: (
    frame: MobiusWsFrame,
    context: RouteContext
  ) => MobiusWsFrame | void | Promise<MobiusWsFrame | void>;
};

const MOBIUS_WS_ROUTE = '**/calling/web**';

const parseFrame = (message: string | Buffer): MobiusWsFrame | undefined => {
  const text = typeof message === 'string' ? message : message.toString();

  try {
    return JSON.parse(text) as MobiusWsFrame;
  } catch {
    return undefined;
  }
};

const stringifyFrame = (frame: MobiusWsFrame): string => JSON.stringify(frame);

const buildResponseFrame = (request: MobiusWsFrame, response: MockResponse): MobiusWsFrame => ({
  type: 'response_event',
  subtype: request.type,
  trackingId: request.trackingId,
  statusCode: response.statusCode,
  statusMessage: response.statusMessage ?? (response.statusCode >= 400 ? 'Error' : 'OK'),
  metadata: response.metadata,
  data: response.data,
});

const redactFrame = (frame: MobiusWsFrame): MobiusWsFrame => {
  if (!frame?.metadata?.authorization) return frame;

  return {...frame, metadata: {...frame.metadata, authorization: '[REDACTED]'}};
};

export class MobiusWsInterceptor {
  private readonly options: MobiusWsInterceptorOptions;

  private readonly requestCounts = new Map<string, number>();

  private readonly responseCounts = new Map<string, number>();

  public readonly requests: Array<MobiusWsFrame & {url: string}> = [];

  public readonly responses: Array<MobiusWsFrame & {url: string}> = [];

  constructor(options: MobiusWsInterceptorOptions = {}) {
    this.options = options;
  }

  async install(context: BrowserContext): Promise<void> {
    await context.routeWebSocket(MOBIUS_WS_ROUTE, async (route: WebSocketRoute) => {
      const server = route.connectToServer();
      const url = route.url();

      route.onMessage(async (message) => {
        const frame = parseFrame(message);

        if (!frame?.type) {
          server.send(message);

          return;
        }

        const requestCount = MobiusWsInterceptor.increment(this.requestCounts, frame.type);
        this.requests.push({...redactFrame(frame), url});

        let mockedResponse: MockResponse | void;
        try {
          mockedResponse = await this.options.onRequest?.(frame, {
            url,
            requestCount,
            responseCount: this.getResponseCount(frame.type),
          });
        } catch (err) {
          console.error('MobiusWsInterceptor onRequest threw, passing frame through', err);
          server.send(message);

          return;
        }

        if (mockedResponse) {
          const responseFrame = buildResponseFrame(frame, mockedResponse);
          const responseType = responseFrame.subtype || responseFrame.type || 'unknown';

          MobiusWsInterceptor.increment(this.responseCounts, responseType);
          this.responses.push({...redactFrame(responseFrame), url});
          route.send(stringifyFrame(responseFrame));

          return;
        }

        server.send(message);
      });

      server.onMessage(async (message) => {
        const frame = parseFrame(message);

        if (!frame) {
          route.send(message);

          return;
        }

        const responseType = frame.subtype || frame.type || 'unknown';
        const responseCount = MobiusWsInterceptor.increment(this.responseCounts, responseType);
        this.responses.push({...redactFrame(frame), url});

        let transformedFrame: MobiusWsFrame | void;
        try {
          transformedFrame = await this.options.onResponse?.(frame, {
            url,
            requestCount: this.getRequestCount(responseType),
            responseCount,
          });
        } catch (err) {
          console.error('MobiusWsInterceptor onResponse threw, passing frame through', err);
          route.send(message);

          return;
        }

        route.send(stringifyFrame(transformedFrame || frame));
      });

      route.onClose((code, reason) => {
        server.close({code, reason}).catch(() => {});
      });

      server.onClose((code, reason) => {
        route.close({code, reason}).catch(() => {});
      });
    });
  }

  getRequestCount(type: string): number {
    return this.requestCounts.get(type) || 0;
  }

  getResponseCount(type: string): number {
    return this.responseCounts.get(type) || 0;
  }

  private static increment(map: Map<string, number>, key: string): number {
    const nextValue = (map.get(key) || 0) + 1;
    map.set(key, nextValue);

    return nextValue;
  }
}

export const normalizeWsUrl = (url: string): string => (url.endsWith('/') ? url : `${url}/`);

export const isKnownWsUrl = (url: string | undefined, urls: string[]): boolean => {
  if (!url) {
    return false;
  }

  const normalized = normalizeWsUrl(url);

  return urls.map(normalizeWsUrl).some((knownUrl) => normalized.startsWith(knownUrl));
};

export const getDiscoveredMobiusWsUrls = (
  page: Page
): Promise<{primary: string[]; backup: string[]}> =>
  page.evaluate(() => {
    const client = (window as any).callingClient;

    return {
      primary: client?.primaryWssMobiusUris ?? [],
      backup: client?.backupWssMobiusUris ?? [],
    };
  });

export const isMobiusWsActive = (url: string | undefined): boolean =>
  url?.startsWith('wss://') ?? false;

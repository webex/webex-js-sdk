/* eslint-disable no-restricted-globals */
/// <reference lib="webworker" />
// keepaliveWorker.ts

interface KeepaliveMessage {
  type: 'START' | 'STOP';
  url?: string;
  accessToken: string;
  interval?: number;
  isCCFlow?: boolean;
  deviceUrl?: string;
  userAgent?: string;
}

interface KeepaliveResponse {
  type: 'SUCCESS' | 'FAILURE' | 'MAX_RETRIES';
  statusCode?: number;
  retryCount?: number;
  error?: string;
}

// Worker scope type is already declared in TypeScript library

let keepaliveTimer: number | undefined;
let keepAliveRetryCount = 0;
const RETRY_COUNT_THRESHOLD = 5;
const CC_RETRY_COUNT_THRESHOLD = 4;

// Store device info
let currentDeviceUrl: string;
let currentUserAgent: string;
let currentAccessToken: string;

async function postKeepAlive(url: string): Promise<Response> {
  const uniqueId = crypto.randomUUID();
  const response = await fetch(`${url}/status`, {
    method: 'POST',
    headers: {
      'cisco-device-url': currentDeviceUrl,
      'spark-user-agent': currentUserAgent,
      authorization: `Bearer ${currentAccessToken}`,
      trackingid: uniqueId.toString(),
    },
  });

  if (!response.ok) {
    throw new Error(`Keepalive failed with status: ${response.status}`);
  }

  return response;
}

self.onmessage = async (e: MessageEvent<KeepaliveMessage>) => {
  const {type, url, interval, isCCFlow, deviceUrl, userAgent, accessToken} = e.data;
  const threshold = isCCFlow ? CC_RETRY_COUNT_THRESHOLD : RETRY_COUNT_THRESHOLD;

  switch (type) {
    case 'START':
      if (!url || !interval || !deviceUrl || !userAgent) {
        throw new Error('URL, interval, deviceUrl and userAgent are required to start keepalive');
      }

      // Store device info
      currentDeviceUrl = deviceUrl;
      currentUserAgent = userAgent;
      currentAccessToken = accessToken;

      // Clear existing timer if any
      if (keepaliveTimer) {
        self.clearInterval(keepaliveTimer);
        keepaliveTimer = undefined;
      }

      keepAliveRetryCount = 0;

      keepaliveTimer = self.setInterval(async () => {
        if (keepAliveRetryCount < threshold) {
          try {
            const response = await postKeepAlive(url);
            keepAliveRetryCount = 0;

            self.postMessage({
              type: 'SUCCESS',
              statusCode: response.status,
            } as KeepaliveResponse);
          } catch (error) {
            keepAliveRetryCount += 1;

            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            const statusCode =
              error instanceof Error && 'status' in error ? (error as any).status : 500;

            self.postMessage({
              type: 'FAILURE',
              statusCode,
              retryCount: keepAliveRetryCount,
              error: errorMessage,
            } as KeepaliveResponse);

            if (keepAliveRetryCount >= threshold) {
              if (keepaliveTimer) {
                self.clearInterval(keepaliveTimer);
                keepaliveTimer = undefined;
              }

              self.postMessage({
                type: 'MAX_RETRIES',
                retryCount: keepAliveRetryCount,
                error: errorMessage,
              } as KeepaliveResponse);
            }
          }
        }
      }, interval * 1000);
      break;

    case 'STOP':
      if (keepaliveTimer) {
        self.clearInterval(keepaliveTimer);
        keepaliveTimer = undefined;
      }
      break;

    default:
      throw new Error(`Unknown message type: ${type}`);
  }
};

export default {} as typeof Worker & {new (): Worker};

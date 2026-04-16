/* eslint-env worker */
import {v4 as uuid} from 'uuid';
import {KeepaliveStatusMessage, WorkerMessageType} from '../../common/types';

let keepaliveTimer: NodeJS.Timeout | undefined;
let keepAliveRetryCount = 0;
let keepaliveInFlight = false;

const normalizeKeepaliveError = (err: any) => {
  const headers = {} as Record<string, string>;

  if (err?.headers?.has?.('Retry-After')) {
    headers['retry-after'] = err.headers.get('Retry-After');
  }

  if (err?.headers?.has?.('Trackingid')) {
    headers.trackingid = err.headers.get('Trackingid');
  }

  return {
    headers,
    statusCode: err?.status ?? err?.statusCode ?? 0,
    statusText: err?.statusText ?? err?.message ?? 'Keepalive failed',
    type: err?.type,
  };
};

const clearKeepaliveTimer = () => {
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = undefined;
  }
};

const messageHandler = (event: MessageEvent) => {
  const {type} = event.data;

  if (type === WorkerMessageType.START_KEEPALIVE) {
    const {interval, retryCountThreshold} = event.data;
    clearKeepaliveTimer();
    keepAliveRetryCount = 0;
    keepaliveInFlight = false;

    keepaliveTimer = setInterval(() => {
      if (keepAliveRetryCount < retryCountThreshold && !keepaliveInFlight) {
        keepaliveInFlight = true;
        postMessage({
          type: WorkerMessageType.SEND_KEEPALIVE,
          trackingId: `web_worker_${uuid()}`,
        });
      }
    }, interval * 1000);
  }

  if (type === WorkerMessageType.KEEPALIVE_RESULT) {
    keepaliveInFlight = false;

    if (event.data.err === undefined) {
      if (keepAliveRetryCount > 0) {
        postMessage({
          type: WorkerMessageType.KEEPALIVE_SUCCESS,
          statusCode: event.data.statusCode,
        } as KeepaliveStatusMessage);
      }
      keepAliveRetryCount = 0;
    } else {
      keepAliveRetryCount += 1;
      postMessage({
        type: WorkerMessageType.KEEPALIVE_FAILURE,
        err: normalizeKeepaliveError(event.data.err),
        keepAliveRetryCount,
      } as KeepaliveStatusMessage);
    }
  }

  if (type === WorkerMessageType.CLEAR_KEEPALIVE) {
    clearKeepaliveTimer();
    keepAliveRetryCount = 0;
    keepaliveInFlight = false;
  }
};

// eslint-disable-next-line no-restricted-globals
self.addEventListener('message', messageHandler);
export default messageHandler;

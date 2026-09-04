/* eslint-env worker */
import {KeepaliveStatusMessage, WorkerMessageType} from '../../common/types';

let keepaliveTimer: NodeJS.Timeout | undefined;
let keepAliveRetryCount = 0;
let keepaliveInFlight = false;
let keepaliveInFlightTimeout: ReturnType<typeof setTimeout> | undefined;

const clearKeepaliveTimer = () => {
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = undefined;
  }
};

const clearKeepaliveInFlightTimeout = () => {
  if (keepaliveInFlightTimeout) {
    clearTimeout(keepaliveInFlightTimeout);
    keepaliveInFlightTimeout = undefined;
  }
};

const messageHandler = (event: MessageEvent) => {
  const {type} = event.data;

  if (type === WorkerMessageType.START_KEEPALIVE) {
    const {interval, retryCountThreshold} = event.data;
    clearKeepaliveTimer();
    clearKeepaliveInFlightTimeout();
    keepAliveRetryCount = 0;
    keepaliveInFlight = false;

    keepaliveTimer = setInterval(() => {
      if (keepAliveRetryCount < retryCountThreshold && !keepaliveInFlight) {
        keepaliveInFlight = true;
        keepaliveInFlightTimeout = setTimeout(() => {
          keepaliveInFlight = false;
          keepaliveInFlightTimeout = undefined;
        }, interval * 2 * 1000);
        postMessage({
          type: WorkerMessageType.SEND_KEEPALIVE,
        });
      }
    }, interval * 1000);
  }

  if (type === WorkerMessageType.KEEPALIVE_RESULT) {
    keepaliveInFlight = false;
    clearKeepaliveInFlightTimeout();

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
        err: event.data.err,
        keepAliveRetryCount,
      } as KeepaliveStatusMessage);
    }
  }

  if (type === WorkerMessageType.CLEAR_KEEPALIVE) {
    clearKeepaliveTimer();
    clearKeepaliveInFlightTimeout();
    keepAliveRetryCount = 0;
    keepaliveInFlight = false;
  }
};

// eslint-disable-next-line no-restricted-globals
self.addEventListener('message', messageHandler);
export default messageHandler;

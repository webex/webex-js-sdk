/**
 * This file contains the stringified version of the web worker code from webWorker.ts
 * It can be used to create a Blob URL for the worker instead of loading it from a separate file
 */

const webWorkerStr = `/* eslint-env worker */

const uuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const WorkerMessageType = {
  START_KEEPALIVE: 'START_KEEPALIVE',
  CLEAR_KEEPALIVE: 'CLEAR_KEEPALIVE',
  SEND_KEEPALIVE: 'SEND_KEEPALIVE',
  KEEPALIVE_RESULT: 'KEEPALIVE_RESULT',
  KEEPALIVE_SUCCESS: 'KEEPALIVE_SUCCESS',
  KEEPALIVE_FAILURE: 'KEEPALIVE_FAILURE',
};

let keepaliveTimer;
let keepAliveRetryCount = 0;
let keepaliveInFlight = false;

const clearKeepaliveTimer = () => {
  if (keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = undefined;
  }
};

const messageHandler = (event) => {
  const {type} = event.data;

  if (type === WorkerMessageType.START_KEEPALIVE) {
    const {interval, retryCountThreshold} = event.data;

    clearKeepaliveTimer();
    keepAliveRetryCount = 0;
    keepaliveInFlight = false;

    keepaliveTimer = setInterval(() => {
      if (keepAliveRetryCount < retryCountThreshold && !keepaliveInFlight) {
        keepaliveInFlight = true;
        self.postMessage({
          type: WorkerMessageType.SEND_KEEPALIVE,
          trackingId: \`web_worker_\${uuid()}\`,
        });
      }
    }, interval * 1000);
  }

  if (type === WorkerMessageType.KEEPALIVE_RESULT) {
    keepaliveInFlight = false;

    if (event.data.err === undefined) {
      if (keepAliveRetryCount > 0) {
        self.postMessage({
          type: WorkerMessageType.KEEPALIVE_SUCCESS,
          statusCode: event.data.statusCode,
        });
      }

      keepAliveRetryCount = 0;
    } else {
      keepAliveRetryCount += 1;
      self.postMessage({
        type: WorkerMessageType.KEEPALIVE_FAILURE,
        err: event.data.err,
        keepAliveRetryCount,
      });
    }
  }

  if (type === WorkerMessageType.CLEAR_KEEPALIVE) {
    clearKeepaliveTimer();
    keepAliveRetryCount = 0;
    keepaliveInFlight = false;
  }
};

self.addEventListener('message', messageHandler);
`;

export default webWorkerStr;

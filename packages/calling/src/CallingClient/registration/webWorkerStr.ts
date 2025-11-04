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

// Enum values from the original imports
const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
};

const WorkerMessageType = {
  START_KEEPALIVE: 'START_KEEPALIVE',
  CLEAR_KEEPALIVE: 'CLEAR_KEEPALIVE',
  KEEPALIVE_SUCCESS: 'KEEPALIVE_SUCCESS',
  KEEPALIVE_FAILURE: 'KEEPALIVE_FAILURE',
};

let keepaliveTimer;

const messageHandler = (event) => {
  const {type} = event.data;

  const postKeepAlive = async (accessToken, deviceUrl, url) => {
    const response = await fetch(\`\${url}/status\`, {
      method: HTTP_METHODS.POST,
      headers: {
        'cisco-device-url': deviceUrl,
        'spark-user-agent': 'webex-calling/beta',
        Authorization: \`\${accessToken}\`,
        trackingId: \`web_worker_\${uuid()}\`,
      },
    });

    if (!response.ok) {
      throw response;
    }

    return response;
  };

  if (type === WorkerMessageType.START_KEEPALIVE) {
    let keepAliveRetryCount = 0;
    const {accessToken, deviceUrl, interval, retryCountThreshold, url} = event.data;

    if (keepaliveTimer) {
      clearInterval(keepaliveTimer);
      keepaliveTimer = undefined;
    }

    keepaliveTimer = setInterval(async () => {
      if (keepAliveRetryCount < retryCountThreshold) {
        try {
          const res = await postKeepAlive(accessToken, deviceUrl, url);
          const statusCode = res.status;
          if (keepAliveRetryCount > 0) {
            self.postMessage({
              type: WorkerMessageType.KEEPALIVE_SUCCESS,
              statusCode,
            });
          }
          keepAliveRetryCount = 0;
        } catch (err) {
          let headers = {};
          if(err.headers?.has('Retry-After')) {
            headers['retry-after'] = err.headers.get('Retry-After');
          } 

          if(err.headers?.has('Trackingid')) {
            headers['trackingid'] = err.headers.get('Trackingid');
          }   

          const error = {
            headers,
            statusCode: err.status,
            statusText: err.statusText,
            type: err.type,
          };

          keepAliveRetryCount += 1
          self.postMessage({
            type: WorkerMessageType.KEEPALIVE_FAILURE,
            err: error,
            keepAliveRetryCount,
          });
        }
      }
    }, interval * 1000);
  }

  if (type === WorkerMessageType.CLEAR_KEEPALIVE) {
    if (keepaliveTimer) {
      clearInterval(keepaliveTimer);
      keepaliveTimer = undefined;
    }
  }
};

self.addEventListener('message', messageHandler);
`;

export default webWorkerStr;

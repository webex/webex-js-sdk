/* eslint-env worker */
import {v4 as uuid} from 'uuid';
import {HTTP_METHODS, KeepaliveStatusMessage, WorkerMessageType} from '../../common/types';

let keepaliveTimer: NodeJS.Timer | undefined;

export const messageHandler = (event: MessageEvent) => {
  const {type} = event.data;

  const postKeepAlive = async (accessToken: string, deviceUrl: string, url: string) => {
    const response = await fetch(`${url}/status`, {
      method: HTTP_METHODS.POST,
      headers: {
        'cisco-device-url': deviceUrl,
        'spark-user-agent': 'webex-calling/beta',
        Authorization: `${accessToken}`,
        trackingId: `web_worker_${uuid()}`,
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
            postMessage({
              type: WorkerMessageType.KEEPALIVE_SUCCESS,
              statusCode,
            } as KeepaliveStatusMessage);
          }
          keepAliveRetryCount = 0;
        } catch (err: any) {
          keepAliveRetryCount += 1;
          const errorBody = await err.json();
          const error = {
            body: errorBody,
            statusCode: err.status,
            statusText: err.statusText,
            type: err.type,
          };
          postMessage({
            type: WorkerMessageType.KEEPALIVE_FAILURE,
            err: error,
            keepAliveRetryCount,
          } as KeepaliveStatusMessage);
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

// eslint-disable-next-line no-restricted-globals
self.addEventListener('message', messageHandler);

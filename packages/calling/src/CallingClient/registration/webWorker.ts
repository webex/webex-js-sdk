import {WorkerMessageType} from '../../common/types';

onmessage = (event: MessageEvent) => {
  let keepaliveTimer: NodeJS.Timer | undefined;
  if (event.data?.type === WorkerMessageType.START_KEEPALIVE) {
    const {interval} = event.data;

    keepaliveTimer = setInterval(() => {
      postMessage({type: WorkerMessageType.SEND_KEEPALIVE});
    }, interval * 1000);
  }

  if (event.data?.type === WorkerMessageType.CLEAR_KEEPALIVE) {
    if (keepaliveTimer) {
      clearInterval(keepaliveTimer);
    }
  }
};

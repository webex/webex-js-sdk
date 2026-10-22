import {
  ConnectionState,
  MediaConnectionEventNames,
  MediaType,
  MultistreamRoapMediaConnection,
  StreamRequest,
} from '@webex/internal-media-core';

import LoggerProxy from '../common/logs/logger-proxy';

type QueuedMediaRequest = {
  mediaType: MediaType;
  streamRequests: StreamRequest[];
};

/**
 * Layer between the MediaRequestManagers and the multistream media connection.
 * Media requests are sent only while the media connection is connected; otherwise they are queued
 * and sent in the original order once the connection becomes connected.
 *
 * This prevents sending requests while the media connection is being renewed (e.g. during reconnection),
 * when the receive slots of the closed peer connection have no IDs.
 *
 * @class MediaRequestQueue
 */
export default class MediaRequestQueue {
  private readonly mediaConnection: MultistreamRoapMediaConnection;

  private queuedRequests: QueuedMediaRequest[] = [];

  /**
   * @param {MultistreamRoapMediaConnection} mediaConnection media connection used to send the requests
   */
  constructor(mediaConnection: MultistreamRoapMediaConnection) {
    this.mediaConnection = mediaConnection;

    this.mediaConnection.on(
      MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED,
      this.handleConnectionStateChange
    );
    this.mediaConnection.on(
      MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED,
      this.handleConnectionStateChange
    );
  }

  /**
   * Sends the media requests if the media connection is connected, otherwise queues them.
   * @param {MediaType} mediaType media type of the requests
   * @param {StreamRequest[]} streamRequests requests to send
   * @returns {void}
   */
  public requestMedia(mediaType: MediaType, streamRequests: StreamRequest[]): void {
    const request = {mediaType, streamRequests};

    if (!this.isConnected()) {
      LoggerProxy.logger.info(
        `MediaRequestQueue#requestMedia --> connection not-ready, enqueuing ${MediaRequestQueue.getTaskName(
          request
        )} task`
      );
      this.queuedRequests.push(request);

      return;
    }

    // the connected event might not have been handled yet, so send the older requests first
    this.flush();
    this.send(request);
  }

  /**
   * Removes the listeners and discards all queued requests.
   * @returns {void}
   */
  public stop(): void {
    this.mediaConnection.off(
      MediaConnectionEventNames.PEER_CONNECTION_STATE_CHANGED,
      this.handleConnectionStateChange
    );
    this.mediaConnection.off(
      MediaConnectionEventNames.ICE_CONNECTION_STATE_CHANGED,
      this.handleConnectionStateChange
    );
    this.queuedRequests = [];
  }

  private static getTaskName({mediaType}: QueuedMediaRequest): string {
    return `requestMedia(${mediaType})`;
  }

  private readonly handleConnectionStateChange = (): void => {
    if (this.isConnected()) {
      this.flush();
    }
  };

  private isConnected(): boolean {
    return this.mediaConnection.getConnectionState() === ConnectionState.Connected;
  }

  private flush(): void {
    if (this.queuedRequests.length === 0) {
      return;
    }

    const requests = this.queuedRequests;

    this.queuedRequests = [];

    LoggerProxy.logger.info(
      `MediaRequestQueue#flush --> flushing queue, tasks: ${requests.length}`
    );

    requests.forEach((request) => {
      const taskName = MediaRequestQueue.getTaskName(request);

      LoggerProxy.logger.info(`MediaRequestQueue#flush --> running ${taskName} task`);

      try {
        this.send(request);
      } catch (error) {
        LoggerProxy.logger.error(`MediaRequestQueue#flush --> ${taskName} task failed`, error);
      }
    });
  }

  private send({mediaType, streamRequests}: QueuedMediaRequest): void {
    this.mediaConnection.requestMedia(mediaType, streamRequests);
  }
}

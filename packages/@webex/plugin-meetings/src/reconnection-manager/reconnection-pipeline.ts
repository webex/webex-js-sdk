import {Defer} from '@webex/common';
import LoggerProxy from '../common/logs/logger-proxy';
import Trigger from '../common/events/trigger-proxy';
import {EVENT_TRIGGERS, SHARE_STATUS, _CALL_, _LEFT_, _ID_} from '../constants';
import {NeedsRejoinError, NeedsRetryError} from './types';
import {MediaRequestManager} from '../multistream/mediaRequestManager';

/**
 * ReconnectionPipeline class implements the logic for handling the reconnection process
 */
export default class ReconnectionPipeline {
  webex: any;
  meeting: any;
  iceServersDefer: Defer;
  reconnectionPromise?: Promise<void>;
  wasSharing: boolean;

  /**
   * Creates an instance of ReconnectionPipeline.
   * @param {Object} webex - The Webex instance.
   * @param {Object} meeting - The meeting instance.
   */
  constructor(webex: any, meeting: any) {
    this.webex = webex;
    this.meeting = meeting;
    this.iceServersDefer = new Defer();
    this.reconnectionPromise = undefined;
    this.wasSharing = false;
  }

  /**
   * Initiates the reconnection process for the meeting.
   *
   * @returns {Promise<void>}
   */
  protected async initializeReconnection(): Promise<void> {
    this.reconnectionPromise = this.meeting.mediaProperties.webrtcMediaConnection.reconnect(
      this.iceServersDefer.promise
    );

    return Promise.resolve();
  }

  /**
   * Initiates the reachability check for the meeting.
   *
   * @returns {Promise<void>}
   */
  protected async startReachabilityCheck(): Promise<void> {
    try {
      await this.webex.meetings.startReachability('reconnection');
    } catch (err) {
      LoggerProxy.logger.info(
        'ReconnectionPipeline#startReachabilityCheck --> Reachability failed, continuing with reconnection attempt, err: ',
        err
      );
    }
  }

  /**
   * Stops the local share stream if it was active before the reconnection.
   *
   * @returns {Promise<void>}
   */
  protected async maybeStopLocalShareStream(): Promise<void> {
    try {
      this.wasSharing = this.meeting.shareStatus === SHARE_STATUS.LOCAL_SHARE_ACTIVE;

      if (!this.wasSharing) {
        return;
      }

      await this.meeting.unpublishStreams([
        this.meeting.mediaProperties.shareVideoStream,
        this.meeting.mediaProperties.shareAudioStream,
      ]);
    } catch (error) {
      LoggerProxy.logger.error(
        `ReconnectionPipeline#maybeStopLocalShareStream --> Error stopping local share stream: ${error}`
      );
    }
  }

  /**
   * Attempts to reconnect the Mercury WebSocket connection
   *
   * @param {boolean} networkDisconnect - Indicates if the reconnection is due to a network disconnect.
   *
   * @returns {Promise<void>}
   */
  protected async maybeReconnectMercuryWebSocket(networkDisconnect: boolean): Promise<void> {
    if (!networkDisconnect) {
      return;
    }

    try {
      LoggerProxy.logger.info(
        'ReconnectionPipeline#maybeReconnectMercuryWebSocket --> Reconnecting websocket.'
      );

      if (this.webex.internal.mercury.connected) {
        LoggerProxy.logger.info(
          'ReconnectionPipeline#maybeReconnectMercuryWebSocket --> Disconnecting existing websocket.'
        );

        try {
          await this.webex.internal.mercury.disconnect();
          LoggerProxy.logger.info(
            'ReconnectionPipeline#maybeReconnectMercuryWebSocket --> Websocket disconnected successfully.'
          );
        } catch (disconnectError) {
          // If we can't disconnect, the sdk is in such a bad state that reconnecting is not going to happen.
          LoggerProxy.logger.error(
            'ReconnectionPipeline#maybeReconnectMercuryWebSocket --> Unable to disconnect from websocket, giving up.',
            disconnectError
          );
          throw disconnectError;
        }
      }

      try {
        LoggerProxy.logger.info(
          'ReconnectionPipeline#maybeReconnectMercuryWebSocket --> Connecting websocket.'
        );

        await this.webex.internal.mercury.connect();

        LoggerProxy.logger.info(
          'ReconnectionPipeline#maybeReconnectMercuryWebSocket --> Websocket connected successfully.'
        );
      } catch (connectError) {
        LoggerProxy.logger.error(
          'ReconnectionPipeline#maybeReconnectMercuryWebSocket --> Unable to connect to websocket, giving up.',
          connectError
        );

        throw connectError;
      }
    } catch (error) {
      LoggerProxy.logger.error(
        'ReconnectionPipeline#maybeReconnectMercuryWebSocket --> Unable to reconnect to websocket, giving up.'
      );

      throw error;
    }
  }

  /**
   * Syncs meetings before media reconnection.
   *
   * @returns {Promise<void>}
   */
  protected async syncMeetings(): Promise<void> {
    try {
      LoggerProxy.logger.info(
        'ReconnectionPipeline#syncMeetings --> Updating meeting data from server.'
      );

      await this.webex.meetings.syncMeetings({keepOnlyLocusMeetings: false});
    } catch (syncError) {
      LoggerProxy.logger.info(
        'ReconnectionPipeline#syncMeetings --> Unable to sync meetings, reconnecting.',
        syncError
      );

      throw new NeedsRetryError(syncError);
    }
  }

  /**
   * Verifies the current state of the meeting before proceeding with reconnection.
   *
   * @throws {Error} If the meeting is in a state that cannot be reconnected to, such as LEFT or if it has been deleted.
   * @returns {Promise<void>}
   */
  protected async verifyMeetingState(): Promise<void> {
    if (!this.meeting || !this.webex.meetings.getMeetingByType(_ID_, this.meeting.id)) {
      LoggerProxy.logger.info(
        'ReconnectionPipeline#executeReconnection --> Meeting got deleted due to inactivity or ended remotely.'
      );

      throw new Error('Unable to rejoin a meeting already ended or inactive.');
    }

    // If the meeting state was left, no longer reconnect media
    if (this.meeting.state === _LEFT_) {
      if (this.meeting.type === _CALL_) {
        throw new Error('Unable to rejoin a call in LEFT state.');
      }

      throw new NeedsRejoinError({wasSharing: this.wasSharing});
    }
  }

  /**
   * Performs TURN server discovery to get the latest TURN server information.
   *
   * @returns {Promise<RTCIceServer[]>}
   */
  protected async doTurnDiscovery(): Promise<RTCIceServer[]> {
    LoggerProxy.logger.log('ReconnectionPipeline#reconnectMedia --> do turn discovery');

    // do the TURN server discovery again and ignore reachability results since the TURN server might change
    const turnServerResult = await this.meeting.roap.doTurnDiscovery(this.meeting, true, true);

    const iceServers = [];

    if (turnServerResult.turnServerInfo?.urls.length > 0) {
      iceServers.push({
        urls: turnServerResult.turnServerInfo.urls,
        username: turnServerResult.turnServerInfo.username || '',
        credential: turnServerResult.turnServerInfo.password || '',
      });
    }

    return Promise.resolve(iceServers);
  }

  /**
   * Waits for media reconnection to complete.
   *
   * @param {RTCIceServer[]} iceServers - The ICE servers to use for the reconnection.
   * @returns {Promise<void>}
   */
  protected async waitForMediaReconnection(iceServers: RTCIceServer[]): Promise<void> {
    this.iceServersDefer.resolve(iceServers);

    await this.meeting.waitForRemoteSDPAnswer();
    await this.meeting.waitForMediaConnectionConnected();

    this.triggerEvent('waitForMediaReconnection', EVENT_TRIGGERS.MEETING_RECONNECTION_SUCCESS);

    // @ts-ignore
    this.webex.internal.newMetrics.submitClientEvent({
      name: 'client.media.recovered',
      payload: {
        recoveredBy: 'new',
      },
      options: {
        meetingId: this.meeting.id,
      },
    });
  }

  /**
   * Resend media requests if the meeting is multistream.
   *
   * @returns {Promise<void>}
   */
  protected async maybeResendMediaRequest() {
    if (this.meeting.isMultistream) {
      LoggerProxy.logger.log(
        'ReconnectionPipeline#maybeResendMediaRequest --> Resending media requests'
      );

      Object.values(this.meeting.mediaRequestManagers).forEach(
        (mediaRequestManager: MediaRequestManager) => {
          mediaRequestManager.clearPreviousRequests();
          mediaRequestManager.commit();
        }
      );
    }
  }

  /**
   * Triggers an event in the meeting context.
   *
   * @param {string} func - The function name that is triggering the event.
   * @param {string} event - The event name to trigger.
   * @param {any | undefined} payload - The payload to send with the event.
   *
   * @returns {void}
   */
  protected triggerEvent(func: string, event: string, payload?: any) {
    Trigger.trigger(
      this.meeting,
      {
        file: 'reconnection-manager/reconnection-pipeline',
        function: func,
      },
      event,
      payload
    );
  }
}

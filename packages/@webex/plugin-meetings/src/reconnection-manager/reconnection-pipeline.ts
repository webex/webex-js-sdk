import {Defer} from '@webex/common';
import LoggerProxy from '../common/logs/logger-proxy';
import Trigger from '../common/events/trigger-proxy';
import {
  EVENT_TRIGGERS,
  RECONNECTION,
  SHARE_STATUS,
  SHARE_STOPPED_REASON,
  _CALL_,
  _LEFT_,
  _ID_,
  RECONNECTION_STATE,
} from '../constants';
import {NeedsRejoinError, NeedsRetryError} from '.';
import {MediaRequestManager} from '../multistream/mediaRequestManager';

export default class ReconnectionPipeline {
  webex: any;
  meeting: any;
  iceServersDefer: Defer;
  reconnectionPromise?: Promise<void>;
  wasSharing: boolean;

  constructor(webex: any, meeting: any) {
    this.webex = webex;
    this.meeting = meeting;
    this.iceServersDefer = new Defer();
    this.reconnectionPromise = undefined;
    this.wasSharing = false;
  }

  protected async initializeReconnection(): Promise<void> {
    this.meeting.mediaProperties.webrtcMediaConnection.reconnect(this.iceServersDefer.promise);

    return Promise.resolve();
  }

  protected async startReachabilityCheck() {
    try {
      await this.webex.meetings.startReachability('reconnection');
    } catch (err) {
      LoggerProxy.logger.info(
        'ReconnectionPipeline#startReachabilityCheck --> Reachability failed, continuing with reconnection attempt, err: ',
        err
      );
    }
  }

  protected async maybeStopLocalShareStream() {
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

  protected async maybeReconnectMercuryWebSocket(networkDisconnect: boolean) {
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
   * Syncs meetings after a reconnection.
   */
  protected async syncMeetings() {
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
   */
  protected async verifyMeetingState() {
    if (!this.meeting || !this.webex.meetings.getMeetingByType(_ID_, this.meeting.id)) {
      LoggerProxy.logger.info(
        'ReconnectionPipeline#executeReconnection --> Meeting got deleted due to inactivity or ended remotely.'
      );

      throw new Error('Unable to rejoin a meeting already ended or inactive.');
    }

    LoggerProxy.logger.info(
      `ReconnectionPipeline#executeReconnection --> Current state of meeting is ${this.meeting.state}`
    );

    // If the meeting state was left, no longer reconnect media
    if (this.meeting.state === _LEFT_) {
      if (this.meeting.type === _CALL_) {
        throw new Error('Unable to rejoin a call in LEFT state.');
      }

      throw new NeedsRejoinError({wasSharing: this.wasSharing});
    }
  }

  protected async doTurnDiscovery() {
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

  protected async waitForMediaReconnection(iceServers: any[]) {
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

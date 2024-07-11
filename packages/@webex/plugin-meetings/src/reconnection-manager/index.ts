/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable no-warning-comments */

import LoggerProxy from '../common/logs/logger-proxy';
import Trigger from '../common/events/trigger-proxy';
import {
  _CALL_,
  _ID_,
  _LEFT_,
  EVENT_TRIGGERS,
  RECONNECTION,
  RECONNECTION_STATE,
  SHARE_STATUS,
  SHARE_STOPPED_REASON,
} from '../constants';
import BEHAVIORAL_METRICS from '../metrics/constants';
import ReconnectionError from '../common/errors/reconnection';
import ReconnectionNotStartedError from '../common/errors/reconnection-not-started';
import Metrics from '../metrics';
import Meeting from '../meeting';
import {MediaRequestManager} from '../multistream/mediaRequestManager';

/**
 * Used to indicate that the reconnect logic needs to be retried.
 *
 * @class NeedsRetryError
 * @extends {Error}
 */
class NeedsRetryError extends Error {}

/**
 * Used to indicate that the meeting needs to be rejoined, not just media reconnected
 *
 * @class NeedsRejoinError
 * @extends {Error}
 */
class NeedsRejoinError extends Error {
  wasSharing: any;

  /**
   * Creates an instance of NeedsRejoinError.
   * @param {Object} params
   * @param {boolean} params.wasSharing
   * @param {Error} params.error
   * @memberof NeedsRejoinError
   */
  constructor({
    wasSharing,
    error = new Error('Meeting needs to be rejoined'),
  }: {
    wasSharing?: boolean;
    error?: Error;
  }) {
    // @ts-ignore
    super(error);

    this.wasSharing = wasSharing;
  }
}

/**
 * @export
 * @class ReconnectionManager
 */
export default class ReconnectionManager {
  autoRejoinEnabled: any;
  iceState: any;
  maxRejoinAttempts: any;
  meeting: any;
  rejoinAttempts: any;
  shareStatus: any;
  status: any;
  webex: any;
  /**
   * @param {Meeting} meeting
   */
  constructor(meeting: Meeting) {
    /**
     * Stores ICE reconnection state data.
     *
     * @instance
     * @type {Object}
     * @private
     * @memberof ReconnectionManager
     */
    this.iceState = {
      disconnected: false,
      resolve: () => {},
      timer: undefined,
      // @ts-ignore
      timeoutDuration: meeting.config.reconnection.iceReconnectionTimeout,
    };

    /**
     * @instance
     * @type {RECONNECTION_STATE}
     * @private
     * @memberof ReconnectionManager
     */
    this.status = RECONNECTION.STATE.DEFAULT_STATUS;
    /**
     * @instance
     * @type {Object}
     * @private
     * @memberof ReconnectionManager
     */
    // TODO : change this logic to not save the meeting instance
    // It gets complicated when meeting ends on remote side , We have a old meeting instance which is not up to date
    // @ts-ignore
    this.webex = meeting.webex;
    /**
     * @instance
     * @type {Meeting}
     * @private
     * @memberof ReconnectionManager
     */
    // TODO: try removing the circular dependency for meeting and reconnection manager
    // try moving this to meetings collection
    this.meeting = meeting;

    // @ts-ignore
    this.maxRejoinAttempts = meeting.config.reconnection.maxRejoinAttempts;
    this.rejoinAttempts = 0;
    // @ts-ignore
    this.autoRejoinEnabled = meeting.config.reconnection.autoRejoin;

    // Make sure reconnection state is in default
    this.reset();
  }

  /**
   * @public
   * @memberof ReconnectionManager
   * @returns {void}
   */
  resetReconnectionTimer() {
    this.iceState.resolve();
    this.iceState.resolve = () => {};

    if (this.iceState.timer) {
      clearTimeout(this.iceState.timer);
      delete this.iceState.timer;
    }
  }

  /**
   * Sets the iceState to connected and clears any disconnect timeouts and
   * related timeout data within the iceState.
   *
   * @returns {undefined}
   * @public
   * @memberof ReconnectionManager
   */
  public iceReconnected() {
    if (this.iceState.disconnected) {
      LoggerProxy.logger.log('ReconnectionManager:index#iceReconnected --> ice has reconnected');

      this.resetReconnectionTimer();

      this.iceState.disconnected = false;
    }
  }

  /**
   * Set the iceState to disconnected and generates a timeout that waits for the
   * iceState to reconnect and then resolves. If the ice state is already
   * processing a reconnect, it immediately resolves. Rejects if the timeout
   * duration is reached.
   *
   * @returns {Promise<undefined>}
   * @public
   * @memberof ReconnectionManager
   */
  public waitForIceReconnect() {
    if (!this.iceState.disconnected) {
      LoggerProxy.logger.log(
        'ReconnectionManager:index#waitForIceReconnect --> waiting for ice reconnect'
      );

      this.iceState.disconnected = true;

      return new Promise<void>((resolve, reject) => {
        this.iceState.timer = setTimeout(() => {
          if (this.iceState.disconnected === false) {
            resolve();
          } else {
            this.iceState.disconnected = false;
            reject(
              new Error(`ice reconnection did not occur in ${this.iceState.timeoutDuration}ms`)
            );
          }
        }, this.iceState.timeoutDuration);

        this.iceState.resolve = resolve;
      });
    }

    // return a resolved promise to prevent multiple catch executions of reconnect
    return Promise.resolve();
  }

  /**
   * @returns {undefined}
   * @public
   * @memberof ReconnectionManager
   */
  public reset() {
    this.status = RECONNECTION.STATE.DEFAULT_STATUS;
    this.rejoinAttempts = 0;
  }

  /**
   * @returns {undefined}
   * @public
   * @memberof ReconnectionManager
   */
  public cleanUp() {
    this.reset();
  }

  /**
   * Stop the local share stream.
   *
   * @param {string} reason a {@link SHARE_STOPPED_REASON}
   * @returns {undefined}
   * @private
   * @memberof ReconnectionManager
   */
  private async stopLocalShareStream(reason: string) {
    await this.meeting.unpublishStreams([
      this.meeting.mediaProperties.shareVideoStream,
      this.meeting.mediaProperties.shareAudioStream,
    ]);
    Trigger.trigger(
      this.meeting,
      {
        file: 'reconnection-manager/index',
        function: 'stopLocalShareStream',
      },
      EVENT_TRIGGERS.MEETING_STOPPED_SHARING_LOCAL,
      {
        reason,
      }
    );
  }

  /**
   * @public
   * @memberof ReconnectionManager
   * @returns {Boolean} true if reconnection operation is in progress
   */
  isReconnectInProgress() {
    return this.status === RECONNECTION.STATE.IN_PROGRESS;
  }

  /**
   * @returns {Boolean}
   * @throws {ReconnectInProgress, ReconnectionDisabled}
   * @private
   * @memberof ReconnectionManager
   */
  private canStartReconnection() {
    if (this.meeting.config.reconnection.enabled) {
      if (this.status === RECONNECTION.STATE.DEFAULT_STATUS) {
        return true;
      }

      LoggerProxy.logger.info(
        'ReconnectionManager:index#canStartReconnection --> Reconnection already in progress.'
      );

      return false;
    }

    LoggerProxy.logger.info(
      'ReconnectionManager:index#canStartReconnection --> Reconnection is not enabled.'
    );

    return false;
  }

  /**
   * Initiates a media reconnect for the active meeting
   * @param {Object} reconnectOptions
   * @param {boolean} [reconnectOptions.networkDisconnect=false] indicates if a network disconnect event happened
   * @param {boolean} [reconnectOptions.networkRetry=false] indicates if we are retrying the reconnect
   * @param {Function} [completionCallback] callback that gets called when reconnection is started successfully
   * @returns {Promise}
   * @public
   * @memberof ReconnectionManager
   */
  public async reconnect(
    {
      networkDisconnect = false,
      networkRetry = false,
    }: {
      networkDisconnect?: boolean;
      networkRetry?: boolean;
    } = {},
    completionCallback: (() => Promise<void>) | undefined = undefined
  ) {
    LoggerProxy.logger.info(
      `ReconnectionManager:index#reconnect --> Reconnection start for meeting ${this.meeting.id}.`
    );

    const triggerEvent = (event: string, payload: undefined | Record<string, any> = undefined) =>
      Trigger.trigger(
        this.meeting,
        {
          file: 'reconnection-manager/index',
          function: 'reconnect',
        },
        event,
        payload
      );

    if (!this.canStartReconnection()) {
      throw new ReconnectionNotStartedError();
    }

    try {
      this.status = RECONNECTION.STATE.IN_PROGRESS;

      triggerEvent(EVENT_TRIGGERS.MEETING_RECONNECTION_STARTING);

      if (!networkRetry) {
        // Only log START metrics on the initial reconnect
        LoggerProxy.logger.info(
          'ReconnectionManager:index#reconnect --> Sending reconnect start metric.'
        );

        // @ts-ignore
        this.webex.internal.newMetrics.submitClientEvent({
          name: 'client.media.reconnecting',
          options: {
            meetingId: this.meeting.id,
          },
        });
      }

      try {
        await this.webex.meetings.startReachability();
      } catch (err) {
        LoggerProxy.logger.info(
          'ReconnectionManager:index#reconnect --> Reachability failed, continuing with reconnection attempt, err: ',
          err
        );
      }

      try {
        await this.executeReconnection({networkDisconnect});
      } catch (reconnectError: any) {
        if (reconnectError instanceof NeedsRetryError) {
          LoggerProxy.logger.info(
            'ReconnectionManager:index#reconnect --> Reconnection not successful, retrying.'
          );
          // Reset our reconnect status since we are looping back to the beginning
          this.status = RECONNECTION.STATE.DEFAULT_STATUS;

          // This is a network retry, so we should not log START metrics again
          await this.reconnect({networkDisconnect: true, networkRetry: true}, completionCallback);

          return;
        }

        // Reconnect has failed
        LoggerProxy.logger.error(
          'ReconnectionManager:index#reconnect --> Reconnection failed.',
          reconnectError.message
        );

        // send call aborted event with category as expected as we are trying to rejoin
        // @ts-ignore
        this.webex.internal.newMetrics.submitClientEvent({
          name: 'client.call.aborted',
          payload: {
            errors: [
              {
                category: 'expected',
                errorCode: 2008,
                fatal: true,
                name: 'media-engine',
                shownToUser: false,
              },
            ],
          },
          options: {
            meetingId: this.meeting.id,
          },
        });

        if (reconnectError instanceof NeedsRejoinError && this.autoRejoinEnabled) {
          await this.rejoinMeeting(reconnectError.wasSharing);

          return;
        }

        throw reconnectError;
      }

      // finalize the reconnection process by calling the completionCallback
      if (completionCallback) {
        await completionCallback();
      }

      triggerEvent(EVENT_TRIGGERS.MEETING_RECONNECTION_SUCCESS);

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
    } catch (error: any) {
      triggerEvent(EVENT_TRIGGERS.MEETING_RECONNECTION_FAILURE, {
        error: new ReconnectionError('Reconnection failure event', error),
      });

      Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MEETING_RECONNECT_FAILURE, {
        correlation_id: this.meeting.correlationId,
        locus_id: this.meeting.locusUrl.split('/').pop(),
        reason: error.message,
        stack: error.stack,
      });

      throw new ReconnectionError('Reconnection failure event', error);
    } finally {
      this.reset();
    }
  }

  /**
   * @param {Object} reconnectOptions
   * @param {boolean} [reconnectOptions.networkDisconnect=false] indicates if a network disconnect event happened
   * @returns {Promise}
   * @throws {NeedsRetryError}
   * @private
   * @memberof ReconnectionManager
   */
  private async executeReconnection({networkDisconnect = false}: {networkDisconnect?: boolean}) {
    LoggerProxy.logger.info(
      'ReconnectionManager:index#executeReconnection --> Attempting to reconnect to meeting.'
    );

    const wasSharing = this.meeting.shareStatus === SHARE_STATUS.LOCAL_SHARE_ACTIVE;

    if (wasSharing) {
      await this.stopLocalShareStream(SHARE_STOPPED_REASON.MEDIA_RECONNECTION);
    }

    if (networkDisconnect) {
      try {
        await this.reconnectMercuryWebSocket();
        LoggerProxy.logger.error(
          'ReconnectionManager:index#executeReconnection --> Websocket reconnected.',
          this.webex.internal.device.url
        );
      } catch (error: unknown) {
        LoggerProxy.logger.error(
          'ReconnectionManager:index#executeReconnection --> Unable to reconnect to websocket, giving up.'
        );
        this.status = RECONNECTION.STATE.FAILURE;
        throw error;
      }
    }

    try {
      LoggerProxy.logger.info(
        'ReconnectionManager:index#executeReconnection --> Updating meeting data from server.'
      );
      await this.webex.meetings.syncMeetings({keepOnlyLocusMeetings: false});
    } catch (syncError: any) {
      LoggerProxy.logger.info(
        'ReconnectionManager:index#executeReconnection --> Unable to sync meetings, reconnecting.',
        syncError
      );
      throw new NeedsRetryError(syncError);
    }

    // TODO: try to improve this logic as the reconnection manager saves the instance of deleted meeting object
    // So that on rejoin it known what parametrs it was using
    if (!this.meeting || !this.webex.meetings.getMeetingByType(_ID_, this.meeting.id)) {
      LoggerProxy.logger.info(
        'ReconnectionManager:index#executeReconnection --> Meeting got deleted due to inactivity or ended remotely.'
      );

      throw new Error('Unable to rejoin a meeting already ended or inactive.');
    }

    LoggerProxy.logger.info(
      `ReconnectionManager:index#executeReconnection --> Current state of meeting is ${this.meeting.state}`
    );

    // If the meeting state was left, no longer reconnect media
    if (this.meeting.state === _LEFT_) {
      if (this.meeting.type === _CALL_) {
        throw new Error('Unable to rejoin a call in LEFT state.');
      }

      throw new NeedsRejoinError({wasSharing});
    }

    try {
      const media = await this.reconnectMedia();

      LoggerProxy.logger.log(
        'ReconnectionManager:index#executeReconnection --> webRTC media connection renewed and local sdp offer sent'
      );

      return media;
    } catch (error) {
      LoggerProxy.logger.error(
        'ReconnectionManager:index#executeReconnection --> failed to renew webRTC media connection or initiate offer'
      );
      this.status = RECONNECTION.STATE.FAILURE;

      throw error;
    }
  }

  /**
   * Rejoins a meeting after detecting the member was in a LEFT state
   *
   * @async
   * @param {boolean} wasSharing
   * @returns {Promise}
   */
  async rejoinMeeting(wasSharing = false) {
    try {
      LoggerProxy.logger.info(
        'ReconnectionManager:index#rejoinMeeting --> attemping meeting rejoin'
      );

      await this.meeting.join({rejoin: true});
      LoggerProxy.logger.info('ReconnectionManager:index#rejoinMeeting --> meeting rejoined');

      if (wasSharing) {
        await this.stopLocalShareStream(SHARE_STOPPED_REASON.MEETING_REJOIN);
      }
    } catch (joinError: any) {
      this.rejoinAttempts += 1;
      if (this.rejoinAttempts <= this.maxRejoinAttempts) {
        LoggerProxy.logger.info(
          `ReconnectionManager:index#rejoinMeeting --> Unable to rejoin meeting, attempt #${this.rejoinAttempts}, retrying.`,
          joinError
        );
        this.rejoinMeeting();
      } else {
        LoggerProxy.logger.error(
          'ReconnectionManager:index#rejoinMeeting --> Unable to rejoin meeting after max attempts.',
          joinError
        );
        Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.MEETING_MAX_REJOIN_FAILURE, {
          locus_id: this.meeting.locusUrl.split('/').pop(),
          reason: joinError.message,
          stack: joinError.stack,
        });
        this.status = RECONNECTION.STATE.FAILURE;
        throw joinError;
      }
    }

    try {
      await this.reconnectMedia();
    } catch (mediaError) {
      LoggerProxy.logger.error(
        'ReconnectionManager:index#rejoinMeeting --> Unable to reestablish media after rejoining.',
        mediaError
      );
      throw mediaError;
    }
  }

  /**
   * @returns {Promise}
   * @private
   * @memberof ReconnectionManager
   */
  async reconnectMedia() {
    LoggerProxy.logger.log('ReconnectionManager:index#reconnectMedia --> do turn discovery');

    // do the TURN server discovery again and ignore reachability results since the TURN server might change
    const turnServerResult = await this.meeting.roap.doTurnDiscovery(this.meeting, true, true);

    const iceServers = [];

    if (turnServerResult.turnServerInfo?.url) {
      iceServers.push({
        urls: turnServerResult.turnServerInfo.url,
        username: turnServerResult.turnServerInfo.username || '',
        credential: turnServerResult.turnServerInfo.password || '',
      });
    }

    LoggerProxy.logger.log(
      'ReconnectionManager:index#reconnectMedia --> renew webRTC media connection and send local sdp offer'
    );

    await this.meeting.mediaProperties.webrtcMediaConnection.reconnect(iceServers);

    // resend media requests
    if (this.meeting.isMultistream) {
      (Object.values(this.meeting.mediaRequestManagers) as MediaRequestManager[]).forEach(
        (mediaRequestManager: MediaRequestManager) => {
          mediaRequestManager.clearPreviousRequests();
          mediaRequestManager.commit();
        }
      );
    }
  }

  /**
   * Attempt to Reconnect Mercury Websocket
   * @returns {Promise}
   * @private
   * @memberof ReconnectionManager
   */
  private async reconnectMercuryWebSocket() {
    LoggerProxy.logger.info(
      'ReconnectionManager:index#reconnectMercuryWebSocket --> Reconnecting websocket.'
    );
    // First, attempt to disconnect if we think we are already connected.
    if (this.webex.internal.mercury.connected) {
      LoggerProxy.logger.info(
        'ReconnectionManager:index#reconnectMercuryWebSocket --> Disconnecting existing websocket.'
      );
      try {
        await this.webex.internal.mercury.disconnect();
        LoggerProxy.logger.info(
          'ReconnectionManager:index#reconnectMercuryWebSocket --> Websocket disconnected successfully.'
        );
      } catch (disconnectError) {
        // If we can't disconnect, the sdk is in such a bad state that reconnecting is not going to happen.
        LoggerProxy.logger.error(
          'ReconnectionManager:index#reconnectMercuryWebSocket --> Unable to disconnect from websocket, giving up.',
          disconnectError
        );
        throw disconnectError;
      }
    }

    try {
      LoggerProxy.logger.info(
        'ReconnectionManager:index#reconnectMercuryWebSocket --> Connecting websocket.'
      );
      await this.webex.internal.mercury.connect();
      LoggerProxy.logger.info(
        'ReconnectionManager:index#reconnectMercuryWebSocket --> Websocket connected successfully.'
      );
    } catch (connectError) {
      LoggerProxy.logger.error(
        'ReconnectionManager:index#reconnectMercuryWebSocket --> Unable to connect to websocket, giving up.',
        connectError
      );

      throw connectError;
    }
  }
}

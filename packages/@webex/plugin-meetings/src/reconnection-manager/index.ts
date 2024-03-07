/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable no-warning-comments */

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
import BEHAVIORAL_METRICS from '../metrics/constants';
import ReconnectInProgress from '../common/errors/reconnection-in-progress';
import Metrics from '../metrics';
import Meeting from '../meeting';
import {MediaRequestManager} from '../multistream/mediaRequestManager';
import ReconnectionError from '../common/errors/reconnection';

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
  tryCount: any;
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
     * @type {Number}
     * @private
     * @memberof ReconnectionManager
     */
    this.tryCount = RECONNECTION.STATE.DEFAULT_TRY_COUNT;
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
    this.rejoinAttempts = RECONNECTION.STATE.DEFAULT_TRY_COUNT;
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
    this.tryCount = RECONNECTION.STATE.DEFAULT_TRY_COUNT;
    this.rejoinAttempts = RECONNECTION.STATE.DEFAULT_TRY_COUNT;
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
   * Sets the reconnection status
   *
   * @public
   * @param {RECONNECTION_STATE} status
   * @memberof ReconnectionManager
   * @returns {undefined}
   */
  public setStatus(status: RECONNECTION_STATE) {
    this.status = status;
  }

  /**
   * @returns {Boolean}
   * @throws {ReconnectionError}
   * @private
   * @memberof ReconnectionManager
   */
  private validate() {
    if (this.meeting.config.reconnection.enabled) {
      if (
        this.status === RECONNECTION.STATE.DEFAULT_STATUS ||
        this.status === RECONNECTION.STATE.COMPLETE
      ) {
        return true;
      }

      LoggerProxy.logger.info(
        'ReconnectionManager:index#validate --> Reconnection already in progress.'
      );

      throw new ReconnectInProgress('Reconnection already in progress.');
    }

    LoggerProxy.logger.info('ReconnectionManager:index#validate --> Reconnection is not enabled.');

    throw new ReconnectionError('Reconnection is not enabled.');
  }

  /**
   * Initiates a media reconnect for the active meeting
   * @param {Object} reconnectOptions
   * @param {boolean} [reconnectOptions.networkDisconnect=false] indicates if a network disconnect event happened
   * @param {boolean} [reconnectOptions.networkRetry=false] indicates if we are retrying the reconnect
   * @returns {Promise}
   * @public
   * @memberof ReconnectionManager
   */
  public async reconnect({
    networkDisconnect = false,
    networkRetry = false,
  }: {
    networkDisconnect?: boolean;
    networkRetry?: boolean;
  } = {}) {
    LoggerProxy.logger.info(
      `ReconnectionManager:index#reconnect --> Reconnection start for meeting ${this.meeting.id}.`
    );
    // First, validate that we can reconnect, if not, it will throw an error
    try {
      this.validate();
    } catch (error) {
      LoggerProxy.logger.info(
        'ReconnectionManager:index#reconnect --> Reconnection unable to begin.',
        error
      );
      throw error;
    }

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
      const media = await this.executeReconnection({networkDisconnect});

      return media;
    } catch (reconnectError) {
      if (reconnectError instanceof NeedsRetryError) {
        LoggerProxy.logger.info(
          'ReconnectionManager:index#reconnect --> Reconnection not successful, retrying.'
        );
        // Reset our reconnect status since we are looping back to the beginning
        this.status = RECONNECTION.STATE.DEFAULT_STATUS;

        // This is a network retry, so we should not log START metrics again
        return this.reconnect({networkDisconnect: true, networkRetry: true});
      }

      // Reconnect has failed
      LoggerProxy.logger.error(
        'ReconnectionManager:index#reconnect --> Reconnection failed.',
        reconnectError.message
      );
      LoggerProxy.logger.info(
        'ReconnectionManager:index#reconnect --> Sending reconnect abort metric.'
      );

      // send call aborted event with catogery as expected as we are trying to rejoin
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
        return this.rejoinMeeting(reconnectError.wasSharing);
      }

      throw reconnectError;
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
    this.status = RECONNECTION.STATE.IN_PROGRESS;

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
      } catch (error) {
        LoggerProxy.logger.error(
          'ReconnectionManager:index#executeReconnection --> Unable to reconnect to websocket, giving up.'
        );
        this.status = RECONNECTION.STATE.FAILURE;
        throw error;
      }
    }

    if (!this.webex.credentials.isUnverifiedGuest) {
      try {
        LoggerProxy.logger.info(
          'ReconnectionManager:index#executeReconnection --> Updating meeting data from server.'
        );
        await this.webex.meetings.syncMeetings({keepOnlyLocusMeetings: false});
      } catch (syncError) {
        LoggerProxy.logger.info(
          'ReconnectionManager:index#executeReconnection --> Unable to sync meetings, reconnecting.',
          syncError
        );
        throw new NeedsRetryError(syncError);
      }
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
    } catch (joinError) {
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

    if (turnServerResult.turnServerInfo) {
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
      Object.values(this.meeting.mediaRequestManagers).forEach(
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

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
import ReconnectionError from '../common/errors/reconnection';
import ReconnectionNotStartedError from '../common/errors/reconnection-not-started';
import Metrics from '../metrics';
import Meeting from '../meeting';
import {MediaRequestManager} from '../multistream/mediaRequestManager';
import {Defer} from '@webex/common';
import ReconnectionPipeline from './reconnection-pipeline';
import MediaReconnectionPipeline from './media-reconnection-pipeline';
import MeetingReconnectionPipeline from './meeting-reconnection-pipeline';

/**
 * Used to indicate that the reconnect logic needs to be retried.
 *
 * @class NeedsRetryError
 * @extends {Error}
 */
export class NeedsRetryError extends Error {}

/**
 * Used to indicate that the meeting needs to be rejoined, not just media reconnected
 *
 * @class NeedsRejoinError
 * @extends {Error}
 */
export class NeedsRejoinError extends Error {
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
  iceServersDefer?: Defer;
  reconnectionPromise?: Promise<void>;

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
    this.iceServersDefer = undefined;
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
  public async reconnect({
    networkDisconnect = false,
  }: {
    networkDisconnect?: boolean;
  } = {}) {
    LoggerProxy.logger.info(
      `ReconnectionManager:index#reconnect --> Reconnection start for meeting ${this.meeting.id}.`
    );

    const triggerEvent = (event, payload = undefined) =>
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

      await this.processReconnection(networkDisconnect);
    } catch (error) {
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
   * Processes the reconnection logic when a network disconnect occurs.
   */
  private async processReconnection(networkDisconnect: boolean) {
    const meetingRejoinAttempts = 0;

    try {
      await this.executeMediaReconnectionPipeline(networkDisconnect);
    } catch (reconnectError) {
      if (reconnectError instanceof NeedsRejoinError && this.autoRejoinEnabled) {
        await this.executeMeetingReconnectionPipeline();
      }

      throw reconnectError;
    }
  }

  private async executeMediaReconnectionPipeline(networkDisconnect: boolean) {
    try {
      const reconnectionPipeline = new MediaReconnectionPipeline(this.meeting, this.webex);

      await reconnectionPipeline.startMediaReconnection({
        networkDisconnect,
      });
    } catch (reconnectError) {
      if (reconnectError instanceof NeedsRetryError) {
        LoggerProxy.logger.info(
          'ReconnectionManager:index#reconnect --> Reconnection not successful, retrying.'
        );
        // Reset our reconnect status since we are looping back to the beginning
        this.status = RECONNECTION.STATE.DEFAULT_STATUS;

        // This is a network retry, so we should not log START metrics again
        await this.executeMediaReconnectionPipeline(networkDisconnect);
      } else {
        throw reconnectError;
      }
    }
  }

  private async executeMeetingReconnectionPipeline() {
    try {
      const reconnectionPipeline = new MeetingReconnectionPipeline(this.meeting, this.webex);

      await reconnectionPipeline.startMeetingReconnection();
    } catch (reconnectError) {}
  }
}

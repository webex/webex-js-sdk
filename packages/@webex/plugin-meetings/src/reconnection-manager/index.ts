/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable no-warning-comments */

import LoggerProxy from '../common/logs/logger-proxy';
import Trigger from '../common/events/trigger-proxy';
import {EVENT_TRIGGERS, RECONNECTION} from '../constants';
import BEHAVIORAL_METRICS from '../metrics/constants';
import ReconnectionError from '../common/errors/reconnection';
import ReconnectionNotStartedError from '../common/errors/reconnection-not-started';
import Metrics from '../metrics';
import Meeting from '../meeting';
import MediaReconnectionPipeline from './media-reconnection-pipeline';
import MeetingReconnectionPipeline from './meeting-reconnection-pipeline';
import {NeedsRetryError, NeedsRejoinError} from './types';

export type ReconnectionManagerOptions = {
  isReconnectionEnabled: boolean;
  autoRejoinEnabled: boolean;
  maxRejoinAttempts: number;
};

/**
 * @export
 * @class ReconnectionManager
 */
export default class ReconnectionManager {
  options: ReconnectionManagerOptions;
  iceState: any;
  meeting: any;
  status: any;
  webex: any;

  /**
   * @param {Meeting} meeting
   * @param {ReconnectionManagerOptions} options
   */
  constructor(
    meeting: Meeting,
    options: ReconnectionManagerOptions = {
      isReconnectionEnabled: true,
      autoRejoinEnabled: true,
      maxRejoinAttempts: 3,
    } // Default options
  ) {
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

    this.options = options;

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
    if (this.options.isReconnectionEnabled) {
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
   *
   * @param {boolean} networkDisconnect - Indicates if the reconnection is due to a network disconnect.
   *
   * @returns {Promise<void>}
   */
  private async processReconnection(networkDisconnect: boolean): Promise<void> {
    try {
      await this.executeMediaReconnectionPipeline(networkDisconnect);
    } catch (reconnectError) {
      if (reconnectError instanceof NeedsRejoinError && this.options.autoRejoinEnabled) {
        await this.executeMeetingReconnectionPipeline();
      } else {
        throw reconnectError;
      }
    }
  }

  /**
   * Executes the media reconnection pipeline for the meeting.
   *
   * @param {boolean} networkDisconnect - Indicates if the reconnection is due to a network disconnect.
   *
   * @returns {Promise<void>}
   */
  private async executeMediaReconnectionPipeline(networkDisconnect: boolean) {
    try {
      const reconnectionPipeline = new MediaReconnectionPipeline(this.webex, this.meeting);

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

  /**
   * Executes the meeting reconnection pipeline for the meeting.
   * @param {number} attempt The number of attempts made to reconnect.
   *
   * @returns {Promise<void>}
   */
  private async executeMeetingReconnectionPipeline(attempt = 0): Promise<void> {
    try {
      const reconnectionPipeline = new MeetingReconnectionPipeline(this.webex, this.meeting);

      await reconnectionPipeline.startMeetingReconnection();
    } catch (joinError) {
      if (attempt > this.options.maxRejoinAttempts) {
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
      } else {
        LoggerProxy.logger.info(
          `ReconnectionManager:index#rejoinMeeting --> Unable to rejoin meeting, attempt #${attempt}, retrying.`,
          joinError
        );

        this.executeMeetingReconnectionPipeline(attempt + 1);
      }
    }
  }
}

/* eslint-disable no-param-reassign */
import {Media as WebRTCMedia} from '@webex/internal-media-core';

import BEHAVIORAL_METRICS from '../metrics/constants';
import Metrics from '../metrics';
import MediaUtil from '../media/util';
import LoggerProxy from '../common/logs/logger-proxy';
import {BNR_STATUS} from '../constants';

const createEffectsState = (type: any) => {
  LoggerProxy.logger.info(
    `Meeting:effectState#createEffectsState --> creating effectsState for effect ${type}`
  );

  return new EffectsState(type);
};

/* The purpose of this class is to manage the effects state(for eg., BNR).
 */
class EffectsState {
  effectType: any;
  pendingPromiseReject: any;
  pendingPromiseResolve: any;
  state: any;

  constructor(type: any) {
    this.effectType = type;
    this.state = {
      bnr: {
        enabled: BNR_STATUS.NOT_ENABLED,
      },
      callToWebrtcBNRInProgress: false,
    };
    // these 2 hold the resolve, reject methods for the promise we returned to the client in last handleClientRequest() call
    this.pendingPromiseResolve = null;
    this.pendingPromiseReject = null;
  }

  /**
   * @memberof EffectsState
   * @param {Boolean} [isEnable] true for enableBNR, false for disableBNR request
   * @param {Object} [meeting] the meeting object
   * @returns {Promise}
   */
  async handleClientRequest(isEnable?: boolean, meeting?: object) {
    return new Promise((resolve, reject) => {
      if (this.pendingPromiseResolve) {
        // resolve the last promise we returned to the client as the client has issued a new request that has superseded the previous one
        this.pendingPromiseResolve(true);
      }
      this.pendingPromiseResolve = resolve;
      this.pendingPromiseReject = reject;

      if (isEnable) this.enableBNR(meeting);
      else this.disableBNR(meeting);
    });
  }

  /**
   * Internal API to return status of BNR
   * @memberof EffectsState
   * @returns {Boolean}
   * @public
   * @memberof Meeting
   */
  public isBnrEnabled() {
    return this.state.bnr.enabled === BNR_STATUS.ENABLED;
  }

  resolvePromise() {
    if (this.pendingPromiseResolve) {
      this.pendingPromiseResolve(true);
    }
    this.pendingPromiseResolve = null;
    this.pendingPromiseReject = null;
  }

  rejectPromise(e) {
    if (this.pendingPromiseReject) {
      this.pendingPromiseReject(e);
    }
    this.pendingPromiseResolve = null;
    this.pendingPromiseReject = null;
  }

  /**
   * enableBNR API
   * @param {Object} meeting the meeting object
   * @returns {Promise<Boolean>}
   * @public
   * @memberof EffectsState
   */
  public async enableBNR(meeting: any) {
    LoggerProxy.logger.info('Meeting:effectState#enableBNR. Enable BNR called');

    if (this.isBnrEnabled()) {
      LoggerProxy.logger.warn('Meeting:index#enableBNR. BNR is already enabled');

      return this.resolvePromise();
    }

    if (this.state.callToWebrtcBNRInProgress) {
      LoggerProxy.logger.warn(
        'Meeting:effectState#enableBNR. Call to WebRTC in progress, we need to wait for it to complete'
      );

      return this.resolvePromise();
    }

    const {bnr} = this.state;

    try {
      bnr.enabled = BNR_STATUS.SHOULD_ENABLE;
      this.state.callToWebrtcBNRInProgress = true;
      const audioStream = MediaUtil.createMediaStream([meeting.mediaProperties.audioTrack]);

      LoggerProxy.logger.info(
        'Meeting:effectState#enableBNR. MediaStream created from meeting & sent to updateAudio'
      );
      await meeting.updateAudio({
        sendAudio: true,
        receiveAudio: meeting.mediaProperties.mediaDirection.receiveAudio,
        stream: audioStream,
      });

      LoggerProxy.logger.info(
        'Meeting:effectState#enableBNR. Updated meeting audio with bnr enabled track'
      );
      bnr.enabled = BNR_STATUS.ENABLED;
      this.state.callToWebrtcBNRInProgress = false;
      Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.ENABLE_BNR_SUCCESS);
    } catch (error) {
      bnr.enabled = BNR_STATUS.NOT_ENABLED;
      this.state.callToWebrtcBNRInProgress = false;
      LoggerProxy.logger.error('Meeting:index#enableBNR.', error);

      Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.ENABLE_BNR_FAILURE, {
        reason: error.message,
        stack: error.stack,
      });

      return this.rejectPromise(error);
    }

    return this.resolvePromise();
  }

  /**
   * disableBNR API
   * @param {Object} meeting the meeting object
   * @returns {Promise<Boolean>}
   * @public
   * @memberof EffectsState
   */
  public async disableBNR(meeting: any) {
    LoggerProxy.logger.info('Meeting:effectState#disableBNR. Disable BNR called');

    const {bnr} = this.state;

    try {
      if (this.state.callToWebrtcBNRInProgress) {
        LoggerProxy.logger.info(
          'Meeting:effectState#disableBNR. Call to WebRTC in progress, we need to wait for it to complete'
        );

        return this.resolvePromise();
      }

      bnr.enabled = BNR_STATUS.SHOULD_DISABLE;
      this.state.callToWebrtcBNRInProgress = true;

      // @ts-ignore - disableBNR does not expect an argument
      const audioTrack = WebRTCMedia.Effects.BNR.disableBNR(meeting.mediaProperties.audioTrack);

      const audioStream = MediaUtil.createMediaStream([audioTrack]);

      LoggerProxy.logger.info(
        'Meeting:effectState#disableBNR. Raw media track obtained from WebRTC & sent to updateAudio'
      );

      await meeting.updateAudio({
        sendAudio: true,
        receiveAudio: meeting.mediaProperties.mediaDirection.receiveAudio,
        stream: audioStream,
      });

      bnr.enabled = BNR_STATUS.NOT_ENABLED;

      this.state.callToWebrtcBNRInProgress = false;

      Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.DISABLE_BNR_SUCCESS);
    } catch (error) {
      bnr.enabled = BNR_STATUS.ENABLED;
      this.state.callToWebrtcBNRInProgress = false;
      LoggerProxy.logger.error(`Meeting:index#disableBNR. ${error}`);

      Metrics.sendBehavioralMetric(BEHAVIORAL_METRICS.DISABLE_BNR_FAILURE, {
        reason: error.message,
        stack: error.stack,
      });

      return this.rejectPromise(error);
    }

    return this.resolvePromise();
  }
}

export default createEffectsState;

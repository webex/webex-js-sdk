import {camelCase} from 'lodash';
import PermissionError from '../common/errors/permission';
import {CONTROLS, HTTP_VERBS} from '../constants';
import MeetingRequest from '../meeting/request';
import LoggerProxy from '../common/logs/logger-proxy';
import Setting from './enums';
import Util from './util';
import {CAN_SET, CAN_UNSET, ENABLED} from './constants';

/**
 * docs
 * https://sqbu-github.cisco.com/pages/WebExSquared/locus/guides/mute.html
 * https://confluence-eng-gpk2.cisco.com/conf/display/LOCUS/Hard+Mute+and+Audio+Privacy#HardMuteandAudioPrivacy-SelfMuteonEntry
 * https://confluence-eng-gpk2.cisco.com/conf/pages/viewpage.action?spaceKey=UC&title=WEBEX-124454%3A+UCF%3A+Hard+mute+support+for+Teams+joining+Webex+meeting
 * https://jira-eng-gpk2.cisco.com/jira/browse/SPARK-180867
 * https://jira-eng-gpk2.cisco.com/jira/browse/SPARK-393351
 */

/**
 * @description ControlsOptionsManager is responsible for handling the behavior of participant controls when somebody joins a meeting
 * @export
 * @private
 * @class Recording
 */
export default class ControlsOptionsManager {
  /**
   * @instance
   * @type {MeetingRequest}
   * @private
   * @memberof ControlsOptionsManager
   */
  private request: MeetingRequest;

  /**
   * @instance
   * @type {Array}
   * @private
   * @memberof ControlsOptionsManager
   */
  private displayHints: Array<string> = [];

  /**
   * @instance
   * @type {string}
   * @private
   * @memberof ControlsOptionsManager
   */
  private locusUrl: string;

  /**
   * @param {MeetingRequest} request
   * @param {Object} options
   * @constructor
   * @memberof ControlsOptionsManager
   */
  constructor(
    request: MeetingRequest,
    options?: {
      locusUrl: string;
      displayHints?: Array<string>;
    }
  ) {
    this.initialize(request);
    this.set(options);
  }

  /**
   * @param {MeetingRequest} request
   * @returns {void}
   * @private
   * @memberof ControlsOptionsManager
   */
  private initialize(request: MeetingRequest) {
    this.request = request;
  }

  /**
   * @param {Object} options
   * @returns {void}
   * @public
   * @memberof ControlsOptionsManager
   */
  public set(options?: {locusUrl: string; displayHints?: Array<string>}) {
    this.extract(options);
  }

  /**
   * @param {string} url
   * @returns {void}
   * @public
   * @memberof ControlsOptionsManager
   */
  public setLocusUrl(url: string) {
    this.locusUrl = url;
  }

  /**
   * @param {Array} hints
   * @returns {void}
   * @public
   * @memberof ControlsOptionsManager
   */
  public setDisplayHints(hints: Array<string>) {
    this.displayHints = hints;
  }

  /**
   * @returns {string}
   * @public
   * @memberof ControlsOptionsManager
   */
  public getLocusUrl() {
    return this.locusUrl;
  }

  /**
   * @returns {Array}
   * @public
   * @memberof ControlsOptionsManager
   */
  public getDisplayHints() {
    return this.displayHints;
  }

  /**
   * @param {Object} options
   * @returns {void}
   * @private
   * @memberof ControlsOptionsManager
   */
  private extract(options?: {locusUrl: string; displayHints?: Array<string>}) {
    this.setDisplayHints(options?.displayHints);
    this.setLocusUrl(options?.locusUrl);
  }

  /**
   * @param {Setting} setting
   * @private
   * @memberof ControlsOptionsManager
   * @returns {Promise}
   */
  private setControls(setting: {[key in Setting]?: boolean}): Promise<any> {
    const muteUnmuteAll = Object.keys(setting).includes(Setting.muted);

    const body = muteUnmuteAll ? {audio: {}} : {};
    for (const [key, value] of Object.entries(setting)) {
      LoggerProxy.logger.log(`ControlsOptionsManager:index#setControls --> ${key} [${value}]`);
      // mute unmute all has different body structure than toggling disable hard mute
      // or mute on entry by themselves
      if (muteUnmuteAll) {
        if (Util?.[`${value ? CAN_SET : CAN_UNSET}${Setting.muted}`](this.displayHints)) {
          body.audio[camelCase(key)] = value;
        } else {
          return Promise.reject(
            new PermissionError(
              `${Setting.muted} [${value}] not allowed, due to moderator property.`
            )
          );
        }
      } else if (Util?.[`${value ? CAN_SET : CAN_UNSET}${key}`](this.displayHints)) {
        body[camelCase(key)] = {
          [ENABLED]: value,
        };
      } else {
        return Promise.reject(
          new PermissionError(`${key} [${value}] not allowed, due to moderator property.`)
        );
      }
    }

    // @ts-ignore
    return this.request.request({
      uri: `${this.locusUrl}/${CONTROLS}`,
      body,
      method: HTTP_VERBS.PATCH,
    });
  }

  /**
   * @public
   * @param {boolean} enabled
   * @memberof ControlsOptionsManager
   * @returns {Promise}
   */
  public setMuteOnEntry(enabled: boolean): Promise<any> {
    return this.setControls({[Setting.muteOnEntry]: enabled});
  }

  /**
   * @public
   * @param {boolean} enabled
   * @memberof ControlsOptionsManager
   * @returns {Promise}
   */
  public setDisallowUnmute(enabled: boolean): Promise<any> {
    return this.setControls({[Setting.disallowUnmute]: enabled});
  }

  /**
   * @public
   * @param {boolean} mutedEnabled
   * @param {boolean} disallowUnmuteEnabled
   * @param {boolean} muteOnEntryEnabled
   * @memberof ControlsOptionsManager
   * @returns {Promise}
   */
  public setMuteAll(
    mutedEnabled: boolean,
    disallowUnmuteEnabled: boolean,
    muteOnEntryEnabled: boolean
  ): Promise<any> {
    return this.setControls({
      [Setting.muted]: mutedEnabled,
      [Setting.disallowUnmute]: disallowUnmuteEnabled,
      [Setting.muteOnEntry]: muteOnEntryEnabled,
    });
  }
}

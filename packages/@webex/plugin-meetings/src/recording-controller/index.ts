import PermissionError from '../common/errors/permission';
import {CONTROLS, HTTP_VERBS} from '../constants';
import LocusInfo from '../locus-info';
import MeetingRequest from '../meeting/request';
import MeetingUtil from '../meeting/util';
import RecordingAction from './enums';
import Util from './util';
import LoggerProxy from '../common/logs/logger-proxy';

/**
 * @description Recording manages the recording functionality of the meeting object, there should only be one instantation of recording per meeting
 * @export
 * @private
 * @class Recording
 */
export default class RecordingController {
  /**
   * @instance
   * @type {MeetingRequest}
   * @private
   * @memberof RecordingController
   */
  private request: MeetingRequest;
  /**
   * @instance
   * @type {MeetingRequest}
   * @private
   * @memberof RecordingController
   */
  private info: LocusInfo;

  /**
   * @instance
   * @type {string}
   * @private
   * @memberof RecordingInfo
   */
  private serviceUrl: string;

  /**
   * @instance
   * @type {string}
   * @private
   * @memberof RecordingInfo
   */
  private sessionId: string;

  /**
   * @instance
   * @type {string}
   * @private
   * @memberof RecordingInfo
   */
  private locusUrl: string;

  /**
   * @instance
   * @type {string}
   * @private
   * @memberof RecordingInfo
   */
  private locusId: string;

  /**
   * @param {MeetingRequest} request
   * @param {LocusInfo} info
   * @constructor
   * @memberof RecordingController
   */
  constructor(request: MeetingRequest, info: LocusInfo) {
    this.initialize(request, info);
  }

  /**
   * @param {MeetingRequest} request
   * @param {LocusInfo} info
   * @returns {void}
   * @private
   * @memberof RecordingController
   */
  private initialize(request: MeetingRequest, info: LocusInfo) {
    this.request = request;
    this.info = info;
    this.extract(info);
  }

  /**
   * @param {LocusInfo} info
   * @returns {void}
   * @public
   * @memberof RecordingController
   */
  public set(info: LocusInfo) {
    this.extract(info);
  }

  /**
   * @param {LocusInfo} info
   * @returns {void}
   * @private
   * @memberof RecordingController
   */
  private extract(info: LocusInfo) {
    this.serviceUrl = info?.services?.record?.url;
    this.sessionId = info?.fullState?.sessionId;
    this.locusUrl = info?.url;
    this.locusId = info?.url?.split('/').pop();
    LoggerProxy.logger.log(
      `RecordingController:index#extract --> [${this.serviceUrl}, ${this.sessionId}, ${this.locusUrl}, ${this.locusId}]`
    );
  }

  /**
   * @param {RecordingAction} action
   * @private
   * @memberof RecordingController
   * @returns {Promise}
   */
  private recordingService(action: RecordingAction): Promise<any> {
    return this.request.recordMeeting({
      body: {
        meetingInfo: {
          locusSessionId: this.sessionId,
        },
        recording: {
          action: action.toLowerCase(),
        },
      },
      uri: `${this.serviceUrl}/loci/${this.locusId}/recording`,
      method: HTTP_VERBS.PUT,
    });
  }

  /**
   * @param {RecordingAction} action
   * @private
   * @memberof RecordingController
   * @returns {Promise}
   */
  private recordingControls(action: RecordingAction): Promise<any> {
    const record = Util.deriveRecordingStates(action);

    LoggerProxy.logger.log(`RecordingController:index#recordingControls --> ${record}`);

    return this.request.recordMeeting({
      uri: `${this.locusUrl}/${CONTROLS}`,
      body: {
        record,
      },
      method: HTTP_VERBS.PATCH,
    });
  }

  /**
   * @param {RecordingAction} action
   * @private
   * @memberof RecordingController
   * @returns {Promise}
   */
  private recordingFacade(action: RecordingAction): Promise<any> {
    LoggerProxy.logger.log(
      `RecordingController:index#recordingFacade --> recording action [${action}]`
    );

    // assumes action is proper cased (i.e., Example)
    if (Util?.[`canUser${action}`](MeetingUtil.getUserDisplayHintsFromLocusInfo(this.info))) {
      if (this.serviceUrl) {
        return this.recordingService(action);
      }

      return this.recordingControls(action);
    }

    return Promise.reject(
      new PermissionError(`${action} recording not allowed, due to moderator property.`)
    );
  }

  /**
   * @private
   * @memberof RecordingController
   * @returns {Promise}
   */
  public startRecording(): Promise<any> {
    return this.recordingFacade(RecordingAction.Start);
  }

  /**
   * @private
   * @memberof RecordingController
   * @returns {Promise}
   */
  public stopRecording(): Promise<any> {
    return this.recordingFacade(RecordingAction.Stop);
  }

  /**
   * @private
   * @memberof RecordingController
   * @returns {Promise}
   */
  public pauseRecording(): Promise<any> {
    return this.recordingFacade(RecordingAction.Pause);
  }

  /**
   * @private
   * @memberof RecordingController
   * @returns {Promise}
   */
  public resumeRecording(): Promise<any> {
    return this.recordingFacade(RecordingAction.Resume);
  }
}

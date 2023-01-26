import PermissionError from '../common/errors/permission';
import {CONTROLS, HTTP_VERBS} from '../constants';
import MeetingRequest from '../meeting/request';
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
   * @type {Array}
   * @private
   * @memberof RecordingInfo
   */
  private displayHints: Array<string> = [];

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
   * @param {Object} options
   * @constructor
   * @memberof RecordingController
   */
  constructor(
    request: MeetingRequest,
    options?: {
      serviceUrl?: string;
      sessionId: string;
      locusUrl: string;
      displayHints?: Array<string>;
    }
  ) {
    this.initialize(request);
    this.set(options);
  }

  /**
   * @param {MeetingRequest} request
   * @param {LocusInfo} info
   * @returns {void}
   * @private
   * @memberof RecordingController
   */
  private initialize(request: MeetingRequest) {
    this.request = request;
  }

  /**
   * @param {Object} options
   * @returns {void}
   * @public
   * @memberof RecordingController
   */
  public set(options?: {
    serviceUrl?: string;
    sessionId: string;
    locusUrl: string;
    displayHints?: Array<string>;
  }) {
    this.extract(options);
  }

  /**
   * @param {string} url
   * @returns {void}
   * @public
   * @memberof RecordingController
   */
  public setLocusUrl(url: string) {
    this.locusUrl = url;
    this.locusId = Util.extractLocusId(this.locusUrl);
  }

  /**
   * @param {Array} hints
   * @returns {void}
   * @public
   * @memberof RecordingController
   */
  public setDisplayHints(hints: Array<string>) {
    this.displayHints = hints;
  }

  /**
   * @param {string} id
   * @returns {void}
   * @public
   * @memberof RecordingController
   */
  public setSessionId(id: string) {
    this.sessionId = id;
  }

  /**
   * @param {string} url
   * @returns {void}
   * @public
   * @memberof RecordingController
   */
  public setServiceUrl(url: string) {
    this.serviceUrl = url;
  }

  /**
   * @returns {string}
   * @public
   * @memberof RecordingController
   */
  public getLocusUrl() {
    return this.locusUrl;
  }

  /**
   * @returns {string}
   * @public
   * @memberof RecordingController
   */
  public getLocusId() {
    return this.locusId;
  }

  /**
   * @returns {string}
   * @public
   * @memberof RecordingController
   */
  public getSessionId() {
    return this.sessionId;
  }

  /**
   * @returns {string}
   * @public
   * @memberof RecordingController
   */
  public getServiceUrl() {
    return this.serviceUrl;
  }

  /**
   * @returns {Array}
   * @public
   * @memberof RecordingController
   */
  public getDisplayHints() {
    return this.displayHints;
  }

  /**
   * @param {Object} options
   * @returns {void}
   * @private
   * @memberof RecordingController
   */
  private extract(options?: {
    serviceUrl?: string;
    sessionId: string;
    locusUrl: string;
    displayHints?: Array<string>;
  }) {
    this.setServiceUrl(options?.serviceUrl);
    this.setSessionId(options?.sessionId);
    this.setDisplayHints(options?.displayHints);
    this.setLocusUrl(options?.locusUrl);
  }

  /**
   * @param {RecordingAction} action
   * @private
   * @memberof RecordingController
   * @returns {Promise}
   */
  private recordingService(action: RecordingAction): Promise<any> {
    // @ts-ignore
    return this.request.request({
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

    // @ts-ignore
    return this.request.request({
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
    if (Util?.[`canUser${action}`](this.displayHints)) {
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

import {LocalMicrophoneStream, CALL_EVENT_KEYS} from '@webex/calling';
import {CC_FILE} from '../../../constants';
import {getErrorDetails} from '../../core/Utils';
import routingContact from '../contact';
import {TaskData, TaskResponse, TASK_EVENTS, IWebRTC} from '../types';
import Voice from './Voice';
import WebCallingService from '../../WebCallingService';
import {CC_EVENTS} from '../../config/types';
import MetricsManager from '../../../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../metrics/constants';
import LoggerProxy from '../../../logger-proxy';

export default class WebRTC extends Voice implements IWebRTC {
  private localAudioStream: LocalMicrophoneStream;
  private webCallingService: WebCallingService;

  constructor(
    contact: ReturnType<typeof routingContact>,
    webCallingService: WebCallingService,
    data: TaskData,
    callOptions: {isEndCallEnabled?: boolean; isEndConsultEnabled?: boolean} = {}
  ) {
    super(contact, data, callOptions);
    this.updateTaskUiControls({accept: [true, true], decline: [true, true]});
    this.webCallingService = webCallingService;
  }

  private registerWebCallListeners() {
    this.webCallingService.on(CALL_EVENT_KEYS.REMOTE_MEDIA, this.handleRemoteMedia);
  }

  private handleRemoteMedia = (track: MediaStreamTrack) => {
    this.emit(TASK_EVENTS.TASK_MEDIA, track);
  };

  /**
   * This method is used to set the UI controls for the specific type of task
   */
  protected setUIControls(): void {
    super.setUIControls();
    switch (this.data.type) {
      // show accept/decline only on normal web call offers
      case CC_EVENTS.AGENT_OFFER_CONTACT:
      case CC_EVENTS.AGENT_OFFER_CONSULT:
        this.updateTaskUiControls({
          accept: [true, true],
          decline: [true, true],
        });
        break;

      // on consult accepted hide accept/decline and show mute
      case CC_EVENTS.AGENT_CONSULTING:
        if (this.data.isConsulted) {
          this.updateTaskUiControls({
            accept: [false, false],
            decline: [false, false],
          });
        }
        this.updateTaskUiControls({
          mute: [true, true],
        });
        break;

      // when consult ends (and we were the recipient) hide mute
      case CC_EVENTS.AGENT_CONSULT_ENDED:
        if (this.data.isConsulted) {
          this.updateTaskUiControls({
            mute: [false, false],
            accept: [false, false],
            decline: [false, false],
          });
        }
        break;

      // hide accept/decline when RONA occurs
      case CC_EVENTS.AGENT_CONTACT_OFFER_RONA:
        this.updateTaskUiControls({
          accept: [false, false],
          decline: [false, false],
        });
        break;

      // hide accept/decline when contact is ended by the external user
      case CC_EVENTS.CONTACT_ENDED:
        if (this.data.interaction.state === 'new') {
          this.updateTaskUiControls({accept: [false, false], decline: [false, false]});
        }
        break;

      case CC_EVENTS.AGENT_CONTACT_ASSIGNED:
        this.updateTaskUiControls({
          mute: [true, true],
        });
        break;

      case CC_EVENTS.AGENT_CONTACT_HELD:
        // disable mute when call is held
        this.updateTaskUiControls({
          mute: [true, false],
        });
        break;

      case CC_EVENTS.AGENT_CONTACT_UNHELD:
        // enable mute when call is resumed
        this.updateTaskUiControls({
          mute: [true, true],
        });
        break;

      default:
        // hide mute when wrapup is active
        if (this.taskUiControls.wrapup.visible) {
          this.updateTaskUiControls({
            mute: [false, false],
          });
        }
        break;
    }
  }

  /**
   * This method is used to unregister the web call listeners.
   * @returns void
   * @example
   * ```typescript
   * task.unregisterWebCallListeners();
   * ```
   */
  public unregisterWebCallListeners() {
    this.webCallingService.off(CALL_EVENT_KEYS.REMOTE_MEDIA, this.handleRemoteMedia);
  }

  /**
   * This is used for incoming task accept by agent.
   *
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.accept().then(()=>{}).catch(()=>{})
   * ```
   */
  public async accept(): Promise<TaskResponse> {
    LoggerProxy.log(`Accepting WebRTC task for taskId:${this.data.interactionId}`, {
      module: 'WebRTC',
      method: 'accept',
    });
    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_ACCEPT_SUCCESS,
        METRIC_EVENT_NAMES.TASK_ACCEPT_FAILED,
      ]);

      const constraints = {audio: true};
      const localStream = await navigator.mediaDevices.getUserMedia(constraints);
      const audioTrack = localStream.getAudioTracks()[0];
      this.localAudioStream = new LocalMicrophoneStream(new MediaStream([audioTrack]));
      this.webCallingService.answerCall(this.localAudioStream, this.data.interactionId);

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_ACCEPT_SUCCESS,
        {
          taskId: this.data.interactionId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(this.data),
        },
        ['operational', 'behavioral', 'business']
      );

      return Promise.resolve();
    } catch (error) {
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_ACCEPT_FAILED,
        {
          taskId: this.data.interactionId,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(
            (error as any).details || {}
          ),
        },
        ['operational', 'behavioral', 'business']
      );
      const {error: detailedError} = getErrorDetails(error, 'accept', CC_FILE);
      throw detailedError;
    }
  }

  /**
   * This is used for the incoming task decline by agent.
   *
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.decline().then(()=>{}).catch(()=>{})
   * ```
   */
  public async decline(): Promise<TaskResponse> {
    LoggerProxy.log(`Declining WebRTC task for taskId:${this.data.interactionId}`, {
      module: 'WebRTC',
      method: 'decline',
    });
    try {
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_DECLINE_SUCCESS,
        METRIC_EVENT_NAMES.TASK_DECLINE_FAILED,
      ]);

      this.webCallingService.declineCall(this.data.interactionId);
      this.unregisterWebCallListeners();

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_DECLINE_SUCCESS,
        {taskId: this.data.interactionId},
        ['operational', 'behavioral']
      );

      return Promise.resolve();
    } catch (error) {
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_DECLINE_FAILED,
        {
          taskId: this.data.interactionId,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(
            (error as any).details || {}
          ),
        },
        ['operational', 'behavioral']
      );
      const {error: detailedError} = getErrorDetails(error, 'decline', CC_FILE);
      throw detailedError;
    }
  }

  /**
   * This is used for the placing the call in mute or unmute by the agent.
   *
   * @throws Error
   * @example
   * ```typescript
   * task.toggleMute().then(()=>{}).catch(()=>{})
   * ```
   */
  public async toggleMute() {
    LoggerProxy.log(`Toggling mute WebRTC task for taskId:${this.data.interactionId}`, {
      module: 'WebRTC',
      method: 'toggleMute',
    });
    try {
      this.webCallingService.muteUnmuteCall(this.localAudioStream);

      return Promise.resolve();
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'mute', CC_FILE);
      throw detailedError;
    }
  }
}

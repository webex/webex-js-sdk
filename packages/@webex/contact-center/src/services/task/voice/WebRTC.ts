import {LocalMicrophoneStream, CALL_EVENT_KEYS} from '@webex/calling';
import {CC_FILE} from '../../../constants';
import {getErrorDetails} from '../../core/Utils';
import routingContact from '../contact';
import {TaskData, TaskResponse, TASK_EVENTS, IWebRTC} from '../types';
import Voice from './Voice';
import WebCallingService from '../../WebCallingService';
import {TaskState} from '../state-machine';
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
    this.webCallingService = webCallingService;
    this.registerWebCallListeners();
  }

  private registerWebCallListeners() {
    this.webCallingService.on(CALL_EVENT_KEYS.REMOTE_MEDIA, this.handleRemoteMedia);
  }

  private handleRemoteMedia = (track: MediaStreamTrack) => {
    this.emit(TASK_EVENTS.TASK_MEDIA, track);
  };

  /**
   * Compute UI controls for WebRTC tasks.
   * Extends Voice UI controls with WebRTC-specific behavior:
   *
   * 1. Accept/Decline buttons:
   *    - Visible when task is offered (OFFERED or OFFERED_CONSULT states)
   *    - Hidden when consulted and in consulting state
   *    - Hidden when call is terminated
   *
   * 2. Mute button:
   *    - Visible when connected or when consulting (if this agent is consulted)
   *    - Disabled when call is held (can't mute a held call)
   *    - Hidden during wrapup
   *
   * WebRTC handles audio client-side, so these controls differ from telephony tasks.
   *
   * @returns UI control states for all task actions
   */
  protected computeUIControls(): import('../Task').TaskUIControls {
    // Get base controls from Voice class
    const controls = super.computeUIControls();

    const state = this.stateMachineService?.state;
    if (!state) {
      return controls;
    }

    // Determine current state
    const isOffered = state.matches(TaskState.OFFERED) || state.matches(TaskState.OFFERED_CONSULT);
    const isConnected = state.matches(TaskState.CONNECTED);
    const isHeld = state.matches(TaskState.HELD);
    const isConsulting = state.matches(TaskState.CONSULTING);
    const isWrappingUp = state.matches(TaskState.WRAPPING_UP);

    // Check if this agent is the consulted party
    const isConsultedAgent = this.data.isConsulted ?? false;

    // Check if call is terminated (ended externally while still offered)
    const isTerminated = this.data.interaction?.isTerminated ?? false;

    // WebRTC-specific accept/decline logic
    // Accept and decline should be visible when:
    // - Task is offered (OFFERED or OFFERED_CONSULT state)
    // - AND not terminated
    // - AND (not consulting OR not the consulted agent)
    const showAcceptDecline = isOffered && !isTerminated && (!isConsulting || !isConsultedAgent);

    controls.accept = {
      visible: showAcceptDecline,
      enabled: showAcceptDecline,
    };

    controls.decline = {
      visible: showAcceptDecline,
      enabled: showAcceptDecline,
    };

    // WebRTC-specific mute button logic
    // Mute should be visible when:
    // - Call is connected (active) OR
    // - Call is consulting AND this agent is the consulted one
    const showMute = isConnected || (isConsulting && isConsultedAgent);

    // Mute should be enabled when:
    // - Visible AND not held AND not wrapping up
    const enableMute = showMute && !isHeld && !isWrappingUp;

    controls.mute = {
      visible: showMute,
      enabled: enableMute,
    };

    return controls;
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

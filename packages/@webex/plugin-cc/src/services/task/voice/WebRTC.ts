import {LocalMicrophoneStream, CALL_EVENT_KEYS} from '@webex/calling';
import {CC_FILE} from '../../../constants';
import {getErrorDetails} from '../../core/Utils';
import routingContact from '../contact';
import {TaskData, TaskResponse, TASK_EVENTS, IWebRTCTask} from '../types';
import Voice from './Voice';
import WebCallingService from '../../WebCallingService';
import {CC_EVENTS} from '../../config/types';

export default class WebRTC extends Voice implements IWebRTCTask {
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
    // TODO: This implementation will change based on the type of task. We need to modify it appropriately, we can even read from task data rather than listening to events
    switch (this.data.type) {
      case CC_EVENTS.AGENT_CONTACT_RESERVED:
        this.taskUiControls.accept.enable();
        break;
      default:
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
    try {
      const constraints = {audio: true};

      const localStream = await navigator.mediaDevices.getUserMedia(constraints);
      const audioTrack = localStream.getAudioTracks()[0];
      this.localAudioStream = new LocalMicrophoneStream(new MediaStream([audioTrack]));
      this.webCallingService.answerCall(this.localAudioStream, this.data.interactionId);

      return Promise.resolve();
    } catch (error) {
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
    try {
      this.webCallingService.declineCall(this.data.interactionId);
      this.unregisterWebCallListeners();

      return Promise.resolve();
    } catch (error) {
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
    try {
      this.webCallingService.muteUnmuteCall(this.localAudioStream);

      return Promise.resolve();
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'mute', CC_FILE);
      throw detailedError;
    }
  }
}

import {LocalMicrophoneStream, CALL_EVENT_KEYS} from '@webex/calling';
import {CC_FILE} from '../../../constants';
import {getErrorDetails} from '../../core/Utils';
import routingContact from '../contact';
import {TaskData, TaskResponse, TASK_EVENTS} from '../types';
import Voice from './Voice';
import WebCallingService from '../../WebCallingService';

export default class WebRTC extends Voice {
  private localAudioStream: LocalMicrophoneStream;
  private webCallingService: WebCallingService;

  constructor(
    contact: ReturnType<typeof routingContact>,
    webCallingService: WebCallingService,
    data: TaskData
  ) {
    super(contact, data);
    this.webCallingService = webCallingService;
  }

  private registerWebCallListeners() {
    this.webCallingService.on(CALL_EVENT_KEYS.REMOTE_MEDIA, this.handleRemoteMedia);
  }

  private handleRemoteMedia = (track: MediaStreamTrack) => {
    this.emit(TASK_EVENTS.TASK_MEDIA, track);
  };

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
  public async mute() {
    try {
      this.webCallingService.muteUnmuteCall(this.localAudioStream);

      return Promise.resolve();
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'mute', CC_FILE);
      throw detailedError;
    }
  }
}

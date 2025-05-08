import {LocalMicrophoneStream} from '@webex/calling';
import {CC_FILE} from '../../constants';
import {getErrorDetails} from '../core/Utils';
import routingContact from './contact';
import {TaskData, TaskResponse} from './types';
import Voice from './Voice';
import WebCallingService from '../WebCallingService';
import {TaskUIControls} from './Task';

export default class WebRTC extends Voice {
  protected contact: ReturnType<typeof routingContact>;
  private localAudioStream: LocalMicrophoneStream;
  private webCallingService: WebCallingService;

  constructor(
    contact: ReturnType<typeof routingContact>,
    webCallingService: WebCallingService,
    data: TaskData
  ) {
    super(contact, data);
    this.contact = contact;
    this.data = data;
    this.webCallingService = webCallingService;
  }

  public getUIControls(): TaskUIControls {
    // Default UI controls for other media types
    return {
      showAcceptButton: true,
      showDeclineButton: true,
      showMuteButton: true,
    };
  }

  public isAcceptSupported(): boolean {
    return true;
  }

  public isDeclineSupported(): boolean {
    return true;
  }

  public isMuteSupported(): boolean {
    return true;
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

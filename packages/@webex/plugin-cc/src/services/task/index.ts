import EventEmitter from 'events';
import {CALL_EVENT_KEYS, LocalMicrophoneStream} from '@webex/calling';
import {CallId} from '@webex/calling/dist/types/common/types';
import {getErrorDetails} from '../core/Utils';
import {LoginOption} from '../../types';
import {CC_FILE} from '../../constants';
import routingContact from './contact';
import {ITask, TaskResponse, TaskData, TaskId, TASK_EVENTS} from './types';
import WebCallingService from '../WebCallingService';

export default class Task extends EventEmitter implements ITask {
  private contact: ReturnType<typeof routingContact>;
  private localAudioStream: LocalMicrophoneStream;
  private webCallingService: WebCallingService;
  public data: TaskData;
  public webCallMap: Record<TaskId, CallId>;

  constructor(
    contact: ReturnType<typeof routingContact>,
    webCallingService: WebCallingService,
    data: TaskData
  ) {
    super();
    this.contact = contact;
    this.data = data;
    this.webCallingService = webCallingService;
    this.webCallMap = {};
    this.registerWebCallListeners();
  }

  private handleRemoteMedia = (track: MediaStreamTrack) => {
    this.emit(TASK_EVENTS.TASK_MEDIA, track);
  };

  private registerWebCallListeners() {
    this.webCallingService.on(CALL_EVENT_KEYS.REMOTE_MEDIA, this.handleRemoteMedia);
  }

  public unregisterWebCallListeners() {
    this.webCallingService.off(CALL_EVENT_KEYS.REMOTE_MEDIA, this.handleRemoteMedia);
  }

  public updateTaskData = (newData: TaskData) => {
    this.data = newData;

    return this;
  };

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
      if (this.webCallingService.loginOption === LoginOption.BROWSER) {
        const constraints = {
          audio: true,
        };

        const localStream = await navigator.mediaDevices.getUserMedia(constraints);
        const audioTrack = localStream.getAudioTracks()[0];
        this.localAudioStream = new LocalMicrophoneStream(new MediaStream([audioTrack]));
        this.webCallingService.answerCall(this.localAudioStream, this.data.interactionId);

        return Promise.resolve(); // TODO: Update this with sending the task object received in AgentContactAssigned
      }

      // TODO: Invoke the accept API from services layer. This is going to be used in Outbound Dialer scenario
      return this.contact.accept({interactionId: this.data.interactionId});
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

  // TODO: Hold/resume, recording pause/resume, consult and transfer public methods to be implemented here
}

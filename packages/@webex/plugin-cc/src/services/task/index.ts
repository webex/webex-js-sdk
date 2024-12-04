import EventEmitter from 'events';
import {CALL_EVENT_KEYS, LocalMicrophoneStream} from '@webex/calling';
import {CallId} from '@webex/calling/dist/types/common/types';
import {getErrorDetails} from '../core/Utils';
import {LoginOption} from '../../types';
import {CC_FILE} from '../../constants';
import routingContact from './contact';
import {ITask, TaskResponse, TaskData, TaskId, TASK_EVENTS, WrapupPayLoad} from './types';
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

  /**
   * This is used to hold the task.
   * @param taskId
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.hold(taskId).then(()=>{}).catch(()=>{})
   * ```
   * */
  public async hold(taskId: string): Promise<TaskResponse> {
    try {
      return this.contact.hold({
        interactionId: taskId,
        data: {mediaResourceId: this.data.mediaResourceId},
      });
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'hold', CC_FILE);
      throw detailedError;
    }
  }

  /**
   * This is used to resume the task.
   * @param taskId
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.resume(taskId).then(()=>{}).catch(()=>{})
   * ```
   */
  public async resume(taskId: string): Promise<TaskResponse> {
    try {
      return this.contact.unHold({
        interactionId: taskId,
        data: {mediaResourceId: this.data.mediaResourceId},
      });
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'resume', CC_FILE);
      throw detailedError;
    }
  }

  /**
   * This is used to end the task.
   * @param taskId - Unique Id to identify each task
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.end(taskId).then(()=>{}).catch(()=>{})
   *  ```
   */
  public async end(taskId: string): Promise<TaskResponse> {
    try {
      return this.contact.end({interactionId: taskId});
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'end', CC_FILE);
      throw detailedError;
    }
  }

  /**
   * This is used to wrap up the task.
   * @param taskId - Unique Id to identify each task
   * @param data - WrapupPayLoad
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.wrapup(taskId, data).then(()=>{}).catch(()=>{})
   * ```
   */
  public async wrapup(taskId: string, wrapupPayload: WrapupPayLoad): Promise<TaskResponse> {
    try {
      if (!this.data) {
        throw new Error('No task data available');
      }

      return this.contact.wrapup({interactionId: taskId, data: wrapupPayload});
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'wrapup', CC_FILE);
      throw detailedError;
    }
  }

  // TODO: recording pause/resume, consult and transfer public methods to be implemented here
}

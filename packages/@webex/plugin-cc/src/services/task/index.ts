import EventEmitter from 'events';
import {CALL_EVENT_KEYS, LocalMicrophoneStream} from '@webex/calling';
import {CallId} from '@webex/calling/dist/types/common/types';
import {getErrorDetails} from '../core/Utils';
import {LoginOption} from '../../types';
import {CC_FILE} from '../../constants';
import routingContact from './contact';
import {
  ITask,
  TaskResponse,
  TaskData,
  TaskId,
  TASK_EVENTS,
  WrapupPayLoad,
  ResumeRecordingPayload,
  ConsultPayload,
  ConsultEndPayload,
} from './types';
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

  public updateTaskData = (updatedData: TaskData, shouldOverwrite = false) => {
    this.data = shouldOverwrite ? updatedData : this.reconcileData(this.data, updatedData);

    return this;
  };

  private reconcileData(oldData: TaskData, newData: TaskData): TaskData {
    Object.keys(newData).forEach((key) => {
      if (newData[key] && typeof newData[key] === 'object' && !Array.isArray(newData[key])) {
        oldData[key] = this.reconcileData({...oldData[key]}, newData[key]);
      } else {
        oldData[key] = newData[key];
      }
    });

    return oldData;
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
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.hold().then(()=>{}).catch(()=>{})
   * ```
   * */
  public async hold(): Promise<TaskResponse> {
    try {
      return this.contact.hold({
        interactionId: this.data.interactionId,
        data: {mediaResourceId: this.data.mediaResourceId},
      });
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'hold', CC_FILE);
      throw detailedError;
    }
  }

  /**
   * This is used to resume the task.
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.resume().then(()=>{}).catch(()=>{})
   * ```
   */
  public async resume(): Promise<TaskResponse> {
    try {
      const {mainInteractionId} = this.data.interaction;
      // In case of consult call, When resume is invoked, we need to pass the mediaResourceId of the main interaction
      // It's always good to explicitly pass the main mediaResourceId to avoid any confusion
      const {mediaResourceId} = this.data.interaction.media[mainInteractionId];

      return this.contact.unHold({
        interactionId: this.data.interactionId,
        data: {mediaResourceId},
      });
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'resume', CC_FILE);
      throw detailedError;
    }
  }

  /**
   * This is used to end the task.
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.end().then(()=>{}).catch(()=>{})
   *  ```
   */
  public async end(): Promise<TaskResponse> {
    try {
      return this.contact.end({interactionId: this.data.interactionId});
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'end', CC_FILE);
      throw detailedError;
    }
  }

  /**
   * This is used to wrap up the task.
   * @param wrapupPayload - WrapupPayLoad
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.wrapup(wrapupPayload).then(()=>{}).catch(()=>{})
   * ```
   */
  public async wrapup(wrapupPayload: WrapupPayLoad): Promise<TaskResponse> {
    try {
      if (!this.data) {
        throw new Error('No task data available');
      }
      if (!wrapupPayload.auxCodeId || wrapupPayload.auxCodeId.length === 0) {
        throw new Error('AuxCodeId is required');
      }
      if (!wrapupPayload.wrapUpReason || wrapupPayload.wrapUpReason.length === 0) {
        throw new Error('WrapUpReason is required');
      }

      return this.contact.wrapup({interactionId: this.data.interactionId, data: wrapupPayload});
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'wrapup', CC_FILE);
      throw detailedError;
    }
  }

  /**
   * This is used to pause the call recording
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.pauseRecording().then(()=>{}).catch(()=>{});
   * ```
   */
  public async pauseRecording(): Promise<TaskResponse> {
    try {
      const result = await this.contact.pauseRecording({interactionId: this.data.interactionId});

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'pauseRecording', CC_FILE);
      throw detailedError;
    }
  }

  /**
   * This is used to pause the call recording
   * @param resumeRecordingPayload
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.resumeRecording(resumeRecordingPayload).then(()=>{}).catch(()=>{});
   * ```
   */
  public async resumeRecording(
    resumeRecordingPayload: ResumeRecordingPayload
  ): Promise<TaskResponse> {
    try {
      const result = await this.contact.resumeRecording({
        interactionId: this.data.interactionId,
        data: resumeRecordingPayload,
      });

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'resumeRecording', CC_FILE);
      throw detailedError;
    }
  }

  /**
   * This is used to consult the task
   * @param consultPayload
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * const consultPayload = {
   *   destination: 'myBuddyAgentId',
   *   destinationType: DESTINATION_TYPE.AGENT,
   * }
   * task.consult(consultPayload).then(()=>{}).catch(()=>{});
   * ```
   * */
  public async consult(consultPayload: ConsultPayload): Promise<TaskResponse> {
    try {
      const result = await this.contact.consult({
        interactionId: this.data.interactionId,
        data: consultPayload,
      });

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'consult', CC_FILE);
      throw detailedError;
    }
  }

  /**
   * This is used to end the consult
   * @param consultEndPayload
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * const consultEndPayload = {
   *  isConsult: true,
   *  queueId: 'myQueueId',
   * }
   * task.endConsult(consultEndPayload).then(()=>{}).catch(()=>{});
   * ```
   */
  public async endConsult(consultEndPayload: ConsultEndPayload): Promise<TaskResponse> {
    try {
      const result = await this.contact.consultEnd({
        interactionId: this.data.interactionId,
        data: consultEndPayload,
      });

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'endConsult', CC_FILE);
      throw detailedError;
    }
  }

  // TODO: transfer public methods to be implemented here
}

import {CC_FILE} from '../../constants';
import {getErrorDetails} from '../core/Utils';
import routingContact from './contact';
import {ConsultPayload, ResumeRecordingPayload, TaskData, TaskResponse} from './types';
import Task from './Task';
import LoggerProxy from '../../logger-proxy';

export default class Voice extends Task {
  protected contact: ReturnType<typeof routingContact>;

  constructor(contact: ReturnType<typeof routingContact>, data: TaskData) {
    super();
    this.contact = contact;
    this.data = data;
  }

  public getUIControls(): TaskUIControls {
    // Default UI controls for other media types
    return {
      showHoldButton: false,
      showConsultButton: true,
      showRecordingButton: true,
      showEndButton: cc.agentConfig.isEndCallEnabled,
      showEndConsultButton: cc.agentConfig.isEndConsultEnabled,
    };
  }

  public isHoldResumeSupported(): boolean {
    return true;
  }

  public isRecordingSupported(): boolean {
    return true; // Feature flag an be checked too here
  }

  public isConsultSupported(): boolean {
    return true;
  }

  public isConsultToQueueSupported(): boolean {
    return cc.agentConfig.allowConsultToQueue;
  }

  public isEndTaskSupported(): boolean {
    return cc.agentConfig.isEndCallEnabled;
  }

  public isEndConsultSupported(): boolean {
    return cc.agentConfig.isEndConsultEnabled;
  }

  /**
   * This method is used to accept the task.
   * It is expected to be overridden by child classes.
   * @returns Promise<TaskResponse>
   * @throws Error
   */
  public async accept(): Promise<TaskResponse> {
    LoggerProxy.warn('Method not implemented here. Please override in the child class.');
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
      const response = await this.contact.hold({
        interactionId: this.data.interactionId,
        data: {mediaResourceId: this.data.mediaResourceId},
      });

      return response;
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
      const {mediaResourceId} = this.data.interaction.media[mainInteractionId];

      const response = await this.contact.unHold({
        interactionId: this.data.interactionId,
        data: {mediaResourceId},
      });

      return response;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'resume', CC_FILE);
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
      resumeRecordingPayload ??= {autoResumed: false};

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
}

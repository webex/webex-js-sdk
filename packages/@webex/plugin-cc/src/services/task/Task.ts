import {EventEmitter} from 'events';
import {CallId} from '@webex/calling/dist/types/common/types';
import {
  ITask,
  TaskData,
  TaskResponse,
  WrapupPayLoad,
  TaskId,
  TransferPayLoad,
  DESTINATION_TYPE,
  MEDIA_CHANNEL,
} from './types';
import {CC_FILE} from '../../constants';
import {getErrorDetails} from '../core/Utils';
import routingContact from './contact';
import WebCallingService from '../WebCallingService';
import Voice from './Voice';
import Digital from './Digital';
import WebRTC from './WebRTC';

export interface TaskUIControls {
  showAcceptButton: boolean;
  showDeclineButton: boolean;
  showHoldButton: boolean;
  showMuteButton: boolean;
  showTransferButton: boolean;
  showConsultButton: boolean;
  showRecordingButton: boolean;
  showEndButton: boolean;
  showConferenceButton: boolean;
  showEndConsultButton: boolean;
  showWrapupButton: boolean;
  //   showMonitoringButton: boolean;
  //   showBargeButton: boolean;
}

export default abstract class Task extends EventEmitter {
  protected contact: ReturnType<typeof routingContact>;
  public data: TaskData;
  public webCallMap: Record<TaskId, CallId>;

  constructor() {
    super();
    this.webCallMap = {};
  }

  public getUIControls(): TaskUIControls {
    // Default UI controls for other media types
    return {
      showAcceptButton: false,
      showDeclineButton: false,
      showHoldButton: false,
      showMuteButton: false,
      showTransferButton: true,
      showConsultButton: false,
      showRecordingButton: false,
      showEndButton: false,
      showConferenceButton: false,
      showEndConsultButton: false,
      showWrapupButton: true,
      //   showMonitoringButton: false,
      //   showBargeButton: false,
    };
  }

  unregisterWebCallListeners(): void {
    throw new Error('Method not implemented.');
  }

  updateTaskData(newData: TaskData): ITask {
    throw new Error('Method not implemented.');
  }

  public isMuteSupported(): boolean {
    return false;
  }

  public isAcceptSupported(): boolean {
    return false;
  }

  public isDeclineSupported(): boolean {
    return false;
  }

  public isHoldResumeSupported(): boolean {
    return false;
  }

  public isRecordingSupported(): boolean {
    return false;
  }

  public isConsultSupported(): boolean {
    return false;
  }

  public isConsultToQueueSupported(): boolean {
    return false;
  }

  public isEndTaskSupported(): boolean {
    return true;
  }

  public isEndConsultSupported(): boolean {
    return false;
  }

  public isConferenceSupported(): boolean {
    return true;
  }

  //   public isMonitoringSupported(): boolean {
  //     return userRole === 'Supervisor';
  //   }

  public abstract accept(): Promise<TaskResponse>;

  /**
   * This is used to blind transfer or vTeam transfer the task
   * @param transferPayload
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * const transferPayload = {
   *  to: 'myQueueId',
   *  destinationType: 'queue',
   * }
   * task.transfer(transferPayload).then(()=>{}).catch(()=>{});
   * ```
   */
  public async transfer(transferPayload: TransferPayLoad): Promise<TaskResponse> {
    try {
      let result: TaskResponse;
      if (transferPayload.destinationType === DESTINATION_TYPE.QUEUE) {
        result = await this.contact.vteamTransfer({
          interactionId: this.data.interactionId,
          data: transferPayload,
        });
      } else {
        result = await this.contact.blindTransfer({
          interactionId: this.data.interactionId,
          data: transferPayload,
        });
      }

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'transfer', CC_FILE);

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
      const response = await this.contact.end({interactionId: this.data.interactionId});

      return response;
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

      const response = await this.contact.wrapup({
        interactionId: this.data.interactionId,
        data: wrapupPayload,
      });

      return response;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'wrapup', CC_FILE);

      throw detailedError;
    }
  }

  static createTaskInstance(
    contact: ReturnType<typeof routingContact>,
    webCallingService: WebCallingService,
    data: TaskData
  ): Task {
    switch (data.interaction.mediaType) {
      case MEDIA_CHANNEL.TELEPHONY:
        if (webCallingService.loginOption === 'BROWSER') {
          return new WebRTC(contact, webCallingService, data);
        }

        return new Voice(contact, data);
      case MEDIA_CHANNEL.CHAT:
      case MEDIA_CHANNEL.EMAIL:
      case MEDIA_CHANNEL.SOCIAL:
        return new Digital(contact, data);
      default:
        throw new Error(`Unknown media type: ${data.interaction.mediaType}`);
    }
  }
}

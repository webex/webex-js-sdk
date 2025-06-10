import {CC_FILE} from '../../../constants';
import {getErrorDetails} from '../../core/Utils';
import routingContact from '../contact';
import {
  ConsultPayload,
  ConsultEndPayload,
  ResumeRecordingPayload,
  TaskData,
  TaskResponse,
  IVoice,
  TransferPayLoad,
  ConsultTransferPayLoad,
  CONSULT_TRANSFER_DESTINATION_TYPE,
} from '../types';
import Task from '../Task';
import {CC_EVENTS} from '../../config/types';

export default class Voice extends Task implements IVoice {
  private isEndCallEnabled: boolean;
  private isEndConsultEnabled: boolean;

  constructor(
    contact: ReturnType<typeof routingContact>,
    data: TaskData,
    callOptions: {isEndCallEnabled?: boolean; isEndConsultEnabled?: boolean} = {}
  ) {
    super(contact, data);
    // apply defaults when no explicit setting provided
    this.isEndCallEnabled = callOptions.isEndCallEnabled ?? true;
    this.isEndConsultEnabled = callOptions.isEndConsultEnabled ?? true;
  }

  protected initialiseUIControls() {
    super.initialiseUIControls();
    this.taskUiControls.accept.hide();
    this.taskUiControls.accept.disable();
    this.taskUiControls.decline.hide();
    this.taskUiControls.decline.disable();

    this.taskUiControls.hold.hide();
    this.taskUiControls.hold.disable();
    this.taskUiControls.transfer.hide();
    this.taskUiControls.transfer.disable();
    this.taskUiControls.end.hide();
    this.taskUiControls.end.disable();
  }

  protected setUIControls(): void {
    // profile disables end‐call or end‐consult
    if (!this.isEndCallEnabled) {
      this.taskUiControls.end.hide();
    }
    if (!this.isEndConsultEnabled) {
      this.taskUiControls.endConsult.hide();
    }

    const eventType = this.data.type;
    const stateNotNew = this.data.interaction.state !== 'new';
    const showMainControls = (): void => {
      this.taskUiControls.hold.show();
      this.taskUiControls.hold.enable();
      this.taskUiControls.transfer.show();
      this.taskUiControls.transfer.enable();
      this.taskUiControls.consult.show();
      this.taskUiControls.consult.enable();
      this.taskUiControls.recording.show();
      this.taskUiControls.recording.enable();
    };

    switch (eventType) {
      case CC_EVENTS.AGENT_CONTACT_ASSIGNED:
        // hide accept/decline, endConsult & wrapup
        this.taskUiControls.accept.hide();
        this.taskUiControls.accept.disable();
        this.taskUiControls.decline.hide();
        this.taskUiControls.decline.disable();
        // show main controls
        showMainControls();
        // end‐button logic
        if (this.isEndCallEnabled) {
          this.taskUiControls.end.show();
          this.taskUiControls.end.enable();
        } else {
          this.taskUiControls.end.hide();
          this.taskUiControls.end.disable();
        }
        // hide consult‐end & wrapup
        this.taskUiControls.endConsult.hide();
        this.taskUiControls.wrapup.hide();
        break;

      case CC_EVENTS.AGENT_CONTACT_UNASSIGNED:
        this.taskUiControls.consultTransfer.hide();
        this.taskUiControls.consultTransfer.disable();
        this.taskUiControls.recording.hide();
        this.taskUiControls.recording.disable();
        this.taskUiControls.end.hide();
        this.taskUiControls.end.disable();
        this.taskUiControls.wrapup.show();
        this.taskUiControls.wrapup.enable();
        break;

      case CC_EVENTS.CONTACT_ENDED:
      case CC_EVENTS.AGENT_INVITE_FAILED:
        // hide everything
        this.taskUiControls.hold.hide();
        this.taskUiControls.transfer.hide();
        this.taskUiControls.consult.hide();
        this.taskUiControls.consultTransfer.hide();
        this.taskUiControls.recording.hide();
        this.taskUiControls.end.hide();
        this.taskUiControls.endConsult.hide();
        // now wrapup if applicable
        if (stateNotNew) {
          this.taskUiControls.wrapup.show();
          this.taskUiControls.wrapup.enable();
        }
        break;

      case CC_EVENTS.AGENT_CONTACT_HELD:
        showMainControls();
        if (this.isEndCallEnabled) {
          this.taskUiControls.end.show();
          this.taskUiControls.end.disable();
        }
        break;

      case CC_EVENTS.AGENT_CONTACT_UNHELD:
        showMainControls();
        if (this.isEndCallEnabled) {
          this.taskUiControls.end.show();
          this.taskUiControls.end.enable();
        }
        break;

      case CC_EVENTS.AGENT_VTEAM_TRANSFERRED:
        this.taskUiControls.hold.hide();
        this.taskUiControls.transfer.hide();
        this.taskUiControls.consult.hide();
        this.taskUiControls.consultTransfer.hide();
        this.taskUiControls.recording.hide();
        this.taskUiControls.end.hide();
        this.taskUiControls.wrapup.show();
        this.taskUiControls.wrapup.enable();
        break;

      case CC_EVENTS.AGENT_CTQ_CANCEL_FAILED:
        showMainControls();
        if (this.isEndCallEnabled) {
          this.taskUiControls.end.show();
          this.taskUiControls.end.enable();
        }
        break;

      case CC_EVENTS.AGENT_CONSULT_CREATED:
        if (!this.data.isConsulted) {
          this.taskUiControls.hold.hide();
          this.taskUiControls.hold.disable();
          this.taskUiControls.consult.hide();
          this.taskUiControls.consult.disable();
          this.taskUiControls.transfer.hide();
          this.taskUiControls.transfer.disable();
          this.taskUiControls.consultTransfer.show();
          this.taskUiControls.consultTransfer.disable();
          this.taskUiControls.recording.show();
          this.taskUiControls.recording.disable();
          if (this.isEndCallEnabled) {
            this.taskUiControls.end.show();
            this.taskUiControls.end.disable();
          }
          this.taskUiControls.endConsult.show();
          this.taskUiControls.endConsult.enable();
        }
        break;

      case CC_EVENTS.AGENT_OFFER_CONSULT:
        if (this.isEndConsultEnabled) {
          this.taskUiControls.endConsult.show();
          this.taskUiControls.endConsult.enable();
        }
        break;

      case CC_EVENTS.AGENT_CONSULTING:
        // hide hold, transfer, consult
        if (!this.data.isConsulted) {
          this.taskUiControls.hold.hide();
          this.taskUiControls.hold.disable();
          this.taskUiControls.transfer.hide();
          this.taskUiControls.transfer.disable();
          this.taskUiControls.consult.hide();
          this.taskUiControls.consult.disable();
          // show consultTransfer
          this.taskUiControls.consultTransfer.show();
          this.taskUiControls.consultTransfer.enable();
          // recording paused
          this.taskUiControls.recording.show();
          this.taskUiControls.recording.disable();
          // allow endConsult irrespective of profile setting
          this.taskUiControls.endConsult.show();
          this.taskUiControls.endConsult.enable();
          // end-call per profile
          if (this.isEndCallEnabled) {
            this.taskUiControls.end.show();
            this.taskUiControls.end.disable();
          }
        } else if (this.isEndConsultEnabled) {
          // allow endConsult only if flag is enabled
          this.taskUiControls.endConsult.show();
          this.taskUiControls.endConsult.enable();
        }
        break;

      case CC_EVENTS.AGENT_CONSULT_FAILED:
      case CC_EVENTS.AGENT_CONSULT_ENDED:
      case CC_EVENTS.AGENT_CTQ_CANCELLED:
        // Only reset if agent is the one who initiated the consult
        if (!this.data.isConsulted) {
          showMainControls();
          if (this.isEndCallEnabled) {
            this.taskUiControls.end.show();
            this.taskUiControls.end.enable();
          }
          // wrapup stays hidden until actual task end
          this.taskUiControls.consultTransfer.hide();
          this.taskUiControls.consultTransfer.disable();
          this.taskUiControls.wrapup.hide();
        }
        break;

      default:
        break;
    }
  }

  /**
   * This method is used to accept the task.
   * It is expected to be overridden by child classes.
   * @returns Promise<TaskResponse>
   * @throws Error
   */
  public async accept(): Promise<TaskResponse> {
    super.unSupportedOperationError('accept');
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

  /**
   * This is used to end the consult session on the task.
   * @param consultEndPayload - Payload indicating consult end flags and identifiers
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.endConsult({
   *   isConsult: true,
   *   queueId: 'myQueueId',
   *   taskId: 'taskId',
   * });
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

  /**
   * This is used to transfer the task.
   * @param payload - Transfer payload
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * task.transfer({
   *   to: 'destinationId',
   *   destinationType: DESTINATION_TYPE.AGENT,
   *   consult: true, // Optional, if true will perform a consult transfer else blind transfer
   * });
   * ```
   */
  public async transfer(payload: TransferPayLoad): Promise<TaskResponse> {
    try {
      // consult transfer path
      if (payload.consult) {
        let consultPayload: ConsultTransferPayLoad = {
          to: payload.to,
          destinationType: payload.destinationType,
        };

        if (payload.destinationType === CONSULT_TRANSFER_DESTINATION_TYPE.QUEUE) {
          if (!this.data.destAgentId) {
            throw new Error('No agent has accepted this queue consult yet');
          }
          consultPayload = {
            to: this.data.destAgentId,
            destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.AGENT,
          };
        }

        return await this.contact.consultTransfer({
          interactionId: this.data.interactionId,
          data: consultPayload,
        });
      }

      // standard blind transfer
      return await super.transfer({
        to: payload.to,
        destinationType: payload.destinationType,
      });
    } catch (err) {
      const {error: detailedError} = getErrorDetails(err, 'transfer', CC_FILE);
      throw detailedError;
    }
  }
}

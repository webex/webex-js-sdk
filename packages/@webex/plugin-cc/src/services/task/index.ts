import EventEmitter from 'events';
import {CALL_EVENT_KEYS, LocalMicrophoneStream} from '@webex/calling';
import {CallId} from '@webex/calling/dist/types/common/types';
import {getErrorDetails} from '../core/Utils';
import {LoginOption} from '../../types';
import {TASK_FILE} from '../../constants';
import routingContact from './contact';
import LoggerProxy from '../../logger-proxy';
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
  TransferPayLoad,
  DESTINATION_TYPE,
  CONSULT_TRANSFER_DESTINATION_TYPE,
  ConsultTransferPayLoad,
  MEDIA_CHANNEL,
} from './types';
import WebCallingService from '../WebCallingService';
import MetricsManager from '../../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../metrics/constants';
import {Failure} from '../core/GlobalTypes';

export default class Task extends EventEmitter implements ITask {
  private contact: ReturnType<typeof routingContact>;
  private localAudioStream: LocalMicrophoneStream;
  private webCallingService: WebCallingService;
  public data: TaskData;
  private metricsManager: MetricsManager;
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
    this.metricsManager = MetricsManager.getInstance();
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
      LoggerProxy.info(`Accepting task`, {
        module: TASK_FILE,
        method: 'accept',
        interactionId: this.data.interactionId,
      });
      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_ACCEPT_SUCCESS,
        METRIC_EVENT_NAMES.TASK_ACCEPT_FAILED,
      ]);

      if (this.data.interaction.mediaType !== MEDIA_CHANNEL.TELEPHONY) {
        const response = await this.contact.accept({interactionId: this.data.interactionId});
        LoggerProxy.log(`Task accepted successfully`, {
          module: TASK_FILE,
          method: 'accept',
          trackingId: response.trackingId,
          interactionId: this.data.interactionId,
        });
        this.metricsManager.trackEvent(
          METRIC_EVENT_NAMES.TASK_ACCEPT_SUCCESS,
          {
            taskId: this.data.interactionId,
            ...MetricsManager.getCommonTrackingFieldForAQMResponse(this.data),
          },
          ['operational', 'behavioral', 'business']
        );

        return response;
      }

      if (this.webCallingService.loginOption === LoginOption.BROWSER) {
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

        LoggerProxy.log(`Task accepted successfully with browser calling`, {
          module: TASK_FILE,
          method: 'accept',
          interactionId: this.data.interactionId,
        });

        return Promise.resolve(); // TODO: Update this with sending the task object received in AgentContactAssigned
      }
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_ACCEPT_FAILED,
        {
          taskId: this.data.interactionId,
          error: 'Unsupported login action for this task',
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(this.data),
        },
        ['operational', 'behavioral', 'business']
      );

      return Promise.reject(new Error('Unsupported login action for this task'));
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'accept', TASK_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_ACCEPT_FAILED,
        {
          taskId: this.data.interactionId,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details as Failure),
        },
        ['operational', 'behavioral', 'business']
      );
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
      LoggerProxy.info(`Toggling mute state`, {
        module: TASK_FILE,
        method: 'toggleMute',
        interactionId: this.data.interactionId,
      });

      this.webCallingService.muteUnmuteCall(this.localAudioStream);

      LoggerProxy.log(`Mute state toggled successfully`, {
        module: TASK_FILE,
        method: 'toggleMute',
        interactionId: this.data.interactionId,
      });

      return Promise.resolve();
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'mute', TASK_FILE);
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
      LoggerProxy.info(`Declining task`, {
        module: TASK_FILE,
        method: 'decline',
        interactionId: this.data.interactionId,
      });
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

      LoggerProxy.log(`Task declined successfully`, {
        module: TASK_FILE,
        method: 'decline',
        interactionId: this.data.interactionId,
      });

      return Promise.resolve();
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'decline', TASK_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_DECLINE_FAILED,
        {
          taskId: this.data.interactionId,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
        },
        ['operational', 'behavioral']
      );
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
      LoggerProxy.info(`Holding task`, {
        module: TASK_FILE,
        method: 'hold',
        interactionId: this.data.interactionId,
      });

      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_HOLD_SUCCESS,
        METRIC_EVENT_NAMES.TASK_HOLD_FAILED,
      ]);

      const response = await this.contact.hold({
        interactionId: this.data.interactionId,
        data: {mediaResourceId: this.data.mediaResourceId},
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_HOLD_SUCCESS,
        {
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
          taskId: this.data.interactionId,
          mediaResourceId: this.data.mediaResourceId,
        },
        ['operational', 'behavioral']
      );

      LoggerProxy.log(`Task placed on hold successfully`, {
        module: TASK_FILE,
        method: 'hold',
        trackingId: response.trackingId,
        interactionId: this.data.interactionId,
      });

      return response;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'hold', TASK_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_HOLD_FAILED,
        {
          taskId: this.data.interactionId,
          mediaResourceId: this.data.mediaResourceId,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
        },
        ['operational', 'behavioral']
      );
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
      LoggerProxy.info(`Resuming task`, {
        module: TASK_FILE,
        method: 'resume',
        interactionId: this.data.interactionId,
      });
      const {mainInteractionId} = this.data.interaction;
      const {mediaResourceId} = this.data.interaction.media[mainInteractionId];

      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_RESUME_SUCCESS,
        METRIC_EVENT_NAMES.TASK_RESUME_FAILED,
      ]);

      const response = await this.contact.unHold({
        interactionId: this.data.interactionId,
        data: {mediaResourceId},
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_RESUME_SUCCESS,
        {
          taskId: this.data.interactionId,
          mainInteractionId,
          mediaResourceId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
        },
        ['operational', 'behavioral']
      );

      LoggerProxy.log(`Task resumed successfully`, {
        module: TASK_FILE,
        method: 'resume',
        trackingId: response.trackingId,
        interactionId: this.data.interactionId,
      });

      return response;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'resume', TASK_FILE);
      const mainInteractionId = this.data.interaction?.mainInteractionId;
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_RESUME_FAILED,
        {
          taskId: this.data.interactionId,
          mainInteractionId,
          mediaResourceId: mainInteractionId
            ? this.data.interaction.media[mainInteractionId].mediaResourceId
            : '',
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
        },
        ['operational', 'behavioral']
      );
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
      LoggerProxy.info(`Ending task`, {
        module: TASK_FILE,
        method: 'end',
        interactionId: this.data.interactionId,
      });

      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_END_SUCCESS,
        METRIC_EVENT_NAMES.TASK_END_FAILED,
      ]);

      const response = await this.contact.end({interactionId: this.data.interactionId});

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_END_SUCCESS,
        {
          taskId: this.data.interactionId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
        },
        ['operational', 'behavioral', 'business']
      );

      LoggerProxy.log(`Task ended successfully`, {
        module: TASK_FILE,
        method: 'end',
        trackingId: response.trackingId,
        interactionId: this.data.interactionId,
      });

      return response;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'end', TASK_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_END_FAILED,
        {
          taskId: this.data.interactionId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
        },
        ['operational', 'behavioral', 'business']
      );
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
      LoggerProxy.info(`Wrapping up task`, {
        module: TASK_FILE,
        method: 'wrapup',
        interactionId: this.data.interactionId,
      });

      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_WRAPUP_SUCCESS,
        METRIC_EVENT_NAMES.TASK_WRAPUP_FAILED,
      ]);

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

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_WRAPUP_SUCCESS,
        {
          taskId: this.data.interactionId,
          wrapUpCode: wrapupPayload.auxCodeId,
          wrapUpReason: wrapupPayload.wrapUpReason,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
        },
        ['operational', 'behavioral', 'business']
      );

      LoggerProxy.log(`Task wrapped up successfully`, {
        module: TASK_FILE,
        method: 'wrapup',
        trackingId: response.trackingId,
        interactionId: this.data.interactionId,
      });

      return response;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'wrapup', TASK_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_WRAPUP_FAILED,
        {
          taskId: this.data.interactionId,
          wrapUpCode: wrapupPayload.auxCodeId,
          wrapUpReason: wrapupPayload.wrapUpReason,
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
        },
        ['operational', 'behavioral', 'business']
      );
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
      LoggerProxy.info(`Pausing recording`, {
        module: TASK_FILE,
        method: 'pauseRecording',
        interactionId: this.data.interactionId,
      });

      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_PAUSE_RECORDING_SUCCESS,
        METRIC_EVENT_NAMES.TASK_PAUSE_RECORDING_FAILED,
      ]);

      const result = await this.contact.pauseRecording({interactionId: this.data.interactionId});

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_PAUSE_RECORDING_SUCCESS,
        {
          taskId: this.data.interactionId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(result),
        },
        ['operational', 'behavioral', 'business']
      );

      LoggerProxy.log(`Recording paused successfully`, {
        module: TASK_FILE,
        method: 'pauseRecording',
        trackingId: result.trackingId,
        interactionId: this.data.interactionId,
      });

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'pauseRecording', TASK_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_PAUSE_RECORDING_FAILED,
        {
          taskId: this.data.interactionId,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
        },
        ['operational', 'behavioral', 'business']
      );
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
      LoggerProxy.info(`Resuming recording`, {
        module: TASK_FILE,
        method: 'resumeRecording',
        interactionId: this.data.interactionId,
      });

      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_RESUME_RECORDING_SUCCESS,
        METRIC_EVENT_NAMES.TASK_RESUME_RECORDING_FAILED,
      ]);

      resumeRecordingPayload ??= {autoResumed: false};

      const result = await this.contact.resumeRecording({
        interactionId: this.data.interactionId,
        data: resumeRecordingPayload,
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_RESUME_RECORDING_SUCCESS,
        {
          taskId: this.data.interactionId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(result),
        },
        ['operational', 'behavioral', 'business']
      );

      LoggerProxy.log(`Recording resumed successfully`, {
        module: TASK_FILE,
        method: 'resumeRecording',
        trackingId: result.trackingId,
        interactionId: this.data.interactionId,
      });

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'resumeRecording', TASK_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_RESUME_RECORDING_FAILED,
        {
          taskId: this.data.interactionId,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
        },
        ['operational', 'behavioral', 'business']
      );
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
      LoggerProxy.info(`Starting consult`, {
        module: TASK_FILE,
        method: 'consult',
        interactionId: this.data.interactionId,
      });

      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_CONSULT_START_SUCCESS,
        METRIC_EVENT_NAMES.TASK_CONSULT_START_FAILED,
      ]);

      const result = await this.contact.consult({
        interactionId: this.data.interactionId,
        data: consultPayload,
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_CONSULT_START_SUCCESS,
        {
          taskId: this.data.interactionId,
          destination: consultPayload.to,
          destinationType: consultPayload.destinationType,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(result),
        },
        ['operational', 'behavioral', 'business']
      );

      LoggerProxy.log(`Consult started successfully to ${consultPayload.to}`, {
        module: TASK_FILE,
        method: 'consult',
        trackingId: result.trackingId,
        interactionId: this.data.interactionId,
      });

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'consult', TASK_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_CONSULT_START_FAILED,
        {
          taskId: this.data.interactionId,
          destination: consultPayload.to,
          destinationType: consultPayload.destinationType,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
        },
        ['operational', 'behavioral', 'business']
      );
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
      LoggerProxy.info(`Ending consult`, {
        module: TASK_FILE,
        method: 'endConsult',
        interactionId: this.data.interactionId,
      });

      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_CONSULT_END_SUCCESS,
        METRIC_EVENT_NAMES.TASK_CONSULT_END_FAILED,
      ]);

      const result = await this.contact.consultEnd({
        interactionId: this.data.interactionId,
        data: consultEndPayload,
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_CONSULT_END_SUCCESS,
        {
          taskId: this.data.interactionId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(result),
        },
        ['operational', 'behavioral', 'business']
      );

      LoggerProxy.log(`Consult ended successfully`, {
        module: TASK_FILE,
        method: 'endConsult',
        trackingId: result.trackingId,
        interactionId: this.data.interactionId,
      });

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'endConsult', TASK_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_CONSULT_END_FAILED,
        {
          taskId: this.data.interactionId,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
        },
        ['operational', 'behavioral', 'business']
      );
      throw detailedError;
    }
  }

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
      LoggerProxy.info(`Transferring task to ${transferPayload.to}`, {
        module: TASK_FILE,
        method: 'transfer',
        interactionId: this.data.interactionId,
      });

      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_TRANSFER_SUCCESS,
        METRIC_EVENT_NAMES.TASK_TRANSFER_FAILED,
      ]);

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

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_TRANSFER_SUCCESS,
        {
          taskId: this.data.interactionId,
          destination: transferPayload.to,
          destinationType: transferPayload.destinationType,
          isConsultTransfer: false,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(result),
        },
        ['operational', 'behavioral', 'business']
      );

      LoggerProxy.log(`Task transferred successfully to ${transferPayload.to}`, {
        module: TASK_FILE,
        method: 'transfer',
        trackingId: result.trackingId,
        interactionId: this.data.interactionId,
      });

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'transfer', TASK_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_TRANSFER_FAILED,
        {
          taskId: this.data.interactionId,
          destination: transferPayload.to,
          destinationType: transferPayload.destinationType,
          isConsultTransfer: false,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
        },
        ['operational', 'behavioral', 'business']
      );
      throw detailedError;
    }
  }

  /**
   * This is used to consult transfer the task
   * @param consultTransferPayload
   * @returns Promise<TaskResponse>
   * @throws Error
   * @example
   * ```typescript
   * const consultTransferPayload = {
   * destination: 'anotherAgentId',
   * destinationType: 'agent',
   * }
   * task.consultTransfer(consultTransferPayload).then(()=>{}).catch(()=>{});
   * ```
   * */
  public async consultTransfer(
    consultTransferPayload: ConsultTransferPayLoad
  ): Promise<TaskResponse> {
    try {
      LoggerProxy.info(`Initiating consult transfer to ${consultTransferPayload.to}`, {
        module: TASK_FILE,
        method: 'consultTransfer',
        interactionId: this.data.interactionId,
      });

      // For queue destinations, use the destAgentId from task data
      if (consultTransferPayload.destinationType === CONSULT_TRANSFER_DESTINATION_TYPE.QUEUE) {
        if (!this.data.destAgentId) {
          throw new Error('No agent has accepted this queue consult yet');
        }

        // Override the destination with the agent who accepted the queue consult
        consultTransferPayload = {
          to: this.data.destAgentId,
          destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.AGENT,
        };
      }

      const result = await this.contact.consultTransfer({
        interactionId: this.data.interactionId,
        data: consultTransferPayload,
      });

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_TRANSFER_SUCCESS,
        {
          taskId: this.data.interactionId,
          destination: consultTransferPayload.to,
          destinationType: consultTransferPayload.destinationType,
          isConsultTransfer: true,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(result),
        },
        ['operational', 'behavioral', 'business']
      );

      LoggerProxy.log(`Consult transfer completed successfully to ${consultTransferPayload.to}`, {
        module: TASK_FILE,
        method: 'consultTransfer',
        trackingId: result.trackingId,
        interactionId: this.data.interactionId,
      });

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, 'consultTransfer', TASK_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_TRANSFER_FAILED,
        {
          taskId: this.data.interactionId,
          destination: consultTransferPayload.to,
          destinationType: consultTransferPayload.destinationType,
          isConsultTransfer: true,
          error: error.toString(),
          ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details || {}),
        },
        ['operational', 'behavioral', 'business']
      );
      throw detailedError;
    }
  }
}

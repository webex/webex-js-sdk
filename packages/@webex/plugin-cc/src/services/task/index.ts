import EventEmitter from 'events';
import {CALL_EVENT_KEYS, LocalMicrophoneStream} from '@webex/calling';
import {CallId} from '@webex/calling/dist/types/common/types';
import {getErrorDetails} from '../core/Utils';
import {LoginOption} from '../../types';
import {TASK_FILE} from '../../constants';
import {METHODS} from './constants';
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

/**
 * Task class represents a contact center task/interaction that can be managed by an agent.
 * This class provides all the necessary methods to manage tasks in a contact center environment,
 * handling various call control operations and task lifecycle management.
 *
 * - Task Lifecycle Management:
 *   - {@link accept} - Accept incoming task
 *   - {@link decline} - Decline incoming task
 *   - {@link end} - End active task
 * - Media Controls:
 *   - {@link toggleMute} - Mute/unmute microphone for voice tasks
 *   - {@link hold} - Place task on hold
 *   - {@link resume} - Resume held task
 * - Recording Controls:
 *   - {@link pauseRecording} - Pause task recording
 *   - {@link resumeRecording} - Resume paused recording
 * - Task Transfer & Consultation:
 *   - {@link consult} - Initiate consultation with another agent/queue
 *   - {@link endConsult} - End ongoing consultation
 *   - {@link transfer} - Transfer task to another agent/queue
 *   - {@link consultTransfer} - Transfer after consultation
 * - Task Completion:
 *   - {@link wrapup} - Complete task wrap-up
 *
 * Key events emitted by Task instances (see {@link TASK_EVENTS} for details):
 *
 * - Task Lifecycle:
 *   - task:incoming — New task is being offered
 *   - task:assigned — Task assigned to agent
 *   - task:unassigned — Task unassigned from agent
 *   - task:end — Task has ended
 *   - task:wrapup — Task entered wrap-up state
 *   - task:wrappedup — Task wrap-up completed
 *   - task:rejected — Task was rejected/unanswered
 *   - task:hydrate — Task data populated
 *
 * - Media & Controls:
 *   - task:media — Voice call media track received
 *   - task:hold — Task placed on hold
 *   - task:unhold — Task resumed from hold
 *
 * - Consultation & Transfer:
 *   - task:consultCreated — Consultation initiated
 *   - task:consulting — Consultation in progress
 *   - task:consultAccepted — Consultation accepted
 *   - task:consultEnd — Consultation ended
 *   - task:consultQueueCancelled — Queue consultation cancelled
 *   - task:consultQueueFailed — Queue consultation failed
 *   - task:offerConsult — Consultation offered
 *   - task:offerContact — New contact offered
 *
 * - Recording:
 *   - task:recordingPaused — Recording paused
 *   - task:recordingPauseFailed — Recording pause failed
 *   - task:recordingResumed — Recording resumed
 *   - task:recordingResumeFailed — Recording resume failed
 *
 * @implements {ITask}
 * @example
 * ```typescript
 * // 1. Initialize task
 * const task = new Task(contact, webCallingService, taskData);
 *
 * // 2. Set up event listeners
 * task.on('task:media', (track) => {
 *   // Handle voice call media
 *   const audioElement = document.getElementById('remote-audio');
 *   audioElement.srcObject = new MediaStream([track]);
 * });
 *
 * task.on('task:hold', () => {
 *   console.log('Task is on hold');
 *   // Update UI to show hold state
 * });
 *
 * task.on('task:end', () => {
 *   console.log('Task ended');
 *   if (task.data.wrapUpRequired) {
 *     // Show wrap-up form
 *   }
 * });
 *
 * // 3. Example task operations
 * await task.accept(); // Accept incoming task
 * await task.hold();   // Place on hold
 * await task.resume(); // Resume from hold
 * await task.end();    // End task
 *
 * // 4. Handle wrap-up if required
 * await task.wrapup({
 *   auxCodeId: 'RESOLVED',
 *   wrapUpReason: 'Customer issue resolved'
 * });
 * ```
 */

export default class Task extends EventEmitter implements ITask {
  private contact: ReturnType<typeof routingContact>;
  private localAudioStream: LocalMicrophoneStream;
  private webCallingService: WebCallingService;
  public data: TaskData;
  private metricsManager: MetricsManager;
  public webCallMap: Record<TaskId, CallId>;

  /**
   * Creates a new Task instance which provides the following features:
   * @param contact - The routing contact service instance
   * @param webCallingService - The web calling service instance
   * @param data - Initial task data
   */
  public constructor(
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

  /**
   * @ignore
   * @private
   */
  private handleRemoteMedia = (track: MediaStreamTrack) => {
    this.emit(TASK_EVENTS.TASK_MEDIA, track);
  };

  /**
   * @ignore
   * @private
   */
  private registerWebCallListeners() {
    this.webCallingService.on(CALL_EVENT_KEYS.REMOTE_MEDIA, this.handleRemoteMedia);
  }

  /**
   * @ignore
   */
  public unregisterWebCallListeners() {
    this.webCallingService.off(CALL_EVENT_KEYS.REMOTE_MEDIA, this.handleRemoteMedia);
  }

  /**
   * Updates the task data with new information
   * @param updatedData - New task data to merge with existing data
   * @param shouldOverwrite - If true, completely replace data instead of merging
   * @returns The updated task instance
   * @example
   * ```typescript
   * task.updateTaskData(newData);
   * task.updateTaskData(newData, true); // completely replace data
   * ```
   */
  public updateTaskData = (updatedData: TaskData, shouldOverwrite = false) => {
    this.data = shouldOverwrite ? updatedData : this.reconcileData(this.data, updatedData);

    return this;
  };

  /**
   * Recursively merges old data with new data
   * @private
   */
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
   * Agent accepts the incoming task.
   * After accepting, the task will emit task:assigned event and for voice calls,
   * a task:media event with the audio stream.
   *
   * @returns Promise<TaskResponse>
   * @throws Error if accepting task fails or media requirements not met
   * @example
   * ```typescript
   * // Set up event handlers before accepting
   * task.on(TASK_EVENTS.TASK_ASSIGNED, () => {
   *   console.log('Task assigned, ID:', task.data.interactionId);
   *   // Update UI to show active task
   * });
   *
   * // For voice calls, handle media
   * task.on(TASK_EVENTS.TASK_MEDIA, (track) => {
   *   const audioElement = document.getElementById('remote-audio');
   *   audioElement.srcObject = new MediaStream([track]);
   * });
   *
   * // Accept the task
   * try {
   *   await task.accept();
   *   console.log('Successfully accepted task');
   * } catch (error) {
   *   console.error('Failed to accept task:', error);
   *   // Handle error (e.g., show error message to agent)
   * }
   * ```
   */
  public async accept(): Promise<TaskResponse> {
    try {
      LoggerProxy.info(`Accepting task`, {
        module: TASK_FILE,
        method: METHODS.ACCEPT,
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
          method: METHODS.ACCEPT,
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

        LoggerProxy.log(`Task accepted successfully with webrtc calling`, {
          module: TASK_FILE,
          method: METHODS.ACCEPT,
          interactionId: this.data.interactionId,
        });
      }

      return Promise.resolve(); // TODO: reject for extension as part of refactor
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, METHODS.ACCEPT, TASK_FILE);
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
   * Agent can mute/unmute their microphone during a WebRTC task.
   * This method toggles between muted and unmuted states for the local audio stream.
   *
   * @returns Promise<void> - Resolves when mute/unmute operation completes
   * @throws Error if toggling mute state fails or audio stream is not available
   * @example
   * ```typescript
   * // Toggle mute state
   * task.toggleMute()
   *   .then(() => console.log('Mute state toggled successfully'))
   *   .catch(error => console.error('Failed to toggle mute:', error));
   * ```
   */
  public async toggleMute() {
    try {
      LoggerProxy.info(`Toggling mute state`, {
        module: TASK_FILE,
        method: METHODS.TOGGLE_MUTE,
        interactionId: this.data.interactionId,
      });

      this.webCallingService.muteUnmuteCall(this.localAudioStream);

      LoggerProxy.log(
        `Mute state toggled successfully isCallMuted: ${this.webCallingService.isCallMuted()}`,
        {
          module: TASK_FILE,
          method: METHODS.TOGGLE_MUTE,
          interactionId: this.data.interactionId,
        }
      );

      return Promise.resolve();
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, METHODS.TOGGLE_MUTE, TASK_FILE);
      throw detailedError;
    }
  }

  /**
   * Declines the incoming task. This will reject the task and notify the routing system.
   * For voice calls, this is equivalent to declining the incoming call.
   *
   * @returns Promise<TaskResponse>
   * @throws Error if the decline operation fails
   * @example
   * ```typescript
   * // Decline an incoming task
   * task.decline()
   *   .then(() => console.log('Task declined successfully'))
   *   .catch(error => console.error('Failed to decline task:', error));
   * ```
   */
  public async decline(): Promise<TaskResponse> {
    try {
      LoggerProxy.info(`Declining task`, {
        module: TASK_FILE,
        method: METHODS.DECLINE,
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
        method: METHODS.DECLINE,
        interactionId: this.data.interactionId,
      });

      return Promise.resolve();
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, METHODS.DECLINE, TASK_FILE);
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
   * Puts the current task/interaction on hold.
   * Emits task:hold event when successful. For voice tasks, this mutes the audio.
   *
   * @returns Promise<TaskResponse>
   * @throws Error if hold operation fails
   * @example
   * ```typescript
   * // Set up hold event handler
   * task.on(TASK_EVENTS.TASK_HOLD, () => {
   *   console.log('Task is now on hold');
   *   // Update UI to show hold state (e.g., enable resume button, show hold indicator)
   *   document.getElementById('resume-btn').disabled = false;
   *   document.getElementById('hold-indicator').style.display = 'block';
   * });
   *
   * // Place task on hold
   * try {
   *   await task.hold();
   *   console.log('Successfully placed task on hold');
   * } catch (error) {
   *   console.error('Failed to place task on hold:', error);
   *   // Handle error (e.g., show error message, reset UI state)
   * }
   * ```
   */
  public async hold(): Promise<TaskResponse> {
    try {
      LoggerProxy.info(`Holding task`, {
        module: TASK_FILE,
        method: METHODS.HOLD,
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
        method: METHODS.HOLD,
        trackingId: response.trackingId,
        interactionId: this.data.interactionId,
      });

      return response;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, METHODS.HOLD, TASK_FILE);
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
   * Resumes the task/interaction that was previously put on hold.
   * Emits task:unhold event when successful. For voice tasks, this restores the audio.
   *
   * @returns Promise<TaskResponse>
   * @throws Error if resume operation fails
   * @example
   * ```typescript
   * // Set up unhold event handler
   * task.on(TASK_EVENTS.TASK_UNHOLD, () => {
   *   console.log('Task resumed from hold');
   *   // Update UI to show active state
   *   document.getElementById('hold-btn').disabled = false;
   *   document.getElementById('hold-indicator').style.display = 'none';
   * });
   *
   * // Resume task from hold
   * try {
   *   await task.resume();
   *   console.log('Successfully resumed task from hold');
   * } catch (error) {
   *   console.error('Failed to resume task:', error);
   *   // Handle error (e.g., show error message)
   * }
   * ```
   */
  public async resume(): Promise<TaskResponse> {
    try {
      LoggerProxy.info(`Resuming task`, {
        module: TASK_FILE,
        method: METHODS.RESUME,
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
        method: METHODS.RESUME,
        trackingId: response.trackingId,
        interactionId: this.data.interactionId,
      });

      return response;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, METHODS.RESUME, TASK_FILE);
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
   * Ends the task/interaction with the customer.
   * Emits task:end event when successful. If task requires wrap-up,
   * this will be indicated in the task:end event data.
   *
   * @returns Promise<TaskResponse>
   * @throws Error if ending task fails
   * @example
   * ```typescript
   * // Set up task end event handler
   * task.on(TASK_EVENTS.TASK_END, (data) => {
   *   console.log('Task ended:', task.data.interactionId);
   *
   *   if (data.wrapUpRequired) {
   *     // Show wrap-up form
   *     showWrapupForm();
   *   } else {
   *     // Clean up and prepare for next task
   *     cleanupTask();
   *   }
   * });
   *
   * // End the task
   * try {
   *   await task.end();
   *   console.log('Task end request successful');
   * } catch (error) {
   *   console.error('Failed to end task:', error);
   *   // Handle error (e.g., show error message, retry option)
   * }
   *
   * function showWrapupForm() {
   *   // Show wrap-up UI with required codes
   *   document.getElementById('wrapup-form').style.display = 'block';
   * }
   *
   * function cleanupTask() {
   *   // Reset UI state
   *   document.getElementById('active-task').style.display = 'none';
   *   document.getElementById('controls').style.display = 'none';
   * }
   * ```
   */
  public async end(): Promise<TaskResponse> {
    try {
      LoggerProxy.info(`Ending task`, {
        module: TASK_FILE,
        method: METHODS.END,
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
        method: METHODS.END,
        trackingId: response.trackingId,
        interactionId: this.data.interactionId,
      });

      return response;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, METHODS.END, TASK_FILE);
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
   * Wraps up the task/interaction with the customer.
   * This is called after task:end event if wrapUpRequired is true.
   * Emits task:wrappedup event when successful.
   *
   * @param wrapupPayload - WrapupPayLoad containing:
   *   - auxCodeId: Required ID for the wrap-up code
   *   - wrapUpReason: Required description of wrap-up reason
   * @returns Promise<TaskResponse>
   * @throws Error if task data is unavailable, auxCodeId is missing, or wrapUpReason is missing
   * @example
   * ```typescript
   * // Set up wrap-up events
   * task.on(TASK_EVENTS.TASK_WRAPUP, () => {
   *   console.log('Task ready for wrap-up');
   *   // Show wrap-up form
   *   document.getElementById('wrapup-form').style.display = 'block';
   * });
   *
   * task.on(TASK_EVENTS.TASK_WRAPPEDUP, () => {
   *   console.log('Task wrap-up completed');
   *   // Clean up UI
   *   document.getElementById('wrapup-form').style.display = 'none';
   * });
   *
   * // Submit wrap-up
   * try {
   *   const wrapupPayload = {
   *     auxCodeId: selectedCode, // e.g., 'ISSUE_RESOLVED'
   *     wrapUpReason: 'Customer issue resolved successfully'
   *   };
   *   await task.wrapup(wrapupPayload);
   *   console.log('Successfully submitted wrap-up');
   * } catch (error) {
   *   console.error('Failed to submit wrap-up:', error);
   *   // Handle validation errors
   *   if (error.message.includes('required')) {
   *     // Show validation error to agent
   *   }
   * }
   * ```
   */
  public async wrapup(wrapupPayload: WrapupPayLoad): Promise<TaskResponse> {
    try {
      LoggerProxy.info(`Wrapping up task`, {
        module: TASK_FILE,
        method: METHODS.WRAPUP,
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
        method: METHODS.WRAPUP,
        trackingId: response.trackingId,
        interactionId: this.data.interactionId,
      });

      return response;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, METHODS.WRAPUP, TASK_FILE);
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
   * Pauses the recording for the current voice task.
   * Emits task:recordingPaused event when successful.
   *
   * @returns Promise<TaskResponse>
   * @throws Error if pause recording fails
   * @example
   * ```typescript
   * // Set up recording events
   * task.on(TASK_EVENTS.TASK_RECORDING_PAUSED, () => {
   *   console.log('Recording paused');
   *   // Update UI to show recording paused state
   *   document.getElementById('recording-status').textContent = 'Recording Paused';
   *   document.getElementById('pause-recording-btn').style.display = 'none';
   *   document.getElementById('resume-recording-btn').style.display = 'block';
   * });
   *
   * task.on(TASK_EVENTS.TASK_RECORDING_PAUSE_FAILED, (error) => {
   *   console.error('Failed to pause recording:', error);
   *   // Show error to agent
   * });
   *
   * // Pause recording
   * try {
   *   await task.pauseRecording();
   *   console.log('Pause recording request sent');
   * } catch (error) {
   *   console.error('Error sending pause recording request:', error);
   *   // Handle error
   * }
   * ```
   */
  public async pauseRecording(): Promise<TaskResponse> {
    try {
      LoggerProxy.info(`Pausing recording`, {
        module: TASK_FILE,
        method: METHODS.PAUSE_RECORDING,
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
        method: METHODS.PAUSE_RECORDING,
        trackingId: result.trackingId,
        interactionId: this.data.interactionId,
      });

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, METHODS.PAUSE_RECORDING, TASK_FILE);
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
   * Resumes the recording for the voice task that was previously paused.
   * Emits task:recordingResumed event when successful.
   *
   * @param resumeRecordingPayload - Configuration for resuming recording:
   *   - autoResumed: Indicates if resume was automatic (defaults to false)
   * @returns Promise<TaskResponse>
   * @throws Error if resume recording fails
   * @example
   * ```typescript
   * // Set up recording resume events
   * task.on(TASK_EVENTS.TASK_RECORDING_RESUMED, () => {
   *   console.log('Recording resumed');
   *   // Update UI to show active recording state
   *   document.getElementById('recording-status').textContent = 'Recording Active';
   *   document.getElementById('pause-recording-btn').style.display = 'block';
   *   document.getElementById('resume-recording-btn').style.display = 'none';
   * });
   *
   * task.on(TASK_EVENTS.TASK_RECORDING_RESUME_FAILED, (error) => {
   *   console.error('Failed to resume recording:', error);
   *   // Show error to agent
   * });
   *
   * // Resume recording
   * try {
   *   const resumePayload = {
   *     autoResumed: false // Set to true if triggered by system
   *   };
   *   await task.resumeRecording(resumePayload);
   *   console.log('Resume recording request sent');
   * } catch (error) {
   *   console.error('Error sending resume recording request:', error);
   *   // Handle error
   * }
   * ```
   */
  public async resumeRecording(
    resumeRecordingPayload: ResumeRecordingPayload
  ): Promise<TaskResponse> {
    try {
      LoggerProxy.info(`Resuming recording`, {
        module: TASK_FILE,
        method: METHODS.RESUME_RECORDING,
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
        method: METHODS.RESUME_RECORDING,
        trackingId: result.trackingId,
        interactionId: this.data.interactionId,
      });

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, METHODS.RESUME_RECORDING, TASK_FILE);
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
   * Consults another agent or queue on an ongoing task for further assistance.
   * During consultation, the original customer is typically placed on hold while
   * the agent seeks guidance from another agent or queue.
   *
   * @param consultPayload - Configuration for the consultation containing:
   *   - to: ID of the agent or queue to consult with
   *   - destinationType: Type of destination (AGENT, QUEUE, etc.)
   *   - holdParticipants: Whether to hold other participants (defaults to true)
   * @returns Promise<TaskResponse> - Resolves with consultation result
   * @throws Error if consultation fails or invalid parameters provided
   * @example
   * ```typescript
   * // Consult with another agent
   * const consultPayload = {
   *   to: 'agentId123',
   *   destinationType: DESTINATION_TYPE.AGENT,
   *   holdParticipants: true
   * };
   * task.consult(consultPayload)
   *   .then(response => console.log('Consultation started successfully'))
   *   .catch(error => console.error('Failed to start consultation:', error));
   *
   * // Consult with a queue
   * const queueConsultPayload = {
   *   to: 'salesQueue123',
   *   destinationType: DESTINATION_TYPE.QUEUE
   * };
   * task.consult(queueConsultPayload)
   *   .then(response => console.log('Queue consultation started'))
   *   .catch(error => console.error('Failed to start queue consultation:', error));
   * ```
   */
  public async consult(consultPayload: ConsultPayload): Promise<TaskResponse> {
    try {
      LoggerProxy.info(`Starting consult`, {
        module: TASK_FILE,
        method: METHODS.CONSULT,
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
        method: METHODS.CONSULT,
        trackingId: result.trackingId,
        interactionId: this.data.interactionId,
      });

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, METHODS.CONSULT, TASK_FILE);
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
   * Ends an ongoing consultation session for the task.
   * This terminates the consultation while maintaining the original customer connection.
   *
   * @param consultEndPayload - Configuration for ending the consultation containing:
   *   - isConsult: Must be true to indicate this is a consultation end
   *   - taskId: ID of the task being consulted on
   *   - queueId: (Optional) Queue ID if this was a queue consultation
   *   - isSecondaryEpDnAgent: (Optional) Indicates if this involves a secondary entry point
   * @returns Promise<TaskResponse> - Resolves when consultation is ended
   * @throws Error if ending consultation fails or invalid parameters provided
   * @example
   * ```typescript
   * // End a direct agent consultation
   * const consultEndPayload = {
   *   isConsult: true,
   *   taskId: 'task123'
   * };
   * task.endConsult(consultEndPayload)
   *   .then(response => console.log('Consultation ended successfully'))
   *   .catch(error => console.error('Failed to end consultation:', error));
   *
   * // End a queue consultation
   * const queueConsultEndPayload = {
   *   isConsult: true,
   *   taskId: 'task123',
   *   queueId: 'queue123'
   * };
   * task.endConsult(queueConsultEndPayload)
   *   .then(response => console.log('Queue consultation ended'))
   *   .catch(error => console.error('Failed to end queue consultation:', error));
   * ```
   */
  public async endConsult(consultEndPayload: ConsultEndPayload): Promise<TaskResponse> {
    try {
      LoggerProxy.info(`Ending consult`, {
        module: TASK_FILE,
        method: METHODS.END_CONSULT,
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
        method: METHODS.END_CONSULT,
        trackingId: result.trackingId,
        interactionId: this.data.interactionId,
      });

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, METHODS.END_CONSULT, TASK_FILE);
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
   * Transfer the task to an agent directly or to a queue.
   * This is a blind transfer that immediately redirects the task to the specified destination.
   *
   * @param transferPayload - Transfer configuration containing:
   *   - to: ID of the agent or queue to transfer to
   *   - destinationType: Type of destination (AGENT, QUEUE, etc.)
   * @returns Promise<TaskResponse> - Resolves when transfer is completed
   * @throws Error if transfer fails or invalid parameters provided
   * @example
   * ```typescript
   * // Transfer to a queue
   * const queueTransferPayload = {
   *   to: 'salesQueue123',
   *   destinationType: DESTINATION_TYPE.QUEUE
   * };
   * task.transfer(queueTransferPayload)
   *   .then(response => console.log('Task transferred to queue successfully'))
   *   .catch(error => console.error('Failed to transfer to queue:', error));
   *
   * // Transfer to an agent
   * const agentTransferPayload = {
   *   to: 'agentId123',
   *   destinationType: DESTINATION_TYPE.AGENT
   * };
   * task.transfer(agentTransferPayload)
   *   .then(response => console.log('Task transferred to agent successfully'))
   *   .catch(error => console.error('Failed to transfer to agent:', error));
   * ```
   */
  public async transfer(transferPayload: TransferPayLoad): Promise<TaskResponse> {
    try {
      LoggerProxy.info(`Transferring task to ${transferPayload.to}`, {
        module: TASK_FILE,
        method: METHODS.TRANSFER,
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
        method: METHODS.TRANSFER,
        trackingId: result.trackingId,
        interactionId: this.data.interactionId,
      });

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, METHODS.TRANSFER, TASK_FILE);
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
   * Transfer the task to the party that was consulted.
   * This completes a consultative transfer where the agent first consulted with the target
   * before transferring the task. For queue consultations, the transfer is automatically
   * directed to the agent who accepted the consultation.
   *
   * @param consultTransferPayload - Configuration for the consultation transfer containing:
   *   - to: ID of the agent or queue to transfer to
   *   - destinationType: Type of destination (AGENT, QUEUE, etc. from CONSULT_TRANSFER_DESTINATION_TYPE)
   * @returns Promise<TaskResponse> - Resolves when consultation transfer is completed
   * @throws Error if transfer fails, no agent has accepted a queue consultation, or other validation errors
   * @example
   * ```typescript
   * // Complete consultation transfer to an agent
   * const agentConsultTransfer = {
   *   to: 'agentId123',
   *   destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.AGENT
   * };
   * task.consultTransfer(agentConsultTransfer)
   *   .then(response => console.log('Consultation transfer to agent completed'))
   *   .catch(error => console.error('Failed to complete agent consultation transfer:', error));
   *
   * // Complete consultation transfer to a queue agent
   * const queueConsultTransfer = {
   *   to: 'queue123',
   *   destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.QUEUE
   * };
   * task.consultTransfer(queueConsultTransfer)
   *   .then(response => console.log('Consultation transfer to queue agent completed'))
   *   .catch(error => console.error('Failed to complete queue consultation transfer:', error));
   * ```
   */
  public async consultTransfer(
    consultTransferPayload: ConsultTransferPayLoad
  ): Promise<TaskResponse> {
    try {
      LoggerProxy.info(`Initiating consult transfer to ${consultTransferPayload.to}`, {
        module: TASK_FILE,
        method: METHODS.CONSULT_TRANSFER,
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
        method: METHODS.CONSULT_TRANSFER,
        trackingId: result.trackingId,
        interactionId: this.data.interactionId,
      });

      return result;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, METHODS.CONSULT_TRANSFER, TASK_FILE);
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

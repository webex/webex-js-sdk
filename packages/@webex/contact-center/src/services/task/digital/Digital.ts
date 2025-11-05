import {CC_FILE, METHODS} from '../../../constants';
import {getErrorDetails} from '../../core/Utils';
import {IDigital, TaskResponse, TaskData} from '../types';
import Task from '../Task';
import LoggerProxy from '../../../logger-proxy';
import MetricsManager from '../../../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../metrics/constants';
import {TaskState} from '../state-machine';

export default class Digital extends Task implements IDigital {
  /**
   * Compute UI controls based on state machine state for digital channels.
   * This method determines which buttons should be visible and enabled
   * based on the current task state.
   *
   * @returns UI control states for all task actions
   */
  protected computeUIControls(): import('../Task').TaskUIControls {
    const state = this.stateMachineService?.state;

    if (!state) {
      // Fallback if state machine not initialized
      return super.computeUIControls();
    }

    // Determine current state
    const isOffered = state.matches(TaskState.OFFERED);
    const isConnected = state.matches(TaskState.CONNECTED);
    const isWrappingUp = state.matches(TaskState.WRAPPING_UP);
    const isTerminated = this.data.interaction?.isTerminated ?? false;

    // For digital channels, determine if task needs wrapup
    const needsWrapup = isTerminated || isWrappingUp;

    return {
      // Accept button: visible when task is offered
      accept: {
        visible: isOffered,
        enabled: isOffered,
      },

      // Decline: not used in digital channels
      decline: {
        visible: false,
        enabled: false,
      },

      // Hold: not used in digital channels
      hold: {
        visible: false,
        enabled: false,
      },

      // Mute: not used in digital channels
      mute: {
        visible: false,
        enabled: false,
      },

      // End button: visible when connected, not when wrapping up
      end: {
        visible: isConnected && !isWrappingUp,
        enabled: isConnected && !isWrappingUp,
      },

      // Transfer button: visible when connected, not when wrapping up
      transfer: {
        visible: isConnected && !isWrappingUp,
        enabled: isConnected && !isWrappingUp,
      },

      // Consult: not used in digital channels
      consult: {
        visible: false,
        enabled: false,
      },

      // Consult transfer: not used in digital channels
      consultTransfer: {
        visible: false,
        enabled: false,
      },

      // End consult: not used in digital channels
      endConsult: {
        visible: false,
        enabled: false,
      },

      // Recording: not used in digital channels
      recording: {
        visible: false,
        enabled: false,
      },

      // Conference: not used in digital channels
      conference: {
        visible: false,
        enabled: false,
      },

      // Wrapup button: visible when task is terminated or in wrapup state
      wrapup: {
        visible: needsWrapup,
        enabled: needsWrapup,
      },

      // Exit conference: not used in digital channels
      exitConference: {
        visible: false,
        enabled: false,
      },

      // Transfer conference: not used in digital channels
      transferConference: {
        visible: false,
        enabled: false,
      },

      // Merge to conference: not used in digital channels
      mergeToConference: {
        visible: false,
        enabled: false,
      },
    };
  }

  /**
   * Updates the task data with new information
   * @param newData - Updated task data to apply
   * @param shouldOverwrite - Whether to completely replace existing data
   * @returns Updated Digital task instance
   */
  public updateTaskData(newData: TaskData, shouldOverwrite = false): IDigital {
    super.updateTaskData(newData, shouldOverwrite);

    return this;
  }

  /**
   * This is used for incoming digital task accept by agent.
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
        module: CC_FILE,
        method: METHODS.ACCEPT,
        interactionId: this.data.interactionId,
      });

      this.metricsManager.timeEvent([
        METRIC_EVENT_NAMES.TASK_ACCEPT_SUCCESS,
        METRIC_EVENT_NAMES.TASK_ACCEPT_FAILED,
      ]);

      const response = await this.contact.accept({interactionId: this.data.interactionId});

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_ACCEPT_SUCCESS,
        {
          taskId: this.data.interactionId,
          ...MetricsManager.getCommonTrackingFieldForAQMResponse(response),
        },
        ['operational', 'behavioral', 'business']
      );
      LoggerProxy.log(`Task accepted successfully`, {
        module: CC_FILE,
        method: METHODS.ACCEPT,
        trackingId: response.trackingId,
        interactionId: this.data.interactionId,
      });

      return response;
    } catch (error) {
      const {error: detailedError} = getErrorDetails(error, METHODS.ACCEPT, CC_FILE);
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.TASK_ACCEPT_FAILED,
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
}

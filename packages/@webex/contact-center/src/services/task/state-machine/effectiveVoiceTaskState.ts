/**
 * When the XState snapshot lags (e.g. after consult transfer) but {@link TaskData} reflects an
 * active voice call, align operational and UI behavior with observable interaction state.
 */

import {TaskState} from './constants';
import type {TaskData} from '../types';

function shouldForceWrapUpForCurrentAgent(taskData: TaskData): boolean {
  const selfId = taskData.agentId;
  if (!selfId) return Boolean(taskData.wrapUpRequired);

  const pending = taskData.agentsPendingWrapUp;
  if (Array.isArray(pending) && pending.length > 0) {
    return pending.includes(selfId);
  }

  const participantWrapUp = taskData.interaction?.participants?.[selfId]?.isWrapUp === true;
  if (participantWrapUp) return true;
  const participants = taskData.interaction?.participants;
  if (participants) {
    const selfParticipant: any = participants[selfId];
    if (!selfParticipant || selfParticipant.hasLeft === true) {
      return true;
    }
  }

  return taskData.wrapUpRequired === true;
}

/**
 * Maps machine + latest task payload to the task state call controls should assume for voice.
 * Used by {@link computeUIControls} and {@link Voice} operation guards.
 */
export function resolveEffectiveVoiceTaskState(
  machineState: TaskState,
  taskData?: TaskData | null
): TaskState {
  if (!taskData?.interaction) {
    return machineState;
  }
  if (
    machineState !== TaskState.WRAPPING_UP &&
    machineState !== TaskState.COMPLETED &&
    machineState !== TaskState.TERMINATED &&
    shouldForceWrapUpForCurrentAgent(taskData)
  ) {
    return TaskState.WRAPPING_UP;
  }
  if (machineState !== TaskState.IDLE) return machineState;
  if (taskData.interaction.isTerminated === true) {
    return machineState;
  }

  const raw = taskData.interaction.state;
  if (typeof raw === 'string') {
    const s = raw.trim().toLowerCase();
    if (s === 'connected') return TaskState.CONNECTED;
    if (s === 'consulting') return TaskState.CONSULTING;
    if (s === 'hold') return TaskState.HELD;
    if (s === 'conference') return TaskState.CONFERENCING;
    if (s === 'wrap-up' || s === 'wrapup' || s === 'wrapping_up') return TaskState.WRAPPING_UP;
    if (s === 'new' || s === 'reserved' || s === 'offered') return machineState;
  }

  const interaction = taskData.interaction;
  const mainId = interaction.mainInteractionId || taskData.interactionId;
  const selfId = taskData.agentId;
  const media = mainId ? interaction.media?.[mainId] : undefined;
  const ids = media?.participants;
  if (selfId && Array.isArray(ids) && ids.includes(selfId) && interaction.participants) {
    const hasOtherActiveParty = ids.some((participantId: string) => {
      if (participantId === selfId) return false;
      const p: any = interaction.participants?.[participantId];

      return Boolean(p && !p.hasLeft);
    });
    if (hasOtherActiveParty) {
      return media?.isHold ? TaskState.HELD : TaskState.CONNECTED;
    }
  }

  return machineState;
}

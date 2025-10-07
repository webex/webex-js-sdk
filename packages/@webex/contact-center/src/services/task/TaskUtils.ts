/* eslint-disable import/prefer-default-export */
import {ITask} from './types';

/**
 * Utility functions for task-related operations in multi-party conference scenarios
 * These functions help determine agent roles, participation status, and task relationships
 */
export class TaskUtils {
  /**
   * Determines if the given agent is the primary agent (owner) of the task
   * @param task - The task to check
   * @param agentId - The agent ID to check for primary status
   * @returns true if the agent is the primary agent, false otherwise
   */
  static isPrimary(task: ITask, agentId: string): boolean {
    if (!task?.data?.interaction?.owner) {
      // Fall back to checking data.agentId when owner is not set
      return task?.data?.agentId === agentId;
    }

    return task.data.interaction.owner === agentId;
  }

  /**
   * Checks if the given agent is a participant in the main interaction (mainCall)
   * @param task - The task to check
   * @param agentId - The agent ID to check for participation
   * @returns true if the agent is a participant in the main interaction, false otherwise
   */
  static isParticipantInMainInteraction(task: ITask, agentId: string): boolean {
    if (!task?.data?.interaction?.media) {
      return false;
    }

    return Object.values(task.data.interaction.media).some(
      (mediaObj: any) => mediaObj.mType === 'mainCall' && mediaObj.participants?.includes(agentId)
    );
  }

  /**
   * Checks if the given agent is not in the interaction or has left the interaction
   * @param task - The task to check
   * @param agentId - The agent ID to check
   * @returns true if the agent is not in the interaction or has left, false otherwise
   */
  static checkParticipantNotInInteraction(task: ITask, agentId: string): boolean {
    if (!task?.data?.interaction?.participants) {
      return true;
    }

    const {data} = task;

    return (
      !(agentId in data.interaction.participants) ||
      (agentId in data.interaction.participants && data.interaction.participants[agentId].hasLeft)
    );
  }

  /**
   * Gets the participant status for a given agent in a task
   * @param task - The task to check
   * @param agentId - The agent ID to get status for
   * @returns Object containing various status flags for the agent
   */
  static getParticipantStatus(task: ITask, agentId: string) {
    return {
      isPrimary: TaskUtils.isPrimary(task, agentId),
      isInMainInteraction: TaskUtils.isParticipantInMainInteraction(task, agentId),
      isNotInInteraction: TaskUtils.checkParticipantNotInInteraction(task, agentId),
      isOwner: task?.data?.interaction?.owner === agentId,
      hasLeft: task?.data?.interaction?.participants?.[agentId]?.hasLeft || false,
    };
  }

  /**
   * Determines if a conference is currently in progress based on the number of active agent participants
   * @param task - The task to check for conference status
   * @returns true if there are 2 or more active agent participants in the main call, false otherwise
   */
  static getIsConferenceInProgress(task: ITask): boolean {
    const mediaMainCall = task?.data?.interaction?.media?.[task?.data?.interactionId];
    const participantsInMainCall = new Set(mediaMainCall?.participants);
    const participants = task?.data?.interaction?.participants;

    const agentParticipants = new Set();
    if (participantsInMainCall.size > 0) {
      participantsInMainCall.forEach((participantId: string) => {
        const participant = participants?.[participantId];
        if (
          participant &&
          participant.pType !== 'Customer' &&
          participant.pType !== 'Supervisor' &&
          !participant.hasLeft &&
          participant.pType !== 'VVA'
        ) {
          agentParticipants.add(participantId);
        }
      });
    }

    return agentParticipants.size >= 2;
  }
}

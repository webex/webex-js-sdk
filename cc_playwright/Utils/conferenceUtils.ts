/* eslint-disable no-await-in-loop, no-plusplus, no-continue, no-console */
import {expect, Page} from '@playwright/test';
import {
  ACTIVE_CONSULT_CONTROL_TEST_IDS,
  cancelConsult,
  consultOrTransfer,
  hasAnyVisibleControlFromList,
} from './advancedTaskControlUtils';
import {hasAnyVisibleControl, hasAnyVisibleEnabledControl} from './controlUtils';
import {acceptIncomingTask, createCallTask, getIncomingTaskLocator} from './incomingTaskUtils';
import {handleStrayTasks, waitForState} from './helperUtils';
import {endTask} from './taskControlUtils';
import {changeUserState, verifyCurrentState} from './userStateUtils';
import {submitWrapup} from './wrapupUtils';
import {
  ACCEPT_TASK_TIMEOUT,
  AWAIT_TIMEOUT,
  CONFERENCE_ACTION_SETTLE_TIMEOUT,
  CONFERENCE_END_TASK_SETTLE_TIMEOUT,
  CONFERENCE_SWITCH_TOGGLE_TIMEOUT,
  TASK_TYPES,
  USER_STATES,
  WRAPUP_REASONS,
  WRAPUP_TIMEOUT,
} from '../constants';

export type AgentId = 1 | 2 | 3 | 4;

export const CONFERENCE_AGENT_IDS: AgentId[] = [1, 2, 3, 4];

type GetAgentPage = (agentId: AgentId) => Page;
type GetRequiredEnv = (suffix: string) => string;
type GetAgentName = (agentId: AgentId) => string;

interface CleanupConferenceStateOptions {
  getAgentPage: GetAgentPage;
  callerPage?: Page;
  agentIds?: AgentId[];
  cleanupTaskTimeout?: number;
}

interface StartConferenceCallOptions {
  getAgentPage: GetAgentPage;
  callerPage?: Page;
  getRequiredEnv: GetRequiredEnv;
  agentIds?: AgentId[];
  acceptTimeout?: number;
  waitForAvailableBeforeDial?: boolean;
}

interface ConferenceConsultOptions {
  fromAgent: AgentId;
  toAgent: AgentId;
  getAgentPage: GetAgentPage;
  getAgentName: GetAgentName;
  acceptTimeout?: number;
}

interface QueueConsultOptions {
  fromAgent: AgentId;
  toAgent: AgentId;
  getAgentPage: GetAgentPage;
  getRequiredEnv: GetRequiredEnv;
  acceptTimeout?: number;
}

interface SingleAgentActionOptions {
  fromAgent: AgentId;
  getAgentPage: GetAgentPage;
  acceptTimeout?: number;
}

export const getConferenceRequiredEnv = (projectName: string, suffix: string): string => {
  const value = process.env[`${projectName}_${suffix}`];
  if (!value) {
    throw new Error(`Missing env key: ${projectName}_${suffix}`);
  }

  return value;
};

export const getConferenceAgentName = (projectName: string, agentId: AgentId): string =>
  getConferenceRequiredEnv(projectName, `AGENT${agentId}_NAME`);

export const cleanupConferencePageWithTimeout = async (
  page?: Page,
  auxiliaryPage?: Page,
  cleanupTaskTimeout = 60000
) => {
  if (!page || page.isClosed()) {
    return;
  }

  const validAuxiliaryPage = auxiliaryPage && !auxiliaryPage.isClosed() ? auxiliaryPage : undefined;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error('conference cleanup timeout')),
      cleanupTaskTimeout
    );
  });

  try {
    await Promise.race([handleStrayTasks(page, validAuxiliaryPage), timeoutPromise]);
  } catch {
    // Ignore cleanup errors/timeouts so hook teardown does not fail test execution.
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
};

export const setConferenceBaselineAvailability = async (
  getAgentPage: GetAgentPage,
  availableAgents: AgentId[],
  agentIds: AgentId[] = CONFERENCE_AGENT_IDS
) => {
  for (const agentId of agentIds) {
    const page = getAgentPage(agentId);
    const state = availableAgents.includes(agentId) ? USER_STATES.AVAILABLE : USER_STATES.MEETING;
    await changeUserState(page, state);
  }
};

export const setConferenceAgentsAvailable = async (
  getAgentPage: GetAgentPage,
  agentIds: AgentId[]
) => {
  for (const agentId of agentIds) {
    const page = getAgentPage(agentId);
    await changeUserState(page, USER_STATES.AVAILABLE);
    await verifyCurrentState(page, USER_STATES.AVAILABLE);
  }
};

export const waitForConferenceControlReady = async (
  getAgentPage: GetAgentPage,
  agentId: AgentId,
  controlTestId: string,
  timeout: number = ACCEPT_TASK_TIMEOUT
) => {
  const page = getAgentPage(agentId);
  await expect
    .poll(() => hasAnyVisibleEnabledControl(page, controlTestId), {
      timeout,
      intervals: [250, 500, 1000, 2000],
    })
    .toBeTruthy();
};

export const resetCallerPageForNextConferenceCall = async (callerPage?: Page) => {
  if (!callerPage || callerPage.isClosed()) return;
  const endBtn = callerPage.getByTestId('end');
  const isEnabled = await endBtn.isEnabled({timeout: 1000}).catch(() => false);
  if (isEnabled) {
    await endBtn.click({timeout: AWAIT_TIMEOUT});
    await callerPage.waitForTimeout(1000);
  }
  await callerPage.locator('#sd-get-media-streams').click({timeout: AWAIT_TIMEOUT});
  await callerPage.waitForTimeout(500);
};

export const cleanupConferenceState = async ({
  getAgentPage,
  callerPage,
  agentIds = CONFERENCE_AGENT_IDS,
  cleanupTaskTimeout = 60000,
}: CleanupConferenceStateOptions) => {
  await resetCallerPageForNextConferenceCall(callerPage);
  for (const agentId of agentIds) {
    await cleanupConferencePageWithTimeout(getAgentPage(agentId), callerPage, cleanupTaskTimeout);
  }
  await cleanupConferencePageWithTimeout(callerPage, undefined, cleanupTaskTimeout);
};

export const startBaselineCallOnAgent1 = async ({
  getAgentPage,
  callerPage,
  getRequiredEnv,
  agentIds = CONFERENCE_AGENT_IDS,
  acceptTimeout = ACCEPT_TASK_TIMEOUT,
  waitForAvailableBeforeDial = true,
}: StartConferenceCallOptions) => {
  await setConferenceBaselineAvailability(getAgentPage, [1], agentIds);
  if (waitForAvailableBeforeDial) {
    await waitForState(getAgentPage(1), USER_STATES.AVAILABLE);
    await verifyCurrentState(getAgentPage(1), USER_STATES.AVAILABLE);
  }

  if (!callerPage || callerPage.isClosed()) {
    throw new Error('Caller page is not available for conference call setup');
  }

  await createCallTask(callerPage, getRequiredEnv('ENTRY_POINT'));
  await acceptIncomingTask(getAgentPage(1), TASK_TYPES.CALL, acceptTimeout);
  await waitForState(getAgentPage(1), USER_STATES.ENGAGED);
  await waitForConferenceControlReady(getAgentPage, 1, 'call-control:end-call', acceptTimeout);
};

export const consultAgentAndAcceptCall = async ({
  fromAgent,
  toAgent,
  getAgentPage,
  getAgentName,
  acceptTimeout = ACCEPT_TASK_TIMEOUT,
}: ConferenceConsultOptions) => {
  const fromAgentPage = getAgentPage(fromAgent);
  const toAgentPage = getAgentPage(toAgent);
  const firstAttemptTimeout = Math.min(15000, acceptTimeout);
  let lastError: unknown;

  const waitForConferenceConsultToSettle = async () => {
    await expect
      .poll(
        async () => {
          const consultReady = await hasAnyVisibleEnabledControl(
            fromAgentPage,
            'call-control:consult'
          );
          const hasActiveConsultControls = await hasAnyVisibleControlFromList(
            fromAgentPage,
            ACTIVE_CONSULT_CONTROL_TEST_IDS
          );

          return consultReady && !hasActiveConsultControls;
        },
        {timeout: acceptTimeout, intervals: [250, 500, 1000, 2000]}
      )
      .toBeTruthy();
  };

  const waitForConsultToStart = async () => {
    await expect
      .poll(
        async () => {
          const sourceConsultVisible = await hasAnyVisibleControlFromList(
            fromAgentPage,
            ACTIVE_CONSULT_CONTROL_TEST_IDS
          );
          const incomingTaskVisible = await getIncomingTaskLocator(toAgentPage, TASK_TYPES.CALL)
            .isVisible()
            .catch(() => false);

          return sourceConsultVisible || incomingTaskVisible;
        },
        {
          timeout: Math.min(10000, acceptTimeout),
          intervals: [250, 500, 1000],
        }
      )
      .toBeTruthy();
  };

  for (const currentAcceptTimeout of [firstAttemptTimeout, acceptTimeout]) {
    await waitForState(fromAgentPage, USER_STATES.ENGAGED);
    await setConferenceAgentsAvailable(getAgentPage, [toAgent]);
    await waitForConferenceConsultToSettle();
    try {
      await consultOrTransfer(fromAgentPage, 'agent', 'consult', getAgentName(toAgent));
      await waitForConsultToStart();
    } catch (error) {
      lastError = error;
      continue;
    }

    try {
      await acceptIncomingTask(toAgentPage, TASK_TYPES.CALL, currentAcceptTimeout);
      await verifyCurrentState(toAgentPage, USER_STATES.ENGAGED);

      return;
    } catch (error) {
      lastError = error;

      const cancelConsultVisible = await hasAnyVisibleControl(fromAgentPage, 'cancel-consult-btn');

      if (cancelConsultVisible) {
        await cancelConsult(fromAgentPage);
        await fromAgentPage.waitForTimeout(CONFERENCE_ACTION_SETTLE_TIMEOUT);
      }
    }
  }

  throw lastError;
};

export const consultQueueAndAcceptCall = async ({
  fromAgent,
  toAgent,
  getAgentPage,
  getRequiredEnv,
  acceptTimeout = ACCEPT_TASK_TIMEOUT,
}: QueueConsultOptions) => {
  await setConferenceAgentsAvailable(getAgentPage, [toAgent]);
  await waitForConferenceControlReady(
    getAgentPage,
    fromAgent,
    'call-control:consult',
    acceptTimeout
  );
  await consultOrTransfer(
    getAgentPage(fromAgent),
    'queue',
    'consult',
    getRequiredEnv('QUEUE_NAME')
  );
  await acceptIncomingTask(getAgentPage(toAgent), TASK_TYPES.CALL, acceptTimeout);
  await verifyCurrentState(getAgentPage(toAgent), USER_STATES.ENGAGED);
};

export const mergeConsultIntoConference = async ({
  fromAgent,
  getAgentPage,
  acceptTimeout = ACCEPT_TASK_TIMEOUT,
}: SingleAgentActionOptions) => {
  const page = getAgentPage(fromAgent);
  const mergeButton = page.getByTestId('conference-consult-btn');
  await expect(mergeButton).toBeVisible({timeout: acceptTimeout});
  await mergeButton.click();
  await page.waitForTimeout(CONFERENCE_ACTION_SETTLE_TIMEOUT);
};

export const transferConsultAndSubmitWrapup = async ({
  fromAgent,
  getAgentPage,
  acceptTimeout = ACCEPT_TASK_TIMEOUT,
}: SingleAgentActionOptions) => {
  const page = getAgentPage(fromAgent);
  await expect(page.getByTestId('transfer-consult-btn')).toBeVisible({timeout: acceptTimeout});
  await page.getByTestId('transfer-consult-btn').click();
  await page.waitForTimeout(CONFERENCE_ACTION_SETTLE_TIMEOUT);
  await submitWrapup(page, WRAPUP_REASONS.SALE);
};

export const toggleConferenceLegIfSwitchAvailable = async (
  getAgentPage: GetAgentPage,
  agentId: AgentId
) => {
  const page = getAgentPage(agentId);
  const switchButton = page.getByTestId('switchToMainCall-consult-btn');
  const canToggle = await switchButton.isVisible().catch(() => false);
  if (!canToggle) {
    return false;
  }
  await switchButton.click();
  await page.waitForTimeout(CONFERENCE_SWITCH_TOGGLE_TIMEOUT);

  return true;
};

export const exitConferenceParticipantAndWrapup = async (
  getAgentPage: GetAgentPage,
  agentId: AgentId
) => {
  const page = getAgentPage(agentId);
  const exitButton = page.getByTestId('call-control:exit-conference').first();
  await expect(exitButton).toBeVisible({timeout: AWAIT_TIMEOUT});
  await exitButton.click();
  await page.waitForTimeout(CONFERENCE_ACTION_SETTLE_TIMEOUT);
  const wrapupBox = page.getByTestId('call-control:wrapup-button').first();
  const needsWrapup = await wrapupBox
    .waitFor({state: 'visible', timeout: WRAPUP_TIMEOUT})
    .then(() => true)
    .catch(() => false);
  if (needsWrapup) {
    await submitWrapup(page, WRAPUP_REASONS.SALE);
  }
};

export const endConferenceTaskAndWrapup = async (getAgentPage: GetAgentPage, agentId: AgentId) => {
  const page = getAgentPage(agentId);
  await endTask(page);
  await page.waitForTimeout(CONFERENCE_END_TASK_SETTLE_TIMEOUT);
  await submitWrapup(page, WRAPUP_REASONS.SALE);
};

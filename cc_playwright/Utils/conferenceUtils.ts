/* eslint-disable no-await-in-loop, no-plusplus, no-continue */
import {expect, Page} from '@playwright/test';
import {
  cancelConsult,
  consultOrTransfer,
  hasAnyVisibleControlFromList,
  waitForConsultingAgentIdReady,
} from './advancedTaskControlUtils';
import {executeConsultTransfer} from './consultTransferWorkaround';
import {hasAnyVisibleEnabledControl} from './controlUtils';
import {acceptIncomingTask, createCallTask, getIncomingTaskLocator} from './incomingTaskUtils';
import {handleStrayTasks, waitForState} from './helperUtils';
import {changeUserState, verifyCurrentState} from './userStateUtils';
import {submitWrapup} from './wrapupUtils';
import type {TestManager} from '../test-manager';
import {
  ACCEPT_TASK_TIMEOUT,
  AWAIT_TIMEOUT,
  CONFERENCE_ACTION_SETTLE_TIMEOUT,
  CONFERENCE_SWITCH_TOGGLE_TIMEOUT,
  TASK_TYPES,
  USER_STATES,
  WRAPUP_REASONS,
  WRAPUP_TIMEOUT,
} from '../constants';

export type AgentId = 1 | 2 | 3 | 4;

export const CONFERENCE_AGENT_IDS: AgentId[] = [1, 2, 3, 4];

// Sample app (docs/samples/contact-center) controls. Visibility/enabled state of each is driven by
// the SDK's task.uiControls (see applyAllControlsFromUIControls in app.js).
export const CONFERENCE_SELECTORS = {
  consult: '#consult',
  end: '#end',
  endConsult: '#end-consult',
  transfer: '#transfer',
  merge: '#merge-conference',
  exit: '#exit-conference',
  transferConference: '#transfer-conference',
  switchToMain: '#switch-to-main',
  switchToConsult: '#switch-to-consult',
  wrapup: '#wrapup',
  wrapupDropdown: '#wrapupCodesDropdown',
} as const;

// Controls that are only visible while a consult leg is open. #transfer and #exit-conference are
// intentionally excluded: they are also visible on a plain call / settled conference.
const CONSULT_IN_PROGRESS_SELECTORS = [
  CONFERENCE_SELECTORS.endConsult,
  CONFERENCE_SELECTORS.merge,
  CONFERENCE_SELECTORS.switchToMain,
  CONFERENCE_SELECTORS.switchToConsult,
];

// Conference membership and ownership are also reflected outside the control buttons: the task
// state line carries a crown for the owning agent, and the roster lists every other participant.
const TASK_STATE_SELECTOR = '#incoming-task';
const ROSTER_PARTICIPANT_NAME_SELECTOR = '.conference-roster__name';
const CONFERENCE_OWNER_MARKER = '👑 Primary';

// Controls that mean the agent is on a live call (consulted agents and conference members may not see #end).
const ACTIVE_CALL_SELECTORS = [
  CONFERENCE_SELECTORS.end,
  CONFERENCE_SELECTORS.exit,
  CONFERENCE_SELECTORS.endConsult,
];

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
  selector: string,
  timeout: number = ACCEPT_TASK_TIMEOUT
) => {
  const page = getAgentPage(agentId);
  await expect
    .poll(() => hasAnyVisibleEnabledControl(page, selector), {
      timeout,
      intervals: [250, 500, 1000, 2000],
    })
    .toBeTruthy();
};

// The sample app does not reliably move Desktop-mode agents to the Engaged state, so call
// membership is asserted from the controls the SDK exposes instead of the agent state.
export const expectAgentInActiveCall = async (
  page: Page,
  timeout: number = ACCEPT_TASK_TIMEOUT
) => {
  await expect
    .poll(() => hasAnyVisibleControlFromList(page, ACTIVE_CALL_SELECTORS), {
      timeout,
      intervals: [250, 500, 1000, 2000],
    })
    .toBeTruthy();
};

// #exit-conference is only shown when the agent is in a multi-agent conference.
export const expectAgentInConference = async (
  page: Page,
  timeout: number = ACCEPT_TASK_TIMEOUT
) => {
  await expect(page.locator(CONFERENCE_SELECTORS.exit).first()).toBeVisible({timeout});
};

export const expectAgentNotInConference = async (
  page: Page,
  timeout: number = ACCEPT_TASK_TIMEOUT
) => {
  await expect(page.locator(CONFERENCE_SELECTORS.exit).first()).toBeHidden({timeout});
};

// Checked from a page that is still on the call: the roster only renders agents that are currently
// in the conference, so a transferred/exited agent must disappear from it.
export const expectAgentNotInConferenceRoster = async (
  page: Page,
  agentName: string,
  timeout: number = ACCEPT_TASK_TIMEOUT
) => {
  await expect(page.locator(ROSTER_PARTICIPANT_NAME_SELECTOR, {hasText: agentName})).toHaveCount(
    0,
    {timeout}
  );
};

// The sample app marks the conference owner (interaction.owner) with a crown on the task state line.
export const expectAgentIsConferenceOwner = async (
  page: Page,
  timeout: number = ACCEPT_TASK_TIMEOUT
) => {
  await expect(page.locator(TASK_STATE_SELECTOR).first()).toContainText(CONFERENCE_OWNER_MARKER, {
    timeout,
  });
};

export const expectPostCustomerLeaveControls = async (
  page: Page,
  timeout: number = ACCEPT_TASK_TIMEOUT
) => {
  // Depending on backend event ordering the agent either keeps active call controls or moves
  // straight to wrapup after the customer disconnects.
  await expect
    .poll(
      () =>
        hasAnyVisibleControlFromList(page, [
          CONFERENCE_SELECTORS.end,
          CONFERENCE_SELECTORS.exit,
          CONFERENCE_SELECTORS.wrapup,
        ]),
      {timeout, intervals: [500, 1000, 2000, 3000]}
    )
    .toBeTruthy();
};

export const resetCallerPageForNextConferenceCall = async (callerPage?: Page) => {
  if (!callerPage || callerPage.isClosed()) return;
  const endBtn = callerPage.locator('#end-call').first();
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
  // Sequential on purpose: parallel cleanup races on conference leg ownership.
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
  await waitForConferenceControlReady(getAgentPage, 1, CONFERENCE_SELECTORS.end, acceptTimeout);
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

  const waitForConsultToSettle = async () => {
    await expect
      .poll(
        async () => {
          const consultReady = await hasAnyVisibleEnabledControl(
            fromAgentPage,
            CONFERENCE_SELECTORS.consult
          );
          const consultOpen = await hasAnyVisibleControlFromList(
            fromAgentPage,
            CONSULT_IN_PROGRESS_SELECTORS
          );

          return consultReady && !consultOpen;
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
            CONSULT_IN_PROGRESS_SELECTORS
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
    await expectAgentInActiveCall(fromAgentPage, acceptTimeout);
    await setConferenceAgentsAvailable(getAgentPage, [toAgent]);
    await waitForConsultToSettle();
    try {
      await consultOrTransfer(fromAgentPage, 'agent', 'consult', getAgentName(toAgent));
      await waitForConsultToStart();
    } catch (error) {
      lastError = error;
      continue;
    }

    try {
      await acceptIncomingTask(toAgentPage, TASK_TYPES.CALL, currentAcceptTimeout);
      await expectAgentInActiveCall(toAgentPage, acceptTimeout);

      return;
    } catch (error) {
      lastError = error;

      // Consult was never answered; close the open consult leg before retrying.
      if (await hasAnyVisibleControlFromList(fromAgentPage, [CONFERENCE_SELECTORS.endConsult])) {
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
    CONFERENCE_SELECTORS.consult,
    acceptTimeout
  );
  await consultOrTransfer(
    getAgentPage(fromAgent),
    'queue',
    'consult',
    getRequiredEnv('QUEUE_NAME')
  );
  await acceptIncomingTask(getAgentPage(toAgent), TASK_TYPES.CALL, acceptTimeout);
  await expectAgentInActiveCall(getAgentPage(toAgent), acceptTimeout);
};

export const mergeConsultIntoConference = async ({
  fromAgent,
  getAgentPage,
  acceptTimeout = ACCEPT_TASK_TIMEOUT,
}: SingleAgentActionOptions) => {
  const page = getAgentPage(fromAgent);
  // Same button on both legs: labelled "Conference" on the main leg and "Merge" on the consult leg.
  const mergeButton = page.locator(CONFERENCE_SELECTORS.merge);
  await expect(mergeButton).toBeVisible({timeout: acceptTimeout});
  await expect(mergeButton).toBeEnabled({timeout: acceptTimeout});
  await mergeButton.click();
  await page.waitForTimeout(CONFERENCE_ACTION_SETTLE_TIMEOUT);
};

// submitWrapup alone only waits WRAPUP_TIMEOUT; transfers can take longer to release the source agent.
export const submitTransferSourceWrapupWhenReady = async (
  page: Page,
  timeout: number = ACCEPT_TASK_TIMEOUT
) => {
  await expect(page.locator(CONFERENCE_SELECTORS.wrapupDropdown)).toBeEnabled({timeout});
  await submitWrapup(page, WRAPUP_REASONS.SALE);
};

export const transferConsultAndSubmitWrapup = async ({
  fromAgent,
  getAgentPage,
  acceptTimeout = ACCEPT_TASK_TIMEOUT,
}: SingleAgentActionOptions) => {
  const page = getAgentPage(fromAgent);
  await page.bringToFront();

  const conferenceTransfer = page.locator(CONFERENCE_SELECTORS.transferConference);
  const inConferenceTransfer = await expect
    .poll(
      async () => {
        if (await hasAnyVisibleEnabledControl(page, CONFERENCE_SELECTORS.transferConference)) {
          return 'conference';
        }
        if (await hasAnyVisibleEnabledControl(page, CONFERENCE_SELECTORS.transfer)) {
          return 'consult';
        }

        return 'waiting';
      },
      {timeout: acceptTimeout, intervals: [250, 500, 1000, 2000]}
    )
    .not.toBe('waiting')
    .then(() => hasAnyVisibleEnabledControl(page, CONFERENCE_SELECTORS.transferConference));

  if (inConferenceTransfer) {
    await conferenceTransfer.first().click();
  } else {
    await waitForConsultingAgentIdReady(page);
    await executeConsultTransfer(page);
  }

  await page.waitForTimeout(CONFERENCE_ACTION_SETTLE_TIMEOUT);
  await submitTransferSourceWrapupWhenReady(page, acceptTimeout);
};

export const toggleConferenceLegIfSwitchAvailable = async (
  getAgentPage: GetAgentPage,
  agentId: AgentId
) => {
  const page = getAgentPage(agentId);
  // Both switch buttons are bound to the same SDK control and call task.switchCall().
  const switchButton = page.locator(CONFERENCE_SELECTORS.switchToMain);
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
  const exitButton = page.locator(CONFERENCE_SELECTORS.exit).first();
  await expect(exitButton).toBeVisible({timeout: AWAIT_TIMEOUT});
  await expect(exitButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
  await exitButton.click();
  await page.waitForTimeout(CONFERENCE_ACTION_SETTLE_TIMEOUT);
  const needsWrapup = await page
    .locator(CONFERENCE_SELECTORS.wrapup)
    .first()
    .waitFor({state: 'visible', timeout: WRAPUP_TIMEOUT})
    .then(() => true)
    .catch(() => false);
  if (needsWrapup) {
    await submitWrapup(page, WRAPUP_REASONS.SALE);
  }
};

// Binds the helpers above to a suite's TestManager so each set file only holds its scenarios.
export const createConferenceHelpers = (getTestManager: () => TestManager) => {
  const getAgentPage = (agentId: AgentId): Page => {
    const testManager = getTestManager();
    switch (agentId) {
      case 1:
        return testManager.agent1Page;
      case 2:
        return testManager.agent2Page;
      case 3:
        return testManager.agent3Page;
      case 4:
        return testManager.agent4Page;
      default:
        throw new Error(`Unsupported agentId: ${agentId}`);
    }
  };

  const getRequiredEnv = (suffix: string): string =>
    getConferenceRequiredEnv(getTestManager().projectName, suffix);

  const getAgentName = (agentId: AgentId): string =>
    getConferenceAgentName(getTestManager().projectName, agentId);

  return {
    getAgentPage,
    getRequiredEnv,
    getAgentName,
    getCallerPage: (): Page => getTestManager().callerPage,
    cleanup: () =>
      cleanupConferenceState({
        getAgentPage,
        callerPage: getTestManager().callerPage,
        agentIds: CONFERENCE_AGENT_IDS,
      }),
    startBaselineCall: () =>
      startBaselineCallOnAgent1({
        getAgentPage,
        callerPage: getTestManager().callerPage,
        getRequiredEnv,
        agentIds: CONFERENCE_AGENT_IDS,
      }),
    setAvailable: (agentIds: AgentId[]) => setConferenceAgentsAvailable(getAgentPage, agentIds),
    consultAgent: (fromAgent: AgentId, toAgent: AgentId) =>
      consultAgentAndAcceptCall({fromAgent, toAgent, getAgentPage, getAgentName}),
    consultQueue: (fromAgent: AgentId, toAgent: AgentId) =>
      consultQueueAndAcceptCall({fromAgent, toAgent, getAgentPage, getRequiredEnv}),
    merge: (fromAgent: AgentId) => mergeConsultIntoConference({fromAgent, getAgentPage}),
    transferConsult: (fromAgent: AgentId) =>
      transferConsultAndSubmitWrapup({fromAgent, getAgentPage}),
    toggleLeg: (agentId: AgentId) => toggleConferenceLegIfSwitchAvailable(getAgentPage, agentId),
    exitParticipant: (agentId: AgentId) =>
      exitConferenceParticipantAndWrapup(getAgentPage, agentId),
  };
};

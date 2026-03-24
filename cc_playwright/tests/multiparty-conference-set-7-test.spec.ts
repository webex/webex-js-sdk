import {test, expect, Page} from '@playwright/test';
import {TestManager} from '../test-manager';
import {verifyCurrentState} from '../Utils/userStateUtils';
import {endCallTask} from '../Utils/incomingTaskUtils';
import {waitForState} from '../Utils/helperUtils';
import {
  AgentId,
  CONFERENCE_AGENT_IDS,
  cleanupConferenceState,
  consultAgentAndAcceptCall,
  exitConferenceParticipantAndWrapup,
  getConferenceAgentName,
  getConferenceRequiredEnv,
  mergeConsultIntoConference as mergeConsultIntoConferenceUtil,
  startBaselineCallOnAgent1 as startBaselineCallOnAgent1Util,
  toggleConferenceLegIfSwitchAvailable,
  transferConsultAndSubmitWrapup,
} from '../Utils/conferenceUtils';
import {
  ACCEPT_TASK_TIMEOUT,
  CONFERENCE_ACTION_SETTLE_TIMEOUT,
  CONFERENCE_CUSTOMER_DISCONNECT_TIMEOUT,
  CONFERENCE_RECONNECT_SETTLE_TIMEOUT,
  CONFERENCE_SWITCH_TOGGLE_TIMEOUT,
  USER_STATES,
} from '../constants';

export default function createMultipartyConferenceSet7Tests() {
  let testManager: TestManager;

  const getAgentPage = (agentId: AgentId): Page => {
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

  const getRequiredEnv = (suffix: string): string => {
    return getConferenceRequiredEnv(testManager.projectName, suffix);
  };

  const getAgentName = (agentId: AgentId): string =>
    getConferenceAgentName(testManager.projectName, agentId);

  const cleanupConferenceStateForTest = async () => {
    await cleanupConferenceState({
      getAgentPage,
      callerPage: testManager.callerPage,
      agentIds: CONFERENCE_AGENT_IDS,
    });
  };

  const startBaselineCallOnAgent1 = async () => {
    await startBaselineCallOnAgent1Util({
      getAgentPage,
      callerPage: testManager.callerPage,
      getRequiredEnv,
      agentIds: CONFERENCE_AGENT_IDS,
    });
  };

  const consultAgentAndAccept = async (fromAgent: AgentId, toAgent: AgentId) => {
    await consultAgentAndAcceptCall({
      fromAgent,
      toAgent,
      getAgentPage,
      getAgentName,
    });
  };

  const mergeConsultIntoConference = async (fromAgent: AgentId) => {
    await mergeConsultIntoConferenceUtil({fromAgent, getAgentPage});
  };

  const transferConsultAndWrapup = async (fromAgent: AgentId) => {
    await transferConsultAndSubmitWrapup({fromAgent, getAgentPage});
  };

  const toggleConferenceLegIfVisible = async (agentId: AgentId) => {
    return toggleConferenceLegIfSwitchAvailable(getAgentPage, agentId);
  };

  const removeConferenceParticipant = async (agentId: AgentId) =>
    exitConferenceParticipantAndWrapup(getAgentPage, agentId);

  const expectPostCustomerLeaveControls = async (agentId: AgentId) => {
    const page = getAgentPage(agentId);
    // Depending on backend event ordering, agent may see either active end-call controls
    // or transition directly into wrapup after customer disconnect.
    await expect
      .poll(
        async () => {
          const hasEnd = await page
            .locator('#end')
            .first()
            .isVisible()
            .catch(() => false);
          const hasWrapup = await page
            .locator('#wrapup')
            .first()
            .isVisible()
            .catch(() => false);

          return hasEnd || hasWrapup;
        },
        {timeout: ACCEPT_TASK_TIMEOUT, intervals: [CONFERENCE_CUSTOMER_DISCONNECT_TIMEOUT]}
      )
      .toBeTruthy();
  };

  test.beforeAll(async ({browser}, testInfo) => {
    testManager = new TestManager(testInfo.project.name);
    await testManager.setupForMultipartyConference(browser);
  });

  test.beforeEach(async () => {
    await cleanupConferenceStateForTest();
  });

  test.afterEach(async () => {
    await cleanupConferenceStateForTest();
  });

  test.afterAll(async () => {
    if (testManager) {
      await testManager.cleanup();
    }
  });

  test.describe('Multi-Party Conference Feature Test Matrix', () => {
    test('CTS-MPC-01 and CTS-MPC-02 should initiate a 3-agent conference and continue after one participant leaves', async () => {
      await startBaselineCallOnAgent1();
      await consultAgentAndAccept(1, 2);
      await mergeConsultIntoConference(1);
      await consultAgentAndAccept(1, 3);
      await mergeConsultIntoConference(1);

      await verifyCurrentState(getAgentPage(1), USER_STATES.ENGAGED);
      await verifyCurrentState(getAgentPage(2), USER_STATES.ENGAGED);
      await verifyCurrentState(getAgentPage(3), USER_STATES.ENGAGED);

      await removeConferenceParticipant(3);
      await verifyCurrentState(getAgentPage(1), USER_STATES.ENGAGED);
      await verifyCurrentState(getAgentPage(2), USER_STATES.ENGAGED);
    });

    test('CTS-MPC-03 and CTS-MPC-04 should support owner handoff and participant replacement without restarting call', async () => {
      await startBaselineCallOnAgent1();
      await consultAgentAndAccept(1, 2);
      await mergeConsultIntoConference(1);
      await consultAgentAndAccept(1, 3);
      await mergeConsultIntoConference(1);

      await removeConferenceParticipant(1);
      await verifyCurrentState(getAgentPage(2), USER_STATES.ENGAGED);

      await consultAgentAndAccept(2, 4);
      await mergeConsultIntoConference(2);
      await verifyCurrentState(getAgentPage(2), USER_STATES.ENGAGED);
      await verifyCurrentState(getAgentPage(4), USER_STATES.ENGAGED);
    });

    test('CTS-MPC-05 should transfer conference to another available agent', async () => {
      await startBaselineCallOnAgent1();
      await consultAgentAndAccept(1, 2);
      await mergeConsultIntoConference(1);

      await consultAgentAndAccept(1, 3);
      await transferConsultAndWrapup(1);
      await verifyCurrentState(getAgentPage(2), USER_STATES.ENGAGED);
      await verifyCurrentState(getAgentPage(3), USER_STATES.ENGAGED);
    });

    test('CTS-MPC-06 should switch between consult and main conference call legs', async () => {
      await startBaselineCallOnAgent1();
      await consultAgentAndAccept(1, 2);
      await mergeConsultIntoConference(1);
      await consultAgentAndAccept(1, 3);

      const switchButton = getAgentPage(1).locator('#switch-to-main');
      await expect(switchButton).toBeVisible({timeout: ACCEPT_TASK_TIMEOUT});
      const firstToggle = await toggleConferenceLegIfVisible(1);
      const secondToggle = await toggleConferenceLegIfVisible(1);
      expect(firstToggle || secondToggle).toBeTruthy();
      await verifyCurrentState(getAgentPage(1), USER_STATES.ENGAGED);
    });

    test('CTS-MPC-07, CTS-MPC-09 and CTS-MPC-10 should recover/rejoin after reconnect and handle customer leave', async () => {
      await startBaselineCallOnAgent1();
      await consultAgentAndAccept(1, 2);
      await mergeConsultIntoConference(1);

      await getAgentPage(2).context().setOffline(true);
      await getAgentPage(2).waitForTimeout(CONFERENCE_ACTION_SETTLE_TIMEOUT);
      await getAgentPage(2).context().setOffline(false);
      await getAgentPage(2).waitForTimeout(CONFERENCE_RECONNECT_SETTLE_TIMEOUT);

      await verifyCurrentState(getAgentPage(1), USER_STATES.ENGAGED);
      await verifyCurrentState(getAgentPage(2), USER_STATES.ENGAGED);

      await endCallTask(testManager.callerPage, true);
      await expectPostCustomerLeaveControls(1);
    });

    test.skip('CTS-MPC-08 should validate conference participant limit (>4 agents required)', async () => {});
  });

  test.describe('Switch Conference - Set 7', () => {
    test('CTS-SW-02 and CTS-SW-03 should switch legs and merge lobby participants into conference', async () => {
      await startBaselineCallOnAgent1();
      await consultAgentAndAccept(1, 2);
      await mergeConsultIntoConference(1);
      await consultAgentAndAccept(1, 3);

      const page = getAgentPage(1);
      const switchToMainButton = page.locator('#switch-to-main');
      const switchToConsultButton = page.locator('#switch-to-consult').first();

      await expect(switchToMainButton).toBeVisible({timeout: ACCEPT_TASK_TIMEOUT});
      await switchToMainButton.click();
      await page.waitForTimeout(CONFERENCE_SWITCH_TOGGLE_TIMEOUT);

      await expect(switchToConsultButton).toBeVisible({timeout: ACCEPT_TASK_TIMEOUT});
      await switchToConsultButton.click();
      await page.waitForTimeout(CONFERENCE_SWITCH_TOGGLE_TIMEOUT);

      await mergeConsultIntoConference(1);
      await verifyCurrentState(getAgentPage(1), USER_STATES.ENGAGED);
      await verifyCurrentState(getAgentPage(3), USER_STATES.ENGAGED);
    });

    test('CTS-SW-04 should transfer from consult lobby to conference participant', async () => {
      await startBaselineCallOnAgent1();
      await consultAgentAndAccept(1, 2);
      await mergeConsultIntoConference(1);
      await waitForState(getAgentPage(1), USER_STATES.ENGAGED);
      await waitForState(getAgentPage(2), USER_STATES.ENGAGED);
      await consultAgentAndAccept(1, 3);
      await transferConsultAndWrapup(1);

      await waitForState(getAgentPage(2), USER_STATES.ENGAGED);
      await waitForState(getAgentPage(3), USER_STATES.ENGAGED);
      await verifyCurrentState(getAgentPage(2), USER_STATES.ENGAGED);
      await verifyCurrentState(getAgentPage(3), USER_STATES.ENGAGED);
    });
  });
}

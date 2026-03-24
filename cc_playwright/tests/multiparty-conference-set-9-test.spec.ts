import {test, expect, Page} from '@playwright/test';
import {TestManager} from '../test-manager';
import {verifyCurrentState} from '../Utils/userStateUtils';
import {
  acceptIncomingTask,
  declineIncomingTask,
  waitForIncomingTask,
} from '../Utils/incomingTaskUtils';
import {cancelConsult, consultOrTransfer} from '../Utils/advancedTaskControlUtils';
import {submitWrapup} from '../Utils/wrapupUtils';
import {
  AgentId,
  CONFERENCE_AGENT_IDS,
  cleanupConferencePageWithTimeout,
  cleanupConferenceState,
  consultAgentAndAcceptCall,
  consultQueueAndAcceptCall,
  getConferenceAgentName,
  getConferenceRequiredEnv,
  mergeConsultIntoConference as mergeConsultIntoConferenceUtil,
  setConferenceAgentsAvailable,
  startBaselineCallOnAgent1 as startBaselineCallOnAgent1Util,
  transferConsultAndSubmitWrapup,
} from '../Utils/conferenceUtils';
import {
  ACCEPT_TASK_TIMEOUT,
  CONSULT_NO_ANSWER_TIMEOUT,
  TASK_TYPES,
  USER_STATES,
  WRAPUP_REASONS,
} from '../constants';

export default function createMultipartyConferenceSet9Tests() {
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

  const getRequiredEnv = (suffix: string): string =>
    getConferenceRequiredEnv(testManager.projectName, suffix);
  const getAgentName = (agentId: AgentId): string =>
    getConferenceAgentName(testManager.projectName, agentId);
  const setConsultTargetAgentsAvailable = async (agentIds: AgentId[]) =>
    setConferenceAgentsAvailable(getAgentPage, agentIds);

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

  const consultQueueAndAcceptIncomingCall = async (fromAgent: AgentId, toAgent: AgentId) => {
    await consultQueueAndAcceptCall({
      fromAgent,
      toAgent,
      getAgentPage,
      getRequiredEnv,
    });
  };

  const mergeConsultIntoConference = async (fromAgent: AgentId) => {
    await mergeConsultIntoConferenceUtil({fromAgent, getAgentPage});
  };

  const transferConsultAndWrapup = async (fromAgent: AgentId) => {
    await transferConsultAndSubmitWrapup({fromAgent, getAgentPage});
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

  test.describe('TRANSFER CONFERENCE SCENARIOS - Set 9', () => {
    test('CTS-TC-01, CTS-TC-02 and CTS-TC-03 should handle blind transfer to agent, then queue transfer in one call session', async () => {
      await startBaselineCallOnAgent1();
      await setConsultTargetAgentsAvailable([2]);

      await consultOrTransfer(getAgentPage(1), 'agent', 'transfer', getAgentName(2));
      await acceptIncomingTask(getAgentPage(2), TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT * 2);
      await submitWrapup(getAgentPage(1), WRAPUP_REASONS.SALE);
      await verifyCurrentState(getAgentPage(2), USER_STATES.ENGAGED);

      await setConsultTargetAgentsAvailable([1]);
      await consultOrTransfer(getAgentPage(2), 'queue', 'transfer', getRequiredEnv('QUEUE_NAME'));
      await acceptIncomingTask(getAgentPage(1), TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT * 2);
      await submitWrapup(getAgentPage(2), WRAPUP_REASONS.SALE);

      await verifyCurrentState(getAgentPage(1), USER_STATES.ENGAGED);
    });

    test('CTS-TC-04 and CTS-TC-05 should run consult accepted and declined flows in one call session', async () => {
      await startBaselineCallOnAgent1();

      await consultAgentAndAccept(1, 3);
      await cancelConsult(getAgentPage(3));
      await verifyCurrentState(getAgentPage(1), USER_STATES.ENGAGED);

      await consultOrTransfer(getAgentPage(1), 'agent', 'consult', getAgentName(3));
      await waitForIncomingTask(getAgentPage(3), TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);
      await declineIncomingTask(getAgentPage(3), TASK_TYPES.CALL);
      await verifyCurrentState(getAgentPage(1), USER_STATES.ENGAGED);
    });

    // Split: queue routing won't re-route to an agent who RONA'd in the same session
    test('CTS-TC-06 should handle not-picked agent consult', async () => {
      await startBaselineCallOnAgent1();
      await setConsultTargetAgentsAvailable([2]);

      await consultOrTransfer(getAgentPage(1), 'agent', 'consult', getAgentName(2));
      await getAgentPage(1).waitForTimeout(CONSULT_NO_ANSWER_TIMEOUT);

      const cancelConsultButton = getAgentPage(1).locator('#end-consult');
      const canCancelConsult = await cancelConsultButton.isVisible().catch(() => false);
      if (canCancelConsult) {
        await cancelConsult(getAgentPage(1));
      }
      await verifyCurrentState(getAgentPage(1), USER_STATES.ENGAGED);
    });

    // Use agent 3 instead of agent 2 — queue routing won't re-route to an
    // agent who RONA'd (CTS-TC-06) in the same session.
    test('CTS-TC-07 should handle queue-consult cancel', async () => {
      await startBaselineCallOnAgent1();
      await consultQueueAndAcceptIncomingCall(1, 3);
      await cancelConsult(getAgentPage(1));
      await verifyCurrentState(getAgentPage(1), USER_STATES.ENGAGED);
    });

    // Use agent 3 instead of agent 2 — agent 2 RONA'd in CTS-TC-06 and may
    // not reliably receive consults for the remainder of the session.
    test('CTS-TC-08 should support multi-stage consult transfer between A1 and A3', async () => {
      await startBaselineCallOnAgent1();

      await consultAgentAndAccept(1, 3);
      await transferConsultAndWrapup(1);
      await verifyCurrentState(getAgentPage(3), USER_STATES.ENGAGED);

      await cleanupConferencePageWithTimeout(getAgentPage(1), testManager.callerPage);
      await consultAgentAndAccept(3, 1);
      await transferConsultAndWrapup(3);
      await verifyCurrentState(getAgentPage(1), USER_STATES.ENGAGED);
    });
  });

  test.describe('Switch Conference - Set 9', () => {
    test.skip('CTS-SW-01 should switch conference via EP_DN handoff', async () => {});

    test('CTS-SW-05 and CTS-SW-06 should block consult during active consult and restore it after lobby closes', async () => {
      await startBaselineCallOnAgent1();
      await consultAgentAndAccept(1, 2);
      await mergeConsultIntoConference(1);

      await consultAgentAndAccept(1, 3);
      const agent2Consult = getAgentPage(2).locator('#consult').first();
      const consultVisible = await agent2Consult.isVisible().catch(() => false);

      if (consultVisible) {
        await expect(agent2Consult).toBeDisabled();
      } else {
        expect(consultVisible).toBeFalsy();
      }

      await mergeConsultIntoConference(1);
      await expect(agent2Consult).toBeVisible({timeout: ACCEPT_TASK_TIMEOUT});
    });

    test.skip('CTS-SW-08 should validate switch conference flows with >4 agents', async () => {});
  });
}

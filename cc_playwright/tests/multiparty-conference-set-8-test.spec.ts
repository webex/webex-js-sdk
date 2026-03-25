import {test, expect, Page} from '@playwright/test';
import {TestManager} from '../test-manager';
import {verifyCurrentState} from '../Utils/userStateUtils';
import {acceptIncomingTask, endCallTask} from '../Utils/incomingTaskUtils';
import {consultOrTransfer, cancelConsult} from '../Utils/advancedTaskControlUtils';
import {submitWrapup} from '../Utils/wrapupUtils';
import {
  AgentId,
  CONFERENCE_AGENT_IDS,
  cleanupConferenceState,
  consultAgentAndAcceptCall,
  consultQueueAndAcceptCall,
  exitConferenceParticipantAndWrapup,
  getConferenceAgentName,
  getConferenceRequiredEnv,
  mergeConsultIntoConference as mergeConsultIntoConferenceUtil,
  setConferenceAgentsAvailable,
  startBaselineCallOnAgent1 as startBaselineCallOnAgent1Util,
  transferConsultAndSubmitWrapup,
} from '../Utils/conferenceUtils';
import {ACCEPT_TASK_TIMEOUT, TASK_TYPES, USER_STATES, WRAPUP_REASONS} from '../constants';

export default function createMultipartyConferenceSet8Tests() {
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

  const removeConferenceParticipant = async (agentId: AgentId) =>
    exitConferenceParticipantAndWrapup(getAgentPage, agentId);

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

  test.describe('TRANSFER CONFERENCE SCENARIOS - Set 8', () => {
    test('CTS-TC-09 and CTS-TC-10 should validate queue consult resume and customer-end wrapup in one call', async () => {
      await startBaselineCallOnAgent1();
      await setConsultTargetAgentsAvailable([2]);

      await consultQueueAndAcceptIncomingCall(1, 2);
      await cancelConsult(getAgentPage(1));
      await verifyCurrentState(getAgentPage(1), USER_STATES.ENGAGED);

      await consultOrTransfer(getAgentPage(1), 'queue', 'consult', getRequiredEnv('QUEUE_NAME'));
      await endCallTask(testManager.callerPage, true);

      await expect(getAgentPage(1).locator('#wrapup').first()).toBeVisible({
        timeout: ACCEPT_TASK_TIMEOUT,
      });
    });

    test('CTS-TC-11 and CTS-TC-13 should allow consult cancel, then queue consult transfer', async () => {
      await startBaselineCallOnAgent1();
      await consultAgentAndAccept(1, 2);
      await cancelConsult(getAgentPage(1));
      await verifyCurrentState(getAgentPage(1), USER_STATES.ENGAGED);

      await consultQueueAndAcceptIncomingCall(1, 2);
      await transferConsultAndWrapup(1);

      await verifyCurrentState(getAgentPage(2), USER_STATES.ENGAGED);
    });

    test.skip('CTS-TC-12 should allow agent2 to end consult when isEndConsultEnabled flag is enabled', async () => {});

    test('CTS-TC-14 and CTS-TC-15 should transfer back to agent1 via agent and queue paths', async () => {
      await startBaselineCallOnAgent1();
      await setConsultTargetAgentsAvailable([2]);

      await consultOrTransfer(getAgentPage(1), 'agent', 'transfer', getAgentName(2));
      await acceptIncomingTask(getAgentPage(2), TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);
      await submitWrapup(getAgentPage(1), WRAPUP_REASONS.SALE);

      await setConsultTargetAgentsAvailable([1]);
      await consultOrTransfer(getAgentPage(2), 'queue', 'transfer', getRequiredEnv('QUEUE_NAME'));
      await acceptIncomingTask(getAgentPage(1), TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);
      await submitWrapup(getAgentPage(2), WRAPUP_REASONS.SALE);

      await verifyCurrentState(getAgentPage(1), USER_STATES.ENGAGED);
    });

    test('CTS-TC-16 should chain add/remove/add participant flow without restarting call', async () => {
      await startBaselineCallOnAgent1();

      await consultAgentAndAccept(1, 2);
      await mergeConsultIntoConference(1);
      await consultAgentAndAccept(1, 3);
      await mergeConsultIntoConference(1);

      await removeConferenceParticipant(3);
      await consultAgentAndAccept(1, 4);
      await mergeConsultIntoConference(1);
      await verifyCurrentState(getAgentPage(4), USER_STATES.ENGAGED);
    });

    test.skip('CTS-TC-17 should validate >4 agent transfer conference flows (future enable)', async () => {});
    test.skip('CTS-TC-18 should validate EPDN transfer conference handoff flow', async () => {});
  });

  test.describe('Switch Conference - Set 8', () => {
    test('CTS-SW-07 should keep queue-based switch flow stable with consult cancel/accept actions', async () => {
      await startBaselineCallOnAgent1();
      await setConsultTargetAgentsAvailable([2]);

      await consultQueueAndAcceptIncomingCall(1, 2);
      await cancelConsult(getAgentPage(1));
      await verifyCurrentState(getAgentPage(1), USER_STATES.ENGAGED);

      await consultQueueAndAcceptIncomingCall(1, 2);
      await mergeConsultIntoConference(1);
      await verifyCurrentState(getAgentPage(2), USER_STATES.ENGAGED);
    });
  });
}

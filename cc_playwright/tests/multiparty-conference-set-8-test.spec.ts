import {test, expect} from '@playwright/test';
import {TestManager} from '../test-manager';
import {acceptIncomingTask, endCallTask} from '../Utils/incomingTaskUtils';
import {cancelConsult, consultOrTransfer} from '../Utils/advancedTaskControlUtils';
import {
  CONFERENCE_SELECTORS,
  createConferenceHelpers,
  expectAgentInActiveCall,
  expectAgentInConference,
  submitTransferSourceWrapupWhenReady,
} from '../Utils/conferenceUtils';
import {ACCEPT_TASK_TIMEOUT, TASK_TYPES} from '../constants';

const CONFERENCE_TEST_TIMEOUT = 7 * 60 * 1000;

export default function createMultipartyConferenceSet8Tests() {
  let testManager: TestManager;
  const conference = createConferenceHelpers(() => testManager);

  test.beforeAll(async ({browser}, testInfo) => {
    testManager = new TestManager(testInfo.project.name);
    await testManager.setupForMultipartyConference(browser);
  });

  test.beforeEach(async () => {
    test.setTimeout(CONFERENCE_TEST_TIMEOUT);
    await conference.cleanup();
  });

  test.afterEach(async () => {
    await conference.cleanup();
  });

  test.afterAll(async () => {
    if (testManager) {
      await testManager.cleanup();
    }
  });

  test.describe('TRANSFER CONFERENCE SCENARIOS - Set 8', () => {
    test('CTS-TC-09 and CTS-TC-10 should validate queue consult resume and customer-end wrapup in one call', async () => {
      await conference.startBaselineCall();
      await conference.setAvailable([2]);

      await conference.consultQueue(1, 2);
      await cancelConsult(conference.getAgentPage(1));
      await expectAgentInActiveCall(conference.getAgentPage(1));

      await consultOrTransfer(
        conference.getAgentPage(1),
        'queue',
        'consult',
        conference.getRequiredEnv('QUEUE_NAME')
      );
      await endCallTask(conference.getCallerPage(), true);

      await expect(
        conference.getAgentPage(1).locator(CONFERENCE_SELECTORS.wrapup).first()
      ).toBeVisible({timeout: ACCEPT_TASK_TIMEOUT});
    });

    test('CTS-TC-11 and CTS-TC-13 should allow consult cancel, then queue consult transfer', async () => {
      await conference.startBaselineCall();
      await conference.consultAgent(1, 2);
      await cancelConsult(conference.getAgentPage(1));
      await expectAgentInActiveCall(conference.getAgentPage(1));

      await conference.consultQueue(1, 2);
      await conference.transferConsult(1);

      await expectAgentInActiveCall(conference.getAgentPage(2));
    });

    test('CTS-TC-14 and CTS-TC-15 should transfer back to agent1 via agent and queue paths', async () => {
      await conference.startBaselineCall();
      await conference.setAvailable([2]);

      await consultOrTransfer(
        conference.getAgentPage(1),
        'agent',
        'transfer',
        conference.getAgentName(2)
      );
      await acceptIncomingTask(conference.getAgentPage(2), TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);
      await submitTransferSourceWrapupWhenReady(conference.getAgentPage(1));

      await conference.setAvailable([1]);
      await consultOrTransfer(
        conference.getAgentPage(2),
        'queue',
        'transfer',
        conference.getRequiredEnv('QUEUE_NAME')
      );
      await acceptIncomingTask(conference.getAgentPage(1), TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);
      await submitTransferSourceWrapupWhenReady(conference.getAgentPage(2));

      await expectAgentInActiveCall(conference.getAgentPage(1));
    });

    test('CTS-TC-16 should chain add/remove/add participant flow without restarting call', async () => {
      await conference.startBaselineCall();

      await conference.consultAgent(1, 2);
      await conference.merge(1);
      await conference.consultAgent(1, 3);
      await conference.merge(1);

      await conference.exitParticipant(3);
      await conference.consultAgent(1, 4);
      await conference.merge(1);
      await expectAgentInConference(conference.getAgentPage(4));
    });
  });

  test.describe('Switch Conference - Set 8', () => {
    test('CTS-SW-07 should keep queue-based switch flow stable with consult cancel/accept actions', async () => {
      await conference.startBaselineCall();
      await conference.setAvailable([2]);

      await conference.consultQueue(1, 2);
      await cancelConsult(conference.getAgentPage(1));
      await expectAgentInActiveCall(conference.getAgentPage(1));

      await conference.consultQueue(1, 2);
      await conference.merge(1);
      await expectAgentInConference(conference.getAgentPage(2));
    });
  });
}

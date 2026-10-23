import {test, expect} from '@playwright/test';
import {TestManager} from '../test-manager';
import {
  acceptIncomingTask,
  declineIncomingTask,
  waitForIncomingTask,
} from '../Utils/incomingTaskUtils';
import {cancelConsult, consultOrTransfer} from '../Utils/advancedTaskControlUtils';
import {
  CONFERENCE_SELECTORS,
  cleanupConferencePageWithTimeout,
  createConferenceHelpers,
  expectAgentInActiveCall,
  submitTransferSourceWrapupWhenReady,
} from '../Utils/conferenceUtils';
import {ACCEPT_TASK_TIMEOUT, CONSULT_NO_ANSWER_TIMEOUT, TASK_TYPES} from '../constants';

const CONFERENCE_TEST_TIMEOUT = 7 * 60 * 1000;

export default function createMultipartyConferenceSet9Tests() {
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

  test.describe('TRANSFER CONFERENCE SCENARIOS - Set 9', () => {
    test('CTS-TC-01, CTS-TC-02 and CTS-TC-03 should handle blind transfer to agent, then queue transfer in one call session', async () => {
      await conference.startBaselineCall();
      await conference.setAvailable([2]);

      await consultOrTransfer(
        conference.getAgentPage(1),
        'agent',
        'transfer',
        conference.getAgentName(2)
      );
      await acceptIncomingTask(
        conference.getAgentPage(2),
        TASK_TYPES.CALL,
        ACCEPT_TASK_TIMEOUT * 2
      );
      await submitTransferSourceWrapupWhenReady(conference.getAgentPage(1));
      await expectAgentInActiveCall(conference.getAgentPage(2));

      await conference.setAvailable([1]);
      await consultOrTransfer(
        conference.getAgentPage(2),
        'queue',
        'transfer',
        conference.getRequiredEnv('QUEUE_NAME')
      );
      await acceptIncomingTask(
        conference.getAgentPage(1),
        TASK_TYPES.CALL,
        ACCEPT_TASK_TIMEOUT * 2
      );
      await submitTransferSourceWrapupWhenReady(conference.getAgentPage(2));

      await expectAgentInActiveCall(conference.getAgentPage(1));
    });

    test('CTS-TC-04 and CTS-TC-05 should run consult accepted and declined flows in one call session', async () => {
      await conference.startBaselineCall();

      await conference.consultAgent(1, 3);
      await cancelConsult(conference.getAgentPage(3));
      await expectAgentInActiveCall(conference.getAgentPage(1));

      await consultOrTransfer(
        conference.getAgentPage(1),
        'agent',
        'consult',
        conference.getAgentName(3)
      );
      await waitForIncomingTask(conference.getAgentPage(3), TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);
      await declineIncomingTask(conference.getAgentPage(3), TASK_TYPES.CALL);
      await expectAgentInActiveCall(conference.getAgentPage(1));
    });

    // Split from TC-07: queue routing won't re-route to an agent who RONA'd in the same session.
    test('CTS-TC-06 should handle not-picked agent consult', async () => {
      await conference.startBaselineCall();
      await conference.setAvailable([2]);

      const agent1Page = conference.getAgentPage(1);
      await consultOrTransfer(agent1Page, 'agent', 'consult', conference.getAgentName(2));
      await agent1Page.waitForTimeout(CONSULT_NO_ANSWER_TIMEOUT);

      const canCancelConsult = await agent1Page
        .locator(CONFERENCE_SELECTORS.endConsult)
        .isVisible()
        .catch(() => false);
      if (canCancelConsult) {
        await cancelConsult(agent1Page);
      }
      await expectAgentInActiveCall(agent1Page);
    });

    // Agent 3 instead of agent 2: agent 2 RONA'd in CTS-TC-06 and may not receive queue consults.
    test('CTS-TC-07 should handle queue-consult cancel', async () => {
      await conference.startBaselineCall();
      await conference.consultQueue(1, 3);
      await cancelConsult(conference.getAgentPage(1));
      await expectAgentInActiveCall(conference.getAgentPage(1));
    });

    test('CTS-TC-08 should support multi-stage consult transfer between A1 and A3', async () => {
      await conference.startBaselineCall();

      await conference.consultAgent(1, 3);
      await conference.transferConsult(1);
      await expectAgentInActiveCall(conference.getAgentPage(3));

      await cleanupConferencePageWithTimeout(
        conference.getAgentPage(1),
        conference.getCallerPage()
      );
      await conference.consultAgent(3, 1);
      await conference.transferConsult(3);
      await expectAgentInActiveCall(conference.getAgentPage(1));
    });
  });

  test.describe('Switch Conference - Set 9', () => {
    test('CTS-SW-05 and CTS-SW-06 should block consult during active consult and restore it after lobby closes', async () => {
      await conference.startBaselineCall();
      await conference.consultAgent(1, 2);
      await conference.merge(1);

      await conference.consultAgent(1, 3);
      const agent2Consult = conference
        .getAgentPage(2)
        .locator(CONFERENCE_SELECTORS.consult)
        .first();
      const consultVisible = await agent2Consult.isVisible().catch(() => false);

      if (consultVisible) {
        await expect(agent2Consult).toBeDisabled();
      } else {
        expect(consultVisible).toBeFalsy();
      }

      await conference.merge(1);
      await expect(agent2Consult).toBeEnabled({timeout: ACCEPT_TASK_TIMEOUT});
    });
  });
}

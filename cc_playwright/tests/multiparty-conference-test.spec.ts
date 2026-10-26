import {test, expect} from '@playwright/test';
import {TestManager} from '../test-manager';
import {
  acceptIncomingTask,
  declineIncomingTask,
  endCallTask,
  waitForIncomingTask,
} from '../Utils/incomingTaskUtils';
import {cancelConsult, consultOrTransfer} from '../Utils/advancedTaskControlUtils';
import {
  CONFERENCE_SELECTORS,
  cleanupConferencePageWithTimeout,
  createConferenceHelpers,
  expectAgentInActiveCall,
  expectAgentInConference,
  expectAgentIsConferenceOwner,
  expectAgentNotInConference,
  expectAgentNotInConferenceRoster,
  expectPostCustomerLeaveControls,
  submitTransferSourceWrapupWhenReady,
} from '../Utils/conferenceUtils';
import {
  ACCEPT_TASK_TIMEOUT,
  CONFERENCE_ACTION_SETTLE_TIMEOUT,
  CONFERENCE_RECONNECT_SETTLE_TIMEOUT,
  CONFERENCE_SWITCH_TOGGLE_TIMEOUT,
  CONSULT_NO_ANSWER_TIMEOUT,
  TASK_TYPES,
} from '../constants';

const CONFERENCE_TEST_TIMEOUT = 7 * 60 * 1000;

type Conference = ReturnType<typeof createConferenceHelpers>;

// A section is a topic. Each set (Playwright project, 4 agents + caller) runs a subset of sections so
// the sets execute in parallel; see the suites/multiparty-conference-set-*-tests.spec.ts wrappers.
export type ConferenceSection = 'lifecycle' | 'switch' | 'transferAgent' | 'transferQueue';

const registerLifecycleTests = (conference: Conference) => {
  test.describe('Conference lifecycle', () => {
    test('CTS-MPC-01 and CTS-MPC-02 should initiate a 3-agent conference and continue after one participant leaves', async () => {
      await conference.startBaselineCall();
      await conference.consultAgent(1, 2);
      await conference.merge(1);
      await conference.consultAgent(1, 3);
      await conference.merge(1);

      await expectAgentInConference(conference.getAgentPage(1));
      await expectAgentInConference(conference.getAgentPage(2));
      await expectAgentInConference(conference.getAgentPage(3));

      await conference.exitParticipant(3);
      await expectAgentInConference(conference.getAgentPage(1));
      await expectAgentInConference(conference.getAgentPage(2));
    });

    test('CTS-MPC-03 and CTS-MPC-04 should support owner handoff and participant replacement without restarting call', async () => {
      await conference.startBaselineCall();
      await conference.consultAgent(1, 2);
      await conference.merge(1);
      await conference.consultAgent(1, 3);
      await conference.merge(1);

      await conference.exitParticipant(1);
      await expectAgentInConference(conference.getAgentPage(2));
      // Ownership moves to agent 2 once the original owner leaves.
      await expectAgentIsConferenceOwner(conference.getAgentPage(2));

      await conference.consultAgent(2, 4);
      await conference.merge(2);
      await expectAgentInConference(conference.getAgentPage(2));
      await expectAgentInConference(conference.getAgentPage(4));
    });

    test('CTS-MPC-07, CTS-MPC-09 and CTS-MPC-10 should recover/rejoin after reconnect and handle customer leave', async () => {
      await conference.startBaselineCall();
      await conference.consultAgent(1, 2);
      await conference.merge(1);

      const agent2Page = conference.getAgentPage(2);
      await agent2Page.context().setOffline(true);
      await agent2Page.waitForTimeout(CONFERENCE_ACTION_SETTLE_TIMEOUT);
      await agent2Page.context().setOffline(false);
      await agent2Page.waitForTimeout(CONFERENCE_RECONNECT_SETTLE_TIMEOUT);

      await expectAgentInConference(conference.getAgentPage(1));
      await expectAgentInConference(agent2Page);

      await endCallTask(conference.getCallerPage(), true);
      await expectPostCustomerLeaveControls(conference.getAgentPage(1));
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
};

const registerSwitchTests = (conference: Conference) => {
  test.describe('Switch conference', () => {
    test('CTS-MPC-06 should switch between consult and main conference call legs', async () => {
      await conference.startBaselineCall();
      await conference.consultAgent(1, 2);
      await conference.merge(1);
      await conference.consultAgent(1, 3);

      const switchButton = conference.getAgentPage(1).locator(CONFERENCE_SELECTORS.switchToMain);
      await expect(switchButton).toBeVisible({timeout: ACCEPT_TASK_TIMEOUT});
      const firstToggle = await conference.toggleLeg(1);
      const secondToggle = await conference.toggleLeg(1);
      expect(firstToggle || secondToggle).toBeTruthy();
      await expect(switchButton).toBeVisible({timeout: ACCEPT_TASK_TIMEOUT});
    });

    test('CTS-SW-02 and CTS-SW-03 should switch legs and merge lobby participants into conference', async () => {
      await conference.startBaselineCall();
      await conference.consultAgent(1, 2);
      await conference.merge(1);
      await conference.consultAgent(1, 3);

      const page = conference.getAgentPage(1);
      const switchToMainButton = page.locator(CONFERENCE_SELECTORS.switchToMain);
      const switchToConsultButton = page.locator(CONFERENCE_SELECTORS.switchToConsult);

      await expect(switchToMainButton).toBeVisible({timeout: ACCEPT_TASK_TIMEOUT});
      await switchToMainButton.click();
      await page.waitForTimeout(CONFERENCE_SWITCH_TOGGLE_TIMEOUT);

      await expect(switchToConsultButton).toBeVisible({timeout: ACCEPT_TASK_TIMEOUT});
      await switchToConsultButton.click();
      await page.waitForTimeout(CONFERENCE_SWITCH_TOGGLE_TIMEOUT);

      await conference.merge(1);
      await expectAgentInConference(conference.getAgentPage(1));
      await expectAgentInConference(conference.getAgentPage(3));
    });
  });
};

const registerTransferAgentTests = (conference: Conference) => {
  test.describe('Transfer conference - agent paths', () => {
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

    test('CTS-MPC-05 and CTS-SW-04 should transfer from consult lobby to conference participant', async () => {
      await conference.startBaselineCall();
      await conference.consultAgent(1, 2);
      await conference.merge(1);
      await expectAgentInConference(conference.getAgentPage(1));
      await expectAgentInConference(conference.getAgentPage(2));

      await conference.consultAgent(1, 3);
      await conference.transferConsult(1);
      await expectAgentInConference(conference.getAgentPage(2));
      await expectAgentInConference(conference.getAgentPage(3));

      await expectAgentNotInConference(conference.getAgentPage(1));
      await expectAgentNotInConferenceRoster(
        conference.getAgentPage(2),
        conference.getAgentName(1)
      );
    });

    // Last on purpose: agent 2 goes unanswered here and may not reliably receive consults afterwards.
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
  });
};

const registerTransferQueueTests = (conference: Conference) => {
  test.describe('Transfer conference - queue paths', () => {
    test('CTS-TC-07 should handle queue-consult cancel', async () => {
      await conference.startBaselineCall();
      await conference.consultQueue(1, 3);
      await cancelConsult(conference.getAgentPage(1));
      await expectAgentInActiveCall(conference.getAgentPage(1));
    });

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

    test('CTS-SW-07 should keep queue-based consult flow stable with consult cancel/accept and merge', async () => {
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
};

const SECTION_REGISTRARS: Record<ConferenceSection, (conference: Conference) => void> = {
  lifecycle: registerLifecycleTests,
  switch: registerSwitchTests,
  transferAgent: registerTransferAgentTests,
  transferQueue: registerTransferQueueTests,
};

export default function createMultipartyConferenceTests(sections: ConferenceSection[]) {
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

  sections.forEach((section) => SECTION_REGISTRARS[section](conference));
}

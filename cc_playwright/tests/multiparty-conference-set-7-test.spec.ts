import {test, expect} from '@playwright/test';
import {TestManager} from '../test-manager';
import {endCallTask} from '../Utils/incomingTaskUtils';
import {
  CONFERENCE_SELECTORS,
  createConferenceHelpers,
  expectAgentInConference,
  expectPostCustomerLeaveControls,
} from '../Utils/conferenceUtils';
import {
  ACCEPT_TASK_TIMEOUT,
  CONFERENCE_ACTION_SETTLE_TIMEOUT,
  CONFERENCE_RECONNECT_SETTLE_TIMEOUT,
  CONFERENCE_SWITCH_TOGGLE_TIMEOUT,
} from '../constants';

const CONFERENCE_TEST_TIMEOUT = 7 * 60 * 1000;

export default function createMultipartyConferenceSet7Tests() {
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

  test.describe('Multi-Party Conference Feature Test Matrix', () => {
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

      await conference.consultAgent(2, 4);
      await conference.merge(2);
      await expectAgentInConference(conference.getAgentPage(2));
      await expectAgentInConference(conference.getAgentPage(4));
    });

    test('CTS-MPC-05 should transfer conference to another available agent', async () => {
      await conference.startBaselineCall();
      await conference.consultAgent(1, 2);
      await conference.merge(1);

      await conference.consultAgent(1, 3);
      await conference.transferConsult(1);
      await expectAgentInConference(conference.getAgentPage(2));
      await expectAgentInConference(conference.getAgentPage(3));
    });

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
  });

  test.describe('Switch Conference - Set 7', () => {
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

    test('CTS-SW-04 should transfer from consult lobby to conference participant', async () => {
      await conference.startBaselineCall();
      await conference.consultAgent(1, 2);
      await conference.merge(1);
      await expectAgentInConference(conference.getAgentPage(1));
      await expectAgentInConference(conference.getAgentPage(2));
      await conference.consultAgent(1, 3);
      await conference.transferConsult(1);

      await expectAgentInConference(conference.getAgentPage(2));
      await expectAgentInConference(conference.getAgentPage(3));
    });
  });
}

import {test, expect} from '@playwright/test';
import {
  cancelConsult,
  consultOrTransfer,
  clearAdvancedCapturedLogs,
  verifyConsultStartSuccessLogs,
  verifyConsultTransferredLogs,
  verifyTransferSuccessLogs,
  verifyConsultEndSuccessLogs,
} from '../Utils/advancedTaskControlUtils';
import {changeUserState, verifyCurrentState} from '../Utils/userStateUtils';
import {
  createCallTask,
  acceptIncomingTask,
  acceptExtensionCall,
  endCallTask,
  declineExtensionCall,
} from '../Utils/incomingTaskUtils';
import {submitWrapup} from '../Utils/wrapupUtils';
import {USER_STATES, TASK_TYPES, WRAPUP_REASONS} from '../constants';
import {waitForState, clearPendingCallAndWrapup, handleStrayTasks} from '../Utils/helperUtils';
import {
  endTask,
  holdCallToggle,
  verifyHoldButtonIcon,
  verifyTaskControls,
} from '../Utils/taskControlUtils';
import {TestManager} from '../test-manager';

export default function createDialNumberTaskControlTests() {
  test.describe('Dial Number Task Control Tests ', () => {
    let testManager: TestManager;

    test.beforeAll(async ({browser}, testInfo) => {
      const projectName = testInfo.project.name;
      testManager = new TestManager(projectName);
      await testManager.setupForDialNumber(browser);
    });

    test.beforeEach(async () => {
      await handleStrayTasks(testManager.agent1Page);
      await handleStrayTasks(testManager.agent2Page);
    });
    test.describe('Dial Number Tests', () => {
      test.beforeAll(async () => {
        test.skip(!process.env.PW_DIAL_NUMBER_NAME, 'PW_DIAL_NUMBER_NAME not set');
      });

      test('Two-hop: consult to Agent then consult-transfer to Dial Number', async () => {
        test.skip(!process.env.PW_DIAL_NUMBER_NAME, 'PW_DIAL_NUMBER_NAME not set');

        await clearPendingCallAndWrapup(testManager.agent1Page);
        await clearPendingCallAndWrapup(testManager.agent2Page);
        await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
        await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
        await createCallTask(
          testManager.callerPage!,
          process.env[`${testManager.projectName}_ENTRY_POINT`]!
        );
        await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
        await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
        await waitForState(testManager.agent1Page, USER_STATES.ENGAGED);
        await waitForState(testManager.agent2Page, USER_STATES.AVAILABLE);
        await testManager.agent2Page.waitForTimeout(2000);
        await testManager.agent1Page.waitForTimeout(2000);

        clearAdvancedCapturedLogs();
        await consultOrTransfer(
          testManager.agent1Page,
          'agent',
          'consult',
          process.env[`${testManager.projectName}_AGENT2_NAME`]!
        );
        await acceptIncomingTask(testManager.agent2Page, TASK_TYPES.CALL);
        await testManager.agent2Page.waitForTimeout(3000);
        await verifyCurrentState(testManager.agent2Page, USER_STATES.ENGAGED);
        await testManager.agent1Page.locator('#consult-transfer').click();
        await testManager.agent1Page.waitForTimeout(2000);
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
        await testManager.agent2Page.waitForTimeout(3000);
        await verifyCurrentState(testManager.agent2Page, USER_STATES.ENGAGED);

        await consultOrTransfer(
          testManager.agent2Page,
          'dialNumber',
          'consult',
          process.env.PW_DIAL_NUMBER_NAME!
        );
        await acceptExtensionCall(testManager.dialNumberPage);
        await testManager.agent2Page.locator('#consult-transfer').click();
        await submitWrapup(testManager.agent2Page, WRAPUP_REASONS.SALE);
        await verifyConsultTransferredLogs();
        await endCallTask(testManager.dialNumberPage);
      });

      test('Dial Number Consult: cancel, decline, accept/end, and transfer scenarios are handled correctly in sequence', async () => {
        await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
        // Setup: create call and get to engaged state
        await createCallTask(
          testManager.callerPage!,
          process.env[`${testManager.projectName}_ENTRY_POINT`]!
        );
        await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
        await testManager.agent1Page.waitForTimeout(5000);
        await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);

        // 1. Cancel consult
        clearAdvancedCapturedLogs();
        await consultOrTransfer(
          testManager.agent1Page,
          'dialNumber',
          'consult',
          process.env.PW_DIAL_NUMBER_NAME
        );
        await expect(testManager.agent1Page.locator('#end-consult')).toBeVisible();
        await testManager.agent1Page.waitForTimeout(2000);
        await cancelConsult(testManager.agent1Page);
        await verifyTaskControls(testManager.agent1Page, TASK_TYPES.CALL);
        await expect(testManager.agent1Page.locator('#end-consult')).not.toBeVisible();

        // 2. Decline consult
        clearAdvancedCapturedLogs();
        await consultOrTransfer(
          testManager.agent1Page,
          'dialNumber',
          'consult',
          process.env.PW_DIAL_NUMBER_NAME
        );
        await declineExtensionCall(testManager.dialNumberPage);
        await testManager.agent1Page.waitForTimeout(2000);
        await cancelConsult(testManager.agent1Page); // still needs to cancel even if declined
        await verifyTaskControls(testManager.agent1Page, TASK_TYPES.CALL);
        await verifyHoldButtonIcon(testManager.agent1Page, {expectedIsHeld: true});
        await holdCallToggle(testManager.agent1Page);
        await testManager.agent1Page.waitForTimeout(2000);
        await expect(testManager.agent1Page.locator('#end-consult')).not.toBeVisible();
        await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);

        // 3. Accept consult and end
        clearAdvancedCapturedLogs();
        await consultOrTransfer(
          testManager.agent1Page,
          'dialNumber',
          'consult',
          process.env.PW_DIAL_NUMBER_NAME
        );
        await testManager.agent1Page.waitForTimeout(2000);
        verifyConsultStartSuccessLogs();
        await acceptExtensionCall(testManager.dialNumberPage);
        await testManager.agent1Page.bringToFront();
        await cancelConsult(testManager.agent1Page);
        await verifyTaskControls(testManager.agent1Page, TASK_TYPES.CALL);
        await testManager.agent1Page.waitForTimeout(2000);
        verifyConsultEndSuccessLogs();
        await verifyHoldButtonIcon(testManager.agent1Page, {expectedIsHeld: true});
        await holdCallToggle(testManager.agent1Page);

        // 4. Consult transfer
        clearAdvancedCapturedLogs();
        await consultOrTransfer(
          testManager.agent1Page,
          'dialNumber',
          'consult',
          process.env.PW_DIAL_NUMBER_NAME
        );
        await acceptExtensionCall(testManager.dialNumberPage);
        await testManager.agent1Page.waitForTimeout(3000);
        await testManager.agent1Page.locator('#consult-transfer').click();
        await testManager.agent1Page.waitForTimeout(2000);
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
        await testManager.dialNumberPage.waitForTimeout(2000);
        verifyConsultStartSuccessLogs();
        verifyConsultTransferredLogs();
        await endCallTask(testManager.dialNumberPage);
      });

      test('Dial Number search filters list to the matching entry (local search)', async () => {
        if (testManager.projectName !== 'SET_5') {
          test.skip(true, 'Dial Number search validation runs only for SET_5 (user23/user24).');
        }

        const searchTerm = process.env.PW_DIAL_NUMBER_NAME!;

        // Setup: create call and get to engaged state
        await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
        await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
        await createCallTask(
          testManager.callerPage!,
          process.env[`${testManager.projectName}_ENTRY_POINT`]!
        );
        await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
        await testManager.agent1Page.waitForTimeout(3000);
        await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);

        // Open consult popover and switch to Dial Number
        const consultButton = testManager.agent1Page.locator('#consult').first();
        await consultButton.waitFor({state: 'visible', timeout: 10000});
        await consultButton.click();
        const popover = testManager.agent1Page.locator('.agent-popover-content');
        await expect(popover).toBeVisible({timeout: 10000});
        await popover.getByRole('button', {name: 'Dial Number'}).click();

        // Perform search and wait for local filtering to reflect
        await popover.locator('#consult-search').fill(searchTerm);
        await testManager.agent1Page.waitForTimeout(4000);

        // Read visible list item titles (aria-labels) and validate only the searched item remains
        const labels = await popover
          .locator('[role="listitem"]')
          .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('aria-label')));
        expect(labels).toContain(searchTerm);
        expect(labels.filter(Boolean).length).toBe(1);

        // Close the popover to avoid overlay blocking further actions
        await testManager.agent1Page.keyboard.press('Escape');
        await testManager.agent1Page
          .locator('.md-popover-backdrop')
          .waitFor({state: 'hidden', timeout: 3000})
          .catch(() => {});

        // End call and complete wrapup to clean up for next tests
        await endTask(testManager.agent1Page);
        await testManager.agent1Page.bringToFront();
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
        await testManager.agent1Page.waitForTimeout(1000);
      });

      test('Dial Number: consult then end consult returns UI to normal', async () => {
        test.skip(!process.env.PW_DIAL_NUMBER_NAME, 'PW_DIAL_NUMBER_NAME not set');

        await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
        await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
        await createCallTask(
          testManager.callerPage!,
          process.env[`${testManager.projectName}_ENTRY_POINT`]!
        );
        await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
        await waitForState(testManager.agent1Page, USER_STATES.ENGAGED);
        clearAdvancedCapturedLogs();
        await consultOrTransfer(
          testManager.agent1Page,
          'dialNumber',
          'consult',
          process.env.PW_DIAL_NUMBER_NAME!
        );
        await expect(testManager.agent1Page.locator('#end-consult')).toBeVisible();
        await cancelConsult(testManager.agent1Page);
        await expect(testManager.agent1Page.locator('#end-consult')).not.toBeVisible();
        await endCallTask(testManager.callerPage!, true);
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      });

      test('Dial Number: consult then transfer completes and remote ends', async () => {
        test.skip(!process.env.PW_DIAL_NUMBER_NAME, 'PW_DIAL_NUMBER_NAME not set');

        await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
        await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
        await createCallTask(
          testManager.callerPage!,
          process.env[`${testManager.projectName}_ENTRY_POINT`]!
        );
        await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
        clearAdvancedCapturedLogs();
        await consultOrTransfer(
          testManager.agent1Page,
          'dialNumber',
          'consult',
          process.env.PW_DIAL_NUMBER_NAME!
        );
        await expect(testManager.dialNumberPage.locator('#answer').first()).toBeVisible();
        await acceptExtensionCall(testManager.dialNumberPage);
        await testManager.agent1Page.locator('#consult-transfer').click();
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
        await verifyConsultStartSuccessLogs();
        await verifyConsultTransferredLogs();
        await endCallTask(testManager.dialNumberPage);
      });

      test.beforeEach(async () => {
        testManager.softCleanup();
        await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
        await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      });

      test('Blind Transfer to DialNumber', async () => {
        // Create call and agent 1 accepts
        await createCallTask(
          testManager.callerPage!,
          process.env[`${testManager.projectName}_ENTRY_POINT`]!
        );
        await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
        await testManager.agent1Page.waitForTimeout(3000);
        await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);
        clearAdvancedCapturedLogs();

        await consultOrTransfer(
          testManager.agent1Page,
          'dialNumber',
          'transfer',
          process.env.PW_DIAL_NUMBER_NAME
        );
        await acceptExtensionCall(testManager.dialNumberPage);
        verifyTransferSuccessLogs();
        await endCallTask(testManager.callerPage!, true);
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.RESOLVED);
        await testManager.agent1Page.waitForTimeout(2000);
        await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
      });

      test('Blind Transfer to Queue with DialNumber', async () => {
        // Create call and agent 1 accepts
        await createCallTask(
          testManager.callerPage!,
          process.env[`${testManager.projectName}_ENTRY_POINT`]!
        );
        await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
        await testManager.agent1Page.waitForTimeout(3000);
        await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);
        clearAdvancedCapturedLogs();

        await consultOrTransfer(testManager.agent1Page, 'queue', 'transfer', 'queue with dn e2e');
        await acceptExtensionCall(testManager.dialNumberPage);
        verifyTransferSuccessLogs();
        await endCallTask(testManager.callerPage!, true);
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.RESOLVED);
        await testManager.agent1Page.waitForTimeout(2000);
        await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
      });

      test('Consult then end consult returns UI to normal', async () => {
        await createCallTask(
          testManager.callerPage!,
          process.env[`${testManager.projectName}_ENTRY_POINT`]!
        );
        await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
        await waitForState(testManager.agent1Page, USER_STATES.ENGAGED);

        clearAdvancedCapturedLogs();
        await consultOrTransfer(
          testManager.agent1Page,
          'dialNumber',
          'consult',
          process.env.PW_DIAL_NUMBER_NAME!
        );
        await expect(testManager.agent1Page.locator('#end-consult')).toBeVisible();
        await cancelConsult(testManager.agent1Page);
        await expect(testManager.agent1Page.locator('#end-consult')).not.toBeVisible();
        await endCallTask(testManager.callerPage!, true);
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      });

      test('Consult then transfer completes and remote ends', async () => {
        await createCallTask(
          testManager.callerPage!,
          process.env[`${testManager.projectName}_ENTRY_POINT`]!
        );
        await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);

        clearAdvancedCapturedLogs();
        await consultOrTransfer(
          testManager.agent1Page,
          'dialNumber',
          'consult',
          process.env.PW_DIAL_NUMBER_NAME!
        );
        await expect(testManager.dialNumberPage.locator('#answer').first()).toBeVisible();
        await acceptExtensionCall(testManager.dialNumberPage);
        await testManager.agent1Page.bringToFront();
        await testManager.agent1Page.locator('#consult-transfer').click();
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
        await verifyConsultStartSuccessLogs();
        await verifyConsultTransferredLogs();
        await endCallTask(testManager.dialNumberPage);
      });
    });
  });
}

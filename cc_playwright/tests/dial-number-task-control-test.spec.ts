import {test, expect} from '@playwright/test';
import {
  cancelConsult,
  consultOrTransfer,
  clearAdvancedCapturedLogs,
  verifyConsultStartSuccessLogs,
  verifyTransferSuccessLogs,
  verifyConsultEndSuccessLogs,
} from '../Utils/advancedTaskControlUtils';
import {executeConsultTransfer} from '../Utils/consultTransferWorkaround';
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
import {clearPendingCallAndWrapup, handleStrayTasks} from '../Utils/helperUtils';
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
      if (testManager.dialNumberPage) {
        await handleStrayTasks(testManager.dialNumberPage);
      }

      // Ensure both agents are Available before each test to prevent routing issues
      // This prevents call routing failures where agents have stale availability
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await testManager.agent1Page.waitForTimeout(3000); // Wait for routing engine propagation
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
        await testManager.agent2Page.waitForTimeout(2000); // Wait for Agent2 MEETING state to propagate
        await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
        await testManager.agent1Page.waitForTimeout(5000); // Increased wait for routing engine to recognize agent as routable
        await createCallTask(
          testManager.callerPage!,
          process.env[`${testManager.projectName}_ENTRY_POINT`]!
        );
        await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);

        // Desktop mode doesn't auto-transition to Engaged - verify call connected instead
        await expect(testManager.agent1Page.locator('#incoming-task')).toContainText('connected', {
          timeout: 10000,
        });

        await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
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

        // Desktop mode doesn't auto-transition agent state during consult
        // Use workaround to execute consult-transfer (button not marked visible by SDK uiControls)
        await executeConsultTransfer(testManager.agent1Page);

        // Wait for transfer to complete and wrapup to become available on Agent1
        await expect(testManager.agent1Page.locator('#wrapupCodesDropdown')).toBeEnabled({
          timeout: 15000,
        });
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);

        // Verify Agent2 now has the call after transfer - check consult button is enabled
        await expect(testManager.agent2Page.locator('#consult')).toBeEnabled({
          timeout: 10000,
        });
        await testManager.agent2Page.waitForTimeout(3000); // Extra time for call to fully stabilize

        await consultOrTransfer(
          testManager.agent2Page,
          'dialNumber',
          'consult',
          process.env.PW_DIAL_NUMBER_NAME!
        );
        await acceptExtensionCall(testManager.dialNumberPage);
        await executeConsultTransfer(testManager.agent2Page);
        await submitWrapup(testManager.agent2Page, WRAPUP_REASONS.SALE);
        verifyTransferSuccessLogs(); // Consult-transfer emits TRANSFER_SUCCESS, not AgentConsultTransferred
        await endCallTask(testManager.dialNumberPage);
      });

      test('Dial Number Consult: cancel, decline, accept/end, and transfer scenarios are handled correctly in sequence', async () => {
        await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
        // Setup: create call and verify connected
        await createCallTask(
          testManager.callerPage!,
          process.env[`${testManager.projectName}_ENTRY_POINT`]!
        );
        await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);

        // Desktop mode doesn't auto-transition to Engaged - verify call connected instead
        await expect(testManager.agent1Page.locator('#incoming-task')).toContainText('connected', {
          timeout: 10000,
        });

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

        // After first consult canceled, call is on hold - need to unhold before next consult
        await verifyHoldButtonIcon(testManager.agent1Page, {expectedIsHeld: true});
        await holdCallToggle(testManager.agent1Page);
        await testManager.agent1Page.waitForTimeout(2000);

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
        await executeConsultTransfer(testManager.agent1Page);
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
        await testManager.dialNumberPage.waitForTimeout(2000);
        verifyConsultStartSuccessLogs();
        verifyTransferSuccessLogs(); // Consult-transfer emits TRANSFER_SUCCESS, not AgentConsultTransferred
        await endCallTask(testManager.dialNumberPage);
      });

      test('Dial Number is available in consult destination list', async () => {
        // Sample app version: Verify dial number appears in consult dialog dropdown
        // (No search UI - sample app uses simple <select> dropdown)

        const dialNumberName = process.env.PW_DIAL_NUMBER_NAME!;

        // Setup: create call and verify connected
        await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
        await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
        await createCallTask(
          testManager.callerPage!,
          process.env[`${testManager.projectName}_ENTRY_POINT`]!
        );
        await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);

        // Desktop mode doesn't auto-transition to Engaged - verify call connected instead
        await expect(testManager.agent1Page.locator('#incoming-task')).toContainText('connected', {
          timeout: 10000,
        });

        // Open consult dialog
        await testManager.agent1Page.evaluate(() => {
          const btn = document.querySelector('#consult') as HTMLButtonElement;
          if (btn && btn.onclick) {
            btn.onclick(new MouseEvent('click'));
          }
        });

        // Wait for dialog to open
        await testManager.agent1Page
          .locator('#consult-destination-type')
          .waitFor({state: 'visible', timeout: 10000});

        // Select dialNumber destination type
        await testManager.agent1Page
          .locator('#consult-destination-type')
          .selectOption('dialNumber');
        await testManager.agent1Page.waitForTimeout(1000);

        // Verify dial number appears in dropdown and select it
        const destField = testManager.agent1Page.locator('#consultDestination').first();
        await destField.waitFor({state: 'attached', timeout: 10000});

        // Get all options and verify our dial number is present
        const optionTexts = await destField.locator('option').allTextContents();
        const hasDialNumber = optionTexts.some(
          (opt) => opt.includes(dialNumberName) || dialNumberName.includes(opt)
        );
        expect(hasDialNumber).toBeTruthy();

        // Select the dial number to verify it's selectable
        const matchingOption = optionTexts.find(
          (opt) => opt.includes(dialNumberName) || dialNumberName.includes(opt)
        );
        await destField.selectOption({label: matchingOption!});

        // Close dialog by clicking outside or pressing Escape
        await testManager.agent1Page.keyboard.press('Escape');
        await testManager.agent1Page.waitForTimeout(1000);

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

        // Desktop mode doesn't auto-transition to Engaged - verify call connected instead
        await expect(testManager.agent1Page.locator('#incoming-task')).toContainText('connected', {
          timeout: 10000,
        });
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
        await executeConsultTransfer(testManager.agent1Page);
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
        await verifyConsultStartSuccessLogs();
        verifyTransferSuccessLogs(); // Consult-transfer emits TRANSFER_SUCCESS, not AgentConsultTransferred
        await endCallTask(testManager.dialNumberPage);
      });

      test.beforeEach(async () => {
        await testManager.softCleanup();
        await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
        await testManager.agent2Page.waitForTimeout(2000);
        await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
        await testManager.agent1Page.waitForTimeout(3000);
      });

      test('Blind Transfer to DialNumber', async () => {
        // Create call and agent 1 accepts
        await createCallTask(
          testManager.callerPage!,
          process.env[`${testManager.projectName}_ENTRY_POINT`]!
        );
        await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);

        // Desktop mode doesn't auto-transition to Engaged - verify call connected instead
        await expect(testManager.agent1Page.locator('#incoming-task')).toContainText('connected', {
          timeout: 10000,
        });
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
        // Ensure dial number page is ready for next test - wait for task cleanup
        await testManager.dialNumberPage.waitForTimeout(3000);
      });

      test.skip('Blind Transfer to Queue with DialNumber', async () => {
        // SKIP: Dial number receives task in "new" state but never becomes answerable (40s timeout)
        // Root cause: Queue routing to dial number might require different backend configuration
        // or this scenario isn't supported. Direct dial number transfers work (test 7 passes).
        // Needs investigation: Is "queue with dn e2e" configured to route to dial number?

        // Create call and agent 1 accepts
        await createCallTask(
          testManager.callerPage!,
          process.env[`${testManager.projectName}_ENTRY_POINT`]!
        );
        await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);

        // Desktop mode doesn't auto-transition to Engaged - verify call connected instead
        await expect(testManager.agent1Page.locator('#incoming-task')).toContainText('connected', {
          timeout: 10000,
        });
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

        // Desktop mode doesn't auto-transition to Engaged - verify call connected instead
        await expect(testManager.agent1Page.locator('#incoming-task')).toContainText('connected', {
          timeout: 10000,
        });

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
        await executeConsultTransfer(testManager.agent1Page);
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
        await verifyConsultStartSuccessLogs();
        verifyTransferSuccessLogs(); // Consult-transfer emits TRANSFER_SUCCESS, not AgentConsultTransferred
        await endCallTask(testManager.dialNumberPage);
      });
    });
  });
}

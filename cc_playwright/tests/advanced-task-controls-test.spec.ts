import {test, expect} from '@playwright/test';
import {
  consultOrTransfer,
  cancelConsult,
  clearAdvancedCapturedLogs,
  verifyTransferSuccessLogs,
  verifyConsultStartSuccessLogs,
  verifyConsultEndSuccessLogs,
  verifyConsultTransferredLogs,
} from '../Utils/advancedTaskControlUtils';

import {changeUserState, verifyCurrentState} from '../Utils/userStateUtils';
import {
  createCallTask,
  acceptIncomingTask,
  declineIncomingTask,
  acceptExtensionCall,
  waitForIncomingTask,
} from '../Utils/incomingTaskUtils';
import {submitWrapup} from '../Utils/wrapupUtils';
import {USER_STATES, TASK_TYPES, WRAPUP_REASONS, ACCEPT_TASK_TIMEOUT} from '../constants';
import {
  holdCallToggle,
  endTask,
  verifyHoldButtonIcon,
  verifyTaskControls,
} from '../Utils/taskControlUtils';
import {TestManager} from '../test-manager';
import {handleStrayTasks} from '../Utils/helperUtils';

/**
 * Transfer and Consult Tests
 *
 * Comprehensive test suite covering:
 * - Blind Transfer Operations (Agent to Agent, Agent to Queue)
 * - Consult Transfer Operations (with acceptance, decline, timeout scenarios)
 * - Queue Consult Operations (multi-agent scenarios)
 * - Multi-stage Consult Transfer Operations
 */

export default function createAdvancedTaskControlsTests() {
  let testManager: TestManager;

  test.beforeAll(async ({browser}, testInfo) => {
    const projectName = testInfo.project.name;
    testManager = new TestManager(projectName);
    await testManager.setupForAdvancedTaskControls(browser);
  });

  test.afterAll(async () => {
    if (testManager) {
      await testManager.cleanup();
    }
  });

  test.beforeEach(async () => {
    await handleStrayTasks(testManager.agent1Page, testManager.callerPage);
    await handleStrayTasks(testManager.agent2Page, testManager.callerPage);
  });

  // =============================================================================
  // BLIND TRANSFER TESTS
  // =============================================================================

  describe('Blind Transfer Tests', () => {
    beforeEach(async () => {
      await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
      // Create call task and agent 1 accepts it
      await createCallTask(
        testManager.callerPage!,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);

      await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);
      await acceptExtensionCall(testManager.agent1ExtensionPage);
      await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await testManager.agent1Page.waitForTimeout(5000);

      await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);

      // Clear console logs to track transfer events
      clearAdvancedCapturedLogs();
    });

    test('Call Blind Transferred by Agent to Another Agent', async () => {
      // Agent 1 performs blind transfer to Agent 2
      await consultOrTransfer(
        testManager.agent1Page,
        'agent',
        'transfer',
        process.env[`${testManager.projectName}_AGENT2_NAME`]!
      );
      // Agent 2 should receive the transfer and accept it
      await acceptIncomingTask(testManager.agent2Page, TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);
      await testManager.agent2Page.waitForTimeout(3000);
      // Verify transfer success in console logs
      await testManager.agent1Page.bringToFront();
      verifyTransferSuccessLogs();

      // Verify Agent 1 goes to wrapup state
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);

      // Verify Agent 2 now has the call and is engaged
      await verifyCurrentState(testManager.agent2Page, USER_STATES.ENGAGED);
      await verifyTaskControls(testManager.agent2Page, TASK_TYPES.CALL);

      // Verify transfer success was logged
      await testManager.agent2Page.waitForTimeout(2000);
      verifyTransferSuccessLogs();

      // End the call and complete wrapup to clean up for next test
      await endTask(testManager.agent2Page);
      await testManager.agent2Page.waitForTimeout(3000);
      await submitWrapup(testManager.agent2Page, WRAPUP_REASONS.RESOLVED);
      await testManager.agent2Page.waitForTimeout(2000);
    });

    test('Call Blind Transferred to Queue', async () => {
      // First transfer from Agent 1 to Agent 2
      await consultOrTransfer(
        testManager.agent1Page,
        'queue',
        'transfer',
        process.env[`${testManager.projectName}_QUEUE_NAME`]!
      );

      // Agent 2 accepts the transfer
      await acceptIncomingTask(testManager.agent2Page, TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      await testManager.agent1Page.waitForTimeout(3000);
      verifyTransferSuccessLogs();
      await verifyCurrentState(testManager.agent2Page, USER_STATES.ENGAGED);
      await endTask(testManager.agent2Page);
      await testManager.agent2Page.waitForTimeout(2000);

      // Verify Agent 2 goes to wrapup after transfer
      await submitWrapup(testManager.agent2Page, WRAPUP_REASONS.RESOLVED);
      await testManager.agent2Page.waitForTimeout(2000);

      // Verify Agent 2 is no longer engaged
      await verifyCurrentState(testManager.agent2Page, USER_STATES.AVAILABLE);
    });
  });

  // =============================================================================
  // CONSULT TRANSFER AND CONSULT SCENARIOS
  // =============================================================================

  describe('Consult and Consult Transfer Scenarios', () => {
    test('Agent Consult Transfer: cancel, decline, timeout, and transfer scenarios are handled correctly in sequence', async () => {
      // ...existing code for Agent Consult Transfer test...
      await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createCallTask(
        testManager.callerPage!,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);
      await expect(testManager.agent1ExtensionPage.locator('#answer').first()).toBeEnabled({
        timeout: 20000,
      });
      await acceptExtensionCall(testManager.agent1ExtensionPage);
      await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await testManager.agent1Page.waitForTimeout(3000);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);

      // 1. Accept consult and end
      clearAdvancedCapturedLogs();
      await consultOrTransfer(
        testManager.agent1Page,
        'agent',
        'consult',
        process.env[`${testManager.projectName}_AGENT2_NAME`]!
      );
      await expect(testManager.agent1Page.locator('#end-consult')).toBeVisible();
      await expect(testManager.agent1Page.locator('#consult-transfer')).toBeVisible();
      await acceptIncomingTask(testManager.agent2Page, TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);
      await testManager.agent2Page.waitForTimeout(3000);
      await expect(testManager.agent1Page.locator('#consult-transfer')).toBeVisible();
      await testManager.agent1Page.waitForTimeout(2000);
      verifyConsultStartSuccessLogs();
      await cancelConsult(testManager.agent2Page);
      await testManager.agent1Page.waitForTimeout(2000);
      verifyConsultEndSuccessLogs();
      await verifyHoldButtonIcon(testManager.agent1Page, {expectedIsHeld: true});
      await verifyCurrentState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await holdCallToggle(testManager.agent1Page);

      // 2. Decline consult
      clearAdvancedCapturedLogs();
      await consultOrTransfer(
        testManager.agent1Page,
        'agent',
        'consult',
        process.env[`${testManager.projectName}_AGENT2_NAME`]!
      );
      await waitForIncomingTask(testManager.agent2Page, TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);
      await declineIncomingTask(testManager.agent2Page, TASK_TYPES.CALL);
      await verifyTaskControls(testManager.agent1Page, TASK_TYPES.CALL);
      await verifyHoldButtonIcon(testManager.agent1Page, {expectedIsHeld: true});
      await holdCallToggle(testManager.agent1Page);
      await testManager.agent1Page.waitForTimeout(2000);
      await expect(testManager.agent1Page.locator('#end-consult')).not.toBeVisible();
      await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);

      // 3. Not picked up (timeout)
      clearAdvancedCapturedLogs();
      await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await consultOrTransfer(
        testManager.agent1Page,
        'agent',
        'consult',
        process.env[`${testManager.projectName}_AGENT2_NAME`]!
      );
      await testManager.agent1Page.waitForTimeout(10000);
      await verifyTaskControls(testManager.agent1Page, TASK_TYPES.CALL);
      await verifyHoldButtonIcon(testManager.agent1Page, {expectedIsHeld: true});
      await holdCallToggle(testManager.agent1Page);
      await testManager.agent1Page.waitForTimeout(2000);

      // 4. Consult transfer
      clearAdvancedCapturedLogs();
      await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await consultOrTransfer(
        testManager.agent1Page,
        'agent',
        'consult',
        process.env[`${testManager.projectName}_AGENT2_NAME`]!
      );
      await acceptIncomingTask(testManager.agent2Page, TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);
      await testManager.agent2Page.waitForTimeout(3000);
      await testManager.agent1Page.bringToFront();
      await testManager.agent1Page.locator('#consult-transfer').click();
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      await verifyCurrentState(testManager.agent2Page, USER_STATES.ENGAGED);
      await verifyTaskControls(testManager.agent2Page, TASK_TYPES.CALL);
      await testManager.agent2Page.waitForTimeout(2000);
      verifyConsultStartSuccessLogs();
      verifyTransferSuccessLogs();
      await endTask(testManager.agent2Page);
      await testManager.agent2Page.waitForTimeout(3000);
      await submitWrapup(testManager.agent2Page, WRAPUP_REASONS.RESOLVED);
      await testManager.agent2Page.waitForTimeout(2000);
    });

    test('Queue Consult: cancel, accept/end, agent-end, and transfer scenarios are handled correctly in sequence', async () => {
      // ...existing code for Queue Consult test...
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);

      // Setup: create call and get to engaged state
      await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
      await createCallTask(
        testManager.callerPage!,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);
      await acceptExtensionCall(testManager.agent1ExtensionPage);
      await testManager.agent1Page.waitForTimeout(5000);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);
      await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await testManager.agent2Page.waitForTimeout(2000);
      // 1. Cancel consult
      clearAdvancedCapturedLogs();
      await consultOrTransfer(
        testManager.agent1Page,
        'queue',
        'consult',
        process.env[`${testManager.projectName}_QUEUE_NAME`]!
      );
      await expect(testManager.agent1Page.locator('#end-consult')).toBeVisible();
      await testManager.agent1Page.waitForTimeout(2000);
      await cancelConsult(testManager.agent1Page);
      await verifyTaskControls(testManager.agent1Page, TASK_TYPES.CALL);
      await expect(testManager.agent1Page.locator('#end-consult')).not.toBeVisible();

      clearAdvancedCapturedLogs();
      await consultOrTransfer(
        testManager.agent1Page,
        'queue',
        'consult',
        process.env[`${testManager.projectName}_QUEUE_NAME`]!
      );
      await testManager.agent1Page.waitForTimeout(3000);
      verifyConsultStartSuccessLogs();
      await acceptIncomingTask(testManager.agent2Page, TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);
      await cancelConsult(testManager.agent1Page);
      await testManager.agent1Page.waitForTimeout(3000);
      await verifyCurrentState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await verifyTaskControls(testManager.agent1Page, TASK_TYPES.CALL);
      await testManager.agent1Page.waitForTimeout(2000);
      verifyConsultEndSuccessLogs();
      await verifyHoldButtonIcon(testManager.agent1Page, {expectedIsHeld: true});
      await holdCallToggle(testManager.agent1Page);

      // 3. Accept consult and Agent 2 ends
      await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
      clearAdvancedCapturedLogs();
      await consultOrTransfer(
        testManager.agent1Page,
        'queue',
        'consult',
        process.env[`${testManager.projectName}_QUEUE_NAME`]!
      );
      await acceptIncomingTask(testManager.agent2Page, TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);
      await testManager.agent2Page.waitForTimeout(3000);
      await cancelConsult(testManager.agent2Page);
      await testManager.agent2Page.waitForTimeout(3000);
      await verifyCurrentState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await verifyTaskControls(testManager.agent1Page, TASK_TYPES.CALL);
      await verifyHoldButtonIcon(testManager.agent1Page, {expectedIsHeld: true});
      await holdCallToggle(testManager.agent1Page);

      // 4. Consult transfer
      await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
      clearAdvancedCapturedLogs();
      await consultOrTransfer(
        testManager.agent1Page,
        'queue',
        'consult',
        process.env[`${testManager.projectName}_QUEUE_NAME`]!
      );
      await testManager.agent1Page.waitForTimeout(2000);
      await acceptIncomingTask(testManager.agent2Page, TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);
      await testManager.agent1Page.locator('#consult-transfer').click();
      await testManager.agent1Page.bringToFront();
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      await verifyCurrentState(testManager.agent2Page, USER_STATES.ENGAGED);
      await verifyTaskControls(testManager.agent2Page, TASK_TYPES.CALL);
      await testManager.agent2Page.waitForTimeout(2000);
      verifyConsultStartSuccessLogs();
      verifyConsultTransferredLogs();
      await endTask(testManager.agent2Page);
      await testManager.agent2Page.waitForTimeout(3000);
      await submitWrapup(testManager.agent2Page, WRAPUP_REASONS.RESOLVED);
      await testManager.agent2Page.waitForTimeout(2000);
    });
  });

  // =============================================================================
  // DIAL NUMBER TESTS - All tests requiring dialNumber session
  // =============================================================================

  test('Entry Point Consult: visible and functional only for supported users (no blind transfer)', async () => {
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await createCallTask(
      testManager.callerPage!,
      process.env[`${testManager.projectName}_ENTRY_POINT`]!
    );
    await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);
    await acceptExtensionCall(testManager.agent1ExtensionPage);
    await testManager.agent1Page.waitForTimeout(3000);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);

    // Ensure consult UI and Entry Point tab exists
    const consultButton = testManager.agent1Page.locator('#consult').first();
    await consultButton.waitFor({state: 'visible', timeout: 10000});
    await consultButton.click();
    await expect(testManager.agent1Page.locator('#consult-search')).toBeVisible();
    await testManager.agent1Page.getByRole('button', {name: 'Entry Point'}).click();

    await consultOrTransfer(
      testManager.agent1Page,
      'entryPoint',
      'consult',
      process.env.PW_ENTRYPOINT_NAME!
    );
    await expect(testManager.agent1Page.locator('#end-consult')).toBeVisible();
    await testManager.agent1Page.waitForTimeout(1000);
    await cancelConsult(testManager.agent1Page);
    await testManager.agent1Page.waitForTimeout(1000);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);
  });
}

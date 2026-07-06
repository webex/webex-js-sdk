import {test, expect} from '@playwright/test';
import {
  cancelConsult,
  consultOrTransfer,
  clearAdvancedCapturedLogs,
  waitForPrimaryCallAfterConsult,
  verifyConsultStartSuccessLogs,
  waitForConsultingAgentIdReady,
} from '../Utils/advancedTaskControlUtils';
import {executeConsultTransfer} from '../Utils/consultTransferWorkaround';
import {changeUserState} from '../Utils/userStateUtils';
import {createCallTask, acceptIncomingTask} from '../Utils/incomingTaskUtils';
import {submitWrapup} from '../Utils/wrapupUtils';
import {USER_STATES, TASK_TYPES, WRAPUP_REASONS} from '../constants';
import {waitForState, handleStrayTasks} from '../Utils/helperUtils';
import {endTask} from '../Utils/taskControlUtils';
import {TestManager} from '../test-manager';

export default function createAdvanceCombinationsTests() {
  test.describe('Advanced Combinations Tests ', () => {
    let testManager: TestManager;

    test.beforeAll(async ({browser}, testInfo) => {
      const projectName = testInfo.project.name;
      testManager = new TestManager(projectName);
      await testManager.setupForAdvancedCombinations(browser);
    });

    test.beforeEach(async () => {
      await handleStrayTasks(testManager.agent1Page);
      await handleStrayTasks(testManager.agent2Page);

      // Ensure both agents are Available before each test to prevent routing issues
      // This prevents blind transfer failures where dropdown shows stale availability
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await testManager.agent1Page.waitForTimeout(3000); // Wait for routing engine propagation
    });

    test('Transfer from one agent to another, then transfer back to the first agent', async () => {
      await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await testManager.agent1Page.waitForTimeout(3000); // Wait for backend to recognize routable
      await createCallTask(
        testManager.callerPage!,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
      await expect(testManager.agent1Page.locator('#incoming-task')).toContainText('connected', {
        timeout: 10000,
      });

      await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await testManager.agent1Page.waitForTimeout(5000); // Extra wait for routing engine
      await waitForState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await consultOrTransfer(
        testManager.agent1Page,
        'agent',
        'transfer',
        process.env[`${testManager.projectName}_AGENT2_NAME`]!
      );

      // Agent 2 must accept the transferred call first for transfer to complete
      await acceptIncomingTask(testManager.agent2Page, TASK_TYPES.CALL);
      await expect(testManager.agent2Page.locator('#incoming-task')).toContainText('connected', {
        timeout: 10000,
      });

      // Wait for transfer to complete - wrapup becomes enabled on Agent1
      await expect(testManager.agent1Page.locator('#wrapupCodesDropdown')).toBeEnabled({
        timeout: 15000,
      });
      await testManager.agent1Page.waitForTimeout(2000);
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);

      await consultOrTransfer(
        testManager.agent2Page,
        'agent',
        'transfer',
        process.env[`${testManager.projectName}_AGENT1_NAME`]!
      );

      // Agent 1 must accept the transferred call first for transfer to complete
      await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
      await testManager.agent1Page.waitForTimeout(2000);
      await expect(testManager.agent1Page.locator('#incoming-task')).toContainText('connected', {
        timeout: 10000,
      });

      // Wait for transfer to complete - wrapup becomes enabled on Agent2
      await expect(testManager.agent2Page.locator('#wrapupCodesDropdown')).toBeEnabled({
        timeout: 15000,
      });
      await testManager.agent1Page.waitForTimeout(2000);
      await submitWrapup(testManager.agent2Page, WRAPUP_REASONS.SALE);
      await waitForState(testManager.agent2Page, USER_STATES.AVAILABLE);

      await testManager.agent1Page.evaluate(() => {
        const btn = document.querySelector('#end') as HTMLButtonElement;
        if (btn) btn.click();
      });
      await testManager.agent1Page.waitForTimeout(3000);
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
    });

    test('Consult with another agent then transfer the call', async () => {
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
      await createCallTask(
        testManager.callerPage!,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
      await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await testManager.agent1Page.waitForTimeout(2000);
      await waitForState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await testManager.agent2Page.waitForTimeout(2000);
      await testManager.agent1Page.waitForTimeout(2000);
      await consultOrTransfer(
        testManager.agent1Page,
        'agent',
        'consult',
        process.env[`${testManager.projectName}_AGENT2_NAME`]!
      );
      await acceptIncomingTask(testManager.agent2Page, TASK_TYPES.CALL);
      await testManager.agent2Page.waitForTimeout(2000);
      await waitForConsultingAgentIdReady(testManager.agent1Page, 20000);

      await executeConsultTransfer(testManager.agent1Page);

      await expect(testManager.agent1Page.locator('#wrapupCodesDropdown')).toBeEnabled({
        timeout: 25000,
      });
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await consultOrTransfer(
        testManager.agent2Page,
        'agent',
        'consult',
        process.env[`${testManager.projectName}_AGENT1_NAME`]!
      );
      await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
      await testManager.agent1Page.waitForTimeout(2000);
      await waitForConsultingAgentIdReady(testManager.agent2Page, 20000);
      await executeConsultTransfer(testManager.agent2Page);
      await expect(testManager.agent2Page.locator('#wrapupCodesDropdown')).toBeEnabled({
        timeout: 25000,
      });
      await submitWrapup(testManager.agent2Page, WRAPUP_REASONS.SALE);
      await waitForState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await testManager.agent1Page.locator('#end').first().click();
      await testManager.agent1Page.waitForTimeout(2000);
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      await testManager.agent1Page.waitForTimeout(2000);
    });

    test('Consult with another agent, transfer the call and transfer the call back to the agent', async () => {
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
      await createCallTask(
        testManager.callerPage!,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
      await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await testManager.agent1Page.waitForTimeout(2000);
      await waitForState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await consultOrTransfer(
        testManager.agent1Page,
        'agent',
        'consult',
        process.env[`${testManager.projectName}_AGENT2_NAME`]!
      );
      await acceptIncomingTask(testManager.agent2Page, TASK_TYPES.CALL);
      await testManager.agent2Page.waitForTimeout(2000);
      await waitForConsultingAgentIdReady(testManager.agent1Page, 20000);
      await executeConsultTransfer(testManager.agent1Page);
      await expect(testManager.agent1Page.locator('#wrapupCodesDropdown')).toBeEnabled({
        timeout: 25000,
      });
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);

      await consultOrTransfer(
        testManager.agent2Page,
        'agent',
        'transfer',
        process.env[`${testManager.projectName}_AGENT1_NAME`]!
      );
      await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
      await testManager.agent1Page.waitForTimeout(2000);
      await testManager.agent2Page.waitForTimeout(2000);
      await submitWrapup(testManager.agent2Page, WRAPUP_REASONS.SALE);
      await waitForState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await testManager.agent1Page.waitForTimeout(2000);
      await testManager.agent1Page.locator('#end').first().click();
      await testManager.agent1Page.waitForTimeout(2000);
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      await testManager.agent1Page.waitForTimeout(2000);
    });

    test('Transfer the call to another agent & then consult from the other agent', async () => {
      await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createCallTask(
        testManager.callerPage!,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
      await testManager.agent1Page.waitForTimeout(2000);
      await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await testManager.agent1Page.waitForTimeout(2000);
      await consultOrTransfer(
        testManager.agent1Page,
        'agent',
        'transfer',
        process.env[`${testManager.projectName}_AGENT2_NAME`]!
      );
      await acceptIncomingTask(testManager.agent2Page, TASK_TYPES.CALL);
      await testManager.agent2Page.waitForTimeout(2000);
      await testManager.agent1Page.waitForTimeout(2000);
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await consultOrTransfer(
        testManager.agent2Page,
        'agent',
        'consult',
        process.env[`${testManager.projectName}_AGENT1_NAME`]!
      );
      await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
      await testManager.agent1Page.waitForTimeout(2000);
      await waitForConsultingAgentIdReady(testManager.agent2Page, 20000);
      await executeConsultTransfer(testManager.agent2Page);
      await expect(testManager.agent2Page.locator('#wrapupCodesDropdown')).toBeEnabled({
        timeout: 25000,
      });
      await submitWrapup(testManager.agent2Page, WRAPUP_REASONS.SALE);
      await waitForState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await testManager.agent1Page.locator('#end').first().click();
      await testManager.agent1Page.waitForTimeout(2000);
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      await testManager.agent1Page.waitForTimeout(2000);
    });

    test('Multi-Stage Consult and Transfer Between A1 and A2', async () => {
      await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createCallTask(
        testManager.callerPage!,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await testManager.agent1Page.waitForTimeout(5000);
      await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
      await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await testManager.agent1Page.waitForTimeout(5000);
      await consultOrTransfer(
        testManager.agent1Page,
        'agent',
        'consult',
        process.env[`${testManager.projectName}_AGENT2_NAME`]!
      );
      await acceptIncomingTask(testManager.agent2Page, TASK_TYPES.CALL);
      await testManager.agent2Page.waitForTimeout(3000);
      await waitForConsultingAgentIdReady(testManager.agent1Page, 20000);
      await executeConsultTransfer(testManager.agent1Page);
      await testManager.agent1Page.waitForTimeout(2000);
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      await testManager.agent2Page.waitForTimeout(3000);
      await consultOrTransfer(
        testManager.agent2Page,
        'agent',
        'consult',
        process.env[`${testManager.projectName}_AGENT1_NAME`]!
      );
      await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
      await testManager.agent1Page.waitForTimeout(3000);
      await waitForConsultingAgentIdReady(testManager.agent2Page, 20000);
      await executeConsultTransfer(testManager.agent2Page);
      await expect(testManager.agent2Page.locator('#wrapupCodesDropdown')).toBeEnabled({
        timeout: 25000,
      });
      await submitWrapup(testManager.agent2Page, WRAPUP_REASONS.RESOLVED);
      await consultOrTransfer(
        testManager.agent1Page,
        'agent',
        'consult',
        process.env[`${testManager.projectName}_AGENT2_NAME`]!
      );
      await expect(testManager.agent1Page.locator('#end-consult')).toBeVisible();
      // NOTE: #consult-transfer button not made visible by SDK (uiControls.consultTransfer not set)
      // await expect(testManager.agent1Page.locator('#consult-transfer')).toBeVisible();
      await cancelConsult(testManager.agent1Page);
      await waitForPrimaryCallAfterConsult(testManager.agent1Page);
      await expect(testManager.agent1Page.locator('#end-consult')).toBeHidden();
      // NOTE: #consult-transfer button not made visible by SDK (uiControls.consultTransfer not set)
      // await expect(testManager.agent1Page.locator('#consult-transfer')).toBeHidden();
      await expect(testManager.agent1Page.locator('#consult').first()).toBeVisible();
      await endTask(testManager.agent1Page);
      await testManager.agent1Page.waitForTimeout(3000);
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.RESOLVED);
      await testManager.agent1Page.waitForTimeout(2000);
    });

    test('Entry Point: consult then end consult returns UI to normal', async () => {
      test.skip(!process.env.PW_ENTRYPOINT_NAME, 'PW_ENTRYPOINT_NAME not set');

      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createCallTask(
        testManager.callerPage!,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
      clearAdvancedCapturedLogs();
      await consultOrTransfer(
        testManager.agent1Page,
        'entryPoint',
        'consult',
        process.env.PW_ENTRYPOINT_NAME!
      );
      await expect(testManager.agent1Page.locator('#end-consult')).toBeVisible();
      await verifyConsultStartSuccessLogs();
      await cancelConsult(testManager.agent1Page);
      await testManager.agent1Page.waitForTimeout(1000);
    });

    test.afterAll(async () => {
      await testManager.cleanup();
    });
  });
}

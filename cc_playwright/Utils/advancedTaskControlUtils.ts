import {Page, expect} from '@playwright/test';
import {holdCallToggle, isCallHeld} from './taskControlUtils';
import {hasAnyVisibleControl} from './controlUtils';
import {AWAIT_TIMEOUT} from '../constants';

/**
 * Utility functions for advanced task controls testing.
 * Provides functions for consult operations, transfer operations, and end consult actions.
 * These utilities handle complex multi-agent scenarios and task state transitions.
 *
 * @packageDocumentation
 */

// Array to store captured console logs for verification
const capturedAdvancedLogs: string[] = [];

export const ACTIVE_CONSULT_CONTROL_TEST_IDS = [
  'cancel-consult-btn',
  'transfer-consult-btn',
  'conference-consult-btn',
  'switchToMainCall-consult-btn',
  'call-control:switch-to-consult',
];

export async function hasAnyVisibleControlFromList(
  page: Page,
  testIds: string[]
): Promise<boolean> {
  for (const testId of testIds) {
    if (await hasAnyVisibleControl(page, testId)) {
      return true;
    }
  }

  return false;
}

/**
 * Sets up console logging to capture transfer and consult related callback logs.
 * Captures transfer success, consult start/end success, and related SDK messages.
 * @param page - The agent's main page
 * @returns Function to remove the console handler
 */
export function setupAdvancedConsoleLogging(page: Page): () => void {
  capturedAdvancedLogs.length = 0;

  const consoleHandler = (msg) => {
    const logText = msg.text();
    if (
      logText.includes('WXCC_SDK_TASK_TRANSFER_SUCCESS') ||
      logText.includes('WXCC_SDK_TASK_CONSULT_START_SUCCESS') ||
      logText.includes('WXCC_SDK_TASK_CONSULT_END_SUCCESS') ||
      logText.includes('AgentConsultTransferred') ||
      logText.includes('onEnd invoked') ||
      logText.includes('onTransfer invoked') ||
      logText.includes('onConsult invoked')
    ) {
      capturedAdvancedLogs.push(logText);
    }
  };

  page.on('console', consoleHandler);

  return () => page.off('console', consoleHandler);
}

/**
 * Clears the captured advanced logs array.
 * Should be called before each test or verification to ensure clean state.
 */
export function clearAdvancedCapturedLogs(): void {
  capturedAdvancedLogs.length = 0;
}

/**
 * Verifies that transfer success logs are present.
 * @throws Error if verification fails with detailed error message
 */
export function verifyTransferSuccessLogs(): void {
  const transferLogs = capturedAdvancedLogs.filter((log) =>
    log.includes('WXCC_SDK_TASK_TRANSFER_SUCCESS')
  );

  if (transferLogs.length === 0) {
    throw new Error(
      `No 'WXCC_SDK_TASK_TRANSFER_SUCCESS' logs found. Captured logs: ${JSON.stringify(
        capturedAdvancedLogs
      )}`
    );
  }
}

/**
 * Verifies that consult start success logs are present.
 * @throws Error if verification fails with detailed error message
 */
export function verifyConsultStartSuccessLogs(): void {
  const consultStartLogs = capturedAdvancedLogs.filter((log) =>
    log.includes('WXCC_SDK_TASK_CONSULT_START_SUCCESS')
  );

  if (consultStartLogs.length === 0) {
    throw new Error(
      `No 'WXCC_SDK_TASK_CONSULT_START_SUCCESS' logs found. Captured logs: ${JSON.stringify(
        capturedAdvancedLogs
      )}`
    );
  }
}

/**
 * Verifies that consult end success logs are present.
 * @throws Error if verification fails with detailed error message
 */
export function verifyConsultEndSuccessLogs(): void {
  const consultEndLogs = capturedAdvancedLogs.filter((log) =>
    log.includes('WXCC_SDK_TASK_CONSULT_END_SUCCESS')
  );

  if (consultEndLogs.length === 0) {
    throw new Error(
      `No 'WXCC_SDK_TASK_CONSULT_END_SUCCESS' logs found. Captured logs: ${JSON.stringify(
        capturedAdvancedLogs
      )}`
    );
  }
}

/**
 * Verifies that agent consult transferred logs are present (when consult is converted to transfer).
 * @throws Error if verification fails with detailed error message
 */
export function verifyConsultTransferredLogs(): void {
  const consultTransferredLogs = capturedAdvancedLogs.filter((log) =>
    log.includes('AgentConsultTransferred')
  );

  if (consultTransferredLogs.length === 0) {
    throw new Error(
      `No 'AgentConsultTransferred' logs found. Captured logs: ${JSON.stringify(
        capturedAdvancedLogs
      )}`
    );
  }
}

/**
 * Unified function to handle consult and transfer actions for agent, queue, and dial number.
 * Sample app version - uses simple dialog/fieldset UI instead of widget popovers.
 * @param page - The agent's main page
 * @param type - 'agent' | 'queue' | 'dialNumber' | 'entryPoint'
 * @param action - 'consult' | 'transfer'
 * @param value - agentName, queueName, or phoneNumber
 * @returns Promise<void>
 */
export async function consultOrTransfer(
  page: Page,
  type: 'agent' | 'queue' | 'dialNumber' | 'entryPoint',
  action: 'consult' | 'transfer',
  value: string
): Promise<void> {
  await page.bringToFront();

  if (action === 'consult') {
    // Sample app: Click #consult button to open dialog via JS (may be CSS-hidden)
    await page.evaluate(() => {
      const btn = document.querySelector('#consult') as HTMLButtonElement;
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);

    // Select destination type
    const typeMap = {
      agent: 'agent',
      queue: 'queue',
      dialNumber: 'dialNumber',
      entryPoint: 'entryPoint',
    };
    await page.locator('#consult-destination-type').selectOption(typeMap[type]);
    await page.waitForTimeout(1000); // Wait for UI to update destination field

    // Enter/select destination value (could be input or select depending on type)
    // Note: When type is 'agent', 'queue', or 'entryPoint', the sample app dynamically creates a select with id='consultDestination' (camelCase)
    // When type is 'dialNumber', it uses the original input with id='consult-destination' (kebab-case)
    const destFieldId = type === 'dialNumber' ? '#consult-destination' : '#consultDestination';
    const destField = page.locator(destFieldId);
    await destField.waitFor({state: 'attached', timeout: 10000});
    const tagName = await destField.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === 'select') {
      // For agent/queue dropdowns, wait for options to populate then select
      await page
        .locator(`${destFieldId} option:not([value=""])`)
        .first()
        .waitFor({state: 'attached', timeout: 10000});
      // Try to find matching option by text content
      const optionTexts = await destField.locator('option').allTextContents();
      const matchingOption = optionTexts.find((opt) => opt.includes(value) || value.includes(opt));
      if (matchingOption) {
        await destField.selectOption({label: matchingOption});
      } else {
        // Fallback: select first available option
        await destField.selectOption({index: 1});
      }
    } else {
      await destField.fill(value);
    }
    await page.waitForTimeout(300);

    // Click Initiate Consult (note: typo in sample app HTML - 'initate' not 'initiate')
    await page.locator('#initate-consult').click();
    await page.waitForTimeout(2000);
  } else {
    // Transfer: Click #transfer button via JS (may be CSS-hidden)
    await page.evaluate(() => {
      const btn = document.querySelector('#transfer') as HTMLButtonElement;
      if (btn) btn.click();
    });
    await page.waitForTimeout(1000); // Wait for transfer options to appear

    // Select destination type
    const typeMap = {
      agent: 'agent',
      queue: 'queue',
      dialNumber: 'dialNumber',
      entryPoint: 'entryPoint',
    };
    await page.locator('#transfer-destination-type').selectOption(typeMap[type]);
    await page.waitForTimeout(1000); // Wait for UI to update destination field

    // Enter/select destination value (could be input or select depending on type)
    const destField = page.locator('#transfer-destination');
    await destField.waitFor({state: 'attached', timeout: 10000});
    const tagName = await destField.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === 'select') {
      // For agent/queue dropdowns, wait for options to populate then select
      await page
        .locator('#transfer-destination option:not([value=""])')
        .first()
        .waitFor({state: 'attached', timeout: 10000});
      // Try to find matching option by text content
      const optionTexts = await destField.locator('option').allTextContents();
      const matchingOption = optionTexts.find((opt) => opt.includes(value) || value.includes(opt));
      if (matchingOption) {
        await destField.selectOption({label: matchingOption});
      } else {
        // Fallback: select first available option
        await destField.selectOption({index: 1});
      }
    } else {
      await destField.fill(value);
    }
    await page.waitForTimeout(300);

    // Click Initiate Transfer
    await page.locator('#initiate-transfer').click();
    await page.waitForTimeout(2000);
  }
}

export async function waitForPrimaryCallAfterConsult(page: Page): Promise<void> {
  // Wait for consult-specific controls to disappear (sample app: #end-consult button)
  const consultControlsGone = async () => {
    const endConsultBtn = page.locator('#end-consult');
    const isVisible = await endConsultBtn.isVisible().catch(() => false);

    return !isVisible;
  };

  await expect
    .poll(consultControlsGone, {timeout: AWAIT_TIMEOUT, intervals: [200, 500, 1000]})
    .toBeTruthy();

  if (await isCallHeld(page)) {
    await holdCallToggle(page);
    await expect
      .poll(() => isCallHeld(page), {timeout: AWAIT_TIMEOUT, intervals: [200, 500, 1000]})
      .toBeFalsy();
  }

  // Wait for primary call controls to return (sample app: #consult and #end buttons)
  await expect
    .poll(
      async () => {
        const consultBtn = page.locator('#consult').first();
        const endBtn = page.locator('#end').first();

        const consultVisible = await consultBtn.isVisible().catch(() => false);
        const consultEnabled = await consultBtn.isEnabled().catch(() => false);
        const endVisible = await endBtn.isVisible().catch(() => false);
        const endEnabled = await endBtn.isEnabled().catch(() => false);

        return consultVisible && consultEnabled && endVisible && endEnabled;
      },
      {timeout: AWAIT_TIMEOUT, intervals: [200, 500, 1000]}
    )
    .toBeTruthy();
}

/**
 * Waits for consult state to be ready for transfer in sample app.
 * Simply waits for End Consult button to be visible - this indicates consult is active.
 * @param page - The agent's main page
 * @param timeout - Maximum time to wait in ms (default 15000)
 * @returns Promise<void>
 */
export async function waitForConsultingAgentIdReady(page: Page, timeout = 15000): Promise<void> {
  // Wait for End Consult button to be visible - indicates consult is fully established
  await expect(page.locator('#end-consult')).toBeVisible({timeout});

  // Additional wait to ensure state is stable before transfer
  await page.waitForTimeout(2000);
}

/**
 * Cancels an ongoing consult and resumes the original call.
 * Sample app version: uses #end-consult button
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function cancelConsult(page: Page): Promise<void> {
  // Sample app: #end-consult button
  const endConsultBtn = page.locator('#end-consult');
  const isVisible = await endConsultBtn.isVisible().catch(() => false);

  if (!isVisible) {
    throw new Error('End consult button (#end-consult) not visible');
  }

  const isEnabled = await endConsultBtn.isEnabled().catch(() => false);
  if (!isEnabled) {
    throw new Error('End consult button (#end-consult) is disabled');
  }

  await endConsultBtn.click({timeout: AWAIT_TIMEOUT});
  await page.waitForTimeout(1000); // Wait for consult to be canceled
}

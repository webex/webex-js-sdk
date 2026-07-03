/* eslint-disable no-await-in-loop, no-plusplus */
// Disabled no-await-in-loop: file contains polling utilities requiring sequential awaits
// Disabled no-plusplus: standard loop incrementing is clearer than alternatives
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

/**
 * Sample app consult control selectors.
 * Note: Sample app uses plain IDs, not data-testid attributes.
 * These selectors are for advanced task controls during consult/conference flows.
 */
export const ACTIVE_CONSULT_CONTROL_SELECTORS = [
  '#end-consult', // End consult button
  '#transfer', // Transfer button (used during consult)
  '#merge-conference', // Merge to conference button
  '#exit-conference', // Exit conference button
];

/**
 * Checks if any control from the list is visible.
 * @param page - Playwright page
 * @param selectors - Array of CSS selectors (e.g., ['#end', '#transfer'])
 * @returns True if any control is visible
 */
export async function hasAnyVisibleControlFromList(
  page: Page,
  selectors: string[]
): Promise<boolean> {
  for (const selector of selectors) {
    if (await hasAnyVisibleControl(page, selector)) {
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
    // Sample app: Click #consult button to open dialog
    // Important: Button must be enabled (not disabled) and call must NOT be on hold
    const consultBtn = page.locator('#consult').first();
    await expect(consultBtn).toBeVisible({timeout: 5000});
    await expect(consultBtn).toBeEnabled({timeout: 5000});

    // Call the onclick handler directly via JavaScript
    await page.evaluate(() => {
      const btn = document.querySelector('#consult') as HTMLButtonElement;
      if (btn && btn.onclick) {
        btn.onclick(new MouseEvent('click'));
      }
    });

    // Wait for consult dialog to open (destination type selector becomes visible)
    await page.locator('#consult-destination-type').waitFor({state: 'visible', timeout: 10000});

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
    // Note: The sample app dynamically creates a select with id='consultDestination' (camelCase) for all types
    // The original input with id='consult-destination' (kebab-case) is cleared when type changes
    const destFieldId = '#consultDestination';
    const allDestFields = page.locator(destFieldId);
    const count = await allDestFields.count();

    let destField = allDestFields.first();

    // If multiple dropdowns exist, find the one that contains our target value
    if (count > 1) {
      for (let i = 0; i < count; i++) {
        const field = allDestFields.nth(i);
        const isVisible = await field.isVisible().catch(() => false);
        if (isVisible) {
          // Check if this dropdown contains the value we're looking for
          const optionTexts = await field
            .locator('option')
            .allTextContents()
            .catch(() => []);
          const hasMatch = optionTexts.some((opt) => opt.includes(value) || value.includes(opt));
          if (hasMatch) {
            destField = field;
            break;
          }
        }
      }
    }

    await destField.waitFor({state: 'attached', timeout: 10000});
    const tagName = await destField.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === 'select') {
      // Wait for options to populate
      await destField
        .locator('option:not([value=""])')
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

    // Wait for transfer dialog to open (destination type selector becomes visible)
    await page.locator('#transfer-destination-type').waitFor({state: 'visible', timeout: 10000});

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
    // Note: Sample app may have multiple #transfer-destination elements (agent/queue/entrypoint dropdowns)
    // We need to find the one that actually contains the value we're looking for
    const allDestFields = page.locator('#transfer-destination');
    const count = await allDestFields.count();

    let destField = allDestFields.first();

    // If multiple dropdowns exist, find the one that contains our target value
    if (count > 1) {
      for (let i = 0; i < count; i++) {
        const field = allDestFields.nth(i);
        const isVisible = await field.isVisible().catch(() => false);
        if (isVisible) {
          // Check if this dropdown contains the value we're looking for
          const optionTexts = await field
            .locator('option')
            .allTextContents()
            .catch(() => []);
          const hasMatch = optionTexts.some((opt) => opt.includes(value) || value.includes(opt));
          if (hasMatch) {
            destField = field;
            break;
          }
        }
      }
    }

    await destField.waitFor({state: 'attached', timeout: 10000});
    const tagName = await destField.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === 'select') {
      // Wait for options to populate
      await destField
        .locator('option:not([value=""])')
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

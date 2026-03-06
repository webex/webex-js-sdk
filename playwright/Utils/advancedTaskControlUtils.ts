/* eslint-disable import/no-extraneous-dependencies, no-use-before-define */
import {Page, expect} from '@playwright/test';
import {dismissOverlays} from './helperUtils';
import {AWAIT_TIMEOUT, FORM_FIELD_TIMEOUT} from '../constants';

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
 * @param page - The agent's main page
 * @param type - 'agent' | 'queue' | 'dialNumber'
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
  await openConsultOrTransferMenu(page, action);
  const popover = await getPopover(page);

  if (type === 'agent') {
    await performAgentSelection(page, popover, value);
  } else if (type === 'queue') {
    await performQueueSelection(page, popover, value);
  } else if (type === 'dialNumber') {
    await performDialNumberSelection(page, popover, value);
  } else if (type === 'entryPoint') {
    await performEntryPointSelection(page, popover, value);
  }

  await page.waitForTimeout(2000);
  if (action === 'consult') {
    await expect(page.getByTestId('cancel-consult-btn')).toBeVisible({timeout: FORM_FIELD_TIMEOUT});
  }
}

// ===== Internal helper functions =====
async function openConsultOrTransferMenu(
  page: Page,
  action: 'consult' | 'transfer'
): Promise<void> {
  await page.bringToFront();
  await dismissOverlays(page);

  if (action === 'consult') {
    await page.getByTestId('call-control:consult').first().click({timeout: AWAIT_TIMEOUT});
  } else {
    await page.getByTestId('call-control:transfer').first().click({timeout: AWAIT_TIMEOUT});
  }
}

async function getPopover(page: Page) {
  const popover = page.locator('.agent-popover-content');
  await expect(popover.locator('#consult-search')).toBeVisible({timeout: FORM_FIELD_TIMEOUT});

  return popover;
}

async function clickCategory(
  page: Page,
  popover: ReturnType<Page['locator']>,
  name: 'Agents' | 'Queues' | 'Dial Number' | 'Entry Point'
): Promise<void> {
  const button = popover.getByRole('button', {name, exact: true});
  await button.click({timeout: AWAIT_TIMEOUT});
  await page.waitForTimeout(200);
}

async function clickListItemPrimaryButton(
  page: Page,
  popover: ReturnType<Page['locator']>,
  value: string,
  categoryLabel: string
): Promise<void> {
  const listItem = popover.locator(`[role="listitem"][aria-label="${value}"]`).first();
  await listItem.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
  await listItem.hover();
  await listItem.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const primaryButton = listItem.getByRole('button');
  await primaryButton.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
  await primaryButton.scrollIntoViewIfNeeded();
  await primaryButton.evaluate((el) => {
    if (el.hasAttribute('disabled')) {
      throw new Error(`${categoryLabel} button is disabled`);
    }
  });
  let lastError;
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < 3; i++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await primaryButton.click({timeout: AWAIT_TIMEOUT, force: true});
      lastError = undefined;
      break;
    } catch (err) {
      lastError = err;
      // eslint-disable-next-line no-await-in-loop
      await page.waitForTimeout(300);
    }
  }
  if (lastError) {
    throw lastError;
  }
  await page
    .locator('.md-popover-backdrop')
    .waitFor({state: 'hidden', timeout: 3000})
    .catch(() => {});
}

async function performAgentSelection(
  page: Page,
  popover: ReturnType<Page['locator']>,
  value: string
): Promise<void> {
  await clickCategory(page, popover, 'Agents');
  await clickListItemPrimaryButton(page, popover, value, 'Agent');
}

async function performQueueSelection(
  page: Page,
  popover: ReturnType<Page['locator']>,
  value: string
): Promise<void> {
  await clickCategory(page, popover, 'Queues');
  await clickListItemPrimaryButton(page, popover, value, 'Queue');
}

async function performDialNumberSelection(
  page: Page,
  popover: ReturnType<Page['locator']>,
  value: string
): Promise<void> {
  if (!value || value.trim() === '') {
    throw new Error(
      'PW_DIAL_NUMBER_NAME is not set. Please provide the Dial Number list item name (e.g., cypher_pstn).'
    );
  }
  await clickCategory(page, popover, 'Dial Number');
  const search = popover.locator('#consult-search');
  if (await search.isVisible({timeout: 500}).catch(() => false)) {
    await search.fill(value, {timeout: AWAIT_TIMEOUT});
    await page.waitForTimeout(300);
  }
  await popover
    .getByRole('listitem', {name: value, exact: true})
    .waitFor({state: 'visible', timeout: FORM_FIELD_TIMEOUT});
  await clickListItemPrimaryButton(page, popover, value, 'Dial Number');
}

async function performEntryPointSelection(
  page: Page,
  popover: ReturnType<Page['locator']>,
  value: string
): Promise<void> {
  await clickCategory(page, popover, 'Entry Point');
  if (value) {
    const search = popover.locator('#consult-search');
    if (await search.isVisible({timeout: 500}).catch(() => false)) {
      await search.fill(value, {timeout: AWAIT_TIMEOUT});
      await page.waitForTimeout(300);
    }
  }
  await clickListItemPrimaryButton(page, popover, value, 'Entry Point');
}

/**
 * Cancels an ongoing consult and resumes the original call.
 * @param page - The agent's main page
 * @returns Promise<void>
 */
export async function cancelConsult(page: Page): Promise<void> {
  // Click cancel consult button
  await page.getByTestId('cancel-consult-btn').click({timeout: AWAIT_TIMEOUT});
}

import {Page, expect} from '@playwright/test';
import {loginExtension} from './incomingTaskUtils';
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
let capturedAdvancedLogs: string[] = [];

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
  const transferLogs = capturedAdvancedLogs.filter((log) => log.includes('WXCC_SDK_TASK_TRANSFER_SUCCESS'));

  if (transferLogs.length === 0) {
    throw new Error(
      `No 'WXCC_SDK_TASK_TRANSFER_SUCCESS' logs found. Captured logs: ${JSON.stringify(capturedAdvancedLogs)}`
    );
  }
}

/**
 * Verifies that consult start success logs are present.
 * @throws Error if verification fails with detailed error message
 */
export function verifyConsultStartSuccessLogs(): void {
  const consultStartLogs = capturedAdvancedLogs.filter((log) => log.includes('WXCC_SDK_TASK_CONSULT_START_SUCCESS'));

  if (consultStartLogs.length === 0) {
    throw new Error(
      `No 'WXCC_SDK_TASK_CONSULT_START_SUCCESS' logs found. Captured logs: ${JSON.stringify(capturedAdvancedLogs)}`
    );
  }
}

/**
 * Verifies that consult end success logs are present.
 * @throws Error if verification fails with detailed error message
 */
export function verifyConsultEndSuccessLogs(): void {
  const consultEndLogs = capturedAdvancedLogs.filter((log) => log.includes('WXCC_SDK_TASK_CONSULT_END_SUCCESS'));

  if (consultEndLogs.length === 0) {
    throw new Error(
      `No 'WXCC_SDK_TASK_CONSULT_END_SUCCESS' logs found. Captured logs: ${JSON.stringify(capturedAdvancedLogs)}`
    );
  }
}

/**
 * Verifies that agent consult transferred logs are present (when consult is converted to transfer).
 * @throws Error if verification fails with detailed error message
 */
export function verifyConsultTransferredLogs(): void {
  const consultTransferredLogs = capturedAdvancedLogs.filter((log) => log.includes('AgentConsultTransferred'));

  if (consultTransferredLogs.length === 0) {
    throw new Error(`No 'AgentConsultTransferred' logs found. Captured logs: ${JSON.stringify(capturedAdvancedLogs)}`);
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
  if (!value || value.trim() === '') {
    throw new Error('Destination value is required for consult/transfer');
  }

  await openConsultOrTransferMenu(page, action);
  await selectDestinationType(page, action, type);
  await fillDestination(page, action, value);
  await submitConsultOrTransfer(page, action);

  await page.waitForTimeout(2000);
  if (action === 'consult') {
    await expect(page.getByTestId('cancel-consult-btn')).toBeVisible({timeout: FORM_FIELD_TIMEOUT});
  }
}

// ===== Internal helper functions =====
const DESTINATION_TYPE_MAP: Record<'agent' | 'queue' | 'dialNumber' | 'entryPoint', string> = {
  agent: 'agent',
  queue: 'queue',
  dialNumber: 'dialNumber',
  entryPoint: 'entryPoint',
};

const CONSULT_SELECTORS = {
  openButton: 'call-control:consult',
  dialog: '#initiate-consult-dialog',
  typeSelect: '#consult-destination-type',
  destinationHolder: '#consult-destination-holder',
  submit: '#initate-consult',
};

const TRANSFER_SELECTORS = {
  openButton: 'call-control:transfer',
  panel: '#transfer-options',
  typeSelect: '#transfer-destination-type',
  destinationHolder: '#transfer-destination-holder',
  submit: '#initiate-transfer',
};

async function openConsultOrTransferMenu(page: Page, action: 'consult' | 'transfer'): Promise<void> {
  if (action === 'consult') {
    await dismissOverlays(page);
    await page.getByTestId(CONSULT_SELECTORS.openButton).click({timeout: AWAIT_TIMEOUT});
    await expect(page.locator(CONSULT_SELECTORS.dialog)).toBeVisible({timeout: FORM_FIELD_TIMEOUT});
    return;
  }
  await page.getByTestId(TRANSFER_SELECTORS.openButton).click({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(TRANSFER_SELECTORS.panel)).toBeVisible({timeout: FORM_FIELD_TIMEOUT});
}

async function selectDestinationType(
  page: Page,
  action: 'consult' | 'transfer',
  type: 'agent' | 'queue' | 'dialNumber' | 'entryPoint'
): Promise<void> {
  const value = DESTINATION_TYPE_MAP[type];
  if (!value) {
    throw new Error(`Unsupported destination type: ${type}`);
  }
  const selector = action === 'consult' ? CONSULT_SELECTORS.typeSelect : TRANSFER_SELECTORS.typeSelect;
  const select = page.locator(selector);
  await select.waitFor({state: 'visible', timeout: FORM_FIELD_TIMEOUT});
  await select.selectOption({value});
  await page.waitForTimeout(200);
}

async function fillDestination(page: Page, action: 'consult' | 'transfer', value: string): Promise<void> {
  const holderSelector =
    action === 'consult' ? CONSULT_SELECTORS.destinationHolder : TRANSFER_SELECTORS.destinationHolder;
  const holder = page.locator(holderSelector);
  const control = holder.locator('input, select').first();
  await control.waitFor({state: 'visible', timeout: FORM_FIELD_TIMEOUT});
  const tag = await control.evaluate((el) => el.tagName.toLowerCase());
  if (tag === 'select') {
    try {
      await control.selectOption({label: value});
    } catch (error) {
      await control.selectOption({value});
    }
  } else {
    await control.fill(value, {timeout: AWAIT_TIMEOUT});
  }
}

async function submitConsultOrTransfer(page: Page, action: 'consult' | 'transfer'): Promise<void> {
  const selector = action === 'consult' ? CONSULT_SELECTORS.submit : TRANSFER_SELECTORS.submit;
  await page.locator(selector).click({timeout: AWAIT_TIMEOUT});
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

/**
 * Ensures the Dial Number softphone (web.webex.com) page is logged in using env creds.
 * Uses: PW_DIAL_NUMBER_LOGIN_USERNAME, PW_DIAL_NUMBER_LOGIN_PASSWORD
 * Also dismisses any stale overlays/popovers (e.g., "Media failed") that might block interaction.
 */
export async function ensureDialNumberLoggedIn(page: Page): Promise<void> {
  const currentUrl = page?.url?.() || '';
  if (!/\.webex\.com\/calling/.test(currentUrl)) {
    const user = process.env.PW_DIAL_NUMBER_LOGIN_USERNAME;
    const pass = process.env.PW_DIAL_NUMBER_LOGIN_PASSWORD;
    if (user && pass) {
      await loginExtension(page, user, pass);
    }
  }

  // Dismiss any stale overlays/popovers (e.g., "Media failed" from previous calls)
  await dismissOverlays(page);

  // Ensure the dial number page is in the foreground to avoid background throttling
  await page.bringToFront();

  // Wait for the incoming call to appear on the dial number page
  // Use extended timeout to handle network routing delays and test interference
  await page.locator('[data-test="right-action-button"]').waitFor({state: 'visible', timeout: AWAIT_TIMEOUT * 2.5});
}

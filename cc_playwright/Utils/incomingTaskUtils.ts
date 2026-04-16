/* eslint-disable no-await-in-loop, no-plusplus, no-continue */
import {Page, expect} from '@playwright/test';
import nodemailer from 'nodemailer';
import {
  CALL_URL,
  RonaOption,
  AWAIT_TIMEOUT,
  TASK_TYPES,
  TaskType,
  DEFAULT_MAX_RETRIES,
  CHAT_LAUNCHER_TIMEOUT,
  FORM_FIELD_TIMEOUT,
  TEST_DATA,
  CHAT_UI,
  UI_SETTLE_TIMEOUT,
  EXTENSION_REGISTRATION_TIMEOUT,
  ACCEPT_TASK_TIMEOUT,
} from '../constants';

const transporter = nodemailer.createTransport({
  service: 'gmail', // Make sure to use Secure Port for Gmail SMTP
  auth: {
    user: process.env.PW_SENDER_EMAIL,
    pass: process.env.PW_SENDER_EMAIL_PASSWORD,
  },
});

/**
 * Utility functions for dealing with creating, ending, and handling tasks in tests
 * Includes helpers for creating and ending call/chat/email tasks, handling extension calls,
 * and interacting with RONA popups and login flows.
 *
 * @packageDocumentation
 */

/**
 * Creates a call task by dialing the provided number, in the webex calling web-client.
 * Prerequisite: The calling webclient must be logged in.
 * @param page Playwright Page object
 * @param number Phone number to dial (defaults to PW_ENTRY_POINT env variable)
 */
export async function createCallTask(page: Page, number: string) {
  await page.bringToFront();
  if (!number || number.trim() === '') {
    throw new Error('Dial number is required');
  }

  // CRITICAL: Use caller's #end-call selector (not agent's #end)
  // Check for active call and end it before creating new call to prevent state contamination
  const endBtn = page.locator('#end-call').first();
  if (await endBtn.isEnabled({timeout: 500}).catch(() => false)) {
    await endBtn.click({timeout: AWAIT_TIMEOUT});
    await page.waitForTimeout(500);
  }

  await page.locator('#destination').waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
  await page.locator('#destination').fill(number, {timeout: AWAIT_TIMEOUT});

  await expect(page.locator('#create-call-action')).toBeVisible({timeout: AWAIT_TIMEOUT});
  await page.locator('#create-call-action').click({timeout: AWAIT_TIMEOUT});
}

/**
 * Ends the current ongoing call in webex calling webclient.
 * Prerequisite: The calling webclient must be logged in.
 * @param page Playwright Page object
 */
export async function endCallTask(page: Page, isCaller = false) {
  await page.bringToFront();
  const endBtn = isCaller ? page.locator('#end-call').first() : page.locator('#end').first();
  await expect(endBtn).toBeEnabled({timeout: AWAIT_TIMEOUT});
  await endBtn.click({timeout: AWAIT_TIMEOUT});
}

/**
 * Creates a chat task by going to the chat client and submitting required info.
 * Retries up to maxRetries on failure.
 * @param page Playwright Page object
 */
export async function createChatTask(page: Page, chatURL: string) {
  for (let i = 0; i < DEFAULT_MAX_RETRIES; i++) {
    try {
      await page.goto(chatURL);
      await page.waitForTimeout(UI_SETTLE_TIMEOUT);
      await page
        .locator(`iframe[name="${CHAT_UI.IFRAME_LAUNCHER}"]`)
        .contentFrame()
        .getByRole('button', {name: CHAT_UI.BUTTON_LAUNCHER})
        .waitFor({state: 'visible', timeout: CHAT_LAUNCHER_TIMEOUT});
      await page
        .locator(`iframe[name="${CHAT_UI.IFRAME_LAUNCHER}"]`)
        .contentFrame()
        .getByRole('button', {name: CHAT_UI.BUTTON_LAUNCHER})
        .click({timeout: AWAIT_TIMEOUT});
      await page
        .locator(`iframe[name="${CHAT_UI.IFRAME_CONVERSATION}"]`)
        .contentFrame()
        .getByRole('button', {name: CHAT_UI.BUTTON_START_CHAT})
        .waitFor({state: 'visible', timeout: FORM_FIELD_TIMEOUT});
      await page
        .locator(`iframe[name="${CHAT_UI.IFRAME_CONVERSATION}"]`)
        .contentFrame()
        .getByRole('button', {name: CHAT_UI.BUTTON_START_CHAT})
        .click({timeout: AWAIT_TIMEOUT});
      await page
        .locator(`iframe[name="${CHAT_UI.IFRAME_CONVERSATION}"]`)
        .contentFrame()
        .getByRole('textbox', {name: CHAT_UI.TEXTBOX_NAME})
        .waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
      await page
        .locator(`iframe[name="${CHAT_UI.IFRAME_CONVERSATION}"]`)
        .contentFrame()
        .getByRole('textbox', {name: CHAT_UI.TEXTBOX_NAME})
        .click({timeout: AWAIT_TIMEOUT});
      await page
        .locator(`iframe[name="${CHAT_UI.IFRAME_CONVERSATION}"]`)
        .contentFrame()
        .getByRole('textbox', {name: CHAT_UI.TEXTBOX_NAME})
        .fill(TEST_DATA.CHAT_NAME, {timeout: AWAIT_TIMEOUT});
      await page
        .locator(`iframe[name="${CHAT_UI.IFRAME_CONVERSATION}"]`)
        .contentFrame()
        .getByRole('textbox', {name: CHAT_UI.TEXTBOX_NAME})
        .fill(TEST_DATA.CHAT_NAME, {timeout: AWAIT_TIMEOUT});
      await page
        .locator(`iframe[name="${CHAT_UI.IFRAME_CONVERSATION}"]`)
        .contentFrame()
        .getByRole('button', {name: CHAT_UI.BUTTON_SUBMIT_NAME})
        .waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
      await page
        .locator(`iframe[name="${CHAT_UI.IFRAME_CONVERSATION}"]`)
        .contentFrame()
        .getByRole('button', {name: CHAT_UI.BUTTON_SUBMIT_NAME})
        .click({timeout: AWAIT_TIMEOUT});
      await page.waitForTimeout(200);
      await expect(
        page
          .locator('iframe[name="Conversation Window"]')
          .contentFrame()
          .getByRole('textbox', {name: 'Email*'})
      ).toBeVisible();
      await page
        .locator('iframe[name="Conversation Window"]')
        .contentFrame()
        .getByRole('textbox', {name: 'Email*'})
        .click({timeout: AWAIT_TIMEOUT});
      await page
        .locator('iframe[name="Conversation Window"]')
        .contentFrame()
        .getByRole('textbox', {name: 'Email*'})
        .fill(TEST_DATA.CHAT_EMAIL, {timeout: AWAIT_TIMEOUT});
      await expect(
        page
          .locator('iframe[name="Conversation Window"]')
          .contentFrame()
          .getByRole('button', {name: 'Submit Email'})
      ).toBeVisible();
      await page
        .locator('iframe[name="Conversation Window"]')
        .contentFrame()
        .getByRole('button', {name: 'Submit Email'})
        .click({timeout: AWAIT_TIMEOUT});
      break;
    } catch (error) {
      if (i === DEFAULT_MAX_RETRIES - 1) {
        throw new Error(
          `Failed to load chat client after ${DEFAULT_MAX_RETRIES} attempts: ${error}`
        );
      }
    }
  }
}

/**
 * Ends the current chat task by navigating the chat UI.
 * The Input page should have the chat client with the chat open.
 * @param page Playwright Page object
 */
export async function endChatTask(page: Page) {
  await expect(
    page
      .locator('iframe[name="Conversation Window"]')
      .contentFrame()
      .getByRole('button', {name: 'Menu'})
  ).toBeVisible();
  await page
    .locator('iframe[name="Conversation Window"]')
    .contentFrame()
    .getByRole('button', {name: 'Menu'})
    .click({timeout: AWAIT_TIMEOUT});
  await page.waitForTimeout(500);
  await expect(
    page.locator('iframe[name="Conversation Window"]').contentFrame().getByText('End chat')
  ).toBeVisible({
    timeout: AWAIT_TIMEOUT,
  });
  await page
    .locator('iframe[name="Conversation Window"]')
    .contentFrame()
    .getByText('End chat')
    .click({timeout: AWAIT_TIMEOUT});
  await page.waitForTimeout(500);
  await expect(
    page
      .locator('iframe[name="Conversation Window"]')
      .contentFrame()
      .getByRole('button', {name: 'End', exact: true})
  ).toBeVisible();
  await page
    .locator('iframe[name="Conversation Window"]')
    .contentFrame()
    .getByRole('button', {name: 'End', exact: true})
    .click({timeout: AWAIT_TIMEOUT});
  await page.waitForTimeout(1000);
}

/**
 * Sends a test email to trigger an incoming email task.
 * @throws Error if sending fails
 */
export async function createEmailTask(to: string) {
  const from = process.env.PW_SENDER_EMAIL;
  const subject = `Playwright Test Email - ${new Date().toISOString()}`;
  const text = TEST_DATA.EMAIL_TEXT;

  try {
    const mailOptions = {
      from,
      to,
      subject,
      text,
    };
    await transporter.sendMail(mailOptions);
  } catch (error) {
    throw new Error(`Failed to send email: ${error}`);
  }
}

/**
 * Gets the incoming task div locator for a given task type.
 * @param page Playwright Page object
 * @param type Task type (see TASK_TYPES)
 * @returns Locator for the incoming task div
 */
export function getIncomingTaskLocator(page: Page, type: TaskType) {
  if (type === TASK_TYPES.CALL) {
    return page.locator('#taskList .task-item-content').first();
  }
  if (type === TASK_TYPES.CHAT || type === TASK_TYPES.EMAIL || type === TASK_TYPES.SOCIAL) {
    // Sample app renders all incoming tasks in the same TaskList container.
    return page.locator('#taskList .task-item-content').first();
  }
  throw new Error(`Unknown task type: ${type}`);
}

/**
 * Waits for an incoming task of the given type to be visible.
 * Brings the page to front and waits for the task div to appear.
 * @param page Playwright Page object
 * @param type Task type (see TASK_TYPES)
 * @param timeout Optional timeout in ms (default: 40000)
 * @returns Locator for the incoming task div
 */
export async function waitForIncomingTask(
  page: Page,
  type: TaskType,
  timeout: number = ACCEPT_TASK_TIMEOUT
) {
  await page.bringToFront();
  const incomingTaskDiv = getIncomingTaskLocator(page, type);
  await incomingTaskDiv.waitFor({state: 'visible', timeout});

  return incomingTaskDiv;
}

/**
 * Accepts an incoming task of the given type (call, chat, email, social).
 * Waits for the task to appear, then clicks the accept button.
 * @param page Playwright Page object
 * @param type Task type (see TASK_TYPES)
 * @param timeout Optional timeout in ms for waiting for task (default: 40000)
 * @throws Error if accept button is not found or if this is an extension call
 */
export async function acceptIncomingTask(
  page: Page,
  type: TaskType,
  timeout: number = ACCEPT_TASK_TIMEOUT
) {
  await page.bringToFront();

  const incomingTaskDiv = await waitForIncomingTask(page, type, timeout);

  // Check if this is an extension call (only for CALL type)
  if (type === TASK_TYPES.CALL) {
    const taskText = await incomingTaskDiv.innerText();
    if (taskText.includes(TEST_DATA.EXTENSION_CALL_INDICATOR)) {
      throw new Error('This is an extension call, use acceptExtensionCall instead');
    }
  }

  // Sample app can expose task-level Accept in TaskList for browser device mode.
  const acceptButton = incomingTaskDiv.getByRole('button', {name: 'Accept'}).first();
  const hasTaskListAccept = await acceptButton.isVisible().catch(() => false);
  if (hasTaskListAccept) {
    await expect(acceptButton).toBeEnabled({timeout: AWAIT_TIMEOUT});

    try {
      await page.waitForTimeout(2000);
      await acceptButton.click({timeout: AWAIT_TIMEOUT});
    } catch {
      // Retry with force click if normal click fails
      await acceptButton.click({force: true, timeout: AWAIT_TIMEOUT});
    }

    await page.waitForTimeout(2000);

    // Best-effort retry if the same task-level accept is still visible.
    const retryAcceptButton = incomingTaskDiv.getByRole('button', {name: 'Accept'}).first();
    const isRetryButtonVisible = await retryAcceptButton.isVisible().catch(() => false);
    if (isRetryButtonVisible) {
      await retryAcceptButton.click({force: true, timeout: AWAIT_TIMEOUT});
      await page.waitForTimeout(2000);
    }
  }

  // For call tasks, click main Answer when available.
  // In some sample-app states, only this control is exposed.
  if (type === TASK_TYPES.CALL) {
    const mainAnswerButton = page.locator('#answer').first();

    // Check if Answer button appears (Desktop mode requires task routing first)
    const isAnswerVisible = await mainAnswerButton
      .waitFor({state: 'visible', timeout: 10000})
      .then(() => true)
      .catch(() => false);

    if (isAnswerVisible) {
      await expect(mainAnswerButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
      await page.waitForTimeout(2000);
      await mainAnswerButton.click({timeout: AWAIT_TIMEOUT});
      // Wait longer for call to connect and agent state to fully transition to Engaged
      await page.waitForTimeout(10000);
    }
    // If button didn't appear, task may already be routed (e.g., extension mode)
  }
}

/**
 * Declines an incoming task of the given type (call, chat, email, social).
 * Expects the incoming task to be already there.
 * @param page Playwright Page object
 * @param type Task type (see TASK_TYPES)
 * @throws Error if decline button is not found
 */
export async function declineIncomingTask(page: Page, type: TaskType) {
  await page.bringToFront();
  const incomingTaskDiv = getIncomingTaskLocator(page, type);

  if (type === TASK_TYPES.CALL) {
    const taskText = await incomingTaskDiv.innerText();
    if (taskText.includes(TEST_DATA.EXTENSION_CALL_INDICATOR)) {
      throw new Error('This is an extension call, use declineExtensionCall instead');
    }
  }

  await expect(incomingTaskDiv).toBeVisible({timeout: AWAIT_TIMEOUT});

  // Browser mode may expose Decline inside TaskList.
  const declineButton = incomingTaskDiv.getByRole('button', {name: 'Decline'}).first();
  const hasTaskListDecline = await declineButton.isVisible().catch(() => false);

  if (hasTaskListDecline) {
    await declineButton.click({timeout: AWAIT_TIMEOUT});
    await page.waitForTimeout(1000);

    return;
  }

  // Fallback for sample-app variants that only expose main #decline control.
  if (type === TASK_TYPES.CALL) {
    const mainDeclineButton = page.locator('#decline').first();
    const hasMainDecline = await mainDeclineButton.isVisible().catch(() => false);
    if (hasMainDecline) {
      await expect(mainDeclineButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
      await mainDeclineButton.click({timeout: AWAIT_TIMEOUT});
      await page.waitForTimeout(1000);

      return;
    }
  }

  throw new Error('Decline button not found');

  // Note: In Desktop mode with RONA, the task remains visible until agent handles the RONA popup
  // Don't wait for task to be hidden - let the calling test handle RONA flow
}

/**
 * Accepts an incoming extension call by clicking the right action button
 * Prerequisite: The calling webclient must be logged in, and an incoming call must be present.
 * @param page Playwright Page object
 */
export async function acceptExtensionCall(page: Page) {
  await page.bringToFront();
  await expect(page.locator('#answer').first()).toBeEnabled({
    timeout: EXTENSION_REGISTRATION_TIMEOUT,
  });
  await page.waitForTimeout(2000);
  await page.locator('#answer').first().click({timeout: AWAIT_TIMEOUT});
}

/**
 * Declines an incoming extension call by clicking the left action button.
 * @param page Playwright Page object
 */
export async function declineExtensionCall(page: Page) {
  await page.bringToFront();
  const endBtn = page.locator('#end').first();
  await expect(endBtn).toBeEnabled({timeout: AWAIT_TIMEOUT});
  await page.waitForTimeout(2000);
  await endBtn.click({timeout: AWAIT_TIMEOUT});
}

/**
 * Ends an ongoing extension call in the webex calling web-client by clicking the end call button.
 * @param page Playwright Page object
 */
export async function endExtensionCall(page: Page) {
  await page.bringToFront();
  const endBtn = page.locator('#end-call').first();
  await expect(endBtn).toBeEnabled({timeout: AWAIT_TIMEOUT});
  await endBtn.click({timeout: AWAIT_TIMEOUT});
}

/**
 * Logs into the web client for webex calling using the provided email and password.
 * Retries up to maxRetries on failure.
 * @param page Playwright Page object
 * @param email User email
 * @param password User password
 * @throws Error if login fails after maxRetries
 */
export async function loginExtension(page: Page, token: string) {
  await page.bringToFront();
  if (!token) {
    throw new Error('Token is required for loginExtension');
  }

  if (token.trim() === '') {
    throw new Error('Token cannot be empty strings for loginExtension');
  }

  await page.goto(CALL_URL);
  await page.locator('#access-token').fill(token);
  await page.locator('#access-token-save').click();
  await expect(page.locator('#registration-register')).toBeEnabled({
    timeout: EXTENSION_REGISTRATION_TIMEOUT,
  });
  await page.locator('#registration-register').click();
  await expect(page.locator('#registration-status')).toContainText('Registered, deviceId', {
    timeout: EXTENSION_REGISTRATION_TIMEOUT,
  });
  await page.locator('#sd-get-media-streams').click();
}

/**
 * Submits the RONA popup by selecting the given state and confirming.
 * @param page Playwright Page object
 * @param select State to select (e.g., 'Available', 'Idle')
 * @throws Error if the RONA state selection is not provided
 */
export async function submitRonaPopup(page: Page, nextState: RonaOption) {
  if (!nextState) {
    throw new Error('RONA next state selection is required');
  }
  await page.bringToFront();

  // Sample app uses #agentStatePopup (not widget testid)
  const popup = page.locator('#agentStatePopup');
  await popup.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});

  // Select the next state from dropdown
  const stateSelect = page.locator('#agentStateSelect');
  await expect(stateSelect).toBeVisible({timeout: AWAIT_TIMEOUT});

  // Map RONA option to actual dropdown value (Idle -> Meeting for sample app)
  let stateName = nextState;
  if (nextState === 'Idle') {
    stateName = 'Meeting'; // Sample app uses "Meeting" for idle state
  }

  await stateSelect.selectOption({label: stateName}, {timeout: AWAIT_TIMEOUT});
  await page.waitForTimeout(500);

  // Click Set State button
  const setStateButton = page.locator('#setAgentState');
  await expect(setStateButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
  await setStateButton.click({timeout: AWAIT_TIMEOUT});

  // Wait for popup to close
  await popup.waitFor({state: 'hidden', timeout: AWAIT_TIMEOUT});
}

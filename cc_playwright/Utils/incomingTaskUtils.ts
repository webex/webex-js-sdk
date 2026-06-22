/* eslint-disable no-await-in-loop, no-plusplus, no-continue */
import {Locator, Page, expect} from '@playwright/test';
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
import {clickDomButton, dismissAgentStatePopupIfPresent} from './controlUtils';

const transporter = nodemailer.createTransport({
  service: 'gmail', // Make sure to use Secure Port for Gmail SMTP
  auth: {
    user: process.env.PW_SENDER_EMAIL,
    pass: process.env.PW_SENDER_EMAIL_PASSWORD,
  },
});

function isCallingRegistrationStatusTextRegistered(text: string | null | undefined): boolean {
  const normalized = (text ?? '').trim().toLowerCase();

  return normalized.startsWith('registered');
}

export async function isCallingClientRegistered(page: Page): Promise<boolean> {
  const registrationStatus = page.locator('#registration-status');
  const statusText = await registrationStatus.textContent().catch(() => '');

  return isCallingRegistrationStatusTextRegistered(statusText);
}

export async function waitForCallingClientRegistered(
  page: Page,
  timeout = EXTENSION_REGISTRATION_TIMEOUT
): Promise<void> {
  await expect
    .poll(() => isCallingClientRegistered(page), {
      timeout,
      intervals: [500, 1000, 2000],
    })
    .toBeTruthy();
}

export const acceptCurrentTaskModel = (page: Page): Promise<boolean> =>
  page
    .evaluate(async () => {
      const task = (globalThis as typeof globalThis & {currentTask?: any}).currentTask;
      if (!task?.accept) {
        return false;
      }

      await task.accept();

      return true;
    })
    .catch(() => false);

export const declineCurrentTaskModel = (page: Page): Promise<boolean> =>
  page
    .evaluate(async () => {
      const task = (globalThis as typeof globalThis & {currentTask?: any}).currentTask;
      if (!task?.decline) {
        return false;
      }

      await task.decline();

      return true;
    })
    .catch(() => false);

export const endCurrentTaskModel = (page: Page, timeoutMs = 5000): Promise<boolean> =>
  page
    .evaluate(async (timeout) => {
      const task = (globalThis as typeof globalThis & {currentTask?: any}).currentTask;
      if (!task?.end) {
        return false;
      }

      return Promise.race([
        task
          .end()
          .then(() => true)
          .catch(() => false),
        new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(false), timeout);
        }),
      ]);
    }, timeoutMs)
    .catch(() => false);

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

  const isRegistered = await isCallingClientRegistered(page);

  if (!isRegistered) {
    const registerBtn = page.locator('#registration-register').first();
    const canRegister = await registerBtn.isEnabled().catch(() => false);
    if (canRegister) {
      await registerBtn.click({timeout: AWAIT_TIMEOUT});
    }
    await waitForCallingClientRegistered(page);
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
  await expect(page.locator('#create-call-action')).toBeEnabled({timeout: AWAIT_TIMEOUT});
  await page.locator('#create-call-action').click({timeout: AWAIT_TIMEOUT});

  await expect
    .poll(async () => endBtn.isEnabled().catch(() => false), {
      timeout: 15000,
      intervals: [500, 1000, 2000],
    })
    .toBeTruthy();

  const callStatus = page.locator('#call-object');
  await expect
    .poll(
      async () => {
        const endEnabled = await endBtn.isEnabled().catch(() => false);
        const statusText = (await callStatus.innerText().catch(() => '')).toLowerCase();
        const hasDialProgressText =
          statusText.includes('call progress') ||
          statusText.includes('call connect') ||
          statusText.includes('call established');
        const hasFailureText = statusText.includes('failed') || statusText.includes('error');

        if (hasFailureText) return false;

        return endEnabled || hasDialProgressText;
      },
      {timeout: 15000, intervals: [500, 1000, 2000]}
    )
    .toBeTruthy();
}

/**
 * Ends the current ongoing call in webex calling webclient.
 * Prerequisite: The calling webclient must be logged in.
 * @param page Playwright Page object
 */
export async function endCallTask(page: Page, isCaller = false) {
  await page.bringToFront();
  const mainEndBtn = page.locator('#end').first();
  const callerEndBtn = page.locator('#end-call').first();

  const endState = await expect
    .poll(
      async () => {
        const mainEndEnabled = await mainEndBtn.isEnabled().catch(() => false);
        const callerEndEnabled = await callerEndBtn.isEnabled().catch(() => false);
        if (mainEndEnabled || callerEndEnabled) {
          return 'endable';
        }

        const incomingText = (
          await page
            .locator('#incoming-task')
            .innerText()
            .catch(() => '')
        )
          .toLowerCase()
          .trim();
        const taskListText = (
          await page
            .locator('#taskList')
            .innerText()
            .catch(() => '')
        )
          .toLowerCase()
          .trim();
        const hasClearedIncomingTask =
          incomingText === '' || incomingText.includes('no incoming tasks');
        const hasClearedTaskList =
          taskListText === '' || taskListText.includes('no tasks available');

        return hasClearedIncomingTask && hasClearedTaskList ? 'gone' : 'waiting';
      },
      {timeout: AWAIT_TIMEOUT, intervals: [500, 1000, 2000]}
    )
    .not.toBe('waiting')
    .then(async () => {
      const mainEndEnabled = await mainEndBtn.isEnabled().catch(() => false);
      const callerEndEnabled = await callerEndBtn.isEnabled().catch(() => false);

      if (mainEndEnabled || callerEndEnabled) {
        return 'endable';
      }

      return 'gone';
    });

  if (endState === 'gone') {
    return;
  }

  const mainEndEnabled = await mainEndBtn.isEnabled().catch(() => false);
  const callerEndEnabled = await callerEndBtn.isEnabled().catch(() => false);
  const endBtn = (isCaller || !mainEndEnabled) && callerEndEnabled ? callerEndBtn : mainEndBtn;

  await endBtn.click({timeout: AWAIT_TIMEOUT});
}

/**
 * Creates a chat task by going to the chat client and submitting required info.
 * Retries up to maxRetries on failure.
 * @param page Playwright Page object
 */
export async function createChatTask(page: Page, chatURL: string) {
  const maxAttempts = DEFAULT_MAX_RETRIES + 4;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await page.goto(chatURL, {waitUntil: 'domcontentloaded', timeout: 45000});
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
        .waitFor({state: 'visible', timeout: FORM_FIELD_TIMEOUT});
      await page
        .locator(`iframe[name="${CHAT_UI.IFRAME_CONVERSATION}"]`)
        .contentFrame()
        .getByRole('textbox', {name: CHAT_UI.TEXTBOX_NAME})
        .click({timeout: FORM_FIELD_TIMEOUT});
      await page
        .locator(`iframe[name="${CHAT_UI.IFRAME_CONVERSATION}"]`)
        .contentFrame()
        .getByRole('textbox', {name: CHAT_UI.TEXTBOX_NAME})
        .fill(TEST_DATA.CHAT_NAME, {timeout: FORM_FIELD_TIMEOUT});
      await page
        .locator(`iframe[name="${CHAT_UI.IFRAME_CONVERSATION}"]`)
        .contentFrame()
        .getByRole('textbox', {name: CHAT_UI.TEXTBOX_NAME})
        .fill(TEST_DATA.CHAT_NAME, {timeout: FORM_FIELD_TIMEOUT});
      await page
        .locator(`iframe[name="${CHAT_UI.IFRAME_CONVERSATION}"]`)
        .contentFrame()
        .getByRole('button', {name: CHAT_UI.BUTTON_SUBMIT_NAME})
        .waitFor({state: 'visible', timeout: FORM_FIELD_TIMEOUT});
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
      ).toBeVisible({timeout: FORM_FIELD_TIMEOUT});
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
      ).toBeVisible({timeout: FORM_FIELD_TIMEOUT});
      await page
        .locator('iframe[name="Conversation Window"]')
        .contentFrame()
        .getByRole('button', {name: 'Submit Email'})
        .click({timeout: AWAIT_TIMEOUT});
      break;
    } catch (error) {
      const errorMessage = String(error);
      const isDnsResolutionError = errorMessage.includes('ERR_NAME_NOT_RESOLVED');
      const isLastAttempt = i === maxAttempts - 1;

      if (isLastAttempt) {
        throw new Error(`Failed to load chat client after ${maxAttempts} attempts: ${error}`);
      }

      const backoffMs = isDnsResolutionError ? 5000 * (i + 1) : 2000;
      await page.waitForTimeout(backoffMs);
      await page.goto('about:blank').catch(() => false);
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
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const mailOptions = {
        from,
        to,
        subject,
        text,
      };
      await transporter.sendMail(mailOptions);

      return;
    } catch (error) {
      lastError = error;
      const message = String(error).toLowerCase();
      const isTransientSocketError =
        message.includes('socket') ||
        message.includes('econnreset') ||
        message.includes('etimedout') ||
        message.includes('timeout') ||
        message.includes('connection');

      if (!isTransientSocketError || attempt === 2) {
        break;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 3000 * (attempt + 1));
      });
    }
  }

  throw new Error(`Failed to send email after retries: ${lastError}`);
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

async function getDigitalIncomingTaskLocator(page: Page, type: TaskType): Promise<Locator> {
  const taskItems = page.locator('#taskList .task-item-content');
  const taskCount = await taskItems.count().catch(() => 0);
  const expectedText =
    type === TASK_TYPES.EMAIL ? (process.env.PW_SENDER_EMAIL ?? '').toLowerCase() : '';

  for (let index = 0; index < taskCount; index += 1) {
    const taskItem = taskItems.nth(index);
    const text = (await taskItem.innerText().catch(() => '')).toLowerCase();

    if (type === TASK_TYPES.CHAT && text.includes(TEST_DATA.CHAT_EMAIL.toLowerCase())) {
      return taskItem;
    }

    if (type === TASK_TYPES.EMAIL && expectedText && text.includes(expectedText)) {
      return taskItem;
    }
  }

  return taskItems.first();
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
  let incomingTaskDiv = getIncomingTaskLocator(page, type);

  if (type === TASK_TYPES.CALL) {
    const incomingTaskSummary = page.locator('#incoming-task').first();
    const mainAnswerButton = page.locator('#answer').first();

    await expect
      .poll(
        async () => {
          const taskListVisible = await incomingTaskDiv.isVisible().catch(() => false);
          const incomingText = (
            await incomingTaskSummary.innerText().catch(() => '')
          ).toLowerCase();
          const hasIncomingSummary =
            incomingText !== '' && !incomingText.includes('no incoming tasks');
          const answerEnabled = await mainAnswerButton
            .evaluate((el) => !(el as HTMLButtonElement).disabled)
            .catch(() => false);

          return taskListVisible || hasIncomingSummary || answerEnabled;
        },
        {timeout, intervals: [500, 1000, 2000]}
      )
      .toBeTruthy();

    const taskListVisible = await incomingTaskDiv.isVisible().catch(() => false);
    if (taskListVisible) {
      return incomingTaskDiv;
    }

    return incomingTaskSummary;
  }

  const expectedType = type.toLowerCase();
  await expect
    .poll(
      async () => {
        const taskItems = page.locator('#taskList .task-item-content');
        const taskCount = await taskItems.count().catch(() => 0);
        if (taskCount === 0) {
          return false;
        }

        const [incomingText, mediaType] = await Promise.all([
          page
            .locator('#incoming-task')
            .first()
            .innerText()
            .catch(() => ''),
          page
            .evaluate(() => {
              const task = (globalThis as typeof globalThis & {currentTask?: any}).currentTask;

              return String(task?.data?.interaction?.mediaType ?? '').toLowerCase();
            })
            .catch(() => ''),
        ]);
        const normalizedText = incomingText.toLowerCase();
        const taskTexts = await taskItems
          .evaluateAll((items) => items.map((item) => (item.textContent ?? '').toLowerCase()))
          .catch(() => []);
        const emailSender = (process.env.PW_SENDER_EMAIL ?? '').toLowerCase();
        const hasMatchingTaskItem =
          (type === TASK_TYPES.CHAT &&
            taskTexts.some((text) => text.includes(TEST_DATA.CHAT_EMAIL.toLowerCase()))) ||
          (type === TASK_TYPES.EMAIL &&
            Boolean(emailSender) &&
            taskTexts.some((text) => text.includes(emailSender)));

        return (
          hasMatchingTaskItem ||
          mediaType === expectedType ||
          normalizedText.includes(`${expectedType} from`) ||
          (expectedType === 'chat' && normalizedText.includes('social from'))
        );
      },
      {timeout, intervals: [500, 1000, 2000]}
    )
    .toBeTruthy();
  incomingTaskDiv = await getDigitalIncomingTaskLocator(page, type);

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

  await dismissAgentStatePopupIfPresent(page, {requireSetStateEnabled: true, settleMs: 1000});

  const incomingTaskDiv =
    type === TASK_TYPES.CALL
      ? await (async () => {
          const taskListItem = getIncomingTaskLocator(page, type);
          const incomingTaskSummary = page.locator('#incoming-task').first();
          const taskListAcceptButton = taskListItem.getByRole('button', {name: 'Accept'}).first();
          const mainAnswerButton = page.locator('#answer').first();

          const taskListVisible = await taskListItem.isVisible().catch(() => false);
          const taskListAcceptVisible = await taskListAcceptButton.isVisible().catch(() => false);
          const mainAnswerEnabled = await mainAnswerButton
            .evaluate((el) => !(el as HTMLButtonElement).disabled)
            .catch(() => false);
          const incomingText = (
            await incomingTaskSummary.innerText().catch(() => '')
          ).toLowerCase();
          const hasIncomingSummary =
            incomingText !== '' && !incomingText.includes('no incoming tasks');

          if (taskListVisible || taskListAcceptVisible) {
            return taskListItem;
          }

          if (mainAnswerEnabled || hasIncomingSummary) {
            return incomingTaskSummary;
          }

          return waitForIncomingTask(page, type, timeout);
        })()
      : await waitForIncomingTask(page, type, timeout);

  // Check if this is an extension call (only for CALL type)
  if (type === TASK_TYPES.CALL) {
    const [incomingTaskText, taskListText, incomingSummaryText] = await Promise.all([
      incomingTaskDiv.innerText().catch(() => ''),
      getIncomingTaskLocator(page, type)
        .innerText()
        .catch(() => ''),
      page
        .locator('#incoming-task')
        .first()
        .innerText()
        .catch(() => ''),
    ]);
    if (
      [incomingTaskText, taskListText, incomingSummaryText].some((text) =>
        text.includes(TEST_DATA.EXTENSION_CALL_INDICATOR)
      )
    ) {
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

  if (type === TASK_TYPES.CHAT || type === TASK_TYPES.EMAIL || type === TASK_TYPES.SOCIAL) {
    const mainAnswerButton = page.locator('#answer').first();
    const taskListAcceptButton = incomingTaskDiv.getByRole('button', {name: 'Accept'}).first();

    const clickDigitalAcceptControl = async (): Promise<void> => {
      const acceptedFromTaskList = await taskListAcceptButton
        .click({force: true, timeout: 5000})
        .then(() => true)
        .catch(() => false);

      if (!acceptedFromTaskList) {
        await clickDomButton(page, '#answer');
      }
    };

    const getDigitalAcceptanceState = async (): Promise<boolean> => {
      const endEnabled = await page
        .locator('#end')
        .first()
        .evaluate((el) => !(el as HTMLButtonElement).disabled)
        .catch(() => false);
      const acceptStillVisible = await incomingTaskDiv
        .getByRole('button', {name: 'Accept'})
        .first()
        .isVisible()
        .catch(() => false);
      const mainAnswerStillVisible = await mainAnswerButton.isVisible().catch(() => false);
      const incomingTaskText = `${await page
        .locator('#incoming-task')
        .first()
        .innerText()
        .catch(() => '')} ${await incomingTaskDiv.innerText().catch(() => '')}`.toLowerCase();
      const taskState = await page
        .evaluate(() => {
          const task = (globalThis as typeof globalThis & {currentTask?: any}).currentTask;
          const state = String(
            task?.data?.interaction?.state ?? task?.data?.state ?? task?.state ?? ''
          ).toLowerCase();
          const interactionId = String(
            task?.data?.interactionId ??
              task?.data?.interaction?.interactionId ??
              task?.interactionId ??
              task?.id ??
              ''
          );

          return {
            exists: Boolean(task),
            interactionId,
            state,
          };
        })
        .catch(() => ({exists: false, interactionId: '', state: ''}));
      const acceptControlStillVisible = acceptStillVisible || mainAnswerStillVisible;
      const taskLooksAccepted =
        incomingTaskText.includes('connected') ||
        incomingTaskText.includes('accepted') ||
        incomingTaskText.includes('active') ||
        ['connected', 'accepted', 'active', 'assigned'].includes(taskState.state);

      return !acceptControlStillVisible && (endEnabled || (taskState.exists && taskLooksAccepted));
    };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const acceptedAfterClick = await expect
        .poll(getDigitalAcceptanceState, {timeout: 12000, intervals: [500, 1000, 2000]})
        .toBeTruthy()
        .then(() => true)
        .catch(() => false);

      if (acceptedAfterClick) {
        return;
      }

      await clickDigitalAcceptControl();
      await acceptCurrentTaskModel(page);
      await page.waitForTimeout(2000);
    }

    await expect
      .poll(getDigitalAcceptanceState, {timeout: 30000, intervals: [500, 1000, 2000]})
      .toBeTruthy();
  }

  // For call tasks, click main Answer when available.
  // In some sample-app states, only this control is exposed.
  if (type === TASK_TYPES.CALL) {
    await dismissAgentStatePopupIfPresent(page, {requireSetStateEnabled: true, settleMs: 1000});
    const mainAnswerButton = page.locator('#answer').first();
    const taskListAcceptButton = page
      .locator('#taskList')
      .getByRole('button', {name: 'Accept'})
      .first();
    const hasEnabledControl = (selector: string): Promise<boolean> =>
      page
        .locator(selector)
        .evaluateAll((elements) => elements.some((el) => !(el as HTMLButtonElement).disabled))
        .catch(() => false);

    const getCallAcceptanceState = async (): Promise<
      'connected' | 'answerable' | 'accepted' | 'waiting'
    > => {
      const taskText = `${await page
        .locator('#incoming-task')
        .first()
        .innerText({timeout: 500})
        .catch(() => '')} ${await page
        .locator('#taskList')
        .innerText({timeout: 500})
        .catch(() => '')}`.toLowerCase();
      const endEnabled = await hasEnabledControl('#end');
      const transferEnabled = await hasEnabledControl('#transfer');
      const answerEnabled = await mainAnswerButton
        .evaluate((el) => !(el as HTMLButtonElement).disabled)
        .catch(() => false);
      const taskListAcceptEnabled = await taskListAcceptButton
        .isEnabled({timeout: 500})
        .catch(() => false);
      const taskAccepted = taskText.includes('task accepted');
      const taskListCleared =
        taskText.includes('no tasks available') && !taskText.includes('call from');

      if (
        taskText.includes('connected') ||
        taskText.includes('consulting') ||
        taskText.includes('beingconsultedaccepted') ||
        endEnabled ||
        transferEnabled
      ) {
        return 'connected';
      }

      if (taskAccepted || taskListCleared) {
        return 'accepted';
      }

      if (answerEnabled || taskListAcceptEnabled) {
        return 'answerable';
      }

      return 'waiting';
    };

    for (let attempt = 0; attempt < 3; attempt += 1) {
      let callAcceptanceState = await expect
        .poll(getCallAcceptanceState, {timeout: 10000, intervals: [500, 1000, 2000]})
        .not.toBe('waiting')
        .then(() => getCallAcceptanceState())
        .catch(() => 'waiting' as const);

      if (callAcceptanceState === 'connected') {
        return;
      }

      if (callAcceptanceState === 'waiting') {
        const directAccepted = await acceptCurrentTaskModel(page);
        if (directAccepted) {
          await page.waitForTimeout(3000);
          callAcceptanceState = await expect
            .poll(getCallAcceptanceState, {timeout: 10000, intervals: [500, 1000, 2000]})
            .not.toBe('waiting')
            .then(() => getCallAcceptanceState())
            .catch(() => 'waiting' as const);
        }
      }

      if (callAcceptanceState === 'connected') {
        return;
      }

      if (callAcceptanceState === 'accepted') {
        callAcceptanceState = await expect
          .poll(getCallAcceptanceState, {timeout: 15000, intervals: [500, 1000, 2000]})
          .toBe('connected')
          .then(() => 'connected' as const)
          .catch(() => 'accepted' as const);
      }

      if (callAcceptanceState === 'connected') {
        return;
      }

      if (callAcceptanceState === 'accepted') {
        throw new Error('Call task accepted, but connected controls did not initialize');
      }

      if (callAcceptanceState === 'answerable') {
        await page.waitForTimeout(1000);
        await taskListAcceptButton.click({force: true, timeout: 5000}).catch(() => false);
        await page.waitForTimeout(2500);
        callAcceptanceState = await getCallAcceptanceState();

        if (callAcceptanceState !== 'connected') {
          await acceptCurrentTaskModel(page);
          await clickDomButton(page, '#answer');
          await page.waitForTimeout(2500);
        }
      }
    }

    await expect
      .poll(getCallAcceptanceState, {
        timeout: Math.max(timeout, 30000),
        intervals: [500, 1000, 2000],
      })
      .toBe('connected');
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
  await dismissAgentStatePopupIfPresent(page, {requireSetStateEnabled: true, settleMs: 1000});
  const incomingTaskDiv = getIncomingTaskLocator(page, type);
  const mainDeclineButton = page.locator('#decline').first();

  if (type === TASK_TYPES.CALL) {
    const taskText = await incomingTaskDiv.innerText().catch(() => '');
    if (taskText.includes(TEST_DATA.EXTENSION_CALL_INDICATOR)) {
      throw new Error('This is an extension call, use declineExtensionCall instead');
    }
  }

  const incomingVisible = await incomingTaskDiv.isVisible().catch(() => false);
  const hasMainDecline = await mainDeclineButton.isVisible().catch(() => false);
  if (!incomingVisible && !hasMainDecline) {
    await expect(incomingTaskDiv).toBeVisible({timeout: AWAIT_TIMEOUT});
  }

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
    if (hasMainDecline) {
      await expect(mainDeclineButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
      await mainDeclineButton.click({timeout: AWAIT_TIMEOUT});
      await page.waitForTimeout(1000);

      return;
    }

    const declinedViaTaskModel = await page
      .evaluate(async () => {
        const task = (globalThis as typeof globalThis & {currentTask?: any}).currentTask;
        if (!task || typeof task.decline !== 'function') {
          return false;
        }

        await task.decline();

        return true;
      })
      .catch(() => false);
    if (declinedViaTaskModel) {
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
  const answerBtn = page.locator('#answer').first();
  const endCallBtn = page.locator('#end-call').first();
  const callStatus = page.locator('#call-object');

  await expect
    .poll(
      async () => {
        const answerEnabled = await answerBtn
          .evaluate((el) => !(el as HTMLButtonElement).disabled)
          .catch(() => false);
        const alreadyConnected = await endCallBtn
          .evaluate((el) => !(el as HTMLButtonElement).disabled)
          .catch(() => false);
        const statusText = (await callStatus.innerText().catch(() => '')).toLowerCase();
        const statusConnected =
          statusText.includes('call established') || statusText.includes('connected');

        return answerEnabled || alreadyConnected || statusConnected;
      },
      {timeout: EXTENSION_REGISTRATION_TIMEOUT, intervals: [500, 1000, 2000]}
    )
    .toBeTruthy();

  const canAnswer = await answerBtn
    .evaluate((el) => !(el as HTMLButtonElement).disabled)
    .catch(() => false);
  if (!canAnswer) return;

  await page.waitForTimeout(1000);
  await clickDomButton(page, '#answer');
}

export async function declineExtensionCall(page: Page) {
  await page.bringToFront();
  await page.waitForTimeout(2000);
  await page.evaluate(() => {
    const callObj = (window as unknown as {call?: {end?: () => void}}).call;
    callObj?.end?.();
  });
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

  const maxLoginAttempts = 3;

  const performLoginAttempt = async (): Promise<void> => {
    await page.goto(CALL_URL, {waitUntil: 'domcontentloaded', timeout: 45000});
    if (page.url().startsWith('chrome-error://')) {
      throw new Error('Calling sample opened Chrome error page');
    }

    await page.locator('#access-token').fill(token);
    await page.locator('#access-token-save').click();
    const authStatus = page.locator('#access-token-status');
    const registerButton = page.locator('#registration-register');
    const unregisterButton = page.locator('#registration-unregister');
    const createCallButton = page.locator('#create-call-action');

    await expect
      .poll(
        async () => {
          const authText = ((await authStatus.textContent().catch(() => '')) ?? '').toLowerCase();

          if (authText.includes('saved access token')) {
            return 'ready';
          }

          const canRegister = await registerButton.isEnabled().catch(() => false);
          if (canRegister) {
            return 'ready';
          }

          const canUnregister = await unregisterButton.isEnabled().catch(() => false);
          if (canUnregister && (await isCallingClientRegistered(page))) {
            return 'ready';
          }

          return 'waiting';
        },
        {timeout: EXTENSION_REGISTRATION_TIMEOUT, intervals: [500, 1000, 2000]}
      )
      .not.toBe('waiting');

    const alreadyRegistered = await isCallingClientRegistered(page);
    if (alreadyRegistered) {
      await page
        .locator('#sd-get-media-streams')
        .click()
        .catch(() => {});
      const callReady = await expect
        .poll(() => createCallButton.isEnabled().catch(() => false), {
          timeout: EXTENSION_REGISTRATION_TIMEOUT,
          intervals: [500, 1000, 2000],
        })
        .toBeTruthy()
        .then(() => true)
        .catch(() => false);

      if (callReady) {
        return;
      }

      const canUnregister = await unregisterButton.isEnabled().catch(() => false);
      if (!canUnregister) {
        throw new Error('Calling client is registered but create call never became ready');
      }

      await unregisterButton.click().catch(() => {});
      await expect
        .poll(
          async () => {
            const stillRegistered = await isCallingClientRegistered(page);
            const canRegister = await registerButton.isEnabled().catch(() => false);

            return !stillRegistered && canRegister;
          },
          {timeout: EXTENSION_REGISTRATION_TIMEOUT, intervals: [500, 1000, 2000]}
        )
        .toBeTruthy();
    }

    await expect(registerButton).toBeEnabled({timeout: EXTENSION_REGISTRATION_TIMEOUT});
    await registerButton.click();
    await waitForCallingClientRegistered(page);

    await page.locator('#sd-get-media-streams').click();
    await expect
      .poll(() => createCallButton.isEnabled().catch(() => false), {
        timeout: EXTENSION_REGISTRATION_TIMEOUT,
        intervals: [500, 1000, 2000],
      })
      .toBeTruthy();
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < maxLoginAttempts; attempt += 1) {
    try {
      await performLoginAttempt();

      return;
    } catch (error) {
      lastError = error;
      if (attempt === maxLoginAttempts - 1) {
        break;
      }

      if (page.isClosed()) {
        break;
      }

      const unregisterButton = page.locator('#registration-unregister');
      const canUnregister = await unregisterButton.isEnabled().catch(() => false);
      if (canUnregister) {
        await unregisterButton.click().catch(() => {});
      }

      await page
        .goto('about:blank', {waitUntil: 'domcontentloaded', timeout: 5000})
        .catch(() => {});

      await page.waitForTimeout(1500 * (attempt + 1));
    }
  }

  throw new Error(`Failed to login extension after ${maxLoginAttempts} attempts: ${lastError}`);
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

  const setStateButton = page.locator('#setAgentState');
  const hideStalePopup = async (): Promise<void> => {
    await page.keyboard.press('Escape').catch(() => {});
    await popup
      .evaluate((element) => {
        const popupElement = element as HTMLElement;
        popupElement.classList.add('hidden');
        popupElement.hidden = true;
        popupElement.style.display = 'none';
        popupElement.setAttribute('aria-hidden', 'true');
      })
      .catch(() => {});
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await stateSelect.selectOption({label: stateName}, {timeout: AWAIT_TIMEOUT}).catch(() => {});
    await expect(setStateButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
    const clicked = await setStateButton
      .click({timeout: AWAIT_TIMEOUT})
      .then(() => true)
      .catch(() =>
        setStateButton
          .click({force: true, timeout: AWAIT_TIMEOUT})
          .then(() => true)
          .catch(() => false)
      );

    if (!clicked) {
      await clickDomButton(page, '#setAgentState');
    }

    const closed = await popup
      .waitFor({state: 'hidden', timeout: 5000})
      .then(() => true)
      .catch(() => false);
    if (closed) {
      return;
    }

    await clickDomButton(page, '#setAgentState').catch(() => {});
    const closedAfterDomClick = await popup
      .waitFor({state: 'hidden', timeout: 5000})
      .then(() => true)
      .catch(() => false);
    if (closedAfterDomClick) {
      return;
    }

    const stateApplied = await page
      .locator('#idleCodesDropdown')
      .evaluate((element, expectedState) => {
        const select = element as HTMLSelectElement;
        const selected = select.options[select.selectedIndex];

        return selected?.text?.trim() === expectedState;
      }, stateName)
      .catch(() => false);
    const taskReoffered =
      stateName === 'Available' &&
      (await page
        .locator('#taskList .task-item-content')
        .first()
        .getByRole('button', {name: 'Accept'})
        .isVisible()
        .catch(() => false));

    if (stateApplied || taskReoffered) {
      await hideStalePopup();

      return;
    }

    await page.waitForTimeout(500);
  }

  await popup.waitFor({state: 'hidden', timeout: AWAIT_TIMEOUT});
}

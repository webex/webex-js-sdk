/* eslint-disable import/no-extraneous-dependencies */
import {expect, Locator, Page} from '@playwright/test';
import {
  ACCEPT_TASK_TIMEOUT,
  AWAIT_TIMEOUT,
  CALL_URL,
  EXTENSION_REGISTRATION_TIMEOUT,
  FORM_FIELD_TIMEOUT,
  RonaOption,
  TASK_TYPES,
  TaskType,
  TEST_DATA,
  UI_SETTLE_TIMEOUT,
} from '../constants';

function getIncomingRegex(type: TaskType): RegExp {
  if (type === TASK_TYPES.CALL) {
    return /call from|ringing/i;
  }
  if (type === TASK_TYPES.CHAT) {
    return /chat from/i;
  }
  if (type === TASK_TYPES.EMAIL) {
    return /email from/i;
  }

  return /social/i;
}

export async function createCallTask(page: Page, number: string): Promise<void> {
  await page.bringToFront();
  if (!number || !number.trim()) {
    throw new Error('Dial number is required');
  }

  const endCallButton = page.locator('#end-call').first();
  if (await endCallButton.isEnabled().catch(() => false)) {
    await endCallButton.click({timeout: AWAIT_TIMEOUT}).catch(() => {});
    await page.waitForTimeout(500);
  }

  await page.locator('#destination').fill(number, {timeout: AWAIT_TIMEOUT});
  await expect(page.locator('#create-call-action')).toBeVisible({timeout: AWAIT_TIMEOUT});
  await page.locator('#create-call-action').click({timeout: AWAIT_TIMEOUT});
}

export async function endCallTask(page: Page, isCaller = false): Promise<void> {
  await page.bringToFront();
  const endLocator = isCaller ? page.locator('#end-call').first() : page.locator('#end').first();
  await expect(endLocator).toBeEnabled({timeout: AWAIT_TIMEOUT});
  await endLocator.click({timeout: AWAIT_TIMEOUT});
}

export async function createChatTask(page: Page, chatURL: string): Promise<void> {
  await page.goto(chatURL, {waitUntil: 'domcontentloaded'});
  await page.waitForTimeout(UI_SETTLE_TIMEOUT);

  const launcherFrame = page.locator('iframe[name="Livechat launcher icon"]').contentFrame();
  await launcherFrame.getByRole('button', {name: /Livechat Button/i}).click({timeout: 60000});

  const conversationFrame = page.locator('iframe[name="Conversation Window"]').contentFrame();
  await conversationFrame
    .getByRole('button', {name: 'Hit Us Up!'})
    .click({timeout: FORM_FIELD_TIMEOUT});
  await conversationFrame
    .getByRole('textbox', {name: 'Name'})
    .fill(TEST_DATA.CHAT_NAME, {timeout: AWAIT_TIMEOUT});
  await conversationFrame
    .getByRole('button', {name: 'Submit Name'})
    .click({timeout: AWAIT_TIMEOUT});
  await conversationFrame
    .getByRole('textbox', {name: 'Email*'})
    .fill(TEST_DATA.CHAT_EMAIL, {timeout: AWAIT_TIMEOUT});
  await conversationFrame
    .getByRole('button', {name: 'Submit Email'})
    .click({timeout: AWAIT_TIMEOUT});
}

export async function endChatTask(page: Page): Promise<void> {
  const conversationFrame = page.locator('iframe[name="Conversation Window"]').contentFrame();
  await conversationFrame.getByRole('button', {name: 'Menu'}).click({timeout: AWAIT_TIMEOUT});
  await conversationFrame.getByText('End chat').click({timeout: AWAIT_TIMEOUT});
  await conversationFrame
    .getByRole('button', {name: 'End', exact: true})
    .click({timeout: AWAIT_TIMEOUT});
}

export async function createEmailTask(to: string): Promise<void> {
  const sender = process.env.PW_SENDER_EMAIL;
  const senderPassword = process.env.PW_SENDER_EMAIL_PASSWORD;

  if (!sender || !senderPassword) {
    throw new Error(
      'PW_SENDER_EMAIL and PW_SENDER_EMAIL_PASSWORD are required to send email tasks'
    );
  }

  // eslint-disable-next-line import/no-unresolved
  const {default: nodemailer} = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {user: sender, pass: senderPassword},
  });

  await transporter.sendMail({
    from: sender,
    to,
    subject: `Playwright Test Email - ${new Date().toISOString()}`,
    text: TEST_DATA.EMAIL_TEXT,
  });
}

export function getIncomingTaskLocator(page: Page): Locator {
  return page.locator('#incoming-task');
}

export async function waitForIncomingTask(
  page: Page,
  type: TaskType,
  timeout: number = ACCEPT_TASK_TIMEOUT
): Promise<Locator> {
  await page.bringToFront();

  const expectedPattern = getIncomingRegex(type);
  await page.waitForFunction(
    ({pattern}) => {
      const incomingText = (
        document.querySelector('#incoming-task')?.textContent || ''
      ).toLowerCase();
      const hasIncomingSummary = new RegExp(pattern, 'i').test(incomingText);
      const hasTaskItem = document.querySelectorAll('#taskList .task-item').length > 0;

      return hasIncomingSummary || hasTaskItem;
    },
    {pattern: expectedPattern.source},
    {timeout}
  );

  return page.locator('#incoming-task');
}

async function clickFirstEnabled(page: Page, selectors: string[]): Promise<void> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    // eslint-disable-next-line no-await-in-loop
    const visible = await locator.isVisible().catch(() => false);
    // eslint-disable-next-line no-await-in-loop
    const enabled = await locator.isEnabled().catch(() => false);

    if (visible && enabled) {
      // eslint-disable-next-line no-await-in-loop
      await locator.click({timeout: AWAIT_TIMEOUT});

      return;
    }
  }

  throw new Error(`No enabled element found for selectors: ${selectors.join(', ')}`);
}

export async function acceptIncomingTask(
  page: Page,
  type: TaskType,
  timeout: number = ACCEPT_TASK_TIMEOUT
): Promise<void> {
  const incoming = await waitForIncomingTask(page, type, timeout);

  if (type === TASK_TYPES.CALL) {
    const text = await incoming.innerText().catch(() => '');
    if (text.includes(TEST_DATA.EXTENSION_CALL_INDICATOR)) {
      throw new Error(
        'Incoming task is an extension call. Use acceptExtensionCall on extension page.'
      );
    }
  }

  await clickFirstEnabled(page, ['#taskList .accept-task', '#answer']);
  await page.waitForTimeout(1200);
}

export async function declineIncomingTask(page: Page): Promise<void> {
  await clickFirstEnabled(page, ['#taskList .decline-task', '#decline']);
  await page.waitForTimeout(800);
}

export async function acceptExtensionCall(page: Page): Promise<void> {
  await page.bringToFront();
  const answerButton = page.locator('#answer').first();
  await expect(answerButton).toBeEnabled({timeout: EXTENSION_REGISTRATION_TIMEOUT});
  await answerButton.click({timeout: AWAIT_TIMEOUT});
}

export async function declineExtensionCall(page: Page): Promise<void> {
  await page.bringToFront();
  const endButton = page.locator('#end').first();
  await expect(endButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
  await endButton.click({timeout: AWAIT_TIMEOUT});
}

export async function endExtensionCall(page: Page): Promise<void> {
  await page.bringToFront();
  const endButton = page.locator('#end-call').first();
  await expect(endButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
  await endButton.click({timeout: AWAIT_TIMEOUT});
}

export async function loginExtension(page: Page, token: string): Promise<void> {
  if (!token || !token.trim()) {
    throw new Error('Token is required for loginExtension');
  }

  await page.goto(CALL_URL, {waitUntil: 'domcontentloaded'});
  await page.locator('#access-token').fill(token, {timeout: AWAIT_TIMEOUT});
  await page.locator('#access-token-save').click({timeout: AWAIT_TIMEOUT});

  await expect(page.locator('#registration-register')).toBeEnabled({
    timeout: EXTENSION_REGISTRATION_TIMEOUT,
  });
  await page.locator('#registration-register').click({timeout: AWAIT_TIMEOUT});

  await expect(page.locator('#registration-status')).toContainText('Registered', {
    timeout: EXTENSION_REGISTRATION_TIMEOUT,
  });

  await page.locator('#sd-get-media-streams').click({timeout: AWAIT_TIMEOUT});
}

export async function submitRonaPopup(page: Page, nextState: RonaOption): Promise<void> {
  if (!nextState) {
    throw new Error('RONA next state selection is required');
  }

  const popup = page.locator('#agentStatePopup');
  await popup.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});

  const stateSelect = page.locator('#agentStateSelect');
  await stateSelect.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});

  const options = await stateSelect.locator('option').evaluateAll((nodes) =>
    nodes
      .map((node) => ({
        value: (node as HTMLOptionElement).value,
        label: ((node as HTMLOptionElement).textContent || '').trim(),
      }))
      .filter((opt) => opt.label.length > 0)
  );

  let target = options.find((opt) => opt.label.toLowerCase() === nextState.toLowerCase());
  if (!target && nextState.toLowerCase() === 'idle') {
    target = options.find((opt) => /meeting|idle/i.test(opt.label)) || options[0];
  }
  if (!target && nextState.toLowerCase() === 'available') {
    target = options.find((opt) => /available/i.test(opt.label));
  }

  if (!target) {
    throw new Error(`No RONA option available for requested state '${nextState}'`);
  }

  await stateSelect.selectOption({value: target.value});
  await page.locator('#setAgentState').click({timeout: AWAIT_TIMEOUT});
  await popup.waitFor({state: 'hidden', timeout: AWAIT_TIMEOUT}).catch(() => {});
}

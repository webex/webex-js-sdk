/* eslint-disable import/no-extraneous-dependencies */
import {Page} from '@playwright/test';
import {OPERATION_TIMEOUT, ThemeColor, userState} from '../constants';

export const SELECTOR_MAP = {
  authTypeSelect: 'auth-type',
  accessTokenInput: 'access-token',
  accessTokenSubmit: 'access-token-save',
  accessTokenStatus: 'access-token-status',
  oauthLoginButton: 'oauth-login-btn',
  oauthStatus: 'oauth-status',
  registerButton: 'webexcc-register',
  deregisterButton: 'webexcc-deregister',
  wsConnectionStatus: 'ws-connection-status',
  teamsDropdown: 'teamsDropdown',
  agentLoginSelect: 'AgentLogin',
  dialNumberInput: 'dialNumber',
  loginButton: 'loginAgent',
  logoutButton: 'logoutAgent',
  idleCodesDropdown: 'idleCodesDropdown',
  setAgentStatusButton: 'setAgentStatus',
  timerDisplay: 'timerDisplay',
  incomingTaskDetails: 'incoming-task',
  answerButton: 'answer',
  declineButton: 'decline',
  holdResumeButton: 'hold-resume',
  endButton: 'end',
  wrapupButton: 'wrapup',
  wrapupCodesDropdown: 'wrapupCodesDropdown',
  taskList: 'taskList',
  ronaPopup: 'agentStatePopup',
  ronaSelect: 'agentStateSelect',
  ronaConfirm: 'setAgentState',
} as const;

export type SelectorKey = keyof typeof SELECTOR_MAP;

export function getSelector(key: SelectorKey): string {
  return `#${SELECTOR_MAP[key]}`;
}

export function getId(key: SelectorKey): string {
  return SELECTOR_MAP[key];
}

export function requireEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Environment variable ${key} is required but was not provided`);
  }

  return value;
}

export function parseTimeString(timeString: string): number {
  const parts = timeString.split(':').map((part) => Number.parseInt(part, 10) || 0);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

/**
 * Generic polling utility that avoids await-in-loop
 * @param condition - Function that returns true when condition is met
 * @param timeoutMs - Maximum time to wait
 * @param intervalMs - Interval between checks
 * @returns Promise that resolves to true if condition met, false if timeout
 */
export async function pollCondition(
  condition: () => boolean | Promise<boolean>,
  timeoutMs: number,
  intervalMs = 100
): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkCondition = async () => {
      const result = await condition();

      if (result) {
        resolve(true);
      } else if (Date.now() - startTime >= timeoutMs) {
        resolve(false);
      } else {
        setTimeout(checkCondition, intervalMs);
      }
    };
    checkCondition();
  });
}

export async function waitForWebSocketDisconnection(
  consoleMessages: string[],
  timeoutMs = 15000
): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkCondition = () => {
      const disconnected = consoleMessages.some(
        (msg) =>
          msg.includes('ERR_INTERNET_DISCONNECTED') ||
          msg.includes('online status= false') ||
          /WebSocket.*(disconnect|closed)/i.test(msg)
      );

      if (disconnected) {
        resolve(true);
      } else if (Date.now() - startTime >= timeoutMs) {
        resolve(false);
      } else {
        setTimeout(checkCondition, 100);
      }
    };
    checkCondition();
  });
}

export async function waitForWebSocketReconnection(
  consoleMessages: string[],
  timeoutMs = 15000
): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkCondition = () => {
      const reconnected = consoleMessages.some(
        (msg) =>
          msg.includes('online status= true') || /WebSocket.*(connected|established)/i.test(msg)
      );

      if (reconnected) {
        resolve(true);
      } else if (Date.now() - startTime >= timeoutMs) {
        resolve(false);
      } else {
        setTimeout(checkCondition, 100);
      }
    };
    checkCondition();
  });
}

export async function waitForState(
  page: Page,
  expectedState: userState,
  timeoutMs: number = OPERATION_TIMEOUT
): Promise<void> {
  const condition = async () => {
    const currentState = await page
      .locator(getSelector('idleCodesDropdown'))
      .locator('option:checked')
      .innerText()
      .then((text) => text.trim())
      .catch(() => '');

    return currentState.toLowerCase() === expectedState.toLowerCase();
  };

  const success = await pollCondition(condition, timeoutMs, 300);

  if (!success) {
    const finalState = await page
      .locator(getSelector('idleCodesDropdown'))
      .locator('option:checked')
      .innerText()
      .then((text) => text.trim())
      .catch(() => 'unknown');

    throw new Error(
      `Timed out waiting for state '${expectedState}', current state is '${finalState}'`
    );
  }
}

export async function getLastStateFromLogs(capturedLogs: string[]): Promise<string> {
  const stateChangeLogs = capturedLogs.filter((log) =>
    log.includes('onStateChange invoked with state name:')
  );

  if (stateChangeLogs.length === 0) {
    return 'No state change logs found';
  }

  const lastStateLog = stateChangeLogs[stateChangeLogs.length - 1];
  const match = lastStateLog.match(/onStateChange invoked with state name:\s*(.+)$/);

  return match?.[1]?.trim() || 'No state change logs found';
}

export async function waitForStateLogs(
  capturedLogs: string[],
  expectedState: userState,
  timeoutMs = 10000
): Promise<void> {
  const condition = async () => {
    const lastState = await getLastStateFromLogs(capturedLogs);

    return lastState.toLowerCase() === expectedState.toLowerCase();
  };

  const success = await pollCondition(condition, timeoutMs, 250);

  if (!success) {
    throw new Error(`Timed out waiting for state '${expectedState}' in logs`);
  }
}

export async function getLastWrapupReasonFromLogs(capturedLogs: string[]): Promise<string> {
  const wrapupLogs = capturedLogs.filter((log) => log.includes('onWrapup invoked with reason :'));

  if (wrapupLogs.length === 0) {
    return 'No wrapup reason found';
  }

  const lastWrapupLog = wrapupLogs[wrapupLogs.length - 1];
  const match = lastWrapupLog.match(/onWrapup invoked with reason : (.+)$/);

  return match?.[1]?.trim() || 'No wrapup reason found';
}

export async function waitForWrapupReasonLogs(
  capturedLogs: string[],
  expectedReason: string,
  timeoutMs = 10000
): Promise<void> {
  const condition = async () => {
    const lastReason = await getLastWrapupReasonFromLogs(capturedLogs);

    return lastReason.toLowerCase() === expectedReason.toLowerCase();
  };

  const success = await pollCondition(condition, timeoutMs, 250);

  if (!success) {
    throw new Error(`Timed out waiting for wrapup reason '${expectedReason}' in logs`);
  }
}

export function isColorClose(
  receivedColor: string,
  expectedColor: ThemeColor,
  tolerance = 10
): boolean {
  const receivedRgb = receivedColor.match(/\d+/g)?.map(Number) || [];
  const expectedRgb = expectedColor.match(/\d+/g)?.map(Number) || [];

  for (let i = 0; i < 3; i += 1) {
    if (typeof receivedRgb[i] !== 'number' || typeof expectedRgb[i] !== 'number') {
      // eslint-disable-next-line no-continue
      continue;
    }

    if (Math.abs(receivedRgb[i] - expectedRgb[i]) > tolerance) {
      return false;
    }
  }

  return true;
}

export async function navigateToContactCenter(page: Page, baseUrl?: string): Promise<void> {
  const url =
    baseUrl || process.env.PW_BASE_URL || 'https://localhost:8000/samples/contact-center/';
  await page.goto(url, {waitUntil: 'domcontentloaded'});

  // If we are on the samples index, click into contact-center.
  if (/^https:\/\/localhost:8000\/?$/.test(url)) {
    const link = page.locator('a[href="./samples/contact-center/"]');
    if (await link.isVisible().catch(() => false)) {
      await link.click();
      await page.waitForLoadState('domcontentloaded');
    }
  }
}

export async function handleStrayTasks(page: Page): Promise<void> {
  const ronaPopup = page.locator(getSelector('ronaPopup'));
  if (await ronaPopup.isVisible().catch(() => false)) {
    const stateSelect = page.locator(getSelector('ronaSelect'));
    if (await stateSelect.isVisible().catch(() => false)) {
      const options = await stateSelect
        .locator('option')
        .evaluateAll((nodes) =>
          nodes.map((node) => (node as HTMLOptionElement).textContent?.trim() || '').filter(Boolean)
        );
      if (options.length > 0) {
        await stateSelect.selectOption({label: options[0]});
      }
    }
    await page
      .locator(getSelector('ronaConfirm'))
      .click()
      .catch(() => {});
  }

  const endButton = page.locator(getSelector('endButton'));
  if (await endButton.isEnabled().catch(() => false)) {
    await endButton.click().catch(() => {});
    await page.waitForTimeout(500);
  }

  const wrapupButton = page.locator(getSelector('wrapupButton'));
  const wrapupSelect = page.locator(getSelector('wrapupCodesDropdown'));
  if (
    (await wrapupButton.isEnabled().catch(() => false)) &&
    (await wrapupSelect.isEnabled().catch(() => false))
  ) {
    await wrapupSelect.selectOption({index: 0}).catch(() => {});
    await wrapupButton.click().catch(() => {});
  }
}

export async function dismissOverlays(page: Page): Promise<void> {
  // Dismiss any modal overlays or backdrops
  const backdrop = page.locator('.md-popover-backdrop, .modal-backdrop');
  if (await backdrop.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
}

export async function clearPendingCallAndWrapup(page: Page): Promise<void> {
  // End any pending calls and complete wrapup
  const endButton = page.locator(getSelector('endButton'));
  if (await endButton.isEnabled().catch(() => false)) {
    await endButton.click();
    await page.waitForTimeout(1000);
  }

  const wrapupButton = page.locator(getSelector('wrapupButton'));
  const wrapupSelect = page.locator(getSelector('wrapupCodesDropdown'));
  if (
    (await wrapupButton.isEnabled().catch(() => false)) &&
    (await wrapupSelect.isEnabled().catch(() => false))
  ) {
    await wrapupSelect.selectOption({index: 0});
    await wrapupButton.click();
    await page.waitForTimeout(1000);
  }
}

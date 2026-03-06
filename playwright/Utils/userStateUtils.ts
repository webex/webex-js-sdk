/* eslint-disable import/no-extraneous-dependencies */
import {Page} from '@playwright/test';
import dotenv from 'dotenv';
import {AWAIT_TIMEOUT, CONSOLE_PATTERNS} from '../constants';
import {getSelector} from './helperUtils';

dotenv.config();

export async function getCurrentState(page: Page): Promise<string> {
  await page.bringToFront();
  const dropdown = page.locator(getSelector('idleCodesDropdown'));
  await dropdown.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
  const current = await dropdown.locator('option:checked').innerText({timeout: AWAIT_TIMEOUT});

  return current.trim();
}

export async function changeUserState(page: Page, userState: string): Promise<void> {
  await page.bringToFront();

  const dropdown = page.locator(getSelector('idleCodesDropdown'));
  await dropdown.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});

  const currentState = await getCurrentState(page).catch(() => '');
  if (currentState.toLowerCase() === userState.toLowerCase()) {
    return;
  }

  const selected = await dropdown.selectOption({label: userState}).catch(() => []);
  if (selected.length === 0) {
    const options = await dropdown.locator('option').evaluateAll((nodes) =>
      nodes
        .map((node) => ({
          value: (node as HTMLOptionElement).value,
          label: ((node as HTMLOptionElement).textContent || '').trim(),
        }))
        .filter((opt) => opt.label.length > 0)
    );

    const partialMatch = options.find((option) =>
      option.label.toLowerCase().includes(userState.toLowerCase())
    );
    if (!partialMatch) {
      throw new Error(`State '${userState}' is not present in #idleCodesDropdown`);
    }

    await dropdown.selectOption({value: partialMatch.value});
  }

  await page.locator(getSelector('setAgentStatusButton')).click({timeout: AWAIT_TIMEOUT});
  await page.waitForTimeout(1000);
}

export async function verifyCurrentState(page: Page, expectedState: string): Promise<void> {
  const currentState = await getCurrentState(page);
  if (currentState.toLowerCase() !== expectedState.toLowerCase()) {
    throw new Error(`Expected state '${expectedState}' but found '${currentState}'`);
  }
}

export async function getStateElapsedTime(page: Page): Promise<string> {
  await page.bringToFront();
  const timer = await page.locator(getSelector('timerDisplay')).innerText({timeout: AWAIT_TIMEOUT});

  return timer.trim();
}

export async function validateConsoleStateChange(
  _page: Page,
  expectedState: string,
  consoleMessages: string[]
): Promise<boolean> {
  const lastStateChangeMessage = consoleMessages
    .slice()
    .reverse()
    .find((msg) => msg.match(CONSOLE_PATTERNS.ON_STATE_CHANGE_REGEX));

  if (!lastStateChangeMessage) {
    throw new Error('No onStateChange log found in console messages');
  }

  const match = lastStateChangeMessage.match(CONSOLE_PATTERNS.ON_STATE_CHANGE_REGEX);
  const actualState = match?.[1]?.trim();

  if (!actualState) {
    throw new Error('Failed to parse state from onStateChange console log');
  }

  return actualState.toLowerCase() === expectedState.toLowerCase();
}

export async function checkCallbackSequence(
  _page: Page,
  expectedState: string,
  consoleMessages: string[]
): Promise<boolean> {
  const apiSuccessIndex = consoleMessages.findIndex((msg) =>
    msg.includes(CONSOLE_PATTERNS.SDK_STATE_CHANGE_SUCCESS)
  );
  const callbackIndex = consoleMessages.findIndex((msg) =>
    msg.match(CONSOLE_PATTERNS.ON_STATE_CHANGE_REGEX)
  );

  if (apiSuccessIndex === -1) {
    throw new Error('API success callback log not found');
  }

  if (callbackIndex === -1) {
    throw new Error('onStateChange callback log not found');
  }

  if (callbackIndex <= apiSuccessIndex) {
    throw new Error(
      `onStateChange callback appeared before success log (${callbackIndex} <= ${apiSuccessIndex})`
    );
  }

  return validateConsoleStateChange(_page, expectedState, consoleMessages);
}

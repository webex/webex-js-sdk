import {Page, expect} from '@playwright/test';
import dotenv from 'dotenv';
import {USER_STATES, AWAIT_TIMEOUT, CONSOLE_PATTERNS} from '../constants';

dotenv.config();

/**
 * Changes the user state in the contact center widget
 * @param page - The Playwright page object
 * @param userState - The target user state (e.g., 'Available', 'Meeting', 'Lunch Break')
 * @description Skips the change if already in the target state
 * @throws {Error} When the specified state is not a valid option
 * @example
 * ```typescript
 * await changeUserState(page, USER_STATES.AVAILABLE);
 * await changeUserState(page, 'Meeting');
 * ```
 */
export const changeUserState = async (page: Page, userState: string): Promise<void> => {
  // Get the current state name with timeout, return early if not found
  try {
    const currentState = await page
      .getByTestId('state-select')
      .getByTestId('state-name')
      .innerText({timeout: AWAIT_TIMEOUT});
    if (currentState.trim() === userState) {
      return;
    }
  } catch (error) {
    // Element not found, return without error
    return;
  }

  const idleDropdown = page.locator('#idleCodesDropdown');
  const idleDropdownVisible = await idleDropdown.isVisible().catch(() => false);
  if (idleDropdownVisible) {
    try {
      await idleDropdown.selectOption({label: userState}, {timeout: AWAIT_TIMEOUT});
      const setAgentStatusButton = page.locator('#setAgentStatus');
      await setAgentStatusButton.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
      await setAgentStatusButton.click({timeout: AWAIT_TIMEOUT});
      await page.waitForTimeout(1000);
      return;
    } catch (error) {
      // Fall back to popup flow below if direct dropdown selection fails.
    }
  }

  await page.getByTestId('state-select').click({timeout: AWAIT_TIMEOUT});
  const stateItem = page.getByTestId(`state-item-${userState}`);
  const isValidState = await stateItem.isVisible().catch(() => false);

  if (!isValidState) {
    throw new Error(`State "${userState}" is not a valid state option.`);
  }

  await stateItem.click({timeout: AWAIT_TIMEOUT});
  const confirmButton = page.getByTestId('samples:rona-button-confirm');
  await confirmButton.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
  await confirmButton.click({timeout: AWAIT_TIMEOUT});
  await page.waitForTimeout(1000);
};

/**
 * Retrieves the current user state from the widget
 * @param page - The Playwright page object
 * @returns Promise<string> - The current state name (trimmed)
 * @example
 * ```typescript
 * const currentState = await getCurrentState(page);
 * console.log(`Agent is currently: ${currentState}`);
 * ```
 */
export const getCurrentState = async (page: Page): Promise<string> => {
  const stateName = await page
    .getByTestId('state-select')
    .getByTestId('state-name')
    .innerText({timeout: AWAIT_TIMEOUT});
  return stateName.trim();
};

/**
 * Verifies that the current user state matches the expected state
 * @param page - The Playwright page object
 * @param expectedState - The state that should be currently active
 * @throws {Error} When the current state doesn't match the expected state
 * @example
 * ```typescript
 * await changeUserState(page, USER_STATES.AVAILABLE);
 * await verifyCurrentState(page, USER_STATES.AVAILABLE); // Will pass
 * await verifyCurrentState(page, USER_STATES.MEETING);   // Will throw error
 * ```
 */
export const verifyCurrentState = async (page: Page, expectedState: string): Promise<void> => {
  const currentState = await getCurrentState(page);
  if (currentState !== expectedState) {
    throw new Error(`Expected state "${expectedState}" but found "${currentState}".`);
  }
};

/**
 * Retrieves the elapsed time for the current user state
 * @param page - The Playwright page object
 * @returns Promise<string> - The elapsed time in format "MM:SS" or "MM:SS / MM:SS" for dual timers
 * @description For idle states like 'Lunch Break', returns dual timer format showing both timers
 * @example
 * ```typescript
 * const timer = await getStateElapsedTime(page);
 * console.log(`Time in current state: ${timer}`);
 * // Output: "05:23" or "05:23 / 12:45" for dual timers
 * ```
 */
export const getStateElapsedTime = async (page: Page): Promise<string> => {
  // Directly select the timer by its test id
  const timerText = await page.getByTestId('elapsed-time').innerText({timeout: AWAIT_TIMEOUT});
  return timerText.trim();
};

/**
 * Validates that the console state change matches the expected state by checking onStateChange logs
 * @param page - The Playwright page object
 * @param state - The expected state name to validate against
 * @param consoleMessages - Array of console messages to search through
 * @returns Promise<boolean> - True if the last onStateChange log matches the expected state
 * @description Searches for the most recent "onStateChange invoked with state name:" log and validates the state
 * @throws {Error} When no onStateChange log is found or state name cannot be extracted
 * @example
 * ```typescript
 * const consoleMessages: string[] = [];
 * page.on('console', (msg) => consoleMessages.push(msg.text()));
 *
 * await changeUserState(page, USER_STATES.AVAILABLE);
 * const isValid = await validateConsoleStateChange(page, USER_STATES.AVAILABLE, consoleMessages);
 * ```
 */
// Validates that the console state change matches the expected state by checking the last onStateChange log
// and comparing it to the expected state name.
export const validateConsoleStateChange = async (
  page: Page,
  state: string,
  consoleMessages: string[]
): Promise<boolean> => {
  const lastStateChangeMessage = consoleMessages
    .slice()
    .reverse()
    .find((msg) => msg.match(CONSOLE_PATTERNS.ON_STATE_CHANGE_REGEX));

  if (!lastStateChangeMessage) {
    throw new Error('No onStateChange log found in console messages');
  }

  const stateMatch = lastStateChangeMessage.match(CONSOLE_PATTERNS.ON_STATE_CHANGE_REGEX);
  const actualState = stateMatch?.[1]?.trim();

  if (!actualState) {
    throw new Error('Failed to extract state name from onStateChange console message');
  }

  // Simplified comparison logic
  const expectedState = state.trim().toLowerCase();
  const loggedState = actualState.toLowerCase();
  return expectedState === loggedState;
};

/**
 * Validates the correct sequence of API success and callback invocation for state changes
 * @param page - The Playwright page object
 * @param expectedState - The expected state name to validate against
 * @param consoleMessages - Array of console messages to analyze for sequence validation
 * @returns Promise<boolean> - True if callback sequence is correct and state matches
 * @description Ensures that API success occurs before onStateChange callback and validates the final state
 * @throws {Error} When API success message is not found
 * @throws {Error} When onStateChange callback is not found
 * @throws {Error} When callback occurs before API success (incorrect sequence)
 * @throws {Error} When no onStateChange log is found
 * @throws {Error} When state name cannot be extracted from onStateChange log
 * @example
 * ```typescript
 * const consoleMessages: string[] = [];
 * page.on('console', (msg) => consoleMessages.push(msg.text()));
 *
 * await changeUserState(page, USER_STATES.AVAILABLE);
 * const isSequenceValid = await checkCallbackSequence(page, USER_STATES.AVAILABLE, consoleMessages);
 * if (!isSequenceValid) {
 *   throw new Error('Callback sequence validation failed');
 * }
 * ```
 */
export async function checkCallbackSequence(
  page: Page,
  expectedState: string,
  consoleMessages: string[]
): Promise<boolean> {
  const reversedMessages = consoleMessages.slice().reverse();

  // Find last index of API success using reverse().findIndex()
  const apiSuccessReverseIndex = reversedMessages.findIndex((msg) =>
    msg.includes(CONSOLE_PATTERNS.SDK_STATE_CHANGE_SUCCESS)
  );

  // Find last index of onStateChange callback using reverse().findIndex()
  const callbackReverseIndex = reversedMessages.findIndex(
    (msg) =>
      msg.toLowerCase().includes(CONSOLE_PATTERNS.ON_STATE_CHANGE_KEYWORDS[0]) &&
      msg.toLowerCase().includes(CONSOLE_PATTERNS.ON_STATE_CHANGE_KEYWORDS[1])
  );

  // Validate that both messages exist
  if (apiSuccessReverseIndex === -1) {
    throw new Error('API success message not found in console');
  }
  if (callbackReverseIndex === -1) {
    throw new Error('onStateChange callback not found in console');
  }

  // Convert reversed indices to original indices for comparison
  const apiSuccessIndex = consoleMessages.length - 1 - apiSuccessReverseIndex;
  const callbackIndex = consoleMessages.length - 1 - callbackReverseIndex;

  // Validate sequence: callback must come after API success
  if (callbackIndex <= apiSuccessIndex) {
    throw new Error(
      `Callback occurred before API success (callback index: ${callbackIndex}, API index: ${apiSuccessIndex})`
    );
  }

  const lastStateChangeMessage = reversedMessages.find((msg) => msg.match(CONSOLE_PATTERNS.ON_STATE_CHANGE_REGEX));

  if (!lastStateChangeMessage) {
    throw new Error('No onStateChange log found in console messages');
  }

  const stateMatch = lastStateChangeMessage.match(CONSOLE_PATTERNS.ON_STATE_CHANGE_REGEX);
  const actualState = stateMatch?.[1]?.trim();

  if (!actualState) {
    throw new Error('Failed to extract state name from onStateChange console message');
  }

  return actualState.toLowerCase() === expectedState.trim().toLowerCase();
}

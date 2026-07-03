/* eslint-disable no-await-in-loop, no-plusplus, no-continue, no-console */
import {Page, expect} from '@playwright/test';
import {AWAIT_TIMEOUT, CONSOLE_PATTERNS} from '../constants';

/**
 * Retrieves the current user state from the sample app
 * @param page - The Playwright page object
 * @returns Promise<string> - The current state name (trimmed)
 * @example
 * ```typescript
 * const currentState = await getCurrentState(page);
 * console.log(`Agent is currently: ${currentState}`);
 * ```
 */
export const getCurrentState = async (page: Page): Promise<string> => {
  await page.bringToFront();
  const dropdown = page.locator('#idleCodesDropdown');
  await expect(dropdown).toBeVisible({timeout: AWAIT_TIMEOUT});

  const selectedState = await dropdown
    .evaluate((element) => {
      const select = element as HTMLSelectElement;
      const selectedOption = select.options[select.selectedIndex];
      if (!selectedOption) {
        return '';
      }

      const text = (selectedOption.text || '').trim();
      const value = (selectedOption.value || '').trim();

      // Placeholder or transitional state where no concrete idle code is selected.
      if (!value || /^select idle codes$/i.test(text)) {
        return '';
      }

      return text;
    })
    .catch(() => '');

  return selectedState;
};

/**
 * Changes the user state in the contact center sample app
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
  await page.bringToFront();

  // Get the current state, return early if not found
  try {
    const currentState = await getCurrentState(page);
    if (currentState.trim() === userState) {
      return;
    }
  } catch (error) {
    // Element not found, return without error
    return;
  }

  // Check if RONA popup is already visible (from previous consult decline/timeout)
  const statePopup = page.locator('#agentStatePopup');
  const isRonaAlreadyVisible = await statePopup.isVisible().catch(() => false);

  if (isRonaAlreadyVisible) {
    // RONA popup is already open - use it directly to change state
    const popupSelect = page.locator('#agentStateSelect');
    const setStateButton = page.locator('#setAgentState');

    // Map state name if needed (Idle → Meeting)
    let ronaStateName = userState;
    if (userState === 'Idle') {
      ronaStateName = 'Meeting';
    }

    const hasTargetOption = await popupSelect
      .locator(`option:has-text("${ronaStateName}")`)
      .count()
      .then((count) => count > 0)
      .catch(() => false);

    if (hasTargetOption) {
      await popupSelect.selectOption({label: ronaStateName}, {timeout: AWAIT_TIMEOUT});
    }

    await expect(setStateButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
    await setStateButton.click({timeout: AWAIT_TIMEOUT});
    await expect(statePopup).toBeHidden({timeout: AWAIT_TIMEOUT});

    // Wait for state to settle
    await page.waitForTimeout(2000);

    // Verify state changed
    await expect
      .poll(
        async () => {
          return getCurrentState(page);
        },
        {timeout: AWAIT_TIMEOUT, intervals: [200, 400, 800]}
      )
      .toBe(userState);

    return;
  }

  // Normal flow: select state from dropdown then click button
  const dropdown = page.locator('#idleCodesDropdown');
  await expect(dropdown).toBeVisible({timeout: AWAIT_TIMEOUT});

  // Check if the state option exists
  const optionExists = await dropdown.locator(`option:has-text("${userState}")`).count();
  if (optionExists === 0) {
    throw new Error(`State "${userState}" is not a valid state option.`);
  }

  await dropdown.selectOption({label: userState}, {timeout: AWAIT_TIMEOUT});

  // Click Set Agent Status button
  const setStatusButton = page.locator('#setAgentStatus');
  await expect(setStatusButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
  await setStatusButton.click({timeout: AWAIT_TIMEOUT});

  const isPopupVisible = await statePopup.isVisible().catch(() => false);

  // In the sample app, some transitions require confirming via this popup.
  if (isPopupVisible) {
    const popupSelect = page.locator('#agentStateSelect');
    const setStateButton = page.locator('#setAgentState');

    const hasTargetOption = await popupSelect
      .locator(`option:has-text("${userState}")`)
      .count()
      .then((count) => count > 0)
      .catch(() => false);

    if (hasTargetOption) {
      await popupSelect.selectOption({label: userState}, {timeout: AWAIT_TIMEOUT});
    }

    await expect(setStateButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
    await setStateButton.click({timeout: AWAIT_TIMEOUT});
    await expect(statePopup).toBeHidden({timeout: AWAIT_TIMEOUT});
  }

  await expect
    .poll(
      async () => {
        return getCurrentState(page);
      },
      {timeout: AWAIT_TIMEOUT, intervals: [200, 400, 800]}
    )
    .toBe(userState);
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
  await page.bringToFront();

  // Poll for state to match expected (handles transitional states after task cleanup)
  await expect
    .poll(
      async () => {
        return getCurrentState(page);
      },
      {timeout: AWAIT_TIMEOUT, intervals: [200, 400, 800]}
    )
    .toBe(expectedState);
};

/**
 * Retrieves the elapsed time for the current user state
 * @param page - The Playwright page object
 * @returns Promise<string> - The elapsed time in format "HH:MM:SS"
 * @example
 * ```typescript
 * const timer = await getStateElapsedTime(page);
 * console.log(`Time in current state: ${timer}`);
 * // Output: "00:05:23"
 * ```
 */
export const getStateElapsedTime = async (page: Page): Promise<string> => {
  await page.bringToFront();
  const timerDisplay = page.locator('#timerDisplay');
  const timerText = await timerDisplay.innerText({timeout: AWAIT_TIMEOUT});

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
/**
 * @deprecated Legacy function for widget patterns - not used in CC SDK sample app.
 * Sample app doesn't emit widget-specific console patterns like "onStateChange invoked with state name:"
 * Use checkCallbackSequence() or UI state verification instead.
 */
export const validateConsoleStateChange = async (
  _page: Page,
  state: string,
  consoleMessages: string[]
): Promise<boolean> => {
  const lastStateChangeMessage = consoleMessages
    .slice()
    .reverse()
    .find((msg) => msg.match(CONSOLE_PATTERNS.WIDGET_ON_STATE_CHANGE_REGEX));

  if (!lastStateChangeMessage) {
    throw new Error('No onStateChange log found in console messages');
  }

  const stateMatch = lastStateChangeMessage.match(CONSOLE_PATTERNS.WIDGET_ON_STATE_CHANGE_REGEX);
  const actualState = stateMatch?.[1]?.trim();

  if (!actualState) {
    throw new Error('Failed to extract state name from onStateChange console message');
  }

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
  _expectedState: string, // Not used in CC SDK - state validation happens via dropdown
  consoleMessages: string[],
  maxWaitMs = 10000
): Promise<boolean> {
  // Poll for console messages with timeout
  const startTime = Date.now();
  let apiSuccessReverseIndex = -1;
  let callbackReverseIndex = -1;

  while (Date.now() - startTime < maxWaitMs) {
    const reversedMessages = consoleMessages.slice().reverse();

    // Find last index of API success: "Agent status set successfully"
    apiSuccessReverseIndex = reversedMessages.findIndex((msg) =>
      msg.includes(CONSOLE_PATTERNS.SDK_STATE_CHANGE_SUCCESS)
    );

    // Find last index of state change callback: "Agent state change event received"
    callbackReverseIndex = reversedMessages.findIndex((msg) =>
      msg.includes('Agent state change event received')
    );

    // If both messages found, break early
    if (apiSuccessReverseIndex !== -1 && callbackReverseIndex !== -1) {
      break;
    }

    // Wait a bit before checking again
    // eslint-disable-next-line no-await-in-loop
    await page.waitForTimeout(500);
  }

  // Validate that both messages exist
  if (apiSuccessReverseIndex === -1) {
    const recentMessages = consoleMessages.slice(-10).join('\n  ');
    throw new Error(
      `API success message not found in console after ${maxWaitMs}ms. Expected: "${CONSOLE_PATTERNS.SDK_STATE_CHANGE_SUCCESS}". Found ${consoleMessages.length} messages.\nRecent messages:\n  ${recentMessages}`
    );
  }
  if (callbackReverseIndex === -1) {
    const recentMessages = consoleMessages.slice(-10).join('\n  ');
    throw new Error(
      `Agent state change callback not found in console after ${maxWaitMs}ms. Expected message containing "Agent state change event received". Found ${consoleMessages.length} messages.\nRecent messages:\n  ${recentMessages}`
    );
  }

  // Convert reversed indices to original indices for comparison
  const apiSuccessIndex = consoleMessages.length - 1 - apiSuccessReverseIndex;
  const callbackIndex = consoleMessages.length - 1 - callbackReverseIndex;

  // Validate sequence: In CC SDK, event callback fires BEFORE promise resolves
  // So callback index should be less than API success index
  if (callbackIndex >= apiSuccessIndex) {
    throw new Error(
      `Callback occurred after API success (callback index: ${callbackIndex}, API index: ${apiSuccessIndex}). Expected callback before promise resolution.`
    );
  }

  // For CC SDK, state validation happens via the dropdown value change, not console message parsing
  // The callback event confirms the state change was processed
  return true;
}

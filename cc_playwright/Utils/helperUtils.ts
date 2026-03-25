import {Page, expect} from '@playwright/test';
import {getCurrentState, changeUserState} from './userStateUtils';
import {
  WRAPUP_REASONS,
  USER_STATES,
  RONA_OPTIONS,
  LoginMode,
  ThemeColor,
  userState,
  WrapupReason,
  AWAIT_TIMEOUT,
  OPERATION_TIMEOUT,
  EXTENSION_REGISTRATION_TIMEOUT,
} from '../constants';
import {submitWrapup} from './wrapupUtils';
import {holdCallToggle, isCallHeld} from './taskControlUtils';
import {submitRonaPopup} from './incomingTaskUtils';
import {loginViaAccessToken, initializeSdk, registerContactCenter} from './initUtils';
import {stationLogout, telephonyLogin} from './stationLoginUtils';

/**
 * Parses a time string in MM:SS format and converts it to total seconds
 * @param timeString - Time string in format "MM:SS" (e.g., "01:30" for 1 minute 30 seconds)
 * @returns Total number of seconds
 * @example
 * ```typescript
 * parseTimeString("01:30"); // Returns 90 (1 minute 30 seconds)
 * parseTimeString("00:45"); // Returns 45 (45 seconds)
 * parseTimeString("10:00"); // Returns 600 (10 minutes)
 * ```
 */
export function parseTimeString(timeString: string): number {
  const parts = timeString.split(':');
  const minutes = parseInt(parts[0], 10) || 0;
  const seconds = parseInt(parts[1], 10) || 0;

  return minutes * 60 + seconds;
}

/**
 * Waits for WebSocket disconnection by monitoring console messages for specific disconnection indicators
 * @param consoleMessages - Array of console messages to monitor
 * @param timeoutMs - Maximum time to wait for disconnection in milliseconds (default: 15000)
 * @returns Promise<boolean> - True if disconnection is detected, false if timeout is reached
 * @description Monitors for network disconnection messages or WebSocket offline status changes
 * @example
 * ```typescript
 * consoleMessages.length = 0; // Clear existing messages
 * await page.context().setOffline(true);
 * const isDisconnected = await waitForWebSocketDisconnection(consoleMessages);
 * expect(isDisconnected).toBe(true);
 * ```
 */
export async function waitForWebSocketDisconnection(
  consoleMessages: string[],
  timeoutMs = 15000
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const webSocketDisconnectLog = consoleMessages.find(
      (msg) =>
        msg.includes('Failed to load resource: net::ERR_INTERNET_DISCONNECTED') ||
        msg.includes('[WebSocketStatus] event=checkOnlineStatus | online status= false')
    );
    if (webSocketDisconnectLog) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return false;
}

/**
 * Waits for WebSocket reconnection by monitoring console messages for online status changes
 * @param consoleMessages - Array of console messages to monitor
 * @param timeoutMs - Maximum time to wait for reconnection in milliseconds (default: 15000)
 * @returns Promise<boolean> - True if reconnection is detected, false if timeout is reached
 * @description Monitors for WebSocket online status change messages indicating successful reconnection
 * @example
 * ```typescript
 * consoleMessages.length = 0; // Clear existing messages
 * await page.context().setOffline(false);
 * const isReconnected = await waitForWebSocketReconnection(consoleMessages);
 * expect(isReconnected).toBe(true);
 * ```
 */
export async function waitForWebSocketReconnection(
  consoleMessages: string[],
  timeoutMs = 15000
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const webSocketReconnectLog = consoleMessages.find((msg) =>
      msg.includes('[WebSocketStatus] event=checkOnlineStatus | online status= true')
    );
    if (webSocketReconnectLog) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return false;
}

/**
 * Waits for a specific user state to be reached in the UI
 * @param page - Playwright Page object
 * @param expectedState - The expected user state to wait for
 * @returns Promise<void>
 * @throws Error if the expected state is not reached within the timeout
 * @description Continuously checks the current user state until it matches the expected state or times out
 * @example
 * ```typescript
 * await waitForState(page, USER_STATES.AVAILABLE);
 * // Waits until the user state changes to 'Available'
 * ```
 */

export const waitForState = async (page: Page, expectedState: userState): Promise<void> => {
  try {
    await page.bringToFront();
    await expect
      .poll(
        async () => {
          return getCurrentState(page);
        },
        {timeout: 30000, intervals: [200, 400, 800, 1200]}
      )
      .toBe(expectedState);
  } catch (error) {
    // Get current state for better error message
    const currentState = await getCurrentState(page);
    throw new Error(
      `Timed out waiting for state "${expectedState}", last state was "${currentState}"`
    );
  }
};

/**
 * Retrieves the last state from captured logs
 * @param capturedLogs - Array of log messages
 * @returns Promise<string> - The last state name found in the logs, or a message if not found
 * @description Filters logs for state change messages and extracts the last state name
 * @example
 * ```typescript
 * const lastState = await getLastStateFromLogs(capturedLogs);
 * console.log(lastState); // Outputs the last state name or a message if not found
 * ```
 */

export async function getLastStateFromLogs(capturedLogs: string[]) {
  const stateChangeLogs = capturedLogs.filter((log) =>
    log.includes('onStateChange invoked with state name:')
  );

  if (stateChangeLogs.length === 0) {
    return 'No state change logs found';
  }

  const lastStateLog = stateChangeLogs[stateChangeLogs.length - 1];
  const match = lastStateLog.match(/onStateChange invoked with state name:\s*(.+)$/);

  if (!match) {
    return 'No State change log found';
  }

  return match[1].trim();
}

/**
 * Waits for a specific state to appear in the captured logs
 * @param capturedLogs - Array of log messages
 * @param expectedState - The expected state to wait for
 * @param timeoutMs - Maximum time to wait for the state in milliseconds (default: 10000)
 * uses the manual logs for that, such as "onStateChange invoked with state name: AVAILABLE"
 * @returns Promise<void>
 * @throws Error if the expected state is not found within the timeout
 * @description Continuously checks the last state in logs until it matches the expected state or times out
 * @example
 * ```typescript
 * await waitForStateLogs(capturedLogs,  AVAILABLE);
 * // Waits until the last state in logs changes to 'Available'
 * ```
 */

export const waitForStateLogs = async (
  capturedLogs: string[],
  expectedState: userState,
  timeoutMs = 10000
): Promise<void> => {
  const start = Date.now();
  while (true) {
    // Check if the latest state in logs matches expectedState
    try {
      const lastState = await getLastStateFromLogs(capturedLogs);
      if (lastState === expectedState) return;
    } catch {
      // Ignore error if no state log yet
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for state "${expectedState}" in logs`);
    }
    await new Promise((res) => setTimeout(res, 300)); // Poll every 300ms
  }
};

/**
 * Waits for a specific wrapup reason to appear in the captured logs
 * @param capturedLogs - Array of log messages
 * @param expectedReason - The expected wrapup reason to wait for
 * @param timeoutMs - Maximum time to wait for the wrapup reason in milliseconds (default: 10000)
 * Uses the manual logs for that, such as "onWrapup invoked with reason : Sale"
 * @returns Promise<void>
 * @throws Error if the expected wrapup reason is not found within the timeout
 * @description Continuously checks the last wrapup reason in logs until it matches the expected reason or times out
 * @example
 * ```typescript
 * await waitForWrapupReasonLogs(capturedLogs, WRAPUP_REASONS.SALE);
 * ```
 */

export const waitForWrapupReasonLogs = async (
  capturedLogs: string[],
  expectedReason: WrapupReason,
  timeoutMs = 10000
): Promise<void> => {
  const start = Date.now();
  while (true) {
    try {
      const lastReason = await getLastWrapupReasonFromLogs(capturedLogs);
      if (lastReason === expectedReason) return;
    } catch {
      // Ignore error if no wrapup log yet
    }
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for wrapup reason "${expectedReason}" in logs`);
    }
    await new Promise((res) => setTimeout(res, 300)); // Poll every 300ms
  }
};

/**
 * Retrieves the last wrapup reason from captured logs
 * @param capturedLogs - Array of log messages
 * @returns Promise<string> - The last wrapup reason found in the logs, or a message if not found
 * @description Filters logs for wrapup messages and extracts the last wrapup reason
 * Uses the manual logs for that, such as "onWrapup invoked with reason : Sale"
 * @example
 * ```typescript
 * const lastWrapupReason = await getLastWrapupReasonFromLogs(capturedLogs);
 * console.log(lastWrapupReason); // Outputs the last wrapup reason or a message if not found
 * ```
 */

export async function getLastWrapupReasonFromLogs(capturedLogs: string[]): Promise<string> {
  const wrapupLogs = capturedLogs.filter((log) => log.includes('onWrapup invoked with reason :'));

  if (wrapupLogs.length === 0) {
    return 'No wrapup reason found';
  }

  const lastWrapupLog = wrapupLogs[wrapupLogs.length - 1];
  const match = lastWrapupLog.match(/onWrapup invoked with reason : (.+)$/);

  if (!match) {
    return 'No wrapup reason found';
  }

  return match[1].trim();
}

/**
 * Compares two RGB color strings to check if they are within a specified tolerance
 * @param receivedColor - The color received from the UI (e.g., "rgb(255, 0, 0)")
 * @param expectedColor - The expected color to compare against (e.g., "rgb(250, 5, 0)")
 * @param tolerance - The maximum allowed difference for each RGB component (default: 10)
 * @returns boolean - True if colors are close enough, false otherwise
 * @description Compares each RGB component of the two colors and checks if the absolute difference is within the specified tolerance
 * @example
 * ```typescript
 * const isClose = isColorClose("rgb(255, 0, 0)", "rgb(250, 5, 0)");
 * expect(isClose).toBe(true); // Returns true if the colors are close enough
 * ```
 */

export function isColorClose(
  receivedColor: string,
  expectedColor: ThemeColor,
  tolerance = 10
): boolean {
  const receivedRgb = receivedColor.match(/\d+/g)?.map(Number) || [];
  const expectedRgb = expectedColor.match(/\d+/g)?.map(Number) || [];

  for (let i = 0; i < 3; i++) {
    if (typeof receivedRgb[i] !== 'number' || typeof expectedRgb[i] !== 'number') {
      continue; // skip if not present
    }
    if (Math.abs(receivedRgb[i] - expectedRgb[i]) > tolerance) {
      return false;
    }
  }

  return true;
}

/**
 * Handles stray incoming tasks by accepting them and performing wrap-up actions, to be used for clean up before tests
 * @param page - Playwright Page object
 * @param extensionPage - Optional extension page for handling calls (default: null)
 * @param maxIterations - Maximum number of iterations to prevent infinite loops (default: 10)
 * @returns Promise<void>
 * @description Checks in order: RONA popup → incoming tasks → end button → wrapup button
 *              Continues until nothing actionable is found or maxIterations reached
 * @example
 * ```typescript
 * await handleStrayTasks(page, extensionPage);
 * ```
 */
export const handleStrayTasks = async (
  page: Page,
  extensionPage: Page | null = null,
  maxIterations = 10
): Promise<void> => {
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    let actionTaken = false;

    // Dismiss any overlays/popovers first
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(100);

    // ============================================
    // STEP 1: Check for RONA popup
    // ============================================
    const ronaPopup = page.locator('#agentStatePopup');
    const ronaVisible = await ronaPopup.isVisible().catch(() => false);

    if (ronaVisible) {
      try {
        await submitRonaPopup(page, RONA_OPTIONS.AVAILABLE);
        actionTaken = true;
        await page.waitForTimeout(300);
        continue; // Start fresh after RONA
      } catch (e) {}
    }

    // ============================================
    // STEP 2: Check for wrapup FIRST (complete pending tasks before accepting new ones)
    // ============================================
    const wrapupButton = page.locator('#wrapup');
    const wrapupVisible = await wrapupButton.isVisible().catch(() => false);

    if (wrapupVisible) {
      try {
        await submitWrapup(page, WRAPUP_REASONS.SALE);
        actionTaken = true;
        await page.waitForTimeout(300);
        continue; // Check for more pending tasks
      } catch (e) {}
    }

    // ============================================
    // STEP 3a: Check for exit-conference button
    // ============================================
    const exitConferenceButton = page.locator('#exit-conference');
    const exitConferenceVisible = await exitConferenceButton.isVisible().catch(() => false);

    if (exitConferenceVisible) {
      try {
        await exitConferenceButton.click({timeout: AWAIT_TIMEOUT});
        await page.waitForTimeout(500);
        const wrapupAfterExit = await wrapupButton.isVisible().catch(() => false);
        if (wrapupAfterExit) {
          await submitWrapup(page, WRAPUP_REASONS.SALE);
        }
        actionTaken = true;
        await page.waitForTimeout(300);
        continue;
      } catch (e) {}
    }

    // ============================================
    // STEP 3b: Check for end button (end active calls before accepting new ones)
    // ============================================
    const allEndButtons = page.locator('#end');
    const endButtonCount = await allEndButtons.count().catch(() => 0);
    let endButton = allEndButtons.first();
    let endButtonVisible = false;
    let endButtonEnabled = false;

    for (let i = 0; i < endButtonCount; i++) {
      const btn = allEndButtons.nth(i);
      const visible = await btn.isVisible().catch(() => false);
      if (!visible) continue;
      endButtonVisible = true;
      const enabled = await btn.isEnabled().catch(() => false);
      if (enabled) {
        endButton = btn;
        endButtonEnabled = true;
        break;
      }
      endButton = btn;
    }

    if (endButtonVisible) {
      if (!endButtonEnabled) {
        // End button disabled - try to cancel consult first
        const cancelConsultBtn = page.locator('#end-consult');
        let cancelConsultVisible = await cancelConsultBtn.isVisible().catch(() => false);

        // Cancel-consult may be hidden if on the main call leg — switch to consult leg first
        if (!cancelConsultVisible) {
          const switchBtn = page.locator('#switch-to-consult');
          const switchVisible = await switchBtn.isVisible().catch(() => false);
          if (switchVisible) {
            try {
              await switchBtn.click({timeout: AWAIT_TIMEOUT});
              await page.waitForTimeout(1000);
              cancelConsultVisible = await cancelConsultBtn.isVisible().catch(() => false);
            } catch (e) {}
          }
        }

        if (cancelConsultVisible) {
          try {
            await cancelConsultBtn.click({timeout: AWAIT_TIMEOUT});
            await page.waitForTimeout(1000);
            endButtonEnabled = await endButton.isEnabled().catch(() => false);
          } catch (e) {}
        }

        // Still disabled - resume only if the visible control state says the call is held
        if (!endButtonEnabled) {
          const holdToggle = page.locator('#hold-resume');
          const holdToggleVisible = await holdToggle.isVisible().catch(() => false);

          if (holdToggleVisible && (await isCallHeld(page))) {
            try {
              await holdCallToggle(page);
              await page.waitForTimeout(500);
              endButtonEnabled = await endButton.isEnabled().catch(() => false);
            } catch (e) {}
          }
        }
      }

      if (endButtonEnabled) {
        try {
          await endButton.click({timeout: AWAIT_TIMEOUT});
          await page.waitForTimeout(500);

          // Verify the click worked - either end button gone or wrapup appeared
          const endStillVisible = await endButton.isVisible().catch(() => false);
          const wrapupNowVisible = await wrapupButton.isVisible().catch(() => false);

          if (!endStillVisible || wrapupNowVisible) {
            actionTaken = true;
            // Don't continue - fall through to check wrapup immediately
          } else {
          }
        } catch (e) {}
      }

      // After clicking end, check for wrapup immediately (same iteration)
      const wrapupAfterEnd = await wrapupButton.isVisible().catch(() => false);
      if (wrapupAfterEnd) {
        try {
          await submitWrapup(page, WRAPUP_REASONS.SALE);
          actionTaken = true;
          await page.waitForTimeout(300);
          continue;
        } catch (e) {}
      }

      if (actionTaken) {
        continue;
      }
    }

    // ============================================
    // STEP 4: Check for incoming tasks (only accept if no active task to handle)
    // ============================================
    const incomingTaskDiv = page.locator('#incoming-task');
    const hasIncomingTask = await incomingTaskDiv.isVisible().catch(() => false);

    if (hasIncomingTask) {
      const task = incomingTaskDiv;
      const taskText = await task.innerText().catch(() => '');
      const isExtensionCall = taskText.includes('Ringing...');

      if (isExtensionCall) {
        // Extension call - try extensionPage first, fallback to waiting for RONA
        if (extensionPage) {
          try {
            // Dismiss any dialogs on extension page first
            await extensionPage.keyboard.press('Escape').catch(() => {});
            await extensionPage.waitForTimeout(200);

            const extButton = extensionPage.locator('#answer').first();
            const extButtonVisible = await extButton
              .waitFor({state: 'visible', timeout: 5000})
              .then(() => true)
              .catch(() => false);

            if (extButtonVisible) {
              // Use shorter timeout for cleanup - don't block for 40s like acceptExtensionCall does
              const isEnabled = await extButton.isEnabled({timeout: 5000}).catch(() => false);
              if (isEnabled) {
                await extButton.click({timeout: AWAIT_TIMEOUT});
              } else {
                actionTaken = true;
                continue;
              }
              await page.waitForTimeout(500);
              // After accepting, immediately try to end and wrapup
              const endBtnAfterAccept = page.getByTestId('call-control:end-call').first();
              const endVisibleAfterAccept = await endBtnAfterAccept.isVisible().catch(() => false);
              if (endVisibleAfterAccept) {
                const endEnabledAfterAccept = await endBtnAfterAccept
                  .isEnabled()
                  .catch(() => false);
                if (endEnabledAfterAccept) {
                  await endBtnAfterAccept.click({timeout: AWAIT_TIMEOUT}).catch(() => {});
                  await page.waitForTimeout(500);
                  const wrapupAfterEnd = await wrapupButton.isVisible().catch(() => false);
                  if (wrapupAfterEnd) {
                    await submitWrapup(page, WRAPUP_REASONS.SALE).catch(() => {});
                    await page.waitForTimeout(300);
                  }
                }
              }
              actionTaken = true;
              continue;
            }
          } catch (e) {}
        } else {
          // No extensionPage - wait for RONA timeout
          await page.waitForTimeout(2000);
          // Check if RONA appeared
          const ronaAfterWait = await ronaPopup.isVisible().catch(() => false);
          if (ronaAfterWait) {
            continue; // Handle RONA on next iteration
          }
          // If still no RONA, we can't handle this - exit
          const stillHasExtCall = await incomingTaskDiv
            .first()
            .isVisible()
            .catch(() => false);
          if (stillHasExtCall) {
            break;
          }
        }
      } else {
        // Regular task - check if accept button is enabled
        const acceptButton = page.locator('#answer');
        const acceptVisible = await acceptButton.isVisible().catch(() => false);
        const acceptEnabled = await acceptButton.isEnabled().catch(() => false);

        if (acceptVisible && acceptEnabled) {
          try {
            await acceptButton.click({timeout: AWAIT_TIMEOUT});
            await page.waitForTimeout(2000);
            // After accepting, immediately try to end and wrapup (same iteration)
            const endBtnAfterAccept = page.locator('#end');
            const endVisibleAfterAccept = await endBtnAfterAccept.isVisible().catch(() => false);
            if (endVisibleAfterAccept) {
              const endEnabledAfterAccept = await endBtnAfterAccept.isEnabled().catch(() => false);
              if (endEnabledAfterAccept) {
                await endBtnAfterAccept.click({timeout: AWAIT_TIMEOUT}).catch(() => {});
                await page.waitForTimeout(500);
                const wrapupAfterEnd = await wrapupButton.isVisible().catch(() => false);
                if (wrapupAfterEnd) {
                  await submitWrapup(page, WRAPUP_REASONS.SALE).catch(() => {});
                  await page.waitForTimeout(300);
                }
              }
            }
            actionTaken = true;
            continue;
          } catch (e) {}
        } else if (acceptVisible && !acceptEnabled) {
        }
      }
    }

    // ============================================
    // Check if anything is still pending that we couldn't handle
    // ============================================
    if (!actionTaken) {
      const stillHasTask = await incomingTaskDiv
        .first()
        .isVisible()
        .catch(() => false);
      const stillHasEnd = await endButton.isVisible().catch(() => false);
      const stillHasWrapup = await wrapupButton.isVisible().catch(() => false);

      // Check if end button is visible but disabled (stuck state)
      if (stillHasEnd && !stillHasWrapup) {
        const endEnabled = await endButton.isEnabled().catch(() => false);
        const holdToggle = page.getByTestId('call-control:hold-toggle').first();
        const holdVisible = await holdToggle.isVisible().catch(() => false);

        if (!endEnabled && !holdVisible) {
          break;
        }
      }

      if (stillHasWrapup) {
        await page.waitForTimeout(500);
      } else if (stillHasEnd) {
        const endEnabled = await endButton.isEnabled().catch(() => false);
        if (endEnabled) {
          if (iteration >= 3) {
            break;
          }
          await page.waitForTimeout(500);
        }
      } else if (stillHasTask) {
        await page.waitForTimeout(500);
      } else {
        break;
      }
    }
  }

  if (iteration >= maxIterations) {
  }

  // Ensure user is in Available state at the end
  const stateSelectVisible = await page
    .locator('#idleCodesDropdown')
    .isVisible()
    .catch(() => false);

  if (stateSelectVisible) {
    try {
      await changeUserState(page, USER_STATES.AVAILABLE);
    } catch (e) {}
  }
};

/**
 * Clears any pending call UI on the page by ending the call and/or submitting wrapup if visible.
 * Follows same logic as handleStrayTasks: end button (resume if disabled) → wrapup
 * @returns true if something was cleared, false otherwise
 */
export async function clearPendingCallAndWrapup(page: Page): Promise<boolean> {
  // Dismiss any open popovers first
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(200);

  const endBtn = page.locator('#end');
  const wrapupBtn = page.locator('#wrapup');

  // Check end button first
  const endVisible = await endBtn.isVisible().catch(() => false);

  if (endVisible) {
    let endEnabled = await endBtn.isEnabled().catch(() => false);

    // If disabled, try to resume only when the visible hold control indicates the call is held
    if (!endEnabled && (await isCallHeld(page))) {
      try {
        await holdCallToggle(page);
        await page.waitForTimeout(500);
        endEnabled = await endBtn.isEnabled().catch(() => false);
      } catch {
        // Resume failed, continue
      }
    }

    // Try to end the call
    if (endEnabled) {
      try {
        await endBtn.click({timeout: AWAIT_TIMEOUT});
        await page.waitForTimeout(500);
      } catch {
        // End click failed, continue
      }
    }
  }

  // Check wrapup button
  const wrapupVisible = await wrapupBtn.isVisible().catch(() => false);

  if (wrapupVisible) {
    try {
      await submitWrapup(page, WRAPUP_REASONS.SALE);
      await page.waitForTimeout(500);

      return true;
    } catch {
      return false;
    }
  }

  // Return true if end button was clicked (even without wrapup)
  return endVisible;
}

/**
 * Sets up the page for testing by logging in, initializing SDK, registering CC, and performing station login
 * @param page - Playwright Page object
 * @param loginMode - The login mode to use (e.g., LOGIN_MODE.DESKTOP or LOGIN_MODE.EXTENSION)
 * @param accessToken - Access token for authentication
 * @param extensionPage - Optional extension page for handling calls in extension mode (default: null) - currently unused but kept for API compatibility
 * @param extensionNumber - Optional extension number for extension/dial login
 * @param isMultiSession - Whether this is a multi-session setup (default: false)
 * @returns Promise<void>
 * @description Logs in via access token, initializes SDK, registers with CC, and performs station login
 * @example
 * ```typescript
 * await pageSetup(page, LOGIN_MODE.DESKTOP, accessToken);
 * await pageSetup(page, LOGIN_MODE.EXTENSION, accessToken, extensionPage, extensionNumber);
 * ```
 */
export const pageSetup = async (
  page: Page,
  loginMode: LoginMode,
  accessToken: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  extensionPage: Page | null = null,
  extensionNumber?: string,
  isMultiSession = false
) => {
  const maxRetries = 3;

  // Step 1: Login with access token
  await loginViaAccessToken(page, accessToken);

  // Step 2: Initialize SDK
  for (let i = 0; i < maxRetries; i++) {
    try {
      await initializeSdk(page);
      break;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error(`Failed to initialize SDK after ${maxRetries} attempts: ${error}`);
      }
      await page.reload();
      await page.waitForTimeout(2000);
    }
  }

  // Step 3: Register with Contact Center
  await registerContactCenter(page);

  if (isMultiSession) {
    return; // Skip station login for multi-session tests
  }

  // Step 4: Check if already logged in (logout button visible, login mode selected, AND state dropdown visible)
  const stateSelect = page.locator('#idleCodesDropdown');
  const loginButton = page.locator('#loginAgent');
  const logoutButton = page.locator('#logoutAgent');
  const agentLoginSelect = page.locator('#AgentLogin');

  // Check logout button visibility, login mode selected, AND state dropdown visible (most reliable indicator)
  const logoutButtonVisible = await logoutButton.isVisible().catch(() => false);
  const loginModeValue = await agentLoginSelect.inputValue().catch(() => '');
  const stateDropdownVisible = await stateSelect.isVisible().catch(() => false);
  const isAlreadyLoggedIn =
    logoutButtonVisible &&
    loginModeValue !== '' &&
    loginModeValue !== 'Choose Agent Login ...' &&
    stateDropdownVisible;

  if (!isAlreadyLoggedIn) {
    let loginButtonExists = await loginButton.isVisible().catch(() => false);

    if (!loginButtonExists) {
      await stationLogout(page, false); // Best-effort logout if still logged in from previous run
      loginButtonExists = await loginButton.isVisible().catch(() => false);
      if (!loginButtonExists) {
        await loginButton.waitFor({state: 'visible', timeout: OPERATION_TIMEOUT});
      }
    }

    await telephonyLogin(page, loginMode, extensionNumber);
  }

  // Step 5: Verify station login was successful (logout button visible)
  const isLogoutVisible = await logoutButton
    .waitFor({state: 'visible', timeout: EXTENSION_REGISTRATION_TIMEOUT})
    .then(() => true)
    .catch(() => false);

  if (!isLogoutVisible) {
    // Single bounded recovery for stale station/device registration state
    await stationLogout(page, false);
    await loginButton.waitFor({state: 'visible', timeout: OPERATION_TIMEOUT});
    await telephonyLogin(page, loginMode, extensionNumber);
    await logoutButton.waitFor({state: 'visible', timeout: EXTENSION_REGISTRATION_TIMEOUT});
  }
};

/**
 * Dismisses any visible popover/tooltips/backdrops that might intercept pointer events.
 * Attempts ESC presses and quick background clicks.
 */
export async function dismissOverlays(page: Page): Promise<void> {
  const isVisibleWithin = async (locator: any, timeoutMs = 500): Promise<boolean> => {
    try {
      await locator.waitFor({state: 'visible', timeout: timeoutMs});

      return true;
    } catch {
      return false;
    }
  };

  for (let i = 0; i < 3; i++) {
    // If a Momentum popover backdrop is visible, try ESC to close (with bounded timeout)
    const backdropVisible = await isVisibleWithin(page.locator('.md-popover-backdrop'), 500);
    const tippyVisible = await isVisibleWithin(page.locator('[id^="tippy-"]').first(), 500);
    if (!backdropVisible && !tippyVisible) return;
    try {
      await page.keyboard.press('Escape');
    } catch {}
    // Small click near top-left to blur active elements
    try {
      await page.mouse.click(5, 5);
    } catch {}
    await page.waitForTimeout(200);
  }
}

/**
 * Returns the CSS selector for a given logical element name
 * @param name - Logical name of the element
 * @returns CSS selector string
 * @description Maps logical element names to their CSS selectors in the contact-center sample app
 * @example
 * ```typescript
 * const selector = getSelector('loginButton'); // Returns '#loginAgent'
 * const element = page.locator(getSelector('loginButton'));
 * ```
 */
export function getSelector(name: string): string {
  const selectorMap: Record<string, string> = {
    teamsDropdown: '#teamsDropdown',
    agentLoginSelect: '#AgentLogin',
    loginButton: '#loginAgent',
    logoutButton: '#logoutAgent',
    dialNumberInput: '#dialNumber',
    idleCodesDropdown: '#idleCodesDropdown',
    registerButton: '#webexcc-register',
    deregisterButton: '#webexcc-deregister',
    accessTokenInput: '#access-token',
    accessTokenSave: '#access-token-save',
    connectionStatus: '#ws-connection-status',
  };

  const selector = selectorMap[name];
  if (!selector) {
    throw new Error(`Unknown selector name: ${name}`);
  }

  return selector;
}

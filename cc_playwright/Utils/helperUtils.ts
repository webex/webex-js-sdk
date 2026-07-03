/* eslint-disable no-await-in-loop, no-continue, no-constant-condition, import/extensions, import/no-unresolved */
// Disabled no-await-in-loop: file contains polling utilities requiring sequential awaits
// Disabled no-continue: continue statements improve readability in complex loops
// Disabled no-constant-condition: while(true) is used intentionally for polling with timeout checks
// Disabled import/extensions, import/no-unresolved: TypeScript handles module resolution

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
 * Waits for console message matching predicate
 * @param consoleMessages - Array of console messages to monitor
 * @param predicate - Function to test each message
 * @param timeoutMs - Maximum wait time in milliseconds (default: 15000)
 * @returns Promise<boolean> - True if message found, false if timeout
 */
async function waitForConsoleMessage(
  consoleMessages: string[],
  predicate: (msg: string) => boolean,
  timeoutMs = 15000
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (consoleMessages.find(predicate)) {
      return true;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  return false;
}

/** Waits for WebSocket disconnection */
export async function waitForWebSocketDisconnection(
  consoleMessages: string[],
  timeoutMs = 15000
): Promise<boolean> {
  return waitForConsoleMessage(
    consoleMessages,
    (msg) =>
      msg.includes('Failed to load resource: net::ERR_INTERNET_DISCONNECTED') ||
      msg.includes('[WebSocketStatus] event=checkOnlineStatus | online status= false'),
    timeoutMs
  );
}

/** Waits for WebSocket reconnection */
export async function waitForWebSocketReconnection(
  consoleMessages: string[],
  timeoutMs = 15000
): Promise<boolean> {
  return waitForConsoleMessage(
    consoleMessages,
    (msg) => msg.includes('[WebSocketStatus] event=checkOnlineStatus | online status= true'),
    timeoutMs
  );
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

/** Generic helper to extract last match from logs */
function getLastLogMatch(
  logs: string[],
  pattern: string,
  regex: RegExp,
  notFoundMsg: string
): string {
  const filtered = logs.filter((log) => log.includes(pattern));
  if (filtered.length === 0) return notFoundMsg;
  const match = filtered[filtered.length - 1].match(regex);

  return match ? match[1].trim() : notFoundMsg;
}

/** Generic helper to wait for value in logs */
async function waitForLogValue<T extends string>(
  logs: string[],
  expected: T,
  getter: (logs: string[]) => string,
  timeoutMs: number,
  errorMsg: string
): Promise<void> {
  const start = Date.now();
  while (true) {
    try {
      if (getter(logs) === expected) return;
    } catch {
      // Ignore error if no log yet
    }
    if (Date.now() - start > timeoutMs) throw new Error(errorMsg);
    await new Promise((res) => {
      setTimeout(res, 300);
    });
  }
}

/** Retrieves last state from logs */
export function getLastStateFromLogs(logs: string[]) {
  return getLastLogMatch(
    logs,
    'onStateChange invoked with state name:',
    /onStateChange invoked with state name:\s*(.+)$/,
    'No state change logs found'
  );
}

/** Waits for state in logs */
export const waitForStateLogs = (logs: string[], state: userState, timeoutMs = 10000) =>
  waitForLogValue(
    logs,
    state,
    getLastStateFromLogs,
    timeoutMs,
    `Timed out waiting for state "${state}" in logs`
  );

/** Retrieves last wrapup reason from logs */
export function getLastWrapupReasonFromLogs(logs: string[]): string {
  return getLastLogMatch(
    logs,
    'onWrapup invoked with reason :',
    /onWrapup invoked with reason : (.+)$/,
    'No wrapup reason found'
  );
}

/** Waits for wrapup reason in logs */
export const waitForWrapupReasonLogs = (logs: string[], reason: WrapupReason, timeoutMs = 10000) =>
  waitForLogValue(
    logs,
    reason,
    getLastWrapupReasonFromLogs,
    timeoutMs,
    `Timed out waiting for wrapup reason "${reason}" in logs`
  );

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

  for (let i = 0; i < 3; i += 1) {
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
    iteration += 1;
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
      } catch {
        /* Ignore - not critical */
      }
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
      } catch {
        /* Ignore - not critical */
      }
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
      } catch {
        /* Ignore - not critical */
      }
    }

    // ============================================
    // STEP 3b: Check for end button (end active calls before accepting new ones)
    // ============================================
    const allEndButtons = page.locator('#end');
    const endButtonCount = await allEndButtons.count().catch(() => 0);
    let endButton = allEndButtons.first();
    let endButtonVisible = false;
    let endButtonEnabled = false;

    for (let i = 0; i < endButtonCount; i += 1) {
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
            } catch {
              /* Ignore - not critical */
            }
          }
        }

        if (cancelConsultVisible) {
          try {
            await cancelConsultBtn.click({timeout: AWAIT_TIMEOUT});
            await page.waitForTimeout(1000);
            endButtonEnabled = await endButton.isEnabled().catch(() => false);
          } catch {
            /* Ignore - not critical */
          }
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
            } catch {
              /* Ignore - not critical */
            }
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
            // No action needed
          }
        } catch {
          /* Ignore - not critical */
        }
      }

      // After clicking end, check for wrapup immediately (same iteration)
      const wrapupAfterEnd = await wrapupButton.isVisible().catch(() => false);
      if (wrapupAfterEnd) {
        try {
          await submitWrapup(page, WRAPUP_REASONS.SALE);
          actionTaken = true;
          await page.waitForTimeout(300);
          continue;
        } catch {
          /* Ignore - not critical */
        }
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
              // Sample app uses #end button
              const endBtnAfterAccept = page.locator('#end');
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
          } catch {
            /* Ignore - not critical */
          }
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
          } catch {
            /* Ignore - not critical */
          }
        } else if (acceptVisible && !acceptEnabled) {
          // Accept button disabled - will be handled on next iteration
        }
      }
    }

    // ============================================
    // STEP 5: Check TaskList for stray incoming tasks (chat/email can stack here)
    // ============================================
    const taskList = page.locator('#taskList');
    const taskItems = taskList.locator('.task-item-content');
    const taskCount = await taskItems.count().catch(() => 0);

    if (taskCount > 0) {
      try {
        const firstTask = taskItems.first();

        // Try Decline button FIRST (faster for cleanup, no session establishment needed)
        const declineBtn = firstTask.getByRole('button', {name: 'Decline'}).first();
        const declineVisible = await declineBtn.isVisible().catch(() => false);

        // Try Accept button as fallback (for tasks that can't be declined)
        const acceptBtn = firstTask.getByRole('button', {name: 'Accept'}).first();
        const acceptVisible = await acceptBtn.isVisible().catch(() => false);

        if (declineVisible) {
          // Decline the task (faster, no need to wait for session establishment)
          await declineBtn.click({timeout: AWAIT_TIMEOUT}).catch(() => {});
          await page.waitForTimeout(1000);

          // Handle RONA popup if it appears (digital channels)
          const ronaAfterDecline = await ronaPopup.isVisible().catch(() => false);
          if (ronaAfterDecline) {
            await submitRonaPopup(page, RONA_OPTIONS.AVAILABLE).catch(() => {});
            await page.waitForTimeout(500);
          }
          actionTaken = true;
          continue;
        } else if (acceptVisible) {
          // Accept the task as fallback, then end it and wrapup to clear it
          // Note: Digital channels need 15-30s for session establishment
          await acceptBtn.click({timeout: AWAIT_TIMEOUT}).catch(() => {});
          await page.waitForTimeout(2000);

          // Wait for task to be active, then end it
          const endAfterAccept = page.locator('#end').first();
          // For digital channels, wait up to 30s for session establishment and End button to be enabled
          try {
            await endAfterAccept.waitFor({state: 'visible', timeout: 30000});
            await page.waitForTimeout(1000); // Let UI settle
            const endEnabled = await endAfterAccept.isEnabled().catch(() => false);
            if (endEnabled) {
              await endAfterAccept.click({timeout: AWAIT_TIMEOUT}).catch(() => {});
              await page.waitForTimeout(1000);

              // Submit wrapup to complete cleanup
              const wrapupAfterEnd = await wrapupButton.isVisible().catch(() => false);
              if (wrapupAfterEnd) {
                await submitWrapup(page, WRAPUP_REASONS.SALE).catch(() => {});
                await page.waitForTimeout(500);
              }
            }
          } catch {
            /* Ignore - task might have been handled already */
          }
          actionTaken = true;
          continue;
        }
      } catch {
        /* Ignore - not critical */
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
        const holdToggle = page.locator('#hold-resume').first();
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
    // Max iterations reached - no action needed, function will return
  }

  // Ensure user is in Available state at the end
  const stateSelectVisible = await page
    .locator('#idleCodesDropdown')
    .isVisible()
    .catch(() => false);

  if (stateSelectVisible) {
    try {
      await changeUserState(page, USER_STATES.AVAILABLE);
    } catch {
      /* Ignore - not critical */
    }
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
 * @param extensionNumber - Optional extension number for extension/dial login
 * @param isMultiSession - Whether this is a multi-session setup (default: false)
 * @returns Promise<void>
 * @description Logs in via access token, initializes SDK, registers with CC, and performs station login.
 * Note: Extension calling webclient page setup is handled separately via loginExtension().
 * @example
 * ```typescript
 * await pageSetup(page, LOGIN_MODE.DESKTOP, accessToken);
 * await pageSetup(page, LOGIN_MODE.EXTENSION, accessToken, extensionNumber);
 * ```
 */
export const pageSetup = async (
  page: Page,
  loginMode: LoginMode,
  accessToken: string,
  extensionNumber: string | undefined = undefined,
  isMultiSession = false
) => {
  const maxRetries = 3;

  // Step 1: Login with access token
  await loginViaAccessToken(page, accessToken);

  // Step 2: Initialize SDK
  for (let i = 0; i < maxRetries; i += 1) {
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

  // Step 4: Check if already logged in with correct mode
  const stateSelect = page.locator('#idleCodesDropdown');
  const loginButton = page.locator('#loginAgent');
  const logoutButton = page.locator('#logoutAgent');
  const agentLoginSelect = page.locator('#AgentLogin');

  // Check logout button visibility, login mode matches requested, AND state dropdown visible
  const logoutButtonVisible = await logoutButton.isVisible().catch(() => false);
  const loginModeValue = await agentLoginSelect.inputValue().catch(() => '');
  const stateDropdownVisible = await stateSelect.isVisible().catch(() => false);

  // CRITICAL: Verify current mode matches requested mode to prevent test contamination
  const currentLoginMode = loginModeValue.toUpperCase();
  const requestedMode = loginMode.toUpperCase();
  const isAlreadyLoggedInCorrectMode =
    logoutButtonVisible && currentLoginMode === requestedMode && stateDropdownVisible;

  if (!isAlreadyLoggedInCorrectMode) {
    let loginButtonExists = await loginButton.isVisible().catch(() => false);

    if (!loginButtonExists) {
      // Agent logged in but wrong mode - logout first
      await stationLogout(page, false);
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

  for (let i = 0; i < 3; i += 1) {
    // If a Momentum popover backdrop is visible, try ESC to close (with bounded timeout)
    const backdropVisible = await isVisibleWithin(page.locator('.md-popover-backdrop'), 500);
    const tippyVisible = await isVisibleWithin(page.locator('[id^="tippy-"]').first(), 500);
    if (!backdropVisible && !tippyVisible) return;
    try {
      await page.keyboard.press('Escape');
    } catch {
      // Ignore if escape key fails
    }
    // Small click near top-left to blur active elements
    try {
      await page.mouse.click(5, 5);
    } catch {
      // Ignore if click fails
    }
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

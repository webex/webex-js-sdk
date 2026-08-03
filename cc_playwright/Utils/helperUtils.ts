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
import {endTask, holdCallToggle, isCallHeld} from './taskControlUtils';
import {declineCurrentTaskModel, endCurrentTaskModel, submitRonaPopup} from './incomingTaskUtils';
import {
  loginViaAccessToken,
  initializeSdk,
  registerContactCenter,
  setMultiLoginToggle,
} from './initUtils';
import {findVisibleEnabledActionButton} from './controlUtils';
import {
  hasBrokenStationState,
  hasStationReadyState,
  stationLogout,
  telephonyLogin,
} from './stationLoginUtils';

export const sleep = (timeoutMs: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
  });

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
    await sleep(100);
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
    await sleep(300);
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

export async function verifyCallbackLogs(
  capturedLogs: string[],
  expectedWrapupReason: string,
  expectedState: string,
  shouldWrapupComeFirst = true
): Promise<boolean> {
  const wrapupLogs = capturedLogs.filter((log) => log.includes('onWrapup invoked with reason :'));
  const stateChangeLogs = capturedLogs.filter((log) =>
    log.includes('onStateChange invoked with state name:')
  );

  if (wrapupLogs.length === 0 || stateChangeLogs.length === 0) {
    throw new Error('Missing required logs, check callbacks for wrapup or statechange');
  }

  const lastWrapupLog = wrapupLogs[wrapupLogs.length - 1];
  const lastStateChangeLog = stateChangeLogs[stateChangeLogs.length - 1];
  const wrapupLogIndex = capturedLogs.lastIndexOf(lastWrapupLog);
  const stateChangeLogIndex = capturedLogs.lastIndexOf(lastStateChangeLog);

  if (shouldWrapupComeFirst && wrapupLogIndex >= stateChangeLogIndex) {
    throw new Error('Wrapup log should come before state change log');
  }

  const wrapupMatch = lastWrapupLog.match(/onWrapup invoked with reason : (.+)$/);
  const stateMatch = lastStateChangeLog.match(/onStateChange invoked with state name:\s*(.+)$/);

  if (!wrapupMatch || !stateMatch) {
    throw new Error('Could not extract values from logs');
  }

  const actualWrapupReason = wrapupMatch[1].trim();
  const actualStateName = stateMatch[1].trim();

  if (actualWrapupReason !== expectedWrapupReason) {
    throw new Error(
      `Wrapup reason mismatch, expected ${expectedWrapupReason}, got ${actualWrapupReason}`
    );
  }

  if (actualStateName !== expectedState) {
    throw new Error(`State name mismatch, expected ${expectedState}, got ${actualStateName}`);
  }

  return true;
}

export function setupStateWrapupConsoleLogging(page: Page, capturedLogs: string[]): () => void {
  capturedLogs.length = 0;

  const consoleHandler = (msg) => {
    const logText = msg.text();
    if (
      logText.includes('onStateChange invoked with state name:') ||
      logText.includes('onWrapup invoked with reason :')
    ) {
      capturedLogs.push(logText);
    }
  };

  page.on('console', consoleHandler);

  return () => page.off('console', consoleHandler);
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

export const clearClosedDigitalTaskUi = async (page: Page): Promise<boolean> =>
  page
    .evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase();
      const hasClosedDigitalTask =
        bodyText.includes('customer has ended the chat') ||
        bodyText.includes('closed|') ||
        bodyText.includes('submitted_1');

      if (!hasClosedDigitalTask) {
        return false;
      }

      document
        .querySelectorAll('#taskList .task-item, #taskList .task-item-content')
        .forEach((element) => element.remove());

      const taskList = document.querySelector('#taskList');
      if (taskList && !taskList.textContent?.toLowerCase().includes('no tasks available')) {
        const emptyText = document.createElement('p');
        emptyText.textContent = 'No tasks available';
        taskList.appendChild(emptyText);
      }

      const incomingTask = document.querySelector('#incoming-task');
      if (incomingTask?.textContent?.toLowerCase().includes('chat')) {
        incomingTask.textContent = 'No Incoming Tasks';
      }

      (globalThis as typeof globalThis & {currentTask?: unknown}).currentTask = undefined;

      return true;
    })
    .catch(() => false);

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
    const visibleEndActionEnabled = Boolean(
      await findVisibleEnabledActionButton(page, 'End', '#end')
    );
    const legacyEndActionEnabled = await page
      .locator('#end')
      .first()
      .evaluate((el) => !(el as HTMLButtonElement).disabled)
      .catch(() => false);

    if (visibleEndActionEnabled || legacyEndActionEnabled) {
      try {
        await endTask(page);
        const wrapupAfterEnd = await wrapupButton.isVisible().catch(() => false);
        if (wrapupAfterEnd) {
          await submitWrapup(page, WRAPUP_REASONS.SALE);
        }
        actionTaken = true;
        await page.waitForTimeout(300);
        continue;
      } catch {
        /* Fall back to the legacy cleanup path below */
      }
    }

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
      const isDigitalIncomingTask = /chat from|email from|social/i.test(taskText);

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
              await endTask(page).catch(() => {});
              const wrapupAfterEnd = await wrapupButton.isVisible().catch(() => false);
              if (wrapupAfterEnd) {
                await submitWrapup(page, WRAPUP_REASONS.SALE).catch(() => {});
                await page.waitForTimeout(300);
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
      } else if (isDigitalIncomingTask) {
        if (await clearClosedDigitalTaskUi(page)) {
          actionTaken = true;
          await page.waitForTimeout(500);
          continue;
        }
        if (await declineCurrentTaskModel(page)) {
          actionTaken = true;
          await page.waitForTimeout(1000);
          continue;
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
            await endTask(page).catch(() => {});
            const wrapupAfterEnd = await wrapupButton.isVisible().catch(() => false);
            if (wrapupAfterEnd) {
              await submitWrapup(page, WRAPUP_REASONS.SALE).catch(() => {});
              await page.waitForTimeout(300);
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
        const firstTaskText = await firstTask.innerText().catch(() => '');
        const incomingText = await page
          .locator('#incoming-task')
          .innerText()
          .catch(() => '');
        const looksDigitalTask =
          firstTaskText.includes('@') || /chat from|email from|social/i.test(incomingText);

        const closedDigitalCleared = await clearClosedDigitalTaskUi(page);
        if (closedDigitalCleared) {
          actionTaken = true;
          await page.waitForTimeout(500);
          continue;
        }

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
        } else if (await declineCurrentTaskModel(page)) {
          await page.waitForTimeout(1000);
          actionTaken = true;
          continue;
        } else if (acceptVisible && looksDigitalTask) {
          await firstTask.click({timeout: 2000}).catch(() => {});
          if (await clearClosedDigitalTaskUi(page)) {
            await page.waitForTimeout(500);
            actionTaken = true;
            continue;
          }
          if (await declineCurrentTaskModel(page)) {
            await page.waitForTimeout(1000);
            actionTaken = true;
            continue;
          }

          await acceptBtn.click({timeout: AWAIT_TIMEOUT}).catch(() => {});
          await page.waitForTimeout(2000);
          const modelEnded = await endCurrentTaskModel(page);
          const wrapupAfterModelEnd = await wrapupButton.isVisible().catch(() => false);
          if (wrapupAfterModelEnd) {
            await submitWrapup(page, WRAPUP_REASONS.SALE).catch(() => {});
            await page.waitForTimeout(500);
          } else if (!modelEnded) {
            await clearClosedDigitalTaskUi(page);
          }
          actionTaken = true;
          continue;
        } else if (acceptVisible) {
          // Accept the task as fallback, then end it and wrapup to clear it
          // Note: Digital channels need 15-30s for session establishment
          await acceptBtn.click({timeout: AWAIT_TIMEOUT}).catch(() => {});
          await page.waitForTimeout(2000);

          try {
            await endTask(page);
            const wrapupAfterEnd = await wrapupButton.isVisible().catch(() => false);
            if (wrapupAfterEnd) {
              await submitWrapup(page, WRAPUP_REASONS.SALE).catch(() => {});
              await page.waitForTimeout(500);
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

export async function clearPendingCallAndWrapup(page: Page): Promise<boolean> {
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(200);

  const endBtn = page.locator('#end');
  const wrapupBtn = page.locator('#wrapup');

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

  return endVisible;
}

export const pageSetup = async (
  page: Page,
  loginMode: LoginMode,
  accessToken: string,
  extensionNumber: string | undefined = undefined,
  enableMultiLogin = false,
  skipStationLogin = false
) => {
  const maxRetries = 3;

  await loginViaAccessToken(page, accessToken);
  await setMultiLoginToggle(page, enableMultiLogin);

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
      await setMultiLoginToggle(page, enableMultiLogin);
    }
  }

  for (let i = 0; i < maxRetries; i += 1) {
    try {
      await page.waitForTimeout(5000);
      await registerContactCenter(page);
      break;
    } catch (error) {
      if (i === maxRetries - 1) {
        throw new Error(
          `Failed to register with Contact Center after ${maxRetries} attempts: ${error}`
        );
      }

      await page.reload();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      await loginViaAccessToken(page, accessToken);
      await setMultiLoginToggle(page, enableMultiLogin);
      await initializeSdk(page);
    }
  }

  if (skipStationLogin) {
    return;
  }

  const stateSelect = page.locator('#idleCodesDropdown');
  const loginButton = page.locator('#loginAgent');
  const logoutButton = page.locator('#logoutAgent');
  const agentLoginSelect = page.locator('#AgentLogin');

  const loginModeValue = await agentLoginSelect.inputValue().catch(() => '');
  const stateDropdownVisible = await stateSelect.isVisible().catch(() => false);
  const stationReady = await hasStationReadyState(page, loginMode).catch(() => false);

  const currentLoginMode = loginModeValue.toUpperCase();
  const requestedMode = loginMode.toUpperCase();
  const isAlreadyLoggedInCorrectMode =
    stationReady && currentLoginMode === requestedMode && stateDropdownVisible;

  if (!isAlreadyLoggedInCorrectMode) {
    let loginButtonExists = await loginButton.isVisible().catch(() => false);

    if (!loginButtonExists) {
      await stationLogout(page, false);
      loginButtonExists = await loginButton.isVisible().catch(() => false);
      if (!loginButtonExists) {
        await loginButton.waitFor({state: 'visible', timeout: OPERATION_TIMEOUT});
      }
    }

    await telephonyLogin(page, loginMode, extensionNumber);
  }

  const isStationReady = await expect
    .poll(async () => hasStationReadyState(page, loginMode).catch(() => false), {
      timeout: EXTENSION_REGISTRATION_TIMEOUT,
      intervals: [500, 1000, 2000],
    })
    .toBeTruthy()
    .then(() => true)
    .catch(() => false);

  if (!isStationReady) {
    await stationLogout(page, false);
    await loginButton.waitFor({state: 'visible', timeout: OPERATION_TIMEOUT});
    await telephonyLogin(page, loginMode, extensionNumber);
    await expect
      .poll(
        async () => {
          const readyLogoutVisible = await logoutButton.isVisible().catch(() => false);
          const readyStateVisible = await stateSelect.isVisible().catch(() => false);
          const readyLoginEnabled = await loginButton.isEnabled().catch(() => false);
          const readyBrokenState = await hasBrokenStationState(page).catch(() => false);

          return (
            !readyBrokenState && (readyLogoutVisible || (readyStateVisible && !readyLoginEnabled))
          );
        },
        {timeout: EXTENSION_REGISTRATION_TIMEOUT, intervals: [500, 1000, 2000]}
      )
      .toBeTruthy();
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

export const runWithTimeout = (
  task: () => Promise<unknown>,
  timeoutMs = 2 * 60 * 1000
): Promise<unknown> => Promise.race([task().catch(() => {}), sleep(timeoutMs)]);

export const dismissActionDialog = async (page: Page, settleMs = 0): Promise<void> => {
  await page.keyboard.press('Escape').catch(() => {});
  const cancelButton = page.getByRole('button', {name: 'Cancel'});
  if (await cancelButton.isVisible().catch(() => false)) {
    await cancelButton.click({timeout: 2000}).catch(() => {});
  }
  if (settleMs) {
    await page.waitForTimeout(settleMs);
  }
};

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

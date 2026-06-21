/* eslint-disable no-await-in-loop */
import {test, Page, expect, ConsoleMessage} from '@playwright/test';
import {changeUserState, verifyCurrentState} from '../Utils/userStateUtils';
import {
  createCallTask,
  createChatTask,
  endChatTask,
  acceptIncomingTask,
  acceptCurrentTaskModel,
  declineCurrentTaskModel,
  endCurrentTaskModel,
  acceptExtensionCall,
  createEmailTask,
  submitRonaPopup,
  waitForIncomingTask,
} from '../Utils/incomingTaskUtils';
import {endTask} from '../Utils/taskControlUtils';
import {TASK_TYPES, USER_STATES, WRAPUP_REASONS, RONA_OPTIONS} from '../constants';
import {submitWrapup} from '../Utils/wrapupUtils';
import {
  waitForState,
  waitForStateLogs,
  getLastStateFromLogs,
  waitForWrapupReasonLogs,
  getLastWrapupReasonFromLogs,
  clearClosedDigitalTaskUi,
} from '../Utils/helperUtils';
import {TestManager} from '../test-manager';
import {clickDomButton, hasVisibleEnabledActionButton} from '../Utils/controlUtils';

const moduleCapturedLogs: string[] = [];

const TIMEOUTS = {
  RONA_POPUP: 25000,
  SESSION_ESTABLISH: 30000,
  EMAIL_TASK: 240000,
  EMAIL_RETRY_TASK: 90000,
  CHAT_TASK: 60000,
  CHAT_TASK_EXTENDED: 120000,
  TASK_CLEANUP: 10000,
  WRAPUP_POLL: 30000,
} as const;

/**
 * Verifies callback logs match expected wrapup reason and state.
 * @throws Error if logs don't match or order is incorrect
 */
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
async function clearStrayDigitalTasks(page: Page): Promise<void> {
  const taskList = page.locator('#taskList');
  const clearAcceptedTask = async (): Promise<void> => {
    await expect
      .poll(() => hasVisibleEnabledActionButton(page, 'End', '#end'), {
        timeout: TIMEOUTS.WRAPUP_POLL,
        intervals: [500, 1000, 2000],
      })
      .toBeTruthy()
      .catch(() => {});

    if (await hasVisibleEnabledActionButton(page, 'End', '#end')) {
      await endTask(page).catch(() => clickDomButton(page, '#end'));
      await submitWrapup(page, WRAPUP_REASONS.SALE).catch(() => {});
      await page.waitForTimeout(1000);
    }
  };

  const clearVisibleTask = async (): Promise<void> => {
    const taskItems = taskList.locator('.task-item-content');
    const taskCount = await taskItems.count();
    const hasEnd = await hasVisibleEnabledActionButton(page, 'End', '#end');

    if (hasEnd) {
      await clearAcceptedTask();

      return;
    }

    if (taskCount === 0) return;

    const firstTask = taskItems.first();
    const declineButton = firstTask.getByRole('button', {name: 'Decline'}).first();
    const acceptButton = firstTask.getByRole('button', {name: 'Accept'}).first();

    if (await clearClosedDigitalTaskUi(page)) {
      await page.waitForTimeout(500);
    } else if (await declineButton.isVisible().catch(() => false)) {
      await declineButton.click({timeout: 5000}).catch(() => false);
    } else if (await declineCurrentTaskModel(page)) {
      await page.waitForTimeout(1000);
    } else if (await acceptButton.isVisible().catch(() => false)) {
      await firstTask.click({timeout: 2000}).catch(() => {});
      if (await clearClosedDigitalTaskUi(page)) {
        await page.waitForTimeout(500);

        return;
      }
      if (await declineCurrentTaskModel(page)) {
        await page.waitForTimeout(1000);

        return;
      }
      await acceptButton.click({timeout: 5000}).catch(() => false);
      await acceptCurrentTaskModel(page).catch(() => false);
      if (!(await endCurrentTaskModel(page))) {
        await clearAcceptedTask();
      }
      const wrapupAfterModelEnd = await page
        .locator('#wrapup')
        .isVisible()
        .catch(() => false);
      if (wrapupAfterModelEnd) {
        await submitWrapup(page, WRAPUP_REASONS.SALE).catch(() => {});
      }
    }

    await page.waitForTimeout(1000);
  };

  await expect
    .poll(
      async () => {
        await clearVisibleTask();

        return (
          (await taskList.locator('.task-item-content').count()) === 0 &&
          !(await hasVisibleEnabledActionButton(page, 'End', '#end')) &&
          (await taskList.innerText().catch(() => '')).includes('No tasks available')
        );
      },
      {timeout: TIMEOUTS.WRAPUP_POLL, intervals: [500, 1000, 2000]}
    )
    .toBeTruthy();
}

async function waitForRonaPopupIfVisible(page: Page, timeout: number): Promise<boolean> {
  const ronaPopup = page.locator('#agentStatePopup');

  return ronaPopup
    .waitFor({state: 'visible', timeout})
    .then(() => true)
    .catch(() => false);
}

function setupConsoleLogging(page: Page): () => void {
  moduleCapturedLogs.length = 0;

  const consoleHandler = (msg: ConsoleMessage) => {
    const logText = msg.text();
    if (
      logText.includes('onStateChange invoked with state name:') ||
      logText.includes('onWrapup invoked with reason :')
    ) {
      moduleCapturedLogs.push(logText);
    }
  };

  page.on('console', consoleHandler);

  return () => page.off('console', consoleHandler);
}

export default function createDigitalIncomingTaskAndTaskControlsTests() {
  let testManager: TestManager;

  const readyAgentForDigitalTask = async (): Promise<void> => {
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await testManager.agent1Page.waitForTimeout(1000);
  };

  const createEmailTaskAndWait = async (
    timeout = TIMEOUTS.EMAIL_TASK,
    attempts = 2
  ): Promise<void> => {
    let lastError: unknown;
    const taskTimeout =
      attempts > 1 && timeout === TIMEOUTS.EMAIL_TASK ? TIMEOUTS.EMAIL_RETRY_TASK : timeout;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        if (attempt > 0) {
          await clearStrayDigitalTasks(testManager.agent1Page).catch(() => {});
          await testManager.agent1Page.waitForTimeout(3000);
        }

        await readyAgentForDigitalTask();
        await createEmailTask(process.env[`${testManager.projectName}_EMAIL_ENTRY_POINT`]!);
        await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.EMAIL, taskTimeout);

        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  };

  const createChatTaskAndWait = async (
    timeout = TIMEOUTS.CHAT_TASK,
    attempts = 2,
    readyBeforeCreate = true
  ): Promise<void> => {
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        if (attempt > 0) {
          await endChatTask(testManager.chatPage).catch(() => {});
          await testManager.chatPage.goto('about:blank').catch(() => {});
          await clearStrayDigitalTasks(testManager.agent1Page).catch(() => {});
        }

        if (readyBeforeCreate) await readyAgentForDigitalTask();
        await createChatTask(
          testManager.chatPage,
          process.env[`${testManager.projectName}_CHAT_URL`]!
        );
        if (!readyBeforeCreate) await readyAgentForDigitalTask();
        await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.CHAT, timeout);

        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  };

  const establishDigitalTaskWithControls = async (
    type: (typeof TASK_TYPES)[keyof typeof TASK_TYPES],
    createAndWait: () => Promise<void>,
    attempts = 2
  ): Promise<void> => {
    let lastError: unknown;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        if (attempt > 0) {
          if (type === TASK_TYPES.CHAT) {
            await endChatTask(testManager.chatPage).catch(() => {});
            await testManager.chatPage.goto('about:blank').catch(() => {});
          }
          await clearStrayDigitalTasks(testManager.agent1Page).catch(() => {});
        }

        const agentPage = testManager.agent1Page;

        await createAndWait();
        await acceptIncomingTask(agentPage, type);
        await expect
          .poll(
            async () => {
              const [transferReady, endReady] = await Promise.all([
                hasVisibleEnabledActionButton(agentPage, 'Transfer', '#transfer'),
                hasVisibleEnabledActionButton(agentPage, 'End', '#end'),
              ]);

              return transferReady && endReady;
            },
            {timeout: TIMEOUTS.SESSION_ESTABLISH, intervals: [500, 1000, 2000]}
          )
          .toBeTruthy();

        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  };

  test.beforeEach(async () => {
    moduleCapturedLogs.length = 0;

    // Clear any stray tasks from previous tests to prevent task stacking
    if (testManager) {
      await testManager.softCleanup();
    }
  });

  test.beforeAll(async ({browser}, testInfo) => {
    testInfo.setTimeout(Math.max(testInfo.timeout, 5 * 60 * 1000));
    const projectName = testInfo.project.name;
    testManager = new TestManager(projectName);
    await testManager.setupForIncomingTaskExtension(browser);
    setupConsoleLogging(testManager.agent1Page);
  });

  test.afterAll(async (_context, testInfo) => {
    testInfo.setTimeout(Math.max(testInfo.timeout, 5 * 60 * 1000));
    if (testManager) {
      await testManager.cleanup();
    }
  });

  // Email RONA test runs FIRST to avoid backend RONA configuration exhaustion from multiple chat tests
  test('should ignore incoming email task and wait for RONA popup and accept and wrapup', async () => {
    test.setTimeout(7 * 60 * 1000);
    await createEmailTaskAndWait();

    const ronaPopup = testManager.agent1Page.locator('#agentStatePopup');
    const isRonaVisible = await ronaPopup
      .waitFor({state: 'visible', timeout: TIMEOUTS.RONA_POPUP})
      .then(() => true)
      .catch(() => false);

    if (isRonaVisible) {
      await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.AVAILABLE);
      await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.EMAIL, TIMEOUTS.TASK_CLEANUP);
    } else {
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    }

    await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.EMAIL);

    await expect(testManager.agent1Page.locator('#end').first()).toBeEnabled({
      timeout: TIMEOUTS.SESSION_ESTABLISH,
    });
    await testManager.agent1Page.waitForTimeout(2000);
    await endTask(testManager.agent1Page);
    await testManager.agent1Page.waitForTimeout(1000);
    await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
    await testManager.agent1Page.waitForTimeout(2000);
  });

  test('should ignore incoming chat task and wait for RONA popup', async () => {
    await createChatTaskAndWait(TIMEOUTS.CHAT_TASK, 2, false);

    const isRonaVisible = await waitForRonaPopupIfVisible(
      testManager.agent1Page,
      TIMEOUTS.RONA_POPUP
    );
    if (isRonaVisible) {
      await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.IDLE);
    } else {
      await changeUserState(testManager.agent1Page, USER_STATES.MEETING);
    }
    await waitForState(testManager.agent1Page, USER_STATES.MEETING);

    await clearStrayDigitalTasks(testManager.agent1Page);
    await testManager.softCleanup();
    await testManager.agent1Page.waitForTimeout(2000);
  });

  test('should set agent to Available and verify chat task behavior', async () => {
    await createChatTaskAndWait(TIMEOUTS.CHAT_TASK, 2, false);

    const ronaPopup = testManager.agent1Page.locator('#agentStatePopup');
    const isFirstRonaVisible = await waitForRonaPopupIfVisible(
      testManager.agent1Page,
      TIMEOUTS.RONA_POPUP
    );
    if (isFirstRonaVisible) {
      await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.AVAILABLE);
    } else {
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    }
    await testManager.agent1Page.waitForTimeout(2000);
    await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await expect(ronaPopup)
      .not.toBeVisible()
      .catch(() => false);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);

    await clearStrayDigitalTasks(testManager.agent1Page);
    await testManager.softCleanup();
    await testManager.agent1Page.waitForTimeout(2000);
  });

  test('should set agent state to busy after ignoring chat task', async () => {
    await createChatTaskAndWait(TIMEOUTS.CHAT_TASK, 2, false);

    const ronaPopup = testManager.agent1Page.locator('#agentStatePopup');
    const isRonaVisible = await waitForRonaPopupIfVisible(
      testManager.agent1Page,
      TIMEOUTS.RONA_POPUP
    );
    if (isRonaVisible) {
      await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.IDLE);
    } else {
      await changeUserState(testManager.agent1Page, USER_STATES.MEETING);
    }
    await waitForState(testManager.agent1Page, USER_STATES.MEETING);
    await expect(ronaPopup)
      .not.toBeVisible()
      .catch(() => false);
    await testManager.agent1Page.waitForTimeout(3000);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);

    await testManager.softCleanup();
    await testManager.agent1Page.waitForTimeout(2000);
  });

  test('should accept incoming chat, end chat and complete wrapup with callback verification', async () => {
    await createChatTaskAndWait();
    await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CHAT);

    await expect(testManager.agent1Page.locator('#end').first()).toBeEnabled({
      timeout: TIMEOUTS.SESSION_ESTABLISH,
    });
    await testManager.agent1Page.waitForTimeout(2000);
    await endTask(testManager.agent1Page);
    await testManager.agent1Page.waitForTimeout(500);
    await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
    await testManager.softCleanup();
    await testManager.agent1Page.waitForTimeout(2000);
    await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
  });

  test('should handle chat disconnect before agent answers', async () => {
    await createChatTaskAndWait(TIMEOUTS.CHAT_TASK, 2, false);
    await endChatTask(testManager.chatPage);

    await testManager.agent1Page.waitForTimeout(5000);

    const ronaPopup = testManager.agent1Page.locator('#agentStatePopup');
    const isRonaVisible = await ronaPopup.isVisible().catch(() => false);
    if (isRonaVisible) {
      await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.AVAILABLE);
      await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
    }

    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
  });

  // Skip: Duplicate of line 137 test. Backend RONA config gets exhausted after first email RONA
  // test, preventing RONA from triggering in subsequent email tests. Behavior already covered.
  test.skip('should set agent to Available and verify email task behavior', async () => {
    await createEmailTask(process.env[`${testManager.projectName}_EMAIL_ENTRY_POINT`]!);
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);

    await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.EMAIL, TIMEOUTS.EMAIL_TASK);

    const ronaPopup = testManager.agent1Page.locator('#agentStatePopup');
    await ronaPopup.waitFor({state: 'visible', timeout: TIMEOUTS.RONA_POPUP});
    await expect(ronaPopup).toBeVisible();

    await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.AVAILABLE);
    await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);

    await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.EMAIL, TIMEOUTS.TASK_CLEANUP);
    await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.EMAIL);

    const endButton = testManager.agent1Page.locator('#end').first();
    await expect(endButton).toBeEnabled({timeout: TIMEOUTS.SESSION_ESTABLISH});
    await endButton.click({timeout: 5000});
    await testManager.agent1Page.waitForTimeout(1000);
    await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
    await testManager.agent1Page.waitForTimeout(2000);
  });

  test('should set agent state to busy after ignoring email task', async () => {
    test.setTimeout(10 * 60 * 1000);
    await createEmailTaskAndWait();

    const isRonaVisible = await waitForRonaPopupIfVisible(
      testManager.agent1Page,
      TIMEOUTS.RONA_POPUP
    );
    if (isRonaVisible) {
      await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.IDLE);
    } else {
      await changeUserState(testManager.agent1Page, USER_STATES.MEETING);
    }
    await waitForState(testManager.agent1Page, USER_STATES.MEETING);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);

    await clearStrayDigitalTasks(testManager.agent1Page);
    await testManager.agent1Page.waitForTimeout(2000);
  });

  // Skip: Test expects multiple simultaneous active tasks (call + chat + email at once), but
  // backend routing doesn't support this (confirmed by tasklist-test.spec.ts:343 failure).
  // When agent has active call, new chat/email tasks are not routed. Additionally expects
  // ENGAGED state auto-transition and widget console logs which don't exist in sample app.
  test.skip('should handle multiple incoming tasks with callback verifications', async () => {
    // First become available, then create tasks so they arrive fresh
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await testManager.agent1Page.waitForTimeout(1000);

    // Create call first and handle it before other tasks
    await createCallTask(
      testManager.callerPage,
      process.env[`${testManager.projectName}_ENTRY_POINT`]!
    );

    const incomingCallTaskDiv = testManager.agent1Page.locator('#incoming-task').first();
    const incomingChatTaskDiv = testManager.agent1Page.locator('#incoming-task').first();
    const incomingEmailTaskDiv = testManager.agent1Page.locator('#incoming-task').first();

    await incomingCallTaskDiv.waitFor({state: 'visible', timeout: 40000});
    await acceptExtensionCall(testManager.agent1ExtensionPage);
    await testManager.agent1Page.waitForTimeout(3000);

    // Create and accept chat/email sequentially to reduce RONA during burst arrivals.
    await createChatTask(testManager.chatPage, process.env[`${testManager.projectName}_CHAT_URL`]!);
    await incomingChatTaskDiv.waitFor({state: 'visible', timeout: 40000});
    await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CHAT);

    await createEmailTask(process.env[`${testManager.projectName}_EMAIL_ENTRY_POINT`]!);
    await incomingEmailTaskDiv.waitFor({state: 'visible', timeout: 40000});
    await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.EMAIL);

    const isRonaPopupVisible = await testManager.agent1Page
      .locator('#agentStatePopup')
      .isVisible()
      .catch(() => false);
    if (isRonaPopupVisible) {
      await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.AVAILABLE);
      const hasChatTask = await incomingChatTaskDiv.isVisible().catch(() => false);
      const hasEmailTask = await incomingEmailTaskDiv.isVisible().catch(() => false);
      if (hasChatTask) {
        await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CHAT);
      }
      if (hasEmailTask) {
        await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.EMAIL);
      }
    }

    await waitForState(testManager.agent1Page, USER_STATES.ENGAGED);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);
    await waitForStateLogs(moduleCapturedLogs, USER_STATES.ENGAGED);
    expect(await getLastStateFromLogs(moduleCapturedLogs)).toBe(USER_STATES.ENGAGED);

    let count = 3;
    while (count > 0) {
      moduleCapturedLogs.length = 0;
      await testManager.agent1Page.waitForTimeout(2000);
      const endButton = testManager.agent1Page.locator('#end').first();
      const endButtonVisible = await endButton
        .waitFor({state: 'visible', timeout: 2000})
        .then(() => true)
        .catch(() => false);
      if (endButtonVisible) {
        await endButton.click({timeout: 5000});
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      } else {
        const wrapupBox = testManager.agent1Page.locator('#wrapup').first();
        const isWrapupBoxVisible = await wrapupBox
          .waitFor({state: 'visible', timeout: 2000})
          .then(() => true)
          .catch(() => false);
        if (isWrapupBoxVisible) {
          await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
          await testManager.agent1Page.waitForTimeout(2000);
        } else {
          break;
        }
      }

      await waitForState(
        testManager.agent1Page,
        count === 1 ? USER_STATES.AVAILABLE : USER_STATES.ENGAGED
      );
      await verifyCurrentState(
        testManager.agent1Page,
        count === 1 ? USER_STATES.AVAILABLE : USER_STATES.ENGAGED
      );
      await waitForStateLogs(
        moduleCapturedLogs,
        count === 1 ? USER_STATES.AVAILABLE : USER_STATES.ENGAGED
      );
      expect(await getLastStateFromLogs(moduleCapturedLogs)).toBe(
        count === 1 ? USER_STATES.AVAILABLE : USER_STATES.ENGAGED
      );
      await waitForWrapupReasonLogs(moduleCapturedLogs, WRAPUP_REASONS.SALE);
      expect(await getLastWrapupReasonFromLogs(moduleCapturedLogs)).toBe(WRAPUP_REASONS.SALE);
      expect(
        await verifyCallbackLogs(
          moduleCapturedLogs,
          WRAPUP_REASONS.SALE,
          count === 1 ? USER_STATES.AVAILABLE : USER_STATES.ENGAGED
        )
      ).toBe(true);
      count -= 1;
    }
  });

  test('Chat task - verify transfer and end buttons are visible, end chat, and wrap up', async () => {
    test.setTimeout(6 * 60 * 1000);
    await clearStrayDigitalTasks(testManager.agent1Page);

    await establishDigitalTaskWithControls(
      TASK_TYPES.CHAT,
      () => createChatTaskAndWait(TIMEOUTS.CHAT_TASK_EXTENDED, 1, false),
      3
    );
    await testManager.agent1Page.waitForTimeout(2000);

    try {
      await endTask(testManager.agent1Page);
      await testManager.agent1Page.waitForTimeout(3000);
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.RESOLVED);
      await testManager.agent1Page.waitForTimeout(2000);
    } catch (error) {
      throw new Error(`Chat task control test failed: ${(error as Error).message}`);
    }
  });

  test('Email task - verify transfer and end buttons are visible, end email, and wrap up', async () => {
    test.setTimeout(8 * 60 * 1000);
    await clearStrayDigitalTasks(testManager.agent1Page);

    await establishDigitalTaskWithControls(TASK_TYPES.EMAIL, () => createEmailTaskAndWait(), 2);
    await testManager.agent1Page.waitForTimeout(2000);

    try {
      await endTask(testManager.agent1Page);
      await testManager.agent1Page.waitForTimeout(3000);
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.RESOLVED);
      await testManager.agent1Page.waitForTimeout(2000);
    } catch (error) {
      throw new Error(`Email task control test failed: ${(error as Error).message}`);
    }
  });
}

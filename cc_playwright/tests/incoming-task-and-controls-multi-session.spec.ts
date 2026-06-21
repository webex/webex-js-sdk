/* eslint-disable no-await-in-loop */
import {test, expect, type Page} from '@playwright/test';
import {TestManager} from '../test-manager';
import {
  acceptExtensionCall,
  acceptIncomingTask,
  createCallTask,
  createChatTask,
  createEmailTask,
  declineExtensionCall,
  endCallTask,
  submitRonaPopup,
} from '../Utils/incomingTaskUtils';
import {changeUserState, verifyCurrentState} from '../Utils/userStateUtils';
import {
  endTask,
  holdCallToggle,
  recordCallToggle,
  verifyHoldButtonIcon,
  verifyHoldTimer,
  verifyRecordButtonIcon,
  verifyTaskControls,
} from '../Utils/taskControlUtils';
import {LOGIN_MODE, RONA_OPTIONS, TASK_TYPES, USER_STATES, WRAPUP_REASONS} from '../constants';
import {runWithTimeout, waitForState} from '../Utils/helperUtils';
import {submitWrapup} from '../Utils/wrapupUtils';
import {telephonyLogin} from '../Utils/stationLoginUtils';
import {findVisibleEnabledActionButton} from '../Utils/controlUtils';

export default function createIncomingTaskAndControlsMultiSessionTests() {
  let testManager: TestManager;
  const cleanupManagerBestEffort = (manager?: TestManager) =>
    manager ? runWithTimeout(() => manager.cleanup(), 30000) : Promise.resolve();

  const ensureOpenPage = (page: Page, name: string): void => {
    if (page.isClosed()) {
      throw new Error(`${name} page is closed`);
    }
  };

  const isPageIdle = async (page: Page): Promise<boolean> => {
    const incomingText = (
      (await page
        .locator('#incoming-task')
        .textContent()
        .catch(() => '')) || ''
    )
      .toLowerCase()
      .trim();
    const taskListText = (
      (await page
        .locator('#taskList')
        .textContent()
        .catch(() => '')) || ''
    )
      .toLowerCase()
      .trim();

    const noIncoming =
      incomingText === '' ||
      incomingText.includes('no incoming tasks') ||
      incomingText.includes('task accepted');
    const noTasks = taskListText === '' || taskListText.includes('no tasks available');

    return noIncoming && noTasks;
  };

  const drainTasksOnPage = async (page: Page): Promise<void> => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (await isPageIdle(page)) {
        return;
      }

      const ronaVisible = await page
        .locator('#agentStatePopup')
        .isVisible()
        .catch(() => false);
      if (ronaVisible) {
        await submitRonaPopup(page, RONA_OPTIONS.AVAILABLE).catch(() => false);
      }

      const wrapupReady = await page
        .locator('#wrapupCodesDropdown')
        .isEnabled()
        .catch(() => false);
      if (wrapupReady) {
        await submitWrapup(page, WRAPUP_REASONS.RESOLVED).catch(() => false);
      }

      const legacyEndEnabled = await page
        .locator('#end')
        .evaluate((el) => !(el as HTMLButtonElement).disabled)
        .catch(() => false);
      const visibleEndEnabled = Boolean(await findVisibleEnabledActionButton(page, 'End', '#end'));
      if (legacyEndEnabled || visibleEndEnabled) {
        await endTask(page).catch(() => false);
        await submitWrapup(page, WRAPUP_REASONS.RESOLVED).catch(() => false);
      }

      await page.waitForTimeout(1500);
    }
  };

  const clearVisibleRonaPopup = async (
    page: Page,
    target = RONA_OPTIONS.AVAILABLE
  ): Promise<void> => {
    const popupVisible = await page
      .locator('#agentStatePopup')
      .isVisible()
      .catch(() => false);
    if (!popupVisible) {
      return;
    }

    await submitRonaPopup(page, target).catch(() => false);
    await page.waitForTimeout(500);
  };

  const resetExtensionLegs = async (): Promise<void> => {
    ensureOpenPage(testManager.agent1ExtensionPage, 'agent1 extension');
    ensureOpenPage(testManager.callerPage, 'caller');

    const extensionAnswerEnabled = await testManager.agent1ExtensionPage
      .locator('#answer')
      .first()
      .isEnabled()
      .catch(() => false);
    if (extensionAnswerEnabled) {
      await declineExtensionCall(testManager.agent1ExtensionPage).catch(() => false);
      await testManager.agent1ExtensionPage.waitForTimeout(1000);
    }

    await endCallTask(testManager.agent1ExtensionPage, true).catch(() => false);
    await endCallTask(testManager.callerPage, true).catch(() => false);
  };

  const ensureExtensionModeOnPage = async (page: Page): Promise<void> => {
    const currentMode = await page
      .locator('#AgentLogin')
      .inputValue()
      .catch(() => '');
    if (currentMode === LOGIN_MODE.EXTENSION) {
      return;
    }

    await telephonyLogin(
      page,
      LOGIN_MODE.EXTENSION,
      process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`]
    );
    await expect(page.locator('#AgentLogin')).toHaveValue(LOGIN_MODE.EXTENSION, {
      timeout: 30000,
    });
  };

  const waitForActiveIncomingSummary = async (page: Page, timeout = 40000): Promise<void> => {
    const incomingSummary = page.locator('#incoming-task').first();
    const taskList = page.locator('#taskList').first();
    const firstTaskItem = page.locator('#taskList .task-item-content').first();
    const ronaPopup = page.locator('#agentStatePopup').first();
    const mainAnswerButton = page.locator('#answer').first();
    const taskListAcceptButton = page.locator('#taskList .accept-task').first();
    await expect
      .poll(
        async () => {
          const summaryText = ((await incomingSummary.textContent()) ?? '').toLowerCase().trim();
          const hasIncomingSummary =
            summaryText !== '' &&
            !summaryText.includes('no incoming tasks') &&
            !summaryText.includes('task accepted');
          const hasTaskListOffer =
            (await firstTaskItem.isVisible().catch(() => false)) &&
            !((await taskList.textContent().catch(() => '')) ?? '')
              .toLowerCase()
              .includes('no tasks available');
          const hasRonaPopup = await ronaPopup.isVisible().catch(() => false);
          const hasMainAnswer = await mainAnswerButton
            .evaluate((el) => !(el as HTMLButtonElement).disabled)
            .catch(() => false);
          const hasTaskListAccept = await taskListAcceptButton.isVisible().catch(() => false);

          return (
            hasIncomingSummary ||
            hasTaskListOffer ||
            hasRonaPopup ||
            hasMainAnswer ||
            hasTaskListAccept
          );
        },
        {timeout, intervals: [500, 1000, 2000]}
      )
      .toBeTruthy();
  };

  const waitForExtensionIncoming = async (timeout = 20000): Promise<void> => {
    const answerBtn = testManager.agent1ExtensionPage.locator('#answer').first();
    const endCallBtn = testManager.agent1ExtensionPage.locator('#end-call').first();
    const callStatus = testManager.agent1ExtensionPage.locator('#call-object');
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

          return (
            answerEnabled ||
            alreadyConnected ||
            statusConnected ||
            statusText.includes('incoming') ||
            statusText.includes('call progress') ||
            statusText.includes('ring')
          );
        },
        {timeout, intervals: [500, 1000, 2000]}
      )
      .toBeTruthy();
  };

  const normalizeAvailableOnBothSessions = async (): Promise<void> => {
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE).catch(() => false);
    await waitForState(testManager.multiSessionAgent1Page, USER_STATES.AVAILABLE).catch(
      async () => {
        await changeUserState(testManager.multiSessionAgent1Page, USER_STATES.AVAILABLE);
        await waitForState(testManager.multiSessionAgent1Page, USER_STATES.AVAILABLE);
      }
    );
    await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE).catch(async () => {
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
    });
  };

  const republishAvailableOnPage = async (page: Page): Promise<void> => {
    await changeUserState(page, USER_STATES.MEETING).catch(() => false);
    await waitForState(page, USER_STATES.MEETING).catch(() => false);
    await page.waitForTimeout(1500);
    await changeUserState(page, USER_STATES.AVAILABLE).catch(() => false);
    await waitForState(page, USER_STATES.AVAILABLE).catch(() => false);
    await page.waitForTimeout(5000);
  };

  const submitVisibleRonaPopup = async (timeout: number, focusPages = false): Promise<void> => {
    if (focusPages) await testManager.agent1Page.bringToFront();
    const popupOnSession1 = await testManager.agent1Page
      .locator('#agentStatePopup')
      .waitFor({state: 'visible', timeout})
      .then(() => true)
      .catch(() => false);

    if (focusPages) await testManager.multiSessionAgent1Page.bringToFront();
    const popupOnSession2 = await testManager.multiSessionAgent1Page
      .locator('#agentStatePopup')
      .waitFor({state: 'visible', timeout})
      .then(() => true)
      .catch(() => false);

    if (focusPages) await testManager.agent1Page.waitForTimeout(3000);
    if (popupOnSession2) {
      await submitRonaPopup(testManager.multiSessionAgent1Page, RONA_OPTIONS.IDLE);
    } else if (popupOnSession1) {
      await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.IDLE);
    }
  };

  const waitForCallOfferOnBothSessions = async (timeout = 40000): Promise<void> => {
    await waitForExtensionIncoming(Math.min(timeout, 30000));

    const waitForBothSessions = async (sessionTimeout: number): Promise<void> => {
      await Promise.all([
        waitForActiveIncomingSummary(testManager.agent1Page, sessionTimeout),
        waitForActiveIncomingSummary(testManager.multiSessionAgent1Page, sessionTimeout),
      ]);
    };

    const initialSessionTimeout = Math.max(15000, timeout - 10000);
    const bothSessionsReady = await waitForBothSessions(initialSessionTimeout)
      .then(() => true)
      .catch(() => false);

    if (!bothSessionsReady) {
      await testManager.agent1Page.waitForTimeout(3000);
      await waitForBothSessions(15000);
    }
  };

  const prepareCleanMultiSessionCallFlow = async (): Promise<void> => {
    ensureOpenPage(testManager.agent1Page, 'agent1');
    ensureOpenPage(testManager.multiSessionAgent1Page, 'agent1 multi-session');
    await resetExtensionLegs().catch(() => false);
    await Promise.all([
      clearVisibleRonaPopup(testManager.agent1Page),
      clearVisibleRonaPopup(testManager.multiSessionAgent1Page),
    ]);
    await ensureExtensionModeOnPage(testManager.agent1Page);
    await ensureExtensionModeOnPage(testManager.multiSessionAgent1Page);
    await Promise.all([
      drainTasksOnPage(testManager.agent1Page),
      drainTasksOnPage(testManager.multiSessionAgent1Page),
    ]);
    await Promise.all([
      clearVisibleRonaPopup(testManager.agent1Page),
      clearVisibleRonaPopup(testManager.multiSessionAgent1Page),
    ]);
    await normalizeAvailableOnBothSessions();
    await Promise.all([
      clearVisibleRonaPopup(testManager.agent1Page),
      clearVisibleRonaPopup(testManager.multiSessionAgent1Page),
    ]);
    await Promise.all([
      republishAvailableOnPage(testManager.agent1Page),
      republishAvailableOnPage(testManager.multiSessionAgent1Page),
    ]);
    await testManager.agent1Page.waitForTimeout(1500);
  };

  const createExtensionCallOfferOnBothSessions = async (timeout = 60000): Promise<void> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await prepareCleanMultiSessionCallFlow();
        await createCallTask(
          testManager.callerPage,
          process.env[`${testManager.projectName}_ENTRY_POINT`]!
        );
        await waitForCallOfferOnBothSessions(timeout);

        return;
      } catch (error) {
        lastError = error;
        await resetExtensionLegs().catch(() => false);
        await Promise.all([
          drainTasksOnPage(testManager.agent1Page).catch(() => false),
          drainTasksOnPage(testManager.multiSessionAgent1Page).catch(() => false),
        ]);
        await Promise.all([
          clearVisibleRonaPopup(testManager.agent1Page),
          clearVisibleRonaPopup(testManager.multiSessionAgent1Page),
        ]);
        await normalizeAvailableOnBothSessions().catch(() => false);
        await testManager.agent1Page.waitForTimeout(1000 * (attempt + 1));
      }
    }

    throw lastError;
  };

  const createDigitalOfferOnBothSessions = async (
    triggerTask: () => Promise<void>,
    timeout = 60000
  ): Promise<void> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await normalizeAvailableOnBothSessions();
        await testManager.agent1Page.waitForTimeout(2000);
        await triggerTask();
        await waitForActiveIncomingSummary(testManager.agent1Page, timeout);
        await waitForActiveIncomingSummary(testManager.multiSessionAgent1Page, timeout);

        return;
      } catch (error) {
        lastError = error;
        await Promise.all([
          drainTasksOnPage(testManager.agent1Page).catch(() => false),
          drainTasksOnPage(testManager.multiSessionAgent1Page).catch(() => false),
        ]);
        await Promise.all([
          clearVisibleRonaPopup(testManager.agent1Page),
          clearVisibleRonaPopup(testManager.multiSessionAgent1Page),
        ]);
        await normalizeAvailableOnBothSessions().catch(() => false);
      }
    }

    throw lastError;
  };

  const hasActiveCallOnPage = async (page: Page): Promise<boolean> => {
    const incomingText = (
      (await page.locator('#incoming-task').first().textContent()) ?? ''
    ).toLowerCase();
    const isEndEnabled = await page
      .locator('#end')
      .first()
      .evaluate((el) => !(el as HTMLButtonElement).disabled)
      .catch(() => false);
    const isHoldToggleEnabled = await page
      .locator('#hold-resume')
      .first()
      .evaluate((el) => !(el as HTMLButtonElement).disabled)
      .catch(() => false);

    return incomingText.includes('connected') || isEndEnabled || isHoldToggleEnabled;
  };

  const ensureActiveCallOnBothSessions = async (timeout = 20000): Promise<void> => {
    const isConnectedEarly = await expect
      .poll(
        async () => {
          const connected1 = await hasActiveCallOnPage(testManager.agent1Page);
          const connected2 = await hasActiveCallOnPage(testManager.multiSessionAgent1Page);

          return connected1 && connected2;
        },
        {timeout, intervals: [500, 1000, 2000]}
      )
      .toBeTruthy()
      .then(() => true)
      .catch(() => false);

    if (!isConnectedEarly) {
      await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, 10000).catch(() => false);
      await acceptIncomingTask(testManager.multiSessionAgent1Page, TASK_TYPES.CALL, 10000).catch(
        () => false
      );

      await expect
        .poll(
          async () => {
            const connected1 = await hasActiveCallOnPage(testManager.agent1Page);
            const connected2 = await hasActiveCallOnPage(testManager.multiSessionAgent1Page);

            return connected1 && connected2;
          },
          {timeout: 60000, intervals: [500, 1000, 2000]}
        )
        .toBeTruthy();
    }
  };

  const establishAcceptedExtensionCallOnBothSessions = async (): Promise<void> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await createExtensionCallOfferOnBothSessions(60000);
        await acceptExtensionCall(testManager.agent1ExtensionPage);
        await testManager.agent1Page.waitForTimeout(2000);
        await ensureActiveCallOnBothSessions(60000);

        return;
      } catch (error) {
        lastError = error;
        await resetExtensionLegs().catch(() => false);
        await Promise.all([
          drainTasksOnPage(testManager.agent1Page).catch(() => false),
          drainTasksOnPage(testManager.multiSessionAgent1Page).catch(() => false),
        ]);
        await Promise.all([
          clearVisibleRonaPopup(testManager.agent1Page),
          clearVisibleRonaPopup(testManager.multiSessionAgent1Page),
        ]);
        await normalizeAvailableOnBothSessions().catch(() => false);
      }
    }

    throw lastError;
  };

  const recordingControlsReadyOnBothSessions = async (): Promise<boolean> => {
    const pages = [testManager.agent1Page, testManager.multiSessionAgent1Page];

    const states = await Promise.all(
      pages.map(async (page) => {
        const recordButton = page.locator('#pause-resume-recording').first();
        const visible = await recordButton.isVisible().catch(() => false);
        const enabled = await recordButton.isEnabled().catch(() => false);

        return visible && enabled;
      })
    );

    return states.every(Boolean);
  };

  const submitWrapupOnAnySession = async (): Promise<void> => {
    await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.RESOLVED).catch(() => false);
    await submitWrapup(testManager.multiSessionAgent1Page, WRAPUP_REASONS.RESOLVED).catch(
      () => false
    );
  };

  test.beforeAll(async ({browser}, testInfo) => {
    testInfo.setTimeout(6 * 60 * 1000);

    const projectName = testInfo.project.name;
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const candidateManager = new TestManager(projectName);
      try {
        await candidateManager.setupForIncomingTaskMultiSession(browser);
        testManager = candidateManager;

        return;
      } catch (error) {
        lastError = error;
        await cleanupManagerBestEffort(candidateManager);
        await new Promise((resolve) => {
          setTimeout(resolve, 5000 * (attempt + 1));
        });
      }
    }

    throw lastError;
  });

  test.beforeEach(async () => {
    await resetExtensionLegs().catch(() => false);
    await Promise.all([
      drainTasksOnPage(testManager.agent1Page).catch(() => false),
      drainTasksOnPage(testManager.multiSessionAgent1Page).catch(() => false),
    ]);
    await Promise.all([
      clearVisibleRonaPopup(testManager.agent1Page),
      clearVisibleRonaPopup(testManager.multiSessionAgent1Page),
    ]);
    await normalizeAvailableOnBothSessions();
  });

  test.afterAll(async () => {
    await cleanupManagerBestEffort(testManager);
  });

  test('should handle multi-session incoming call with state synchronization', async () => {
    test.setTimeout(6 * 60 * 1000);

    await createExtensionCallOfferOnBothSessions(40000);
    let incomingTaskDiv = testManager.agent1Page.locator('#incoming-task').first();
    let incomingTaskDiv2 = testManager.multiSessionAgent1Page.locator('#incoming-task').first();
    await testManager.agent1Page.waitForTimeout(5000);
    await testManager.agent1ExtensionPage.waitForTimeout(1000);
    await declineExtensionCall(testManager.agent1ExtensionPage);

    await submitVisibleRonaPopup(10000);

    await testManager.agent1Page.waitForTimeout(2000);
    await normalizeAvailableOnBothSessions();
    await testManager.multiSessionAgent1Page.waitForTimeout(2000);
    await verifyCurrentState(testManager.multiSessionAgent1Page, USER_STATES.AVAILABLE);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);

    const taskReappeared = await waitForActiveIncomingSummary(testManager.agent1Page, 15000)
      .then(() => true)
      .catch(() => false);
    if (!taskReappeared) {
      await createExtensionCallOfferOnBothSessions(60000);
    } else {
      await waitForExtensionIncoming(20000);
      await waitForActiveIncomingSummary(testManager.multiSessionAgent1Page, 30000);
    }

    incomingTaskDiv = testManager.agent1Page.locator('#incoming-task').first();
    await incomingTaskDiv.waitFor({state: 'visible', timeout: 10000});
    incomingTaskDiv2 = testManager.multiSessionAgent1Page.locator('#incoming-task').first();
    await incomingTaskDiv2.waitFor({state: 'visible', timeout: 10000});
    await testManager.agent1Page.waitForTimeout(2000);
    await acceptExtensionCall(testManager.agent1ExtensionPage);
    await testManager.agent1Page.waitForTimeout(2000);
    await ensureActiveCallOnBothSessions();
    await testManager.agent1Page.waitForTimeout(3000);
    await Promise.all([
      verifyTaskControls(testManager.agent1Page, TASK_TYPES.CALL),
      verifyTaskControls(testManager.multiSessionAgent1Page, TASK_TYPES.CALL),
    ]);
    await endTask(testManager.multiSessionAgent1Page);
    await testManager.agent1Page.waitForTimeout(1000);
    await submitWrapup(testManager.multiSessionAgent1Page, WRAPUP_REASONS.SALE);
    await normalizeAvailableOnBothSessions();
    await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await verifyCurrentState(testManager.multiSessionAgent1Page, USER_STATES.AVAILABLE);
  });

  test('Multi-login call controls - verify controls are synchronized', async () => {
    await establishAcceptedExtensionCallOnBothSessions();

    try {
      // Verify call control buttons are visible on both AGENT1 sessions
      await Promise.all([
        verifyTaskControls(testManager.agent1Page, TASK_TYPES.CALL),
        verifyTaskControls(testManager.multiSessionAgent1Page!, TASK_TYPES.CALL),
      ]);

      // Verify initial hold button icons on both sessions (should show pause icon when call is active)
      await Promise.all([
        verifyHoldButtonIcon(testManager.agent1Page, {expectedIsHeld: false}),
        verifyHoldButtonIcon(testManager.multiSessionAgent1Page!, {expectedIsHeld: false}),
      ]);

      // Put call on hold from session 1 (AGENT1)
      await holdCallToggle(testManager.agent1Page);
      await testManager.agent1Page.waitForTimeout(3000);

      // Verify hold button icons changed to play icon on both sessions (when call is on hold)
      await Promise.all([
        verifyHoldButtonIcon(testManager.agent1Page, {expectedIsHeld: true}),
        verifyHoldButtonIcon(testManager.multiSessionAgent1Page!, {expectedIsHeld: true}),
      ]);

      // Verify hold timer is visible on both AGENT1 sessions
      await Promise.all([
        verifyHoldTimer(testManager.agent1Page, {shouldBeVisible: true}),
        verifyHoldTimer(testManager.multiSessionAgent1Page!, {shouldBeVisible: true}),
      ]);

      // Resume call from session 2 (AGENT1)
      await holdCallToggle(testManager.multiSessionAgent1Page!);
      await testManager.multiSessionAgent1Page!.waitForTimeout(3000);

      // Verify hold button icons changed back to pause icon on both sessions (when call is active)
      await Promise.all([
        verifyHoldButtonIcon(testManager.agent1Page, {expectedIsHeld: false}),
        verifyHoldButtonIcon(testManager.multiSessionAgent1Page!, {expectedIsHeld: false}),
      ]);

      // Verify hold timer disappears on both AGENT1 sessions
      await Promise.all([
        verifyHoldTimer(testManager.agent1Page, {shouldBeVisible: false}),
        verifyHoldTimer(testManager.multiSessionAgent1Page!, {shouldBeVisible: false}),
      ]);

      const canVerifyRecording = await recordingControlsReadyOnBothSessions();
      if (canVerifyRecording) {
        await Promise.all([
          verifyRecordButtonIcon(testManager.agent1Page, {expectedIsRecording: true}),
          verifyRecordButtonIcon(testManager.multiSessionAgent1Page!, {expectedIsRecording: true}),
        ]);

        await recordCallToggle(testManager.agent1Page);
        await testManager.agent1Page.waitForTimeout(2000);

        await Promise.all([
          verifyRecordButtonIcon(testManager.agent1Page, {expectedIsRecording: false}),
          verifyRecordButtonIcon(testManager.multiSessionAgent1Page!, {expectedIsRecording: false}),
        ]);

        await recordCallToggle(testManager.multiSessionAgent1Page!);
        await testManager.multiSessionAgent1Page!.waitForTimeout(2000);

        await Promise.all([
          verifyRecordButtonIcon(testManager.agent1Page, {expectedIsRecording: true}),
          verifyRecordButtonIcon(testManager.multiSessionAgent1Page!, {expectedIsRecording: true}),
        ]);
      }

      // End call from extension page
      await endCallTask(testManager.agent1ExtensionPage!);
      await testManager.agent1Page.waitForTimeout(2000);

      await submitWrapupOnAnySession();
      await testManager.agent1Page.waitForTimeout(2000);

      // Verify both AGENT1 sessions return to available state
      await normalizeAvailableOnBothSessions();
      await Promise.all([
        verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE),
        verifyCurrentState(testManager.multiSessionAgent1Page!, USER_STATES.AVAILABLE),
      ]);
    } catch (error) {
      throw new Error(`Multi-session call controls synchronization failed: ${error.message}`);
    }
  });

  test('should handle multi-session incoming chat with state synchronization', async () => {
    test.setTimeout(6 * 60 * 1000);

    await createDigitalOfferOnBothSessions(
      () =>
        createChatTask(testManager.chatPage, process.env[`${testManager.projectName}_CHAT_URL`]!),
      60000
    );
    await submitVisibleRonaPopup(15000);

    await testManager.agent1Page.waitForTimeout(2000);
    await normalizeAvailableOnBothSessions();
    await testManager.multiSessionAgent1Page.waitForTimeout(2000);
    await verifyCurrentState(testManager.multiSessionAgent1Page, USER_STATES.AVAILABLE);
    const taskReappeared = await waitForActiveIncomingSummary(testManager.agent1Page, 15000)
      .then(() => true)
      .catch(() => false);
    if (!taskReappeared) {
      await createChatTask(
        testManager.chatPage,
        process.env[`${testManager.projectName}_CHAT_URL`]!
      );
      await waitForActiveIncomingSummary(testManager.agent1Page, 60000);
    }
    await waitForActiveIncomingSummary(testManager.multiSessionAgent1Page, 30000);
    await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CHAT);
    await endTask(testManager.multiSessionAgent1Page);
    await submitWrapup(testManager.multiSessionAgent1Page, WRAPUP_REASONS.SALE);
    await normalizeAvailableOnBothSessions();
    await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await verifyCurrentState(testManager.multiSessionAgent1Page, USER_STATES.AVAILABLE);
  });

  test('should handle multi-session incoming email with state synchronization', async () => {
    test.setTimeout(6 * 60 * 1000);

    await createDigitalOfferOnBothSessions(
      () => createEmailTask(process.env[`${testManager.projectName}_EMAIL_ENTRY_POINT`]!),
      60000
    );
    await submitVisibleRonaPopup(20000, true);

    await testManager.agent1Page.waitForTimeout(3000);
    await normalizeAvailableOnBothSessions();
    await testManager.multiSessionAgent1Page.waitForTimeout(2000);
    await verifyCurrentState(testManager.multiSessionAgent1Page, USER_STATES.AVAILABLE);
    const taskReappeared = await waitForActiveIncomingSummary(testManager.agent1Page, 15000)
      .then(() => true)
      .catch(() => false);
    if (!taskReappeared) {
      await createEmailTask(process.env[`${testManager.projectName}_EMAIL_ENTRY_POINT`]!);
      await waitForActiveIncomingSummary(testManager.agent1Page, 60000);
    }
    await waitForActiveIncomingSummary(testManager.multiSessionAgent1Page, 30000);
    await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.EMAIL);
    await endTask(testManager.multiSessionAgent1Page);
    await submitWrapup(testManager.multiSessionAgent1Page, WRAPUP_REASONS.SALE);
    await normalizeAvailableOnBothSessions();
    await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await verifyCurrentState(testManager.multiSessionAgent1Page, USER_STATES.AVAILABLE);
  });
}

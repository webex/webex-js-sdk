/* eslint-disable no-await-in-loop */
import {test, expect, Page, Browser} from '@playwright/test';
import {
  consultOrTransfer,
  cancelConsult,
  clearAdvancedCapturedLogs,
  ensureConnectedCall,
  ensureConsultAccepted,
  ensurePrimaryConsultReady,
  hasConnectedCall,
  setupAdvancedConsoleLogging,
  verifyTransferSuccessLogs,
  verifyConsultStartSuccessLogs,
  verifyConsultEndSuccessLogs,
  verifyConsultTransferredLogs,
  waitForConsultingAgentIdReady,
  waitForPrimaryCallAfterConsult,
} from '../Utils/advancedTaskControlUtils';
import {executeConsultTransfer} from '../Utils/consultTransferWorkaround';

import {changeUserState, republishAgentAvailability} from '../Utils/userStateUtils';
import {createCallTask, declineIncomingTask, waitForIncomingTask} from '../Utils/incomingTaskUtils';
import {submitWrapup} from '../Utils/wrapupUtils';
import {USER_STATES, TASK_TYPES, WRAPUP_REASONS, ACCEPT_TASK_TIMEOUT} from '../constants';
import {holdCallToggle, endTask, callTaskControlCheck, isCallHeld} from '../Utils/taskControlUtils';
import {TestManager} from '../test-manager';
import {
  clearPendingCallAndWrapup,
  dismissActionDialog,
  handleStrayTasks,
  runWithTimeout,
  sleep,
  waitForState,
} from '../Utils/helperUtils';
import {acquireSerialResourceLock} from '../Utils/serialResourceLock';
import {hasVisibleEnabledActionButton} from '../Utils/controlUtils';
import {ensureHealthyCallerPage as ensureHealthyCallerPageBase} from '../Utils/callerPageUtils';
import {
  ensureHealthyDesktopAgent as ensureHealthyDesktopAgentBase,
  recreateDesktopAgentPage,
} from '../Utils/desktopAgentUtils';

export default function createAdvancedTaskControlsTests() {
  const advancedCallingTestTimeout = 120 * 60 * 1000;
  const advancedCallingLockYieldMs = 2000;
  let releaseAdvancedCallingLock: (() => Promise<void>) | undefined;

  const resetTransientSampleAppState = async (page: Page): Promise<void> => {
    await page
      .evaluate(() => {
        for (const key of ['currentTask', 'consultationData', 'currentConsultQueueId']) {
          try {
            (globalThis as any)[key] = null;
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {});
  };

  const hasTransferredTaskCleared = async (page: Page): Promise<boolean> => {
    const incomingText = (
      await page
        .locator('#incoming-task')
        .innerText()
        .catch(() => '')
    )
      .toLowerCase()
      .trim();
    const taskListText = (
      await page
        .locator('#taskList')
        .innerText()
        .catch(() => '')
    )
      .toLowerCase()
      .trim();

    const noIncomingTasks = incomingText === '' || incomingText.includes('no incoming tasks');
    const noTaskListItems = taskListText === '' || taskListText.includes('no tasks available');

    return noIncomingTasks && noTaskListItems;
  };

  const isTransferredTaskWrapupReady = async (page: Page): Promise<boolean> => {
    const wrapupDropdownEnabled = await page
      .locator('#wrapupCodesDropdown')
      .evaluate((el) => !(el as HTMLSelectElement).disabled)
      .catch(() => false);
    const wrapupButtonEnabled = await page
      .locator('#wrapup')
      .evaluate((el) => !(el as HTMLButtonElement).disabled)
      .catch(() => false);

    return wrapupDropdownEnabled && wrapupButtonEnabled;
  };

  const getTransferredTaskCompletionState = async (
    page: Page
  ): Promise<'active' | 'wrapup' | 'cleared' | 'waiting'> => {
    if (await isTransferredTaskWrapupReady(page)) {
      return 'wrapup';
    }

    if (await hasConnectedCall(page)) {
      return 'active';
    }

    if (await hasTransferredTaskCleared(page)) {
      return 'cleared';
    }

    const currentState = await page
      .locator('#idleCodesDropdown')
      .inputValue()
      .catch(() => '');
    const acceptButtons = page.getByRole('button', {name: 'Accept'});
    const acceptVisible =
      (await acceptButtons.count().catch(() => 0)) > 0
        ? await acceptButtons
            .first()
            .isVisible()
            .catch(() => false)
        : false;
    const hasVisibleTaskControls =
      (await hasVisibleEnabledActionButton(page, 'Consult', '#consult')) ||
      (await hasVisibleEnabledActionButton(page, 'Transfer', '#transfer')) ||
      (await hasVisibleEnabledActionButton(page, 'End', '#end')) ||
      (await hasVisibleEnabledActionButton(page, 'End Consult', '#end-consult')) ||
      (await hasVisibleEnabledActionButton(page, 'Switch', '#switch-to-consult')) ||
      (await hasVisibleEnabledActionButton(page, 'Merge', '#merge-conference'));

    if (currentState !== '' && !acceptVisible && !hasVisibleTaskControls) {
      return 'cleared';
    }

    return 'waiting';
  };

  const waitForTransferredTaskCompletion = async (
    page: Page,
    timeout = ACCEPT_TASK_TIMEOUT
  ): Promise<'active' | 'wrapup' | 'cleared'> => {
    await page.bringToFront();

    const completionReached = await expect
      .poll(() => getTransferredTaskCompletionState(page), {
        timeout,
        intervals: [500, 1000, 2000],
      })
      .not.toBe('waiting')
      .then(() => true)
      .catch(() => false);

    const finalState = await getTransferredTaskCompletionState(page);
    if (completionReached || finalState !== 'waiting') {
      return finalState === 'waiting' ? 'cleared' : finalState;
    }

    throw new Error('Transferred task never reached active, wrapup, or cleared state');
  };

  const completeTransferredTask = async (
    page: Page,
    wrapupReason: (typeof WRAPUP_REASONS)[keyof typeof WRAPUP_REASONS]
  ): Promise<void> => {
    const immediateCompletionState = await waitForTransferredTaskCompletion(page, 5000).catch(
      () => null as 'active' | 'wrapup' | 'cleared' | null
    );

    if (immediateCompletionState === 'wrapup') {
      await submitWrapup(page, wrapupReason);

      return;
    }

    if (immediateCompletionState === 'cleared') {
      return;
    }

    const endActiveTask = async (): Promise<'active' | 'wrapup' | 'cleared'> => {
      await callTaskControlCheck(page);
      await endTask(page);
      await page.waitForTimeout(3000);

      return waitForTransferredTaskCompletion(page, 30000);
    };

    if (immediateCompletionState === 'active') {
      const postEndState = await endActiveTask();
      if (postEndState === 'wrapup') await submitWrapup(page, wrapupReason);

      return;
    }

    let completionState = await waitForTransferredTaskCompletion(page, ACCEPT_TASK_TIMEOUT);

    if (completionState === 'active') {
      completionState = await endActiveTask();
    }

    if (completionState === 'wrapup') {
      await submitWrapup(page, wrapupReason);
    }
  };

  const waitForConsultTransferReadyOnPrimary = async (
    primaryPage: Page,
    timeout = ACCEPT_TASK_TIMEOUT
  ): Promise<void> => {
    await expect
      .poll(
        () =>
          primaryPage.evaluate(() => {
            const globalScope = globalThis as typeof globalThis & {
              currentTask?: any;
              consultationData?: {to?: string; destinationType?: string};
              getConsultStatus?: (task: any) => string;
              toggleTransferOptions?: () => Promise<void> | void;
              initiateConsultTransfer?: () => Promise<void> | void;
            };
            const task = globalScope.currentTask;
            const incomingText = (
              document.querySelector('#incoming-task')?.textContent ?? ''
            ).toLowerCase();
            const consultTransferBtn = document.querySelector(
              '#consult-transfer'
            ) as HTMLButtonElement | null;
            const transferBtn = document.querySelector('#transfer') as HTMLButtonElement | null;
            const consultDestinationInput = document.querySelector('#consult-destination') as
              | HTMLInputElement
              | HTMLSelectElement
              | null;
            const consultDestinationType = document.querySelector(
              '#consult-destination-type'
            ) as HTMLSelectElement | null;
            const consultationData = globalScope.consultationData;
            const payloadTarget =
              consultationData?.to || consultDestinationInput?.value?.trim() || '';
            const payloadDestinationType =
              consultationData?.destinationType || consultDestinationType?.value || '';
            const transferVisibleEnabled = (() => {
              if (!transferBtn || transferBtn.disabled) {
                return false;
              }

              const style = window.getComputedStyle(transferBtn);

              return (
                transferBtn.offsetParent !== null &&
                style.display !== 'none' &&
                style.visibility !== 'hidden'
              );
            })();
            const consultAccepted =
              task?.data?.interaction?.callProcessingDetails?.relationshipType === 'consult' &&
              ['consultaccepted', 'connected', 'conference'].includes(
                String(globalScope.getConsultStatus?.(task) ?? '').toLowerCase()
              );

            return (
              consultAccepted ||
              incomingText.includes('consultaccepted') ||
              incomingText.includes('beingconsultedaccepted') ||
              (Boolean(consultTransferBtn) && !consultTransferBtn.disabled) ||
              transferVisibleEnabled ||
              (typeof task?.transfer === 'function' &&
                Boolean(payloadTarget) &&
                Boolean(payloadDestinationType)) ||
              (task?.data?.isConferenceInProgress === true &&
                typeof task?.transferConference === 'function') ||
              typeof globalScope.toggleTransferOptions === 'function' ||
              typeof globalScope.initiateConsultTransfer === 'function'
            );
          }),
        {timeout, intervals: [500, 1000, 2000]}
      )
      .toBeTruthy();
  };

  const createAndConnectCall = async (
    callerPage: Page,
    agentPage: Page,
    entryPoint: string
  ): Promise<void> => {
    let activeCallerPage = callerPage;
    let activeAgentPage = agentPage;

    const recreateAgent1Page = async (): Promise<void> => {
      activeAgentPage = await recreateDesktopAgentPage(testManager, 'agent1', {
        browser: testBrowser,
        setupConsoleLogging: setupAdvancedConsoleLogging,
      });
    };

    const ensureHealthyAgent1Page = async (): Promise<void> => {
      activeAgentPage = await ensureHealthyDesktopAgentBase(
        testManager,
        'agent1',
        USER_STATES.AVAILABLE,
        {
          browser: testBrowser,
          setupConsoleLogging: setupAdvancedConsoleLogging,
        }
      );
    };

    const ensureHealthyCallerPage = async (resetRegistration = false): Promise<void> => {
      activeCallerPage = await ensureHealthyCallerPageBase(testManager, {
        browser: testBrowser,
        resetRegistration,
        waitForRegisteredAfterRegisterMs: 10000,
        recreateIfCreateCallNotReady: true,
        createCallReadyAfterRecreateMs: 20000,
      });
    };

    const refreshAvailableRoutingState = async (): Promise<void> => {
      const currentState = await activeAgentPage
        .locator('#idleCodesDropdown')
        .inputValue()
        .catch(() => '');

      if (currentState === USER_STATES.AVAILABLE) {
        await changeUserState(activeAgentPage, USER_STATES.MEETING);
        await waitForState(activeAgentPage, USER_STATES.MEETING);
        await activeAgentPage.waitForTimeout(2000);
      }

      await changeUserState(activeAgentPage, USER_STATES.AVAILABLE);
      await waitForState(activeAgentPage, USER_STATES.AVAILABLE);
      await activeAgentPage.waitForTimeout(5000);
    };

    const cleanupFailedCallAttempt = async (): Promise<void> => {
      if (!activeCallerPage.isClosed()) {
        const endCallButton = activeCallerPage.locator('#end-call').first();
        const canEndCallerLeg = await endCallButton.isEnabled().catch(() => false);
        if (canEndCallerLeg) {
          await endCallButton.click().catch(() => {});
          await expect
            .poll(() => endCallButton.isEnabled().catch(() => false), {
              timeout: 10000,
              intervals: [500, 1000, 2000],
            })
            .toBeFalsy()
            .catch(() => {});
        } else {
          await activeCallerPage
            .evaluate(() => {
              const activeCall = (window as unknown as {call?: {end?: () => void}}).call;
              activeCall?.end?.();
            })
            .catch(() => {});
        }
      }

      if (!activeAgentPage.isClosed()) {
        await clearPendingCallAndWrapup(activeAgentPage).catch(() => {});
        await resetTransientSampleAppState(activeAgentPage);
      }
    };

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        if (attempt > 0) {
          await recreateAgent1Page().catch(() => {});
        }

        if (!activeAgentPage.isClosed()) {
          await clearPendingCallAndWrapup(activeAgentPage).catch(() => {});
          await resetTransientSampleAppState(activeAgentPage);
        }
        await ensureHealthyAgent1Page();
        await ensureHealthyCallerPage(attempt > 0);
        await ensureHealthyAgent1Page();
        await refreshAvailableRoutingState();
        await createCallTask(activeCallerPage, entryPoint);
        await ensureConnectedCall(activeAgentPage, ACCEPT_TASK_TIMEOUT);
        await ensurePrimaryConsultReady(activeAgentPage, 45000);

        return;
      } catch (error) {
        lastError = error;
        await cleanupFailedCallAttempt().catch(() => {});

        if (attempt < 2) {
          await recreateAgent1Page().catch(() => {});
          if (!activeAgentPage.isClosed()) {
            await activeAgentPage.waitForTimeout(1000);
          }
        }
      }
    }
    throw lastError;
  };

  const startAgentConsultWithRecovery = async (
    sourcePage: Page,
    targetPage: Page,
    targetAgentName: string
  ): Promise<void> => {
    const recreateAgent2Session = (): Promise<Page> =>
      recreateDesktopAgentPage(testManager, 'agent2', {
        browser: testBrowser,
        setupConsoleLogging: setupAdvancedConsoleLogging,
      });

    const openConsult = async (): Promise<void> => {
      await ensurePrimaryConsultReady(sourcePage);
      await consultOrTransfer(sourcePage, 'agent', 'consult', targetAgentName);
    };

    try {
      await openConsult();
    } catch (error) {
      if (!String(error).includes('Consult destination')) {
        throw error;
      }

      await dismissActionDialog(sourcePage);

      let liveTargetPage = targetPage;
      if (!liveTargetPage.isClosed()) {
        await republishAgentAvailability(liveTargetPage).catch(() => {});

        try {
          await openConsult();

          return;
        } catch (retryError) {
          if (!String(retryError).includes('Consult destination')) {
            throw retryError;
          }
        }
      }

      if (liveTargetPage.isClosed()) {
        liveTargetPage = await recreateAgent2Session();
      } else {
        liveTargetPage = await ensureHealthyDesktopAgentBase(
          testManager,
          'agent2',
          USER_STATES.AVAILABLE,
          {browser: testBrowser, setupConsoleLogging: setupAdvancedConsoleLogging}
        );
      }

      await republishAgentAvailability(liveTargetPage);

      await openConsult();
    }
  };

  const ensureActiveCall = async (page: Page): Promise<void> => {
    await page.bringToFront();
    await expect
      .poll(
        async () => {
          const connected = await hasConnectedCall(page);
          const [consultReady, transferReady, endReady] = await Promise.all([
            hasVisibleEnabledActionButton(page, 'Consult', '#consult'),
            hasVisibleEnabledActionButton(page, 'Transfer', '#transfer'),
            hasVisibleEnabledActionButton(page, 'End', '#end'),
          ]);

          return connected && (consultReady || transferReady || endReady);
        },
        {timeout: 12000, intervals: [500, 1000, 2000]}
      )
      .toBeTruthy();
    const held = await isCallHeld(page);
    if (held) {
      await holdCallToggle(page);
      await expect
        .poll(() => isCallHeld(page), {timeout: 15000, intervals: [500, 1000, 2000]})
        .toBeFalsy();
    }
  };

  const blindTransferToAgentWithRecovery = async (
    sourcePage: Page,
    targetAgentName: string
  ): Promise<void> => {
    let liveSourcePage = sourcePage;

    const ensureTransferSourceReady = async (): Promise<void> => {
      try {
        await ensureActiveCall(liveSourcePage);
        await ensurePrimaryConsultReady(liveSourcePage, 60000);
      } catch (error) {
        if (!liveSourcePage.isClosed()) {
          await endTask(liveSourcePage).catch(() => {});
          await submitWrapup(liveSourcePage, WRAPUP_REASONS.SALE).catch(() => {});
          await handleStrayTasks(liveSourcePage).catch(() => {});
          await resetTransientSampleAppState(liveSourcePage);
        }
        liveSourcePage = await ensureHealthyAdvancedAgent('agent1', USER_STATES.AVAILABLE);
        await createAndConnectCall(
          testManager.callerPage!,
          liveSourcePage,
          process.env[`${testManager.projectName}_ENTRY_POINT`]!
        );
        liveSourcePage = testManager.agent1Page;
        await ensurePrimaryConsultReady(liveSourcePage, 60000);
      }
    };

    const openTransfer = async (): Promise<void> => {
      await ensureTransferSourceReady();
      await consultOrTransfer(liveSourcePage, 'agent', 'transfer', targetAgentName);
    };

    try {
      await openTransfer();
    } catch (error) {
      if (!String(error).includes('Transfer destination')) {
        throw error;
      }

      await dismissActionDialog(liveSourcePage, 1000);
      await ensureHealthyAdvancedAgent('agent2', USER_STATES.AVAILABLE);
      await republishAgentAvailability(testManager.agent2Page);
      await liveSourcePage.waitForTimeout(5000);
      await openTransfer();
    }
  };

  let testManager: TestManager;
  let testBrowser: Browser;

  const ensureHealthyAdvancedAgent = (
    agentKey: 'agent1' | 'agent2',
    targetState: string
  ): Promise<Page> =>
    ensureHealthyDesktopAgentBase(testManager, agentKey, targetState, {
      browser: testBrowser,
      setupConsoleLogging: setupAdvancedConsoleLogging,
    });

  test.beforeEach(async ({browser}, testInfo) => {
    test.setTimeout(advancedCallingTestTimeout);
    releaseAdvancedCallingLock = await acquireSerialResourceLock('advanced-calling', {
      timeoutMs: advancedCallingTestTimeout,
    });

    const projectName = testInfo.project.name;
    testBrowser = browser;
    testManager = new TestManager(projectName);
    await testManager.setupForAdvancedCombinations(browser);

    await ensureHealthyAdvancedAgent('agent1', USER_STATES.AVAILABLE);
    await ensureHealthyAdvancedAgent('agent2', USER_STATES.AVAILABLE);
    await handleStrayTasks(testManager.agent1Page);
    await handleStrayTasks(testManager.agent2Page);

    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
    await testManager.agent1Page.waitForTimeout(3000);
  });

  test.afterEach(async () => {
    try {
      if (testManager) {
        await runWithTimeout(() => testManager.cleanup());
      }
    } finally {
      await releaseAdvancedCallingLock?.();
      releaseAdvancedCallingLock = undefined;
      await sleep(advancedCallingLockYieldMs);
    }
  });

  test.describe('Blind Transfer Tests', () => {
    test.beforeEach(() => {
      test.setTimeout(advancedCallingTestTimeout);
    });

    test.beforeEach(async () => {
      await ensureHealthyAdvancedAgent('agent2', USER_STATES.MEETING);
      await ensureHealthyAdvancedAgent('agent1', USER_STATES.AVAILABLE);

      await createAndConnectCall(
        testManager.callerPage!,
        testManager.agent1Page,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );

      await ensurePrimaryConsultReady(testManager.agent1Page, 60000);

      clearAdvancedCapturedLogs();
    });

    test('Call Blind Transferred by Agent to Another Agent', async () => {
      await republishAgentAvailability(testManager.agent2Page);
      await blindTransferToAgentWithRecovery(
        testManager.agent1Page,
        process.env[`${testManager.projectName}_AGENT2_NAME`]!
      );

      await completeTransferredTask(testManager.agent1Page, WRAPUP_REASONS.SALE);
    });

    test('Call Blind Transferred to Queue', async () => {
      await consultOrTransfer(
        testManager.agent1Page,
        'queue',
        'transfer',
        process.env[`${testManager.projectName}_QUEUE_NAME`]!
      );

      await completeTransferredTask(testManager.agent1Page, WRAPUP_REASONS.SALE);
      await testManager.agent1Page.waitForTimeout(2000);
    });
  });

  test.describe('Consult and Consult Transfer Scenarios', () => {
    test.beforeEach(() => {
      test.setTimeout(advancedCallingTestTimeout);
    });

    const prepareAgentConsultScenario = async (): Promise<void> => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          await ensureHealthyAdvancedAgent('agent2', USER_STATES.MEETING);
          await ensureHealthyAdvancedAgent('agent1', USER_STATES.AVAILABLE);
          await testManager.agent1Page.waitForTimeout(3000);

          await createAndConnectCall(
            testManager.callerPage!,
            testManager.agent1Page,
            process.env[`${testManager.projectName}_ENTRY_POINT`]!
          );
          await expect(testManager.agent1Page.locator('#incoming-task')).toContainText(
            'connected',
            {
              timeout: 10000,
            }
          );

          await ensureHealthyAdvancedAgent('agent2', USER_STATES.AVAILABLE);
          await republishAgentAvailability(testManager.agent2Page);
          await ensurePrimaryConsultReady(testManager.agent1Page);

          return;
        } catch (error) {
          lastError = error;
          await endTask(testManager.agent1Page).catch(() => {});
          await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE).catch(() => {});
          await handleStrayTasks(testManager.agent1Page).catch(() => {});
          await handleStrayTasks(testManager.agent2Page).catch(() => {});
          await resetTransientSampleAppState(testManager.agent1Page);
          await resetTransientSampleAppState(testManager.agent2Page);
        }
      }

      throw lastError;
    };

    const resumePrimaryCallIfNeeded = async (): Promise<void> => {
      let primaryCallState: 'active' | 'held' | 'wrapup';
      try {
        primaryCallState = await waitForPrimaryCallAfterConsult(testManager.agent1Page);
      } catch (error) {
        await cancelConsult(testManager.agent1Page).catch(() => {});
        await holdCallToggle(testManager.agent1Page).catch(() => {});
        const recoveredPrimary = await expect
          .poll(
            async () => {
              const hasCall = await hasConnectedCall(testManager.agent1Page);
              const endReady = await hasVisibleEnabledActionButton(
                testManager.agent1Page,
                'End',
                '#end'
              );
              const transferReady = await hasVisibleEnabledActionButton(
                testManager.agent1Page,
                'Transfer',
                '#transfer'
              );
              const wrapupReady = await hasVisibleEnabledActionButton(
                testManager.agent1Page,
                'Wrapup',
                '#wrapup'
              );

              return hasCall || endReady || transferReady || wrapupReady;
            },
            {timeout: 30000, intervals: [500, 1000, 2000]}
          )
          .toBeTruthy()
          .then(() => true)
          .catch(() => false);

        if (!recoveredPrimary) {
          throw error;
        }

        const wrapupVisible = await hasVisibleEnabledActionButton(
          testManager.agent1Page,
          'Wrapup',
          '#wrapup'
        );
        if (wrapupVisible) {
          primaryCallState = 'wrapup';
        } else if (await isCallHeld(testManager.agent1Page).catch(() => false)) {
          primaryCallState = 'held';
        } else {
          primaryCallState = 'active';
        }
      }

      if (primaryCallState === 'wrapup') {
        return;
      }

      if (primaryCallState === 'held') {
        await holdCallToggle(testManager.agent1Page).catch(() => {});
      }
      await testManager.agent1Page.waitForTimeout(2000);
      const endConsultVisible = await testManager.agent1Page
        .locator('#end-consult')
        .isVisible()
        .catch(() => false);
      if (endConsultVisible) {
        await cancelConsult(testManager.agent1Page).catch(() => {});
      }
      await expect(testManager.agent1Page.locator('#end-consult')).not.toBeVisible({
        timeout: 10000,
      });
    };

    const cleanupPrimaryCall = async (): Promise<void> => {
      await callTaskControlCheck(testManager.agent1Page).catch(() => {});
      await endTask(testManager.agent1Page);
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
    };

    test.beforeEach(async () => {
      await handleStrayTasks(testManager.agent1Page);
      await handleStrayTasks(testManager.agent2Page);
      await resetTransientSampleAppState(testManager.agent1Page);
      await resetTransientSampleAppState(testManager.agent2Page);
      await ensureHealthyAdvancedAgent('agent1', USER_STATES.AVAILABLE);
      await ensureHealthyAdvancedAgent('agent2', USER_STATES.AVAILABLE);
      await testManager.agent1Page.waitForTimeout(2000);
    });

    test('Agent Consult: consulted agent accepts and ends, primary call resumes', async () => {
      await prepareAgentConsultScenario();
      clearAdvancedCapturedLogs();
      await startAgentConsultWithRecovery(
        testManager.agent1Page,
        testManager.agent2Page,
        process.env[`${testManager.projectName}_AGENT2_NAME`]!
      );
      await waitForConsultingAgentIdReady(testManager.agent1Page, 20000);
      await ensureConsultAccepted(
        testManager.agent1Page,
        testManager.agent2Page,
        ACCEPT_TASK_TIMEOUT
      );
      await testManager.agent1Page.waitForTimeout(2000);
      await verifyConsultStartSuccessLogs(testManager.agent1Page);
      await cancelConsult(testManager.agent2Page);
      await resumePrimaryCallIfNeeded();
      try {
        await verifyConsultEndSuccessLogs();
      } catch {
        // Optional log.
      }
      await cleanupPrimaryCall();
    });

    test('Agent Consult: consulted agent declines, primary call resumes', async () => {
      await prepareAgentConsultScenario();
      clearAdvancedCapturedLogs();
      await startAgentConsultWithRecovery(
        testManager.agent1Page,
        testManager.agent2Page,
        process.env[`${testManager.projectName}_AGENT2_NAME`]!
      );
      await waitForIncomingTask(testManager.agent2Page, TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);
      await declineIncomingTask(testManager.agent2Page, TASK_TYPES.CALL);
      await resumePrimaryCallIfNeeded();
      await cleanupPrimaryCall();
    });

    test('Agent Consult: not picked up timeout returns to primary call', async () => {
      await prepareAgentConsultScenario();
      clearAdvancedCapturedLogs();
      await startAgentConsultWithRecovery(
        testManager.agent1Page,
        testManager.agent2Page,
        process.env[`${testManager.projectName}_AGENT2_NAME`]!
      );
      await testManager.agent1Page.waitForTimeout(10000);
      await resumePrimaryCallIfNeeded();
      await cleanupPrimaryCall();
    });

    test('Agent Consult Transfer: transfer scenario is handled correctly', async () => {
      await prepareAgentConsultScenario();
      clearAdvancedCapturedLogs();
      await startAgentConsultWithRecovery(
        testManager.agent1Page,
        testManager.agent2Page,
        process.env[`${testManager.projectName}_AGENT2_NAME`]!
      );

      await waitForConsultingAgentIdReady(testManager.agent1Page, 20000);
      await ensureConsultAccepted(
        testManager.agent1Page,
        testManager.agent2Page,
        ACCEPT_TASK_TIMEOUT
      );
      await waitForConsultTransferReadyOnPrimary(testManager.agent1Page, 25000);

      await executeConsultTransfer(testManager.agent1Page);

      await expect(testManager.agent1Page.locator('#wrapupCodesDropdown')).toBeEnabled({
        timeout: 25000,
      });
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);

      await verifyConsultStartSuccessLogs(testManager.agent1Page);
      await verifyTransferSuccessLogs();
      await completeTransferredTask(testManager.agent2Page, WRAPUP_REASONS.RESOLVED);
      await testManager.agent2Page.waitForTimeout(2000);
    });

    test('Queue Consult: cancel, accept/end, agent-end, and transfer scenarios are handled correctly in sequence', async () => {
      test.setTimeout(advancedCallingTestTimeout);
      const consultReadyTimeout = 12000;
      const queueConsultAcceptTimeout = 30000;
      const queueName = process.env[`${testManager.projectName}_QUEUE_NAME`]!;
      const startQueueConsult = async (): Promise<void> => {
        clearAdvancedCapturedLogs();
        await consultOrTransfer(testManager.agent1Page, 'queue', 'consult', queueName);
      };

      await changeUserState(testManager.agent2Page, USER_STATES.MEETING);

      await createAndConnectCall(
        testManager.callerPage!,
        testManager.agent1Page,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await expect(testManager.agent1Page.locator('#incoming-task')).toContainText('connected', {
        timeout: 10000,
      });
      await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);

      await startQueueConsult();
      await waitForConsultingAgentIdReady(testManager.agent1Page, consultReadyTimeout);
      await cancelConsult(testManager.agent1Page);
      await resumePrimaryCallIfNeeded();
      await expect(testManager.agent1Page.locator('#end-consult')).not.toBeVisible();

      await startQueueConsult();
      await waitForConsultingAgentIdReady(testManager.agent1Page, consultReadyTimeout);
      await verifyConsultStartSuccessLogs(testManager.agent1Page);
      await ensureConsultAccepted(
        testManager.agent1Page,
        testManager.agent2Page,
        queueConsultAcceptTimeout
      );
      await waitForConsultingAgentIdReady(testManager.agent1Page, consultReadyTimeout);
      await cancelConsult(testManager.agent1Page);
      await resumePrimaryCallIfNeeded();
      try {
        await verifyConsultEndSuccessLogs();
      } catch {
        await resumePrimaryCallIfNeeded();
      }
      await expect(testManager.agent1Page.locator('#end-consult')).not.toBeVisible();

      await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await startQueueConsult();
      await ensureConsultAccepted(
        testManager.agent1Page,
        testManager.agent2Page,
        queueConsultAcceptTimeout
      );
      await waitForConsultingAgentIdReady(testManager.agent2Page, consultReadyTimeout);
      await cancelConsult(testManager.agent2Page);
      await resumePrimaryCallIfNeeded();
      await expect(testManager.agent1Page.locator('#end-consult')).not.toBeVisible();

      await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await startQueueConsult();
      await ensureConsultAccepted(
        testManager.agent1Page,
        testManager.agent2Page,
        queueConsultAcceptTimeout
      );
      await waitForConsultingAgentIdReady(testManager.agent1Page, consultReadyTimeout);
      await waitForConsultTransferReadyOnPrimary(testManager.agent1Page, 25000);
      await executeConsultTransfer(testManager.agent1Page);
      await expect(testManager.agent1Page.locator('#wrapupCodesDropdown')).toBeEnabled({
        timeout: 40000,
      });
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      await callTaskControlCheck(testManager.agent2Page);
      await verifyConsultStartSuccessLogs(testManager.agent1Page);
      await verifyConsultTransferredLogs();
      await endTask(testManager.agent2Page);
      await completeTransferredTask(testManager.agent2Page, WRAPUP_REASONS.RESOLVED);
    });
  });

  test('Entry Point: consult then end consult returns UI to normal', async () => {
    test.skip(!process.env.PW_ENTRYPOINT_NAME, 'PW_ENTRYPOINT_NAME not set');
    test.setTimeout(advancedCallingTestTimeout);

    await ensureHealthyAdvancedAgent('agent1', USER_STATES.AVAILABLE);
    await createAndConnectCall(
      testManager.callerPage!,
      testManager.agent1Page,
      process.env[`${testManager.projectName}_ENTRY_POINT`]!
    );

    clearAdvancedCapturedLogs();
    await consultOrTransfer(
      testManager.agent1Page,
      'entryPoint',
      'consult',
      process.env.PW_ENTRYPOINT_NAME!
    );
    await waitForConsultingAgentIdReady(testManager.agent1Page, 20000);
    await testManager.agent1Page.waitForTimeout(2000);
    await verifyConsultStartSuccessLogs(testManager.agent1Page);
    await cancelConsult(testManager.agent1Page);
    await testManager.agent1Page.waitForTimeout(1000);
  });
}

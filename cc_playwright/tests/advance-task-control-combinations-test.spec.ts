/* eslint-disable no-await-in-loop */
import {test, expect, Page, Browser, TestInfo} from '@playwright/test';
import {
  cancelConsult,
  consultOrTransfer,
  clearAdvancedCapturedLogs,
  ensureConnectedCall,
  ensureTransferCapableCall,
  ensurePrimaryConsultReady as ensureMainCallConsultReady,
  setupAdvancedConsoleLogging,
  submitTransferSourceWrapup,
  waitForPrimaryCallAfterConsult,
  verifyConsultStartSuccessLogs,
  waitForConsultingAgentIdReady,
} from '../Utils/advancedTaskControlUtils';
import {executeConsultTransfer} from '../Utils/consultTransferWorkaround';
import {changeUserState, getCurrentState} from '../Utils/userStateUtils';
import {createCallTask} from '../Utils/incomingTaskUtils';
import {submitWrapup} from '../Utils/wrapupUtils';
import {USER_STATES, WRAPUP_REASONS} from '../constants';
import {
  dismissActionDialog,
  waitForState,
  handleStrayTasks,
  runWithTimeout,
  sleep,
} from '../Utils/helperUtils';
import {endTask, holdCallToggle} from '../Utils/taskControlUtils';
import {TestManager} from '../test-manager';
import {acquireSerialResourceLock} from '../Utils/serialResourceLock';
import {hasVisibleEnabledActionButton} from '../Utils/controlUtils';
import {ensureHealthyCallerPage as ensureHealthyCallerPageBase} from '../Utils/callerPageUtils';
import {
  type DesktopAgentKey,
  ensureHealthyDesktopAgent as ensureHealthyDesktopAgentBase,
  getDesktopAgentPage as getDesktopAgentPageBase,
  recreateDesktopAgentPage as recreateDesktopAgentPageBase,
} from '../Utils/desktopAgentUtils';

export default function createAdvanceCombinationsTests() {
  test.describe('Advanced Combinations Tests ', () => {
    const advancedCallingTestTimeout = 120 * 60 * 1000;
    const advancedCallingLockYieldMs = 2000;
    let delayedForFullSuiteCallingResources = false;

    const waitForFullSuiteCallingResources = async (testInfo: TestInfo): Promise<void> => {
      const configuredWorkers = Number(testInfo.config.workers ?? 1);
      const cliArgs = process.argv.join(' ');
      const isExplicitSingleWorkerRun =
        cliArgs.includes('--workers=1') || cliArgs.includes('--workers 1');
      const isFullSuiteRun = configuredWorkers > 1 || !isExplicitSingleWorkerRun;

      if (!isFullSuiteRun || delayedForFullSuiteCallingResources) {
        return;
      }

      delayedForFullSuiteCallingResources = true;
      await sleep(7 * 60 * 1000);
    };

    test.describe.configure({mode: 'serial', timeout: advancedCallingTestTimeout});

    let testManager: TestManager;
    let testBrowser: Browser;
    let releaseAdvancedCallingLock: (() => Promise<void>) | undefined;
    const getDesktopAgentPage = (agentKey: DesktopAgentKey): Page =>
      getDesktopAgentPageBase(testManager, agentKey);

    const recreateDesktopAgentPage = (
      agentKey: DesktopAgentKey,
      targetState = USER_STATES.AVAILABLE
    ): Promise<Page> =>
      recreateDesktopAgentPageBase(testManager, agentKey, {
        browser: testBrowser,
        setupConsoleLogging: setupAdvancedConsoleLogging,
        targetState,
        retries: 2,
      });

    const ensureHealthyDesktopAgent = (
      agentKey: DesktopAgentKey,
      targetState: string
    ): Promise<Page> =>
      ensureHealthyDesktopAgentBase(testManager, agentKey, targetState, {
        browser: testBrowser,
        setupConsoleLogging: setupAdvancedConsoleLogging,
        reloginSettleMs: 5000,
        postLoginSettleMs: 3000,
      });

    const clearResidualTaskUi = async (agentKey: DesktopAgentKey): Promise<Page> => {
      let page = getDesktopAgentPage(agentKey);
      if (page.isClosed()) {
        return recreateDesktopAgentPage(agentKey);
      }

      await handleStrayTasks(page, null, 2).catch(() => {});

      const hasResidualUi = async (): Promise<boolean> => {
        const incomingText = (
          await page
            .locator('#incoming-task')
            .innerText()
            .catch(() => '')
        )
          .toLowerCase()
          .trim();
        const hasIncomingTask = incomingText !== '' && !incomingText.includes('no incoming tasks');
        const isConnectedPrimary =
          incomingText.includes('connected') &&
          (incomingText.includes('primary') || incomingText.includes('state: connected'));
        const hasConsultControls =
          (await page
            .locator('#end-consult')
            .first()
            .isVisible()
            .catch(() => false)) ||
          (await page
            .locator('#merge-conference')
            .first()
            .isVisible()
            .catch(() => false)) ||
          (await page
            .locator('#switch-to-main')
            .first()
            .isVisible()
            .catch(() => false)) ||
          (await page
            .locator('#switch-to-consult')
            .first()
            .isVisible()
            .catch(() => false));
        const wrapupReady = await hasVisibleEnabledActionButton(page, 'Wrapup', '#wrapup');

        return hasConsultControls || wrapupReady || (hasIncomingTask && !isConnectedPrimary);
      };

      if (!(await hasResidualUi())) {
        return page;
      }

      const wrapupReady = await hasVisibleEnabledActionButton(page, 'Wrapup', '#wrapup');
      if (wrapupReady) {
        await submitWrapup(page, WRAPUP_REASONS.SALE).catch(() => {});
        await waitForState(page, USER_STATES.AVAILABLE).catch(() => {});
      }

      await handleStrayTasks(page, null, 2).catch(() => {});
      await page.waitForTimeout(1000).catch(() => {});

      if (await hasResidualUi()) {
        page = await recreateDesktopAgentPage(agentKey);
      }

      return page;
    };

    const refreshAvailableRoutingState = async (agentKey: DesktopAgentKey): Promise<Page> => {
      let page = await clearResidualTaskUi(agentKey);

      if (page.isClosed()) {
        return ensureHealthyDesktopAgent(agentKey, USER_STATES.AVAILABLE);
      }

      const hasStationLoginError = await page
        .getByText('An error occurred while logging in to the station')
        .isVisible()
        .catch(() => false);
      const currentState = await getCurrentState(page).catch(() => '');

      if (!currentState || hasStationLoginError) {
        return ensureHealthyDesktopAgent(agentKey, USER_STATES.AVAILABLE);
      }

      if (currentState === USER_STATES.AVAILABLE) {
        await changeUserState(page, USER_STATES.MEETING);
        await waitForState(page, USER_STATES.MEETING);
        await page.waitForTimeout(2000);
      }

      await changeUserState(page, USER_STATES.AVAILABLE);
      await waitForState(page, USER_STATES.AVAILABLE);
      await page.waitForTimeout(5000);
      page = getDesktopAgentPage(agentKey);

      return page;
    };

    const ensureHealthyCallerPage = (resetRegistration = false) =>
      ensureHealthyCallerPageBase(testManager, {
        browser: testBrowser,
        resetRegistration,
        includeDialNumberToken: true,
        preferAgent2TokenBeforeGlobalCaller: true,
        endCallSettleMs: 1000,
        recreateOnReset: true,
        waitForRegisteredAfterLoginMs: 30000,
        waitForCreateCallEnabledAfterLoginMs: 30000,
        strictRegisterClick: true,
        registerTimeoutMs: 20000,
        waitAfterRegisterMs: 2000,
        createReadyCheck: 'visible-form',
      });

    const createInboundCallAndConnect = async (
      agentKey: DesktopAgentKey,
      options: {requireConsult?: boolean; requireTransfer?: boolean} = {}
    ): Promise<void> => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          if (attempt > 0) {
            await recreateDesktopAgentPage(agentKey).catch(() => {});
          }

          await ensureHealthyCallerPage(attempt > 0);
          await refreshAvailableRoutingState(agentKey);
          await createCallTask(
            testManager.callerPage!,
            process.env[`${testManager.projectName}_ENTRY_POINT`]!
          );
          await ensureConnectedCall(getDesktopAgentPage(agentKey), attempt === 0 ? 60000 : 90000);

          if (options.requireConsult) {
            await ensureMainCallConsultReady(getDesktopAgentPage(agentKey));
          }

          if (options.requireTransfer) {
            await ensureTransferCapableCall(getDesktopAgentPage(agentKey));
          }

          return;
        } catch (error) {
          lastError = error;

          if (attempt < 2) {
            await handleStrayTasks(getDesktopAgentPage(agentKey)).catch(() => {});
            await recreateDesktopAgentPage(agentKey).catch(() => {});
            await getDesktopAgentPage(agentKey)
              .waitForTimeout(1000)
              .catch(() => {});
          }
        }
      }

      throw lastError;
    };

    const ensureTransferCapableCallOrRecreate = async (
      agentKey: DesktopAgentKey
    ): Promise<void> => {
      const page = getDesktopAgentPage(agentKey);
      const transferReady = await ensureTransferCapableCall(page)
        .then(() => true)
        .catch(() => false);

      if (transferReady) {
        return;
      }

      const wrapupReady = await hasVisibleEnabledActionButton(page, 'Wrapup', '#wrapup');
      if (wrapupReady) {
        await submitWrapup(page, WRAPUP_REASONS.SALE).catch(() => {});
        await waitForState(page, USER_STATES.AVAILABLE).catch(() => {});
      } else {
        const endReady = await hasVisibleEnabledActionButton(page, 'End', '#end');
        if (endReady) {
          await endTask(page).catch(() => {});
          await submitWrapup(page, WRAPUP_REASONS.SALE).catch(() => {});
        }

        await handleStrayTasks(page).catch(() => {});
      }

      await createInboundCallAndConnect(agentKey, {requireTransfer: true});
    };

    const startAgentConsultAndConnectTarget = async (
      sourceKey: DesktopAgentKey,
      targetKey: DesktopAgentKey,
      targetAgentName: string
    ): Promise<void> => {
      let lastError: unknown;

      const recoverSourceCall = async (): Promise<void> => {
        const sourcePage = getDesktopAgentPage(sourceKey);
        await endTask(sourcePage).catch(() =>
          sourcePage
            .evaluate(async () => {
              const task = (globalThis as typeof globalThis & {currentTask?: any}).currentTask;
              await task?.end?.();
            })
            .catch(() => {})
        );
        await submitWrapup(sourcePage, WRAPUP_REASONS.SALE).catch(() => {});
        await handleStrayTasks(sourcePage).catch(() => {});
        await ensureHealthyDesktopAgent(targetKey, USER_STATES.MEETING).catch(() => {});
        await createInboundCallAndConnect(sourceKey, {requireConsult: true});
      };
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const sourcePage = getDesktopAgentPage(sourceKey);

        try {
          await refreshAvailableRoutingState(targetKey);
          await ensureMainCallConsultReady(sourcePage);
          await consultOrTransfer(sourcePage, 'agent', 'consult', targetAgentName);
          await ensureConnectedCall(getDesktopAgentPage(targetKey));

          return;
        } catch (error) {
          lastError = error;
          await cancelConsult(sourcePage).catch(() => {});
          if (String(error).includes('toBeTruthy') && attempt < 1) {
            await recoverSourceCall().catch(() => {});
          }
          await refreshAvailableRoutingState(targetKey).catch(() => {});
        }
      }

      throw lastError;
    };

    const isDestinationLookupFailure = (error: unknown): boolean => {
      const message = String(error);

      return (
        message.includes('Consult/Transfer destination') ||
        message.includes('Transfer destination') ||
        message.includes('Expected: not ""')
      );
    };

    const transferToAgentWithRecovery = async (
      sourceKey: DesktopAgentKey,
      targetKey: DesktopAgentKey,
      targetAgentName: string
    ): Promise<void> => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const sourcePage = getDesktopAgentPage(sourceKey);

        try {
          await refreshAvailableRoutingState(targetKey);
          await ensureTransferCapableCallOrRecreate(sourceKey);
          await consultOrTransfer(sourcePage, 'agent', 'transfer', targetAgentName);

          return;
        } catch (error) {
          lastError = error;
          await dismissActionDialog(sourcePage, 500).catch(() => {});

          if (!isDestinationLookupFailure(error) || attempt >= 1) {
            break;
          }

          await recreateDesktopAgentPage(targetKey).catch(() => {});
          await refreshAvailableRoutingState(targetKey).catch(() => {});
          await sourcePage.waitForTimeout(3000).catch(() => {});
        }
      }

      throw lastError;
    };

    const endCallAndSubmitWrapup = async (page: Page, reason = WRAPUP_REASONS.SALE) => {
      await endTask(page).catch(() =>
        page
          .evaluate(async () => {
            const task = (globalThis as typeof globalThis & {currentTask?: any}).currentTask;
            await task?.end?.();
          })
          .catch(() => {})
      );
      await page.waitForTimeout(2000);
      await submitWrapup(page, reason).catch(() => {});
    };

    const transferToAgentAndConnectWithRecovery = async (
      sourceKey: DesktopAgentKey,
      targetKey: DesktopAgentKey,
      targetAgentName: string,
      options: {recoverWithFreshSourceCall?: boolean} = {}
    ): Promise<void> => {
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          await transferToAgentWithRecovery(sourceKey, targetKey, targetAgentName);
          await ensureConnectedCall(getDesktopAgentPage(targetKey));

          return;
        } catch (error) {
          lastError = error;

          if (!options.recoverWithFreshSourceCall || attempt >= 1) {
            break;
          }

          await endCallAndSubmitWrapup(getDesktopAgentPage(sourceKey), WRAPUP_REASONS.SALE).catch(
            () => {}
          );
          await endCallAndSubmitWrapup(getDesktopAgentPage(targetKey), WRAPUP_REASONS.SALE).catch(
            () => {}
          );
          await handleStrayTasks(getDesktopAgentPage(sourceKey)).catch(() => {});
          await handleStrayTasks(getDesktopAgentPage(targetKey)).catch(() => {});
          await refreshAvailableRoutingState(targetKey).catch(() => {});
          await createInboundCallAndConnect(sourceKey, {requireTransfer: true});
        }
      }

      throw lastError;
    };

    test.beforeAll(async ({browser}) => {
      testBrowser = browser;
    });

    test.beforeEach(() => {
      test.setTimeout(advancedCallingTestTimeout);
    });

    test.beforeEach(async ({browser}, testInfo) => {
      await waitForFullSuiteCallingResources(testInfo);
      releaseAdvancedCallingLock = await acquireSerialResourceLock('advanced-calling', {
        timeoutMs: advancedCallingTestTimeout,
      });

      testBrowser = browser;
      testManager = new TestManager(testInfo.project.name);
      await testManager.setupForAdvancedCombinations(browser);

      await ensureHealthyCallerPage();
      await handleStrayTasks(testManager.agent1Page);
      await handleStrayTasks(testManager.agent2Page);

      await ensureHealthyDesktopAgent('agent1', USER_STATES.AVAILABLE);
      await ensureHealthyDesktopAgent('agent2', USER_STATES.AVAILABLE);
      await testManager.agent1Page.waitForTimeout(3000);
    });

    test('Transfer from one agent to another, then transfer back to the first agent', async () => {
      await ensureHealthyDesktopAgent('agent2', USER_STATES.MEETING);
      await waitForState(testManager.agent2Page, USER_STATES.MEETING);
      await ensureHealthyDesktopAgent('agent1', USER_STATES.AVAILABLE);
      await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await testManager.agent1Page.waitForTimeout(5000);

      await createInboundCallAndConnect('agent1', {requireTransfer: true});

      await transferToAgentAndConnectWithRecovery(
        'agent1',
        'agent2',
        process.env[`${testManager.projectName}_AGENT2_NAME`]!,
        {recoverWithFreshSourceCall: true}
      );

      await submitTransferSourceWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE, () =>
        testManager.agent1Page.waitForTimeout(2000)
      );
      await ensureConnectedCall(testManager.agent2Page);
      await transferToAgentAndConnectWithRecovery(
        'agent2',
        'agent1',
        process.env[`${testManager.projectName}_AGENT1_NAME`]!,
        {recoverWithFreshSourceCall: true}
      );
      await testManager.agent1Page.waitForTimeout(2000);

      await submitTransferSourceWrapup(testManager.agent2Page, WRAPUP_REASONS.SALE, () =>
        testManager.agent1Page.waitForTimeout(2000)
      );

      await testManager.agent1Page.evaluate(() => {
        const btn = document.querySelector('#end') as HTMLButtonElement;
        if (btn) btn.click();
      });
      await testManager.agent1Page.waitForTimeout(3000);
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
    });

    test('Consult with another agent then transfer the call', async () => {
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
      await createInboundCallAndConnect('agent1', {requireConsult: true});
      await startAgentConsultAndConnectTarget(
        'agent1',
        'agent2',
        process.env[`${testManager.projectName}_AGENT2_NAME`]!
      );
      await testManager.agent2Page.waitForTimeout(2000);
      await waitForConsultingAgentIdReady(testManager.agent1Page, 20000);

      await executeConsultTransfer(testManager.agent1Page);

      await submitTransferSourceWrapup(testManager.agent1Page);
      await refreshAvailableRoutingState('agent1');
      await startAgentConsultAndConnectTarget(
        'agent2',
        'agent1',
        process.env[`${testManager.projectName}_AGENT1_NAME`]!
      );
      await testManager.agent1Page.waitForTimeout(2000);
      await waitForConsultingAgentIdReady(testManager.agent2Page, 20000);
      await executeConsultTransfer(testManager.agent2Page);
      await submitTransferSourceWrapup(testManager.agent2Page);
      await endCallAndSubmitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      await testManager.agent1Page.waitForTimeout(2000);
    });

    test('Consult with another agent, transfer the call and transfer the call back to the agent', async () => {
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
      await createInboundCallAndConnect('agent1', {requireConsult: true});
      await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await waitForState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await startAgentConsultAndConnectTarget(
        'agent1',
        'agent2',
        process.env[`${testManager.projectName}_AGENT2_NAME`]!
      );
      await testManager.agent2Page.waitForTimeout(2000);
      await waitForConsultingAgentIdReady(testManager.agent1Page, 20000);
      await executeConsultTransfer(testManager.agent1Page);
      await submitTransferSourceWrapup(testManager.agent1Page);
      await ensureConnectedCall(testManager.agent2Page);
      await transferToAgentAndConnectWithRecovery(
        'agent2',
        'agent1',
        process.env[`${testManager.projectName}_AGENT1_NAME`]!,
        {recoverWithFreshSourceCall: true}
      );
      await testManager.agent1Page.waitForTimeout(2000);
      await testManager.agent2Page.waitForTimeout(2000);
      await submitTransferSourceWrapup(testManager.agent2Page);
      await testManager.agent1Page.waitForTimeout(2000);
      await endCallAndSubmitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      await testManager.agent1Page.waitForTimeout(2000);
    });

    test('Transfer the call to another agent & then consult from the other agent', async () => {
      await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
      await waitForState(testManager.agent2Page, USER_STATES.MEETING);
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await testManager.agent1Page.waitForTimeout(5000);

      await createInboundCallAndConnect('agent1', {requireTransfer: true});
      await testManager.agent1Page.waitForTimeout(2000);
      await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await waitForState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await testManager.agent1Page.waitForTimeout(5000);
      await transferToAgentAndConnectWithRecovery(
        'agent1',
        'agent2',
        process.env[`${testManager.projectName}_AGENT2_NAME`]!,
        {recoverWithFreshSourceCall: true}
      );
      await testManager.agent2Page.waitForTimeout(2000);
      await testManager.agent1Page.waitForTimeout(2000);
      await submitTransferSourceWrapup(testManager.agent1Page);
      await refreshAvailableRoutingState('agent1');
      await ensureConnectedCall(testManager.agent2Page);
      await startAgentConsultAndConnectTarget(
        'agent2',
        'agent1',
        process.env[`${testManager.projectName}_AGENT1_NAME`]!
      );
      await testManager.agent1Page.waitForTimeout(2000);
      await waitForConsultingAgentIdReady(testManager.agent2Page, 20000);
      await executeConsultTransfer(testManager.agent2Page);
      await submitTransferSourceWrapup(testManager.agent2Page);
      await endCallAndSubmitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      await testManager.agent1Page.waitForTimeout(2000);
    });

    test('Multi-Stage Consult and Transfer Between A1 and A2', async () => {
      await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createInboundCallAndConnect('agent1', {requireConsult: true});
      await changeUserState(testManager.agent2Page, USER_STATES.AVAILABLE);
      await startAgentConsultAndConnectTarget(
        'agent1',
        'agent2',
        process.env[`${testManager.projectName}_AGENT2_NAME`]!
      );
      await testManager.agent2Page.waitForTimeout(3000);
      await waitForConsultingAgentIdReady(testManager.agent1Page, 20000);
      await executeConsultTransfer(testManager.agent1Page);
      await testManager.agent1Page.waitForTimeout(2000);
      await submitTransferSourceWrapup(testManager.agent1Page);
      await refreshAvailableRoutingState('agent1');
      await ensureConnectedCall(testManager.agent2Page);
      await startAgentConsultAndConnectTarget(
        'agent2',
        'agent1',
        process.env[`${testManager.projectName}_AGENT1_NAME`]!
      );
      await testManager.agent1Page.waitForTimeout(3000);
      await waitForConsultingAgentIdReady(testManager.agent2Page, 20000);
      await executeConsultTransfer(testManager.agent2Page);
      await submitTransferSourceWrapup(testManager.agent2Page, WRAPUP_REASONS.RESOLVED);
      await refreshAvailableRoutingState('agent2');
      await ensureConnectedCall(testManager.agent1Page);
      await startAgentConsultAndConnectTarget(
        'agent1',
        'agent2',
        process.env[`${testManager.projectName}_AGENT2_NAME`]!
      );
      await waitForConsultingAgentIdReady(testManager.agent1Page, 20000);
      await cancelConsult(testManager.agent1Page);
      const primaryCallState = await waitForPrimaryCallAfterConsult(testManager.agent1Page);
      if (primaryCallState === 'held') {
        await holdCallToggle(testManager.agent1Page);
      }
      await expect(testManager.agent1Page.locator('#end-consult')).toBeHidden();
      await expect
        .poll(
          async () =>
            testManager.agent1Page
              .locator('#consult')
              .first()
              .evaluate((el) => !(el as HTMLButtonElement).disabled)
              .catch(() => false),
          {timeout: 10000, intervals: [500, 1000, 2000]}
        )
        .toBeTruthy();
      await endCallAndSubmitWrapup(testManager.agent1Page, WRAPUP_REASONS.RESOLVED);
      await testManager.agent1Page.waitForTimeout(2000);
    });

    test('Entry Point: consult then end consult returns UI to normal', async () => {
      test.skip(!process.env.PW_ENTRYPOINT_NAME, 'PW_ENTRYPOINT_NAME not set');

      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createInboundCallAndConnect('agent1', {requireConsult: true});
      clearAdvancedCapturedLogs();
      await consultOrTransfer(
        testManager.agent1Page,
        'entryPoint',
        'consult',
        process.env.PW_ENTRYPOINT_NAME!
      );
      await waitForConsultingAgentIdReady(testManager.agent1Page, 20000);
      await verifyConsultStartSuccessLogs(testManager.agent1Page);
      await cancelConsult(testManager.agent1Page);
      await testManager.agent1Page.waitForTimeout(1000);
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
  });
}

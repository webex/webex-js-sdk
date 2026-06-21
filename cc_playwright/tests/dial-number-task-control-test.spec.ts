/* eslint-disable no-await-in-loop */
import {test, expect, Browser, Page} from '@playwright/test';
import {
  cancelConsult,
  consultOrTransfer,
  clearAdvancedCapturedLogs,
  ensureConsultAccepted,
  setupAdvancedConsoleLogging,
  verifyConsultStartSuccessLogs,
  verifyTransferSuccessLogs,
  verifyConsultEndSuccessLogs,
} from '../Utils/advancedTaskControlUtils';
import {executeConsultTransfer} from '../Utils/consultTransferWorkaround';
import {
  changeUserState,
  republishAgentAvailability,
  verifyCurrentState,
} from '../Utils/userStateUtils';
import {
  acceptCurrentTaskModel,
  createCallTask,
  acceptExtensionCall,
  endCallTask,
  declineExtensionCall,
} from '../Utils/incomingTaskUtils';
import {submitWrapup} from '../Utils/wrapupUtils';
import {USER_STATES, TASK_TYPES, WRAPUP_REASONS} from '../constants';
import {clearPendingCallAndWrapup} from '../Utils/helperUtils';
import {
  endTask,
  holdCallToggle,
  verifyHoldButtonIcon,
  verifyTaskControls,
} from '../Utils/taskControlUtils';
import {TestManager} from '../test-manager';
import {clickDomButton} from '../Utils/controlUtils';
import {ensureHealthyCallerPage as ensureHealthyCallingSamplePageBase} from '../Utils/callerPageUtils';
import {ensureHealthyDesktopAgent as ensureHealthyDesktopAgentBase} from '../Utils/desktopAgentUtils';

export default function createDialNumberTaskControlTests() {
  test.describe('Dial Number Task Control Tests ', () => {
    let testManager: TestManager;
    let testBrowser: Browser;

    const pollTruthy = (
      fn: () => Promise<boolean>,
      timeout: number,
      intervals = [500, 1000, 2000]
    ): Promise<boolean> =>
      expect
        .poll(fn, {timeout, intervals})
        .toBeTruthy()
        .then(() => true)
        .catch(() => false);

    const runCleanupBestEffort = async (
      task: () => Promise<void>,
      timeoutMs = 15000
    ): Promise<void> => {
      await Promise.race([
        task().catch(() => {}),
        new Promise<void>((resolve) => {
          setTimeout(resolve, timeoutMs);
        }),
      ]);
    };

    const cleanupStrayTasks = async (page?: Page): Promise<void> => {
      if (!page || page.isClosed()) {
        return;
      }

      await runCleanupBestEffort(async () => {
        if (page === testManager.dialNumberPage) {
          await cleanupDialNumberTransferLeg().catch(() => {});

          return;
        }

        await clearPendingCallAndWrapup(page).catch(() => {});
        const ronaVisible = await page
          .locator('#agentStatePopup')
          .isVisible()
          .catch(() => false);
        if (ronaVisible) {
          await changeUserState(page, USER_STATES.AVAILABLE).catch(() => {});
        }
      });
    };

    const ensureHealthyAgent = (page: Page, targetState = USER_STATES.AVAILABLE): Promise<Page> =>
      ensureHealthyDesktopAgentBase(testManager, page, targetState, {
        browser: testBrowser,
        captureConsoleMessages: true,
        setupConsoleLogging: setupAdvancedConsoleLogging,
        verifyTargetState: true,
      });

    const hasDialNumberLegSurfaced = async (): Promise<boolean> => {
      const [answerEnabled, endEnabled, statusText] = await Promise.all([
        testManager.dialNumberPage
          .locator('#answer')
          .first()
          .isEnabled()
          .catch(() => false),
        testManager.dialNumberPage
          .locator('#end-call')
          .first()
          .isEnabled()
          .catch(() => false),
        testManager.dialNumberPage
          .locator('#call-object')
          .innerText()
          .then((text) => text.toLowerCase())
          .catch(() => ''),
      ]);

      return (
        answerEnabled ||
        endEnabled ||
        statusText.includes('call progress') ||
        statusText.includes('call established') ||
        statusText.includes('connected')
      );
    };

    const remoteTransferLegSurfaced = async (): Promise<boolean> =>
      pollTruthy(hasDialNumberLegSurfaced, 15000);

    const hasAcceptedDialNumberConsultOnPrimary = async (): Promise<boolean> => {
      const incomingText = (
        await testManager.agent1Page
          .locator('#incoming-task')
          .innerText()
          .catch(() => '')
      ).toLowerCase();
      const endConsultEnabled = await testManager.agent1Page
        .locator('#end-consult')
        .first()
        .isEnabled()
        .catch(() => false);
      const consultTransferEnabled = await testManager.agent1Page
        .locator('#consult-transfer')
        .first()
        .isEnabled()
        .catch(() => false);
      const mergeEnabled = await testManager.agent1Page
        .locator('#merge-conference')
        .first()
        .isEnabled()
        .catch(() => false);

      return (
        incomingText.includes('consulting') ||
        incomingText.includes('consultaccepted') ||
        incomingText.includes('consult: consultaccepted') ||
        endConsultEnabled ||
        consultTransferEnabled ||
        mergeEnabled
      );
    };

    const acceptDialNumberConsultIfNeeded = async (): Promise<void> => {
      const acceptDialNumberLeg = async (): Promise<void> => {
        if (!(await hasDialNumberLegSurfaced())) {
          return;
        }

        await acceptExtensionCall(testManager.dialNumberPage).catch(async () => {
          await testManager.dialNumberPage
            .locator('#answer')
            .first()
            .click({timeout: 3000})
            .catch(() => {});
        });
      };

      const alreadyAccepted = await pollTruthy(() => hasAcceptedDialNumberConsultOnPrimary(), 8000);

      if (alreadyAccepted) {
        return;
      }

      await acceptDialNumberLeg();

      const accepted = await pollTruthy(async () => {
        if (await hasAcceptedDialNumberConsultOnPrimary()) {
          return true;
        }

        await acceptDialNumberLeg();

        return hasAcceptedDialNumberConsultOnPrimary();
      }, 45000);

      expect(accepted).toBeTruthy();
    };

    const cleanupDialNumberTransferLeg = async (): Promise<void> => {
      await testManager.dialNumberPage.bringToFront();

      const answerButton = testManager.dialNumberPage.locator('#answer').first();
      const endCallButton = testManager.dialNumberPage.locator('#end-call').first();
      const callStatus = testManager.dialNumberPage.locator('#call-object');

      const getLegState = async (): Promise<'answerable' | 'endable' | 'gone' | 'waiting'> => {
        const answerEnabled = await answerButton.isEnabled().catch(() => false);
        const endEnabled = await endCallButton.isEnabled().catch(() => false);
        const statusText = (await callStatus.innerText().catch(() => '')).toLowerCase().trim();

        const isTerminalState =
          statusText === '' ||
          statusText.includes('call ended') ||
          statusText.includes('call disconnected') ||
          statusText.includes('disconnected') ||
          statusText.includes('declined') ||
          statusText.includes('failed') ||
          statusText.includes('ended');

        if (endEnabled) {
          return 'endable';
        }

        if (answerEnabled) {
          return 'answerable';
        }

        if (isTerminalState) {
          return 'gone';
        }

        return 'waiting';
      };

      let legState = await expect
        .poll(getLegState, {timeout: 15000, intervals: [500, 1000, 2000]})
        .not.toBe('waiting')
        .then(() => getLegState())
        .catch(() => 'waiting' as const);

      if (legState === 'answerable') {
        await acceptExtensionCall(testManager.dialNumberPage).catch(() => {});
        legState = await expect
          .poll(getLegState, {timeout: 10000, intervals: [500, 1000, 2000]})
          .not.toBe('waiting')
          .then(() => getLegState())
          .catch(() => 'waiting' as const);
      }

      if (legState === 'endable') {
        await endCallTask(testManager.dialNumberPage, true);

        return;
      }

      if (legState === 'gone') {
        return;
      }

      await testManager.dialNumberPage
        .evaluate(() => {
          const activeCall = (window as unknown as {call?: {end?: () => void}}).call;
          activeCall?.end?.();
        })
        .catch(() => {});
      await testManager.dialNumberPage.waitForTimeout(2000);
    };

    const ensureHealthyCallingSamplePage = async (
      kind: 'caller' | 'dialNumber',
      resetRegistration = false
    ): Promise<void> => {
      await ensureHealthyCallingSamplePageBase(testManager, {
        browser: testBrowser,
        samplePage: kind,
        resetRegistration,
        includeDialNumberToken: true,
        endCallSettleMs: 1000,
        registerTimeoutMs: 30000,
        waitAfterRegisterMs: 2000,
        recreateIfCreateCallNotReady: true,
        createCallReadyAfterRecreateMs: 30000,
      });
    };

    const createAndAcceptAgent1Call = async (): Promise<void> => {
      const entryPoint = process.env[`${testManager.projectName}_ENTRY_POINT`]!;
      let lastError: unknown;

      const waitForAgent1Offer = async (timeout = 60000): Promise<void> => {
        const incomingTaskSummary = testManager.agent1Page.locator('#incoming-task').first();
        const incomingTaskDiv = testManager.agent1Page
          .locator('#taskList .task-item-content')
          .first();
        const taskListAcceptButton = incomingTaskDiv.getByRole('button', {name: 'Accept'}).first();
        const mainAnswerButton = testManager.agent1Page.locator('#answer').first();

        await expect
          .poll(
            async () => {
              const taskListAcceptVisible = await taskListAcceptButton
                .isVisible()
                .catch(() => false);
              const summaryText = (
                await incomingTaskSummary.innerText().catch(() => '')
              ).toLowerCase();
              const hasIncomingSummary =
                summaryText !== '' && !summaryText.includes('no incoming tasks');
              const answerEnabled = await mainAnswerButton.isEnabled().catch(() => false);

              return taskListAcceptVisible || hasIncomingSummary || answerEnabled;
            },
            {timeout, intervals: [500, 1000, 2000]}
          )
          .toBeTruthy();
      };

      const acceptAgent1Offer = async (): Promise<void> => {
        const incomingTaskDiv = testManager.agent1Page
          .locator('#taskList .task-item-content')
          .first();
        const taskListAcceptButton = incomingTaskDiv.getByRole('button', {name: 'Accept'}).first();
        const mainAnswerButton = testManager.agent1Page.locator('#answer').first();

        const taskListAcceptVisible = await taskListAcceptButton.isVisible().catch(() => false);
        if (taskListAcceptVisible) {
          await expect(taskListAcceptButton).toBeEnabled({timeout: 5000});
          await taskListAcceptButton.click({timeout: 5000}).catch(async () => {
            await taskListAcceptButton.click({force: true, timeout: 5000});
          });
          await testManager.agent1Page.waitForTimeout(2000);

          const retryAcceptVisible = await taskListAcceptButton.isVisible().catch(() => false);
          if (retryAcceptVisible) {
            await taskListAcceptButton.click({force: true, timeout: 5000}).catch(() => {});
            await testManager.agent1Page.waitForTimeout(2000);
          }
        }

        const answerEnabled = await mainAnswerButton.isEnabled().catch(() => false);
        if (answerEnabled) {
          await clickDomButton(testManager.agent1Page, '#answer');
          await testManager.agent1Page.waitForTimeout(5000);

          return;
        }

        await acceptCurrentTaskModel(testManager.agent1Page);
        await testManager.agent1Page.waitForTimeout(3000);
      };
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          await clearPendingCallAndWrapup(testManager.agent1Page).catch(() => {});
          await ensureHealthyAgent(testManager.agent1Page, USER_STATES.AVAILABLE);
          await ensureHealthyCallingSamplePage('caller', attempt > 0);
          await republishAgentAvailability(testManager.agent1Page);
          await testManager.agent1Page.waitForTimeout(2000);

          await createCallTask(testManager.callerPage!, entryPoint);
          await waitForAgent1Offer(attempt === 0 ? 60000 : 90000);
          await acceptAgent1Offer();
          await expect(testManager.agent1Page.locator('#incoming-task')).toContainText(
            'connected',
            {
              timeout: 15000,
            }
          );

          return;
        } catch (error) {
          lastError = error;
          await clearPendingCallAndWrapup(testManager.agent1Page).catch(() => {});
          await testManager.agent1Page.waitForTimeout(1000).catch(() => {});
        }
      }

      throw lastError;
    };

    test.beforeAll(async ({browser}, testInfo) => {
      const projectName = testInfo.project.name;
      testBrowser = browser;
      testManager = new TestManager(projectName);
      await testManager.setupForDialNumber(browser);
    });

    test.beforeEach(async (_context, testInfo) => {
      testInfo.setTimeout(Math.max(testInfo.timeout, 10 * 60 * 1000));

      await cleanupStrayTasks(testManager.agent1Page);
      await cleanupStrayTasks(testManager.agent2Page);
      await cleanupStrayTasks(testManager.dialNumberPage);

      await ensureHealthyAgent(testManager.agent1Page, USER_STATES.AVAILABLE);
      await ensureHealthyAgent(testManager.agent2Page, USER_STATES.AVAILABLE);
      await ensureHealthyCallingSamplePage('caller');
      if (testManager.dialNumberPage) {
        await ensureHealthyCallingSamplePage('dialNumber');
      }
      await testManager.agent1Page.waitForTimeout(3000);
    });
    test.describe('Dial Number Tests', () => {
      test.beforeAll(async () => {
        test.skip(!process.env.PW_DIAL_NUMBER_NAME, 'PW_DIAL_NUMBER_NAME not set');
      });

      test('Two-hop: consult to Agent then consult-transfer to Dial Number', async () => {
        test.setTimeout(7 * 60 * 1000);
        test.skip(!process.env.PW_DIAL_NUMBER_NAME, 'PW_DIAL_NUMBER_NAME not set');

        await clearPendingCallAndWrapup(testManager.agent1Page);
        await clearPendingCallAndWrapup(testManager.agent2Page);
        await ensureHealthyAgent(testManager.agent2Page, USER_STATES.MEETING);
        await ensureHealthyAgent(testManager.agent1Page, USER_STATES.AVAILABLE);
        await testManager.agent1Page.waitForTimeout(5000);
        await createAndAcceptAgent1Call();

        // Desktop mode doesn't auto-transition to Engaged - verify call connected instead
        await expect(testManager.agent1Page.locator('#incoming-task')).toContainText('connected', {
          timeout: 10000,
        });

        await republishAgentAvailability(testManager.agent2Page);
        await testManager.agent1Page.waitForTimeout(2000);

        clearAdvancedCapturedLogs();
        await consultOrTransfer(
          testManager.agent1Page,
          'agent',
          'consult',
          process.env[`${testManager.projectName}_AGENT2_NAME`]!
        );
        await ensureConsultAccepted(testManager.agent1Page, testManager.agent2Page);
        await testManager.agent2Page.waitForTimeout(3000);

        await executeConsultTransfer(testManager.agent1Page);

        await expect(testManager.agent1Page.locator('#wrapupCodesDropdown')).toBeEnabled({
          timeout: 15000,
        });
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);

        await expect(testManager.agent2Page.locator('#consult')).toBeEnabled({
          timeout: 10000,
        });
        await testManager.agent2Page.waitForTimeout(3000);

        await consultOrTransfer(
          testManager.agent2Page,
          'dialNumber',
          'consult',
          process.env.PW_DIAL_NUMBER_NAME!
        );
        if (await remoteTransferLegSurfaced()) {
          await acceptExtensionCall(testManager.dialNumberPage).catch(() => {});
        }
        await executeConsultTransfer(testManager.agent2Page);
        await submitWrapup(testManager.agent2Page, WRAPUP_REASONS.SALE);
        await verifyTransferSuccessLogs(); // Consult-transfer emits TRANSFER_SUCCESS, not AgentConsultTransferred
        if (await remoteTransferLegSurfaced()) {
          await cleanupDialNumberTransferLeg();
        }
      });

      test('Dial Number Consult: cancel, decline, accept/end, and transfer scenarios are handled correctly in sequence', async () => {
        await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
        await createAndAcceptAgent1Call();

        await expect(testManager.agent1Page.locator('#incoming-task')).toContainText('connected', {
          timeout: 10000,
        });

        clearAdvancedCapturedLogs();
        await consultOrTransfer(
          testManager.agent1Page,
          'dialNumber',
          'consult',
          process.env.PW_DIAL_NUMBER_NAME
        );
        await expect(
          testManager.agent1Page.getByRole('button', {name: 'End Consult'}).first()
        ).toBeVisible({timeout: 10000});
        await testManager.agent1Page.waitForTimeout(2000);
        await cancelConsult(testManager.agent1Page);
        await verifyTaskControls(testManager.agent1Page, TASK_TYPES.CALL);
        await expect(testManager.agent1Page.getByRole('button', {name: 'End Consult'})).toHaveCount(
          0
        );

        await verifyHoldButtonIcon(testManager.agent1Page, {expectedIsHeld: true});
        await holdCallToggle(testManager.agent1Page);
        await testManager.agent1Page.waitForTimeout(2000);

        clearAdvancedCapturedLogs();
        await consultOrTransfer(
          testManager.agent1Page,
          'dialNumber',
          'consult',
          process.env.PW_DIAL_NUMBER_NAME
        );
        await declineExtensionCall(testManager.dialNumberPage);
        await testManager.agent1Page.waitForTimeout(2000);
        await cancelConsult(testManager.agent1Page);
        await verifyTaskControls(testManager.agent1Page, TASK_TYPES.CALL);
        await verifyHoldButtonIcon(testManager.agent1Page, {expectedIsHeld: true});
        await holdCallToggle(testManager.agent1Page);
        await testManager.agent1Page.waitForTimeout(2000);
        await expect(testManager.agent1Page.getByRole('button', {name: 'End Consult'})).toHaveCount(
          0
        );

        clearAdvancedCapturedLogs();
        await consultOrTransfer(
          testManager.agent1Page,
          'dialNumber',
          'consult',
          process.env.PW_DIAL_NUMBER_NAME
        );
        await testManager.agent1Page.waitForTimeout(2000);
        await verifyConsultStartSuccessLogs(testManager.agent1Page);
        await acceptDialNumberConsultIfNeeded();
        await testManager.agent1Page.bringToFront();
        await cancelConsult(testManager.agent1Page);
        await verifyTaskControls(testManager.agent1Page, TASK_TYPES.CALL);
        await testManager.agent1Page.waitForTimeout(2000);
        await verifyConsultEndSuccessLogs();
        await verifyHoldButtonIcon(testManager.agent1Page, {expectedIsHeld: true});
        await holdCallToggle(testManager.agent1Page);

        // 4. Consult transfer
        clearAdvancedCapturedLogs();
        await consultOrTransfer(
          testManager.agent1Page,
          'dialNumber',
          'consult',
          process.env.PW_DIAL_NUMBER_NAME
        );
        await acceptDialNumberConsultIfNeeded();
        await testManager.agent1Page.waitForTimeout(3000);
        await executeConsultTransfer(testManager.agent1Page);
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
        await testManager.dialNumberPage.waitForTimeout(2000);
        await verifyConsultStartSuccessLogs(testManager.agent1Page);
        await verifyTransferSuccessLogs(); // Consult-transfer emits TRANSFER_SUCCESS, not AgentConsultTransferred
        if (await remoteTransferLegSurfaced()) {
          await cleanupDialNumberTransferLeg();
        }
      });

      test('Dial Number is available in consult destination list', async () => {
        // Sample app version: Verify dial number appears in consult dialog dropdown
        // (No search UI - sample app uses simple <select> dropdown)

        const dialNumberName = process.env.PW_DIAL_NUMBER_NAME!;

        // Setup: create call and verify connected
        await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
        await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
        await createAndAcceptAgent1Call();

        // Desktop mode doesn't auto-transition to Engaged - verify call connected instead
        await expect(testManager.agent1Page.locator('#incoming-task')).toContainText('connected', {
          timeout: 10000,
        });

        // Open consult dialog
        await clickDomButton(testManager.agent1Page, '#consult');

        // Wait for dialog to open
        await testManager.agent1Page
          .locator('#consult-destination-type')
          .waitFor({state: 'visible', timeout: 10000});

        // Select dialNumber destination type
        await testManager.agent1Page
          .locator('#consult-destination-type')
          .selectOption('dialNumber');
        await testManager.agent1Page.waitForTimeout(1000);

        // Verify dial number appears in dropdown and select it
        const destField = testManager.agent1Page.locator('#consultDestination').first();
        await destField.waitFor({state: 'attached', timeout: 10000});

        // Get all options and verify our dial number is present
        const optionTexts = await destField.locator('option').allTextContents();
        const hasDialNumber = optionTexts.some(
          (opt) => opt.includes(dialNumberName) || dialNumberName.includes(opt)
        );
        expect(hasDialNumber).toBeTruthy();

        // Select the dial number to verify it's selectable
        const matchingOption = optionTexts.find(
          (opt) => opt.includes(dialNumberName) || dialNumberName.includes(opt)
        );
        await destField.selectOption({label: matchingOption!});

        // Close dialog by clicking outside or pressing Escape
        await testManager.agent1Page.keyboard.press('Escape');
        await testManager.agent1Page.waitForTimeout(1000);

        // End call and complete wrapup to clean up for next tests
        await endTask(testManager.agent1Page);
        await testManager.agent1Page.bringToFront();
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
        await testManager.agent1Page.waitForTimeout(1000);
      });

      test('Dial Number: consult then end consult returns UI to normal', async () => {
        test.skip(!process.env.PW_DIAL_NUMBER_NAME, 'PW_DIAL_NUMBER_NAME not set');

        await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
        await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
        await createAndAcceptAgent1Call();

        // Desktop mode doesn't auto-transition to Engaged - verify call connected instead
        await expect(testManager.agent1Page.locator('#incoming-task')).toContainText('connected', {
          timeout: 10000,
        });
        clearAdvancedCapturedLogs();
        await consultOrTransfer(
          testManager.agent1Page,
          'dialNumber',
          'consult',
          process.env.PW_DIAL_NUMBER_NAME!
        );
        await expect(
          testManager.agent1Page.getByRole('button', {name: 'End Consult'}).first()
        ).toBeVisible({timeout: 10000});
        await cancelConsult(testManager.agent1Page);
        await expect(testManager.agent1Page.getByRole('button', {name: 'End Consult'})).toHaveCount(
          0
        );
        await endCallTask(testManager.callerPage!, true);
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      });

      test('Dial Number: consult then transfer completes and remote ends', async () => {
        test.skip(!process.env.PW_DIAL_NUMBER_NAME, 'PW_DIAL_NUMBER_NAME not set');

        await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
        await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
        await createAndAcceptAgent1Call();
        clearAdvancedCapturedLogs();
        await consultOrTransfer(
          testManager.agent1Page,
          'dialNumber',
          'consult',
          process.env.PW_DIAL_NUMBER_NAME!
        );
        await acceptDialNumberConsultIfNeeded();
        await executeConsultTransfer(testManager.agent1Page);
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
        await verifyConsultStartSuccessLogs(testManager.agent1Page);
        await verifyTransferSuccessLogs(); // Consult-transfer emits TRANSFER_SUCCESS, not AgentConsultTransferred
        await cleanupDialNumberTransferLeg();
      });

      test.beforeEach(async () => {
        await Promise.all([
          testManager.softCleanup().catch(() => {}),
          cleanupStrayTasks(testManager.dialNumberPage),
        ]);
        await changeUserState(testManager.agent2Page, USER_STATES.MEETING);
        await testManager.agent2Page.waitForTimeout(2000);
        await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
        await testManager.agent1Page.waitForTimeout(3000);
      });

      test('Blind Transfer to DialNumber', async () => {
        // Create call and agent 1 accepts
        await createAndAcceptAgent1Call();

        // Desktop mode doesn't auto-transition to Engaged - verify call connected instead
        await expect(testManager.agent1Page.locator('#incoming-task')).toContainText('connected', {
          timeout: 10000,
        });
        clearAdvancedCapturedLogs();

        await consultOrTransfer(
          testManager.agent1Page,
          'dialNumber',
          'transfer',
          process.env.PW_DIAL_NUMBER_NAME
        );
        await verifyTransferSuccessLogs();
        if (await remoteTransferLegSurfaced()) {
          await cleanupDialNumberTransferLeg();
        }
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.RESOLVED);
        await testManager.agent1Page.waitForTimeout(2000);
        await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
        // Ensure dial number page is ready for next test - wait for task cleanup
        await testManager.dialNumberPage.waitForTimeout(3000);
      });

      test.skip('Blind Transfer to Queue with DialNumber', async () => {
        // SKIP: Dial number receives task in "new" state but never becomes answerable (40s timeout)
        // Root cause: Queue routing to dial number might require different backend configuration
        // or this scenario isn't supported. Direct dial number transfers work (test 7 passes).
        // Needs investigation: Is "queue with dn e2e" configured to route to dial number?

        // Create call and agent 1 accepts
        await createAndAcceptAgent1Call();

        // Desktop mode doesn't auto-transition to Engaged - verify call connected instead
        await expect(testManager.agent1Page.locator('#incoming-task')).toContainText('connected', {
          timeout: 10000,
        });
        clearAdvancedCapturedLogs();

        await consultOrTransfer(testManager.agent1Page, 'queue', 'transfer', 'queue with dn e2e');
        await acceptExtensionCall(testManager.dialNumberPage);
        await verifyTransferSuccessLogs();
        await endCallTask(testManager.callerPage!, true);
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.RESOLVED);
        await testManager.agent1Page.waitForTimeout(2000);
        await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
      });

      test('Consult then end consult returns UI to normal', async () => {
        await createAndAcceptAgent1Call();

        // Desktop mode doesn't auto-transition to Engaged - verify call connected instead
        await expect(testManager.agent1Page.locator('#incoming-task')).toContainText('connected', {
          timeout: 10000,
        });

        clearAdvancedCapturedLogs();
        await consultOrTransfer(
          testManager.agent1Page,
          'dialNumber',
          'consult',
          process.env.PW_DIAL_NUMBER_NAME!
        );
        await expect(
          testManager.agent1Page.getByRole('button', {name: 'End Consult'}).first()
        ).toBeVisible({timeout: 10000});
        await cancelConsult(testManager.agent1Page);
        await expect(testManager.agent1Page.getByRole('button', {name: 'End Consult'})).toHaveCount(
          0
        );
        await endCallTask(testManager.callerPage!, true);
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      });

      test('Consult then transfer completes and remote ends', async () => {
        await createAndAcceptAgent1Call();

        clearAdvancedCapturedLogs();
        await consultOrTransfer(
          testManager.agent1Page,
          'dialNumber',
          'consult',
          process.env.PW_DIAL_NUMBER_NAME!
        );
        await acceptDialNumberConsultIfNeeded();
        await testManager.agent1Page.bringToFront();
        await executeConsultTransfer(testManager.agent1Page);
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
        await verifyConsultStartSuccessLogs(testManager.agent1Page);
        await verifyTransferSuccessLogs(); // Consult-transfer emits TRANSFER_SUCCESS, not AgentConsultTransferred
        await cleanupDialNumberTransferLeg();
      });
    });
  });
}

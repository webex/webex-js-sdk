/* eslint-disable no-await-in-loop, no-plusplus */
import {Locator, Page, expect} from '@playwright/test';
import {holdCallToggle, isCallHeld} from './taskControlUtils';
import {
  clickFirstVisibleEnabledControl,
  clickDomButton,
  clickEnabledDomButton,
  clickVisibleTextButton,
  findVisibleEnabledActionButton,
  getTaskReadinessSnapshot,
  hasAnyVisibleControl,
  hasVisibleEnabledActionButton,
} from './controlUtils';
import {acceptCurrentTaskModel, acceptIncomingTask} from './incomingTaskUtils';
import {ACCEPT_TASK_TIMEOUT, AWAIT_TIMEOUT, OPERATION_TIMEOUT, TASK_TYPES} from '../constants';

const capturedAdvancedLogs: string[] = [];
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

export const ACTIVE_CONSULT_CONTROL_TEST_IDS = [
  '#end-consult',
  '#transfer',
  '#merge-conference',
  '#exit-conference',
];

export async function hasAnyVisibleControlFromList(
  page: Page,
  selectors: string[]
): Promise<boolean> {
  for (const selector of selectors) {
    if (await hasAnyVisibleControl(page, selector)) {
      return true;
    }
  }

  return false;
}

export function setupAdvancedConsoleLogging(page: Page): () => void {
  const consoleHandler = (msg) => {
    const logText = msg.text();
    if (
      logText.includes('WXCC_SDK_TASK_TRANSFER_SUCCESS') ||
      logText.includes('WXCC_SDK_TASK_CONSULT_START_SUCCESS') ||
      logText.includes('WXCC_SDK_TASK_CONSULT_END_SUCCESS') ||
      logText.includes('AgentConsultTransferred') ||
      logText.includes('onEnd invoked') ||
      logText.includes('onTransfer invoked') ||
      logText.includes('onConsult invoked')
    ) {
      capturedAdvancedLogs.push(logText);
    }
  };

  page.on('console', consoleHandler);

  return () => page.off('console', consoleHandler);
}

export function clearAdvancedCapturedLogs(): void {
  capturedAdvancedLogs.length = 0;
}

const hasCapturedAdvancedLog = (eventName: string): boolean =>
  capturedAdvancedLogs.some((log) => log.includes(eventName));

const hasConsultStartEvidence = async (page: Page): Promise<boolean> => {
  const snapshot = await getConsultSnapshot(page);
  const incomingText = await page
    .locator('#incoming-task')
    .innerText()
    .catch(() => '');

  if (
    snapshot.relationshipType === 'consult' ||
    ['consulting', 'consultaccepted', 'beingconsulted', 'beingconsultedaccepted'].includes(
      snapshot.consultStatus
    ) ||
    incomingText.toLowerCase().includes('consult')
  ) {
    return true;
  }

  return hasAnyVisibleControlFromList(page, ACTIVE_CONSULT_CONTROL_TEST_IDS);
};

const verifyCapturedAdvancedLog = async (eventName: string, page?: Page): Promise<void> => {
  if (await pollTruthy(async () => hasCapturedAdvancedLog(eventName), 5000, [100, 250, 500])) {
    return;
  }

  if (
    page &&
    eventName === 'WXCC_SDK_TASK_CONSULT_START_SUCCESS' &&
    (await hasConsultStartEvidence(page))
  ) {
    return;
  }

  throw new Error(
    `No '${eventName}' logs found. Captured logs: ${JSON.stringify(capturedAdvancedLogs)}`
  );
};

export const verifyTransferSuccessLogs = (page?: Page): Promise<void> =>
  verifyCapturedAdvancedLog('WXCC_SDK_TASK_TRANSFER_SUCCESS', page);
export const verifyConsultStartSuccessLogs = (page?: Page): Promise<void> =>
  verifyCapturedAdvancedLog('WXCC_SDK_TASK_CONSULT_START_SUCCESS', page);
export const verifyConsultEndSuccessLogs = (page?: Page): Promise<void> =>
  verifyCapturedAdvancedLog('WXCC_SDK_TASK_CONSULT_END_SUCCESS', page);
export const verifyConsultTransferredLogs = (page?: Page): Promise<void> =>
  verifyCapturedAdvancedLog('AgentConsultTransferred', page);

export async function getConsultSnapshot(page: Page) {
  return page
    .evaluate(() => {
      const globalScope = globalThis as typeof globalThis & {
        currentTask?: any;
        getConsultStatus?: (task: any) => string;
      };
      const task = globalScope.currentTask;
      const interaction = task?.data?.interaction;

      return {
        exists: Boolean(task),
        relationshipType: interaction?.callProcessingDetails?.relationshipType ?? '',
        interactionState: String(interaction?.state ?? '').toLowerCase(),
        consultStatus:
          task && typeof globalScope.getConsultStatus === 'function'
            ? String(globalScope.getConsultStatus(task) ?? '').toLowerCase()
            : '',
      };
    })
    .catch(() => ({
      exists: false,
      relationshipType: '',
      interactionState: '',
      consultStatus: '',
    }));
}

export async function ensureConsultAccepted(
  primaryPage: Page,
  consultedPage: Page,
  timeout = ACCEPT_TASK_TIMEOUT
): Promise<void> {
  const isConsultAcceptedOnPage = async (page: Page, isPrimary: boolean): Promise<boolean> => {
    const currentTask = await getConsultSnapshot(page);
    const incomingText = (
      await page
        .locator('#incoming-task')
        .innerText()
        .catch(() => '')
    ).toLowerCase();
    const transferEnabled = await hasVisibleEnabledActionButton(page, 'Transfer', '#transfer');
    const acceptedStatus = isPrimary
      ? ['consultaccepted', 'connected', 'conference']
      : ['beingconsultedaccepted', 'consultaccepted', 'connected', 'conference'];
    const acceptedText = (
      isPrimary
        ? ['consultaccepted', 'beingconsultedaccepted', 'consult: consultaccepted']
        : ['connected', 'consulting', 'beingconsultedaccepted']
    ).some((text) => incomingText.includes(text));
    const pageControlAccepted = isPrimary
      ? (await hasVisibleEnabledActionButton(page, 'Merge', '#merge-conference')) ||
        (await hasVisibleEnabledActionButton(page, 'Consult Transfer', '#consult-transfer'))
      : (await hasVisibleEnabledActionButton(page, 'End', '#end')) ||
        (await hasVisibleEnabledActionButton(page, 'End Consult', '#end-consult'));

    return (
      acceptedText ||
      transferEnabled ||
      pageControlAccepted ||
      (currentTask.exists &&
        currentTask.relationshipType === 'consult' &&
        acceptedStatus.includes(currentTask.consultStatus))
    );
  };

  const isConsultAccepted = async (): Promise<boolean> => {
    if (await isConsultAcceptedOnPage(primaryPage, true)) {
      return true;
    }

    return isConsultAcceptedOnPage(consultedPage, false);
  };

  const acceptConsultOfferOnConsultedPage = async (): Promise<void> => {
    const directTaskAcceptWorked = await acceptCurrentTaskModel(consultedPage);

    if (directTaskAcceptWorked) {
      return;
    }

    const taskListAcceptButton = consultedPage.getByRole('button', {name: 'Accept'}).first();
    const taskListAcceptVisible = await taskListAcceptButton.isVisible().catch(() => false);
    if (taskListAcceptVisible) {
      await expect(taskListAcceptButton).toBeEnabled({timeout: 5000});
      await taskListAcceptButton.click({timeout: 5000}).catch(async () => {
        await taskListAcceptButton.click({force: true, timeout: 5000});
      });
    }

    const answerEnabled = await consultedPage
      .locator('#answer')
      .first()
      .isEnabled()
      .catch(() => false);
    if (answerEnabled) {
      await consultedPage.waitForTimeout(1000);
      await clickDomButton(consultedPage, '#answer');
    }
  };

  if (await pollTruthy(isConsultAccepted, 8000)) {
    return;
  }

  await acceptConsultOfferOnConsultedPage().catch(() => {});

  if (await pollTruthy(isConsultAccepted, 8000)) {
    return;
  }

  await acceptIncomingTask(consultedPage, TASK_TYPES.CALL, timeout).catch(() => {});
  await expect.poll(isConsultAccepted, {timeout: 25000, intervals: [1000, 2000]}).toBeTruthy();
}

const isControlEnabled = async (page: Page, selector: string): Promise<boolean> =>
  page
    .locator(selector)
    .evaluate((el) => !(el as HTMLButtonElement).disabled)
    .catch(() => false);

export const hasConnectedCall = async (page: Page): Promise<boolean> => {
  const currentTask = await getTaskReadinessSnapshot(page);
  const text = (
    await page
      .locator('#incoming-task')
      .innerText()
      .catch(() => '')
  ).toLowerCase();
  const consultInteractionActive =
    text.includes('state: consulting') ||
    text.includes('consultaccepted') ||
    text.includes('beingconsultedaccepted') ||
    text.includes('consulted');
  const connectedFromTaskModel =
    currentTask.hasTask &&
    currentTask.interactionId !== '' &&
    !currentTask.wrapUpRequired &&
    ['connected', 'consult', 'conference'].includes(currentTask.state);
  const consultEnabled = await hasVisibleEnabledActionButton(page, 'Consult', '#consult');
  const transferEnabled = await hasVisibleEnabledActionButton(page, 'Transfer', '#transfer');
  const endEnabled = await hasVisibleEnabledActionButton(page, 'End', '#end');
  const endConsultEnabled = await hasVisibleEnabledActionButton(
    page,
    'End Consult',
    '#end-consult'
  );
  const switchEnabled = await hasVisibleEnabledActionButton(page, 'Switch', '#switch-to-consult');
  const mergeEnabled = await hasVisibleEnabledActionButton(page, 'Merge', '#merge-conference');

  return (
    text.includes('connected') ||
    connectedFromTaskModel ||
    consultInteractionActive ||
    endEnabled ||
    (consultEnabled && transferEnabled) ||
    (consultInteractionActive && (endConsultEnabled || switchEnabled || mergeEnabled))
  );
};

const hasIncomingCallOffer = async (page: Page): Promise<boolean> => {
  const currentTask = await getTaskReadinessSnapshot(page);
  const text = (
    await page
      .locator('#incoming-task')
      .innerText()
      .catch(() => '')
  ).toLowerCase();
  const acceptButtons = page.getByRole('button', {name: 'Accept'});
  const taskListAcceptEnabled =
    (await acceptButtons.count().catch(() => 0)) > 0
      ? await acceptButtons
          .first()
          .isEnabled()
          .catch(() => false)
      : false;
  const taskModelOffer =
    currentTask.hasTask &&
    currentTask.interactionId !== '' &&
    !currentTask.wrapUpRequired &&
    ['new', 'alerting', 'ringing', 'offered'].includes(currentTask.state);

  return (
    text.includes('call from') ||
    text.includes('state: new') ||
    text.includes('ringing') ||
    (await isControlEnabled(page, '#answer')) ||
    taskListAcceptEnabled ||
    taskModelOffer
  );
};

const acceptCurrentCallOffer = async (page: Page): Promise<boolean> => {
  const directTaskAcceptWorked = await acceptCurrentTaskModel(page);

  if (directTaskAcceptWorked) {
    return true;
  }

  if (await isControlEnabled(page, '#answer')) {
    await clickDomButton(page, '#answer');

    return true;
  }

  const acceptButtons = page.getByRole('button', {name: 'Accept'});
  const acceptButtonCount = await acceptButtons.count().catch(() => 0);
  for (let i = 0; i < acceptButtonCount; i += 1) {
    const acceptButton = acceptButtons.nth(i);
    const visible = await acceptButton.isVisible().catch(() => false);
    const enabled = visible ? await acceptButton.isEnabled().catch(() => false) : false;

    if (enabled) {
      await acceptButton.click({force: true, timeout: 3000}).catch(() => {});

      return true;
    }
  }

  return false;
};

export async function ensureConnectedCall(
  page: Page,
  timeout = ACCEPT_TASK_TIMEOUT
): Promise<void> {
  await page.bringToFront();

  const getCallState = async (): Promise<'connected' | 'offer' | 'waiting'> => {
    if (await hasConnectedCall(page)) return 'connected';
    if (await hasIncomingCallOffer(page)) return 'offer';

    return 'waiting';
  };

  let initialState = await expect
    .poll(getCallState, {timeout: Math.max(timeout, 45000), intervals: [500, 1000, 2000]})
    .not.toBe('waiting')
    .then(() => getCallState())
    .catch(() => 'waiting' as const);

  if (initialState === 'waiting' && (await acceptCurrentCallOffer(page))) {
    initialState = await expect
      .poll(getCallState, {timeout: 20000, intervals: [500, 1000, 2000]})
      .not.toBe('waiting')
      .then(() => getCallState())
      .catch(() => 'waiting' as const);
  }

  if (initialState === 'waiting') {
    throw new Error('Incoming call offer never became actionable');
  }

  if (initialState === 'offer') {
    const connectedAfterDirectAccept = (await acceptCurrentCallOffer(page))
      ? await pollTruthy(() => hasConnectedCall(page), 15000)
      : false;

    if (!connectedAfterDirectAccept) {
      await acceptIncomingTask(page, TASK_TYPES.CALL, timeout).catch(() =>
        acceptCurrentCallOffer(page)
      );
    }
  }

  await expect
    .poll(() => hasConnectedCall(page), {timeout: 30000, intervals: [500, 1000, 2000]})
    .toBeTruthy();
}

export async function ensurePrimaryConsultReady(page: Page, timeout = 30000): Promise<void> {
  if (
    !(await page
      .bringToFront()
      .then(() => true)
      .catch(() => false))
  ) {
    throw new Error('Primary call page is unavailable while waiting for consult readiness');
  }

  await expect
    .poll(
      async () => {
        if (await isCallHeld(page).catch(() => false)) {
          await holdCallToggle(page).catch(() => {});
        }

        const consultEnabled = await hasVisibleEnabledActionButton(page, 'Consult', '#consult');
        const transferEnabled = await hasVisibleEnabledActionButton(page, 'Transfer', '#transfer');
        const endEnabled = await hasVisibleEnabledActionButton(page, 'End', '#end');
        const consultControlsVisible =
          (await hasVisibleEnabledActionButton(page, 'End Consult', '#end-consult')) ||
          (await hasVisibleEnabledActionButton(page, 'Switch', '#switch-to-consult')) ||
          (await hasVisibleEnabledActionButton(page, 'Merge', '#merge-conference'));

        return (
          (await hasConnectedCall(page)) &&
          consultEnabled &&
          (transferEnabled || endEnabled) &&
          !consultControlsVisible
        );
      },
      {timeout, intervals: [500, 1000, 2000]}
    )
    .toBeTruthy();
}

export async function consultOrTransfer(
  page: Page,
  type: 'agent' | 'queue' | 'dialNumber' | 'entryPoint',
  action: 'consult' | 'transfer',
  value: string
): Promise<void> {
  await page.bringToFront();

  const dismissStaleActionDialogs = async (): Promise<void> => {
    const consultDialog = page.locator('#initiate-consult-dialog');
    const transferDialog = page.locator('#transfer-options');
    const consultDialogVisible = await consultDialog.isVisible().catch(() => false);
    const transferDialogVisible = await transferDialog.isVisible().catch(() => false);

    if (!consultDialogVisible && !transferDialogVisible) {
      return;
    }

    await page.keyboard.press('Escape').catch(() => {});

    const cancelButton = page.getByRole('button', {name: 'Cancel'});
    const cancelVisible = await cancelButton.isVisible().catch(() => false);
    if (cancelVisible) {
      await cancelButton.click({timeout: 2000}).catch(() => {});
    }

    await consultDialog.waitFor({state: 'hidden', timeout: 3000}).catch(() => {});
    await transferDialog.waitFor({state: 'hidden', timeout: 3000}).catch(() => {});
  };

  const isActionButtonReady = (name: string, fallbackSelector?: string): Promise<boolean> =>
    hasVisibleEnabledActionButton(page, name, fallbackSelector);

  const clickActionButton = async (name: string, fallbackSelector?: string): Promise<void> => {
    const actionButton = await findVisibleEnabledActionButton(page, name, fallbackSelector);

    if (actionButton) {
      try {
        await actionButton.click({timeout: AWAIT_TIMEOUT});
      } catch (error) {
        if (
          String(error).includes('intercepts pointer events') ||
          (await page
            .locator('#initiate-consult-dialog')
            .isVisible()
            .catch(() => false)) ||
          (await page
            .locator('#transfer-options')
            .isVisible()
            .catch(() => false))
        ) {
          await dismissStaleActionDialogs();
          await actionButton.click({timeout: AWAIT_TIMEOUT});

          return;
        }

        throw error;
      }

      return;
    }

    if (fallbackSelector) {
      const taskSnapshot = await getTaskReadinessSnapshot(page);
      if (taskSnapshot.hasLiveTask && (await clickEnabledDomButton(page, fallbackSelector))) {
        return;
      }

      await clickFirstVisibleEnabledControl(page, fallbackSelector);

      return;
    }

    throw new Error(`No visible enabled '${name}' action button found`);
  };

  const resumeHeldCallIfPossible = async (timeout = AWAIT_TIMEOUT): Promise<boolean> => {
    const held = await isCallHeld(page).catch(() => false);
    if (!held) {
      return true;
    }

    const holdButton = page.locator('#hold-resume').first();
    const holdReady = await pollTruthy(
      () => holdButton.evaluate((el) => !(el as HTMLButtonElement).disabled).catch(() => false),
      timeout
    );

    if (!holdReady) {
      return false;
    }

    await holdCallToggle(page).catch(() => {});

    return expect
      .poll(() => isCallHeld(page).catch(() => false), {
        timeout,
        intervals: [500, 1000, 2000],
      })
      .toBeFalsy()
      .then(() => true)
      .catch(() => false);
  };

  await dismissStaleActionDialogs();

  const normalizeOptionText = (text: string): string =>
    text.replace(/\s+/g, ' ').trim().toLowerCase();

  const matchesTransferOption = (optionText: string, targetValue: string): boolean => {
    const normalizedOption = normalizeOptionText(optionText);
    const normalizedTarget = normalizeOptionText(targetValue);

    return (
      normalizedOption.length > 0 &&
      (normalizedOption.includes(normalizedTarget) || normalizedTarget.includes(normalizedOption))
    );
  };

  const pickMatchingTransferOption = (
    optionTexts: string[],
    targetValue: string,
    preferAvailable = false
  ): string | undefined => {
    const matches = optionTexts.filter((opt) => matchesTransferOption(opt, targetValue));

    if (matches.length === 0) {
      return undefined;
    }

    if (preferAvailable) {
      return matches.find((opt) => normalizeOptionText(opt).includes('available')) ?? matches[0];
    }

    return matches[0];
  };

  const pickConsultAgentOption = (
    optionTexts: string[],
    targetValue: string
  ): string | undefined => {
    const matches = optionTexts.filter((opt) => matchesTransferOption(opt, targetValue));

    if (matches.length === 0) {
      return undefined;
    }

    const normalizedMatches = matches.map((opt) => normalizeOptionText(opt));
    const includesAvailabilityState = normalizedMatches.some(
      (opt) =>
        opt.includes('available') ||
        opt.includes('idle') ||
        opt.includes('meeting') ||
        opt.includes('tea break') ||
        opt.includes('lunch break')
    );

    if (!includesAvailabilityState) {
      return matches[0];
    }

    return matches.find((opt) => normalizeOptionText(opt).includes('available'));
  };

  const getLastVisibleLocator = async (locator: Locator): Promise<Locator> => {
    const count = await locator.count().catch(() => 0);
    let fallback = locator.first();

    for (let i = count - 1; i >= 0; i -= 1) {
      const candidate = locator.nth(i);
      const isVisible = await candidate.isVisible().catch(() => false);
      fallback = candidate;
      if (isVisible) {
        return candidate;
      }
    }

    return fallback;
  };

  const findMatchingVisibleSelectOption = async (
    fields: Locator,
    targetValue: string,
    preferAvailable = false,
    matcher: (optionTexts: string[], candidateValue: string) => string | undefined = (
      optionTexts,
      candidateValue
    ) => pickMatchingTransferOption(optionTexts, candidateValue, preferAvailable)
  ): Promise<{field: Locator; option: string} | null> => {
    const fieldCount = await fields.count().catch(() => 0);

    for (let i = fieldCount - 1; i >= 0; i -= 1) {
      const field = fields.nth(i);
      const isVisible = await field.isVisible().catch(() => false);
      if (isVisible) {
        const optionTexts = await field
          .locator('option')
          .allTextContents()
          .catch(() => []);
        const matchingOption = matcher(optionTexts, targetValue);
        if (matchingOption) {
          return {field, option: matchingOption};
        }
      }
    }

    return null;
  };

  const getVisibleSelectOptionTexts = async (fields: Locator): Promise<string[]> => {
    const fieldCount = await fields.count().catch(() => 0);
    const optionTexts: string[] = [];

    for (let i = fieldCount - 1; i >= 0; i -= 1) {
      const field = fields.nth(i);
      const isVisible = await field.isVisible().catch(() => false);

      if (isVisible) {
        optionTexts.push(
          ...(await field
            .locator('option')
            .allTextContents()
            .catch(() => []))
        );
      }
    }

    return optionTexts;
  };

  const waitForMatchingTransferDestination = async (
    fields: Locator,
    targetValue: string,
    preferAvailable: boolean,
    refreshButton: Locator | null,
    timeout: number
  ): Promise<{field: Locator; option: string; optionTexts: string[]}> => {
    const deadline = Date.now() + timeout;
    let lastOptionTexts = await getVisibleSelectOptionTexts(fields);

    while (Date.now() < deadline) {
      const canRefresh = refreshButton
        ? (await refreshButton.isVisible().catch(() => false)) &&
          (await refreshButton.isEnabled().catch(() => false))
        : false;

      if (canRefresh) {
        await refreshButton.click({timeout: 5000}).catch(() => {});
        await page.waitForTimeout(500);
      }

      const matchingDestination = await findMatchingVisibleSelectOption(
        fields,
        targetValue,
        preferAvailable
      );

      if (matchingDestination) {
        const fallbackOptionTexts = lastOptionTexts;
        const optionTexts = await matchingDestination.field
          .locator('option')
          .allTextContents()
          .catch(() => fallbackOptionTexts);

        return {...matchingDestination, optionTexts};
      }

      lastOptionTexts = await getVisibleSelectOptionTexts(fields);
      await page.waitForTimeout(1500);
    }

    throw new Error(
      `Transfer destination '${targetValue}' not found. Available options: ${JSON.stringify(
        lastOptionTexts
      )}`
    );
  };

  const waitForRegularMainCallState = async (
    controlName: 'Consult' | 'Transfer',
    fallbackSelector: '#consult' | '#transfer',
    dialogSelector?: string
  ): Promise<void> => {
    await resumeHeldCallIfPossible(OPERATION_TIMEOUT);
    const blockingControlSelectors = [
      '#end-consult',
      '#consult-transfer',
      '#switch-to-main',
      '#switch-to-consult',
      '#merge-conference',
      '#exit-conference',
    ];

    let lastObservedState = '';

    const isReady = async (): Promise<boolean> => {
      const incomingText = (
        await page
          .locator('#incoming-task')
          .innerText()
          .catch(() => '')
      ).toLowerCase();
      const isStableConnectedPrimary =
        incomingText.includes('connected') &&
        (incomingText.includes('primary') || incomingText.includes('state: connected'));
      const dialogVisible = dialogSelector
        ? await page
            .locator(dialogSelector)
            .isVisible()
            .catch(() => false)
        : false;
      const hasBlockingControls = await hasAnyVisibleControlFromList(
        page,
        blockingControlSelectors
      );
      const controlReady = await isActionButtonReady(controlName, fallbackSelector);
      const taskSnapshot = await getTaskReadinessSnapshot(page);
      const taskModelOnMainCall =
        taskSnapshot.hasLiveTask &&
        !taskSnapshot.hasConsultLegControls &&
        (taskSnapshot.state === 'connected' ||
          taskSnapshot.state === 'consult' ||
          taskSnapshot.state === 'conference' ||
          taskSnapshot.activeLeg === 'main');

      lastObservedState = JSON.stringify({
        incomingText,
        isStableConnectedPrimary,
        dialogVisible,
        hasBlockingControls,
        controlReady,
        taskSnapshot,
      });

      return (
        !hasBlockingControls &&
        (controlReady || dialogVisible || isStableConnectedPrimary || taskModelOnMainCall)
      );
    };

    const becameReady = await pollTruthy(isReady, OPERATION_TIMEOUT);

    if (!becameReady) {
      throw new Error(
        `${controlName} controls never reached a stable main-call state. Last observed state: ${lastObservedState}`
      );
    }
  };

  if (action === 'consult') {
    await waitForRegularMainCallState('Consult', '#consult');

    let isConsultEnabled = await isActionButtonReady('Consult', '#consult');

    if (!isConsultEnabled) {
      await resumeHeldCallIfPossible(OPERATION_TIMEOUT);

      await expect
        .poll(() => isActionButtonReady('Consult', '#consult'), {
          timeout: OPERATION_TIMEOUT,
          intervals: [500, 1000, 2000],
        })
        .toBeTruthy();

      isConsultEnabled = await isActionButtonReady('Consult', '#consult');
      if (!isConsultEnabled) {
        throw new Error('Consult action never became enabled');
      }
    }

    await clickActionButton('Consult', '#consult');

    await page.locator('#consult-destination-type').waitFor({state: 'visible', timeout: 10000});

    const typeMap = {
      agent: 'agent',
      queue: 'queue',
      dialNumber: 'dialNumber',
      entryPoint: 'entryPoint',
    };
    await page.locator('#consult-destination-type').selectOption(typeMap[type]);
    await page.waitForTimeout(1000);

    const destFieldId = '#consultDestination';
    const allDestFields = page.locator(destFieldId);

    let destField = await getLastVisibleLocator(allDestFields);

    await destField.waitFor({state: 'attached', timeout: 10000});
    const tagName = await destField.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === 'select') {
      const refreshButton =
        type === 'agent'
          ? await getLastVisibleLocator(page.locator('#refresh-buddy-agents-for-consult'))
          : null;
      const canRefresh = refreshButton ? await refreshButton.isVisible().catch(() => false) : false;

      await destField
        .locator('option:not([value=""])')
        .first()
        .waitFor({state: 'attached', timeout: 10000});

      const getMatchingDestination = async (): Promise<{field: Locator; option: string} | null> => {
        return findMatchingVisibleSelectOption(
          allDestFields,
          value,
          false,
          (optionTexts, targetValue) =>
            type === 'agent'
              ? pickConsultAgentOption(optionTexts, targetValue)
              : pickMatchingTransferOption(optionTexts, targetValue)
        );
      };

      let matchingDestination: {field: Locator; option: string} | null = null;
      const refreshAttempts = type === 'agent' && canRefresh ? 3 : 1;

      for (let attempt = 0; attempt < refreshAttempts && !matchingDestination; attempt += 1) {
        if (attempt > 0 && refreshButton) {
          await refreshButton.click({timeout: 5000});
          await page.waitForTimeout(1000);
        } else if (attempt === 0 && refreshButton) {
          await refreshButton.click({timeout: 5000});
        }

        matchingDestination = await expect
          .poll(async () => (await getMatchingDestination())?.option ?? '', {
            timeout: type === 'agent' ? 12000 : 15000,
            intervals: [500, 1000, 2000],
          })
          .not.toBe('')
          .then(() => getMatchingDestination())
          .catch(async () => null);
      }

      if (matchingDestination) {
        destField = matchingDestination.field;
      }

      const optionTexts = await destField.locator('option').allTextContents();

      if (!matchingDestination) {
        throw new Error(
          `Consult destination '${value}' not found or not available. Available options: ${JSON.stringify(
            optionTexts
          )}`
        );
      }

      await destField.selectOption({label: matchingDestination.option});
    } else {
      await destField.fill(value);
    }
    await page.waitForTimeout(300);

    await page.locator('#initate-consult').click();
    await page.waitForTimeout(2000);
  } else {
    const initialTransferSuccessLogCount = capturedAdvancedLogs.filter((log) =>
      log.includes('WXCC_SDK_TASK_TRANSFER_SUCCESS')
    ).length;

    await waitForRegularMainCallState('Transfer', '#transfer', '#transfer-options');

    await clickActionButton('Transfer', '#transfer');

    const transferTypeDropdown = page.locator('#transfer-destination-type');
    const transferDialogVisible = await pollTruthy(
      () => transferTypeDropdown.isVisible().catch(() => false),
      5000,
      [250, 500, 1000]
    );

    if (!transferDialogVisible) {
      await waitForRegularMainCallState('Transfer', '#transfer', '#transfer-options');
      await clickActionButton('Transfer', '#transfer');
      await transferTypeDropdown.waitFor({state: 'visible', timeout: 10000});
    }
    const typeMap = {
      agent: 'agent',
      queue: 'queue',
      dialNumber: 'dialNumber',
      entryPoint: 'entryPoint',
    };
    await transferTypeDropdown.selectOption(typeMap[type]);
    await page.waitForTimeout(1000);

    const allDestFields = page.locator('#transfer-destination');

    let destField = await getLastVisibleLocator(allDestFields);
    let selectedDestinationText = value;

    const syncTransferDestinationInput = async (
      field: Locator,
      targetTextOrValue: string
    ): Promise<void> => {
      const selectedValue = await field
        .evaluate((el, target) => {
          const normalize = (text?: string | null): string =>
            (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
          const fieldEl = el as HTMLInputElement | HTMLSelectElement;

          if (fieldEl instanceof HTMLSelectElement) {
            const normalizedTarget = normalize(target);
            const matchingOption = Array.from(fieldEl.options).find((option) => {
              const optionText = normalize(option.textContent);
              const optionLabel = normalize(option.label);
              const optionValue = normalize(option.value);

              return (
                optionText === normalizedTarget ||
                optionLabel === normalizedTarget ||
                optionValue === normalizedTarget ||
                optionText.includes(normalizedTarget) ||
                normalizedTarget.includes(optionText)
              );
            });

            if (matchingOption) {
              fieldEl.value = matchingOption.value;
            }
          } else {
            fieldEl.value = target;
          }

          fieldEl.dispatchEvent(new Event('input', {bubbles: true}));
          fieldEl.dispatchEvent(new Event('change', {bubbles: true}));

          return fieldEl.value;
        }, targetTextOrValue)
        .catch(() => '');

      await page
        .evaluate(
          ({targetTextOrValue: target, selectedValue: selected}) => {
            const normalize = (text?: string | null): string =>
              (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
            const normalizedTarget = normalize(target);
            const normalizedSelected = normalize(selected);
            const fields = Array.from(document.querySelectorAll('#transfer-destination')) as Array<
              HTMLInputElement | HTMLSelectElement
            >;
            let matchedField: HTMLInputElement | HTMLSelectElement | null = null;

            fields.forEach((candidateField) => {
              if (candidateField instanceof HTMLSelectElement) {
                const matchingOption = Array.from(candidateField.options).find((option) => {
                  const optionText = normalize(option.textContent);
                  const optionLabel = normalize(option.label);
                  const optionValue = normalize(option.value);

                  return (
                    optionValue === normalizedSelected ||
                    optionText === normalizedTarget ||
                    optionLabel === normalizedTarget ||
                    optionValue === normalizedTarget ||
                    optionText.includes(normalizedTarget) ||
                    normalizedTarget.includes(optionText)
                  );
                });

                if (!matchingOption) {
                  return;
                }

                candidateField.value = matchingOption.value;
              } else {
                candidateField.value = selected || target;
              }

              candidateField.dispatchEvent(new Event('input', {bubbles: true}));
              candidateField.dispatchEvent(new Event('change', {bubbles: true}));
              matchedField = candidateField;
            });

            if (matchedField) {
              try {
                // eslint-disable-next-line no-new-func
                new Function('field', 'transferDestinationInput = field; return true;')(
                  matchedField
                );
              } catch {
                matchedField = null;
              }
            }
          },
          {targetTextOrValue, selectedValue}
        )
        .catch(() => {});
    };

    await destField.waitFor({state: 'attached', timeout: 10000});
    const tagName = await destField.evaluate((el) => el.tagName.toLowerCase());
    if (tagName === 'select') {
      const refreshButton =
        type === 'queue' || type === 'agent'
          ? await getLastVisibleLocator(
              page.locator(
                type === 'queue'
                  ? '#refresh-queue-list-for-transfer'
                  : '#refresh-buddy-agents-for-transfer'
              )
            )
          : null;
      const canRefresh = refreshButton ? await refreshButton.isVisible().catch(() => false) : false;

      await destField
        .locator('option:not([value=""])')
        .first()
        .waitFor({state: 'attached', timeout: 10000});

      if (type === 'agent' && canRefresh) {
        await refreshButton.click({timeout: 5000}).catch(() => {});
        await page.waitForTimeout(300);
      }

      const matchingDestination = await findMatchingVisibleSelectOption(
        allDestFields,
        value,
        type === 'agent'
      );
      let optionTexts = await destField.locator('option').allTextContents();
      let matchingOption = matchingDestination?.option;

      if (matchingDestination) {
        destField = matchingDestination.field;
        optionTexts = await destField.locator('option').allTextContents();
      }

      if (!matchingOption && (type === 'queue' || type === 'agent')) {
        const refreshedDestination = await waitForMatchingTransferDestination(
          allDestFields,
          value,
          type === 'agent',
          refreshButton,
          type === 'agent' ? 90000 : 45000
        );

        destField = refreshedDestination.field;
        matchingOption = refreshedDestination.option;
        optionTexts = refreshedDestination.optionTexts;
      }

      if (!matchingOption) {
        await expect
          .poll(
            async () => {
              const polledOptions = await destField.locator('option').allTextContents();
              const polledMatch = pickMatchingTransferOption(
                polledOptions,
                value,
                type === 'agent'
              );

              return polledMatch ?? '';
            },
            {timeout: 10000, intervals: [500, 1000, 2000]}
          )
          .not.toBe('');

        optionTexts = await destField.locator('option').allTextContents();
        matchingOption = pickMatchingTransferOption(optionTexts, value, type === 'agent');
      }

      if (!matchingOption) {
        throw new Error(
          `Transfer destination '${value}' not found. Available options: ${JSON.stringify(
            optionTexts
          )}`
        );
      }

      await destField.selectOption({label: matchingOption});
      selectedDestinationText = matchingOption;
      await syncTransferDestinationInput(destField, selectedDestinationText);
    } else {
      await destField.fill(value);
      await syncTransferDestinationInput(destField, value);
    }
    await page.waitForTimeout(300);

    const visibleInitiateTransfer = page.getByRole('button', {name: /initiate transfer/i}).first();
    const canUseVisibleAction = await visibleInitiateTransfer.isVisible().catch(() => false);
    if (canUseVisibleAction) {
      await expect(visibleInitiateTransfer).toBeEnabled({timeout: AWAIT_TIMEOUT});
      await visibleInitiateTransfer.click({timeout: AWAIT_TIMEOUT});
    } else {
      await page.locator('#initiate-transfer').click();
    }

    let lastTransferObservedState = '';

    const hasTransferSettled = async (): Promise<boolean> => {
      const transferSuccessLogCount = capturedAdvancedLogs.filter((log) =>
        log.includes('WXCC_SDK_TASK_TRANSFER_SUCCESS')
      ).length;
      const hasFreshTransferSuccess = transferSuccessLogCount > initialTransferSuccessLogCount;
      const transferOptions = page.locator('#transfer-options');
      const dialogVisible = await transferOptions.isVisible().catch(() => false);
      const wrapupEnabled = await page
        .locator('#wrapupCodesDropdown')
        .evaluate((el) => !(el as HTMLSelectElement).disabled)
        .catch(() => false);
      const incomingText = (
        await page
          .locator('#incoming-task')
          .innerText()
          .catch(() => '')
      ).toLowerCase();
      const incomingTaskCleared =
        incomingText.trim() === '' || incomingText.includes('no incoming tasks');
      const endButton = page.locator('#end');
      const consultButton = page.locator('#consult');
      const transferButton = page.locator('#transfer');
      const endVisible = await endButton.isVisible().catch(() => false);
      const consultVisible = await consultButton.isVisible().catch(() => false);
      const transferVisible = await transferButton.isVisible().catch(() => false);
      const endEnabled = endVisible
        ? await endButton.evaluate((el) => !(el as HTMLButtonElement).disabled).catch(() => false)
        : false;
      const consultEnabled = consultVisible
        ? await consultButton
            .evaluate((el) => !(el as HTMLButtonElement).disabled)
            .catch(() => false)
        : false;
      const transferEnabled = transferVisible
        ? await transferButton
            .evaluate((el) => !(el as HTMLButtonElement).disabled)
            .catch(() => false)
        : false;
      const taskListText = (
        await page
          .locator('#taskList')
          .innerText()
          .catch(() => '')
      ).toLowerCase();
      const taskListCleared = taskListText.includes('no tasks available') || taskListText === '';
      const sourceControlsGone =
        !endVisible &&
        !consultVisible &&
        !transferVisible &&
        !endEnabled &&
        !consultEnabled &&
        !transferEnabled;
      const connectedPrimaryNoControls =
        incomingText.includes('connected') &&
        (incomingText.includes('primary') || incomingText.includes('state: connected')) &&
        sourceControlsGone;
      const sourceCallNoLongerActionable =
        incomingTaskCleared && !endEnabled && !consultEnabled && !transferEnabled;
      const sourceLegCleared = incomingTaskCleared && sourceControlsGone;
      const sourceTaskFullyGone = incomingTaskCleared && taskListCleared;
      const transferLoggedAndDialogClosed = hasFreshTransferSuccess && !dialogVisible;
      const sourceLooksTransferred =
        sourceTaskFullyGone ||
        sourceLegCleared ||
        sourceCallNoLongerActionable ||
        connectedPrimaryNoControls;
      const wrapupAfterSubmittedTransfer =
        wrapupEnabled && (!dialogVisible || hasFreshTransferSuccess);
      const sourceTransitionedToWrapup = wrapupEnabled && sourceLooksTransferred;
      const settled =
        wrapupAfterSubmittedTransfer ||
        sourceTransitionedToWrapup ||
        transferLoggedAndDialogClosed ||
        (sourceLooksTransferred && sourceControlsGone) ||
        (hasFreshTransferSuccess && sourceLooksTransferred) ||
        (!dialogVisible && sourceLooksTransferred);

      lastTransferObservedState = JSON.stringify({
        hasFreshTransferSuccess,
        dialogVisible,
        transferLoggedAndDialogClosed,
        wrapupEnabled,
        incomingText,
        taskListText,
        endVisible,
        consultVisible,
        transferVisible,
        endEnabled,
        consultEnabled,
        transferEnabled,
        sourceTaskFullyGone,
        sourceLegCleared,
        sourceCallNoLongerActionable,
        connectedPrimaryNoControls,
        sourceLooksTransferred,
        wrapupAfterSubmittedTransfer,
        sourceTransitionedToWrapup,
      });

      return settled;
    };

    const settledQuickly = await pollTruthy(hasTransferSettled, 10000);

    if (!settledQuickly) {
      const dialogVisible = await page
        .locator('#transfer-options')
        .isVisible()
        .catch(() => false);
      const incomingText = (
        await page
          .locator('#incoming-task')
          .innerText()
          .catch(() => '')
      ).toLowerCase();
      const endButton = page.locator('#end');
      const endVisible = await endButton.isVisible().catch(() => false);
      const endEnabled = endVisible
        ? await endButton.evaluate((el) => !(el as HTMLButtonElement).disabled).catch(() => false)
        : false;
      const sourceLegStillActive = incomingText.includes('connected') || (endVisible && endEnabled);

      if (dialogVisible && sourceLegStillActive) {
        if (type === 'agent' && tagName === 'select') {
          const refreshButton = page.locator('#refresh-buddy-agents-for-transfer');
          const refreshedDestination = await waitForMatchingTransferDestination(
            allDestFields,
            value,
            true,
            refreshButton,
            30000
          ).catch(() => null);

          if (refreshedDestination) {
            destField = refreshedDestination.field;
            await destField.selectOption({label: refreshedDestination.option}).catch(() => {});
            selectedDestinationText = refreshedDestination.option;
            await syncTransferDestinationInput(destField, selectedDestinationText);
          }
        }

        await syncTransferDestinationInput(destField, selectedDestinationText);
        await clickDomButton(page, '#initiate-transfer');
      }
    }

    const transferSettled = await pollTruthy(hasTransferSettled, OPERATION_TIMEOUT);

    const transferOptions = page.locator('#transfer-options');
    const isStillVisible = await transferOptions.isVisible().catch(() => false);
    if (transferSettled && isStillVisible) {
      await page.keyboard.press('Escape').catch(() => {});
      await page.mouse.click(5, 5).catch(() => {});
      await transferOptions.waitFor({state: 'hidden', timeout: 5000}).catch(() => {});
    }

    if (!transferSettled) {
      throw new Error(
        `Transfer submission did not settle on the source page. Last observed state: ${lastTransferObservedState}`
      );
    }

    await page.waitForTimeout(1000);
  }
}

export async function waitForPrimaryCallAfterConsult(
  page: Page
): Promise<'active' | 'held' | 'wrapup'> {
  const getPrimaryCallState = async (): Promise<'active' | 'held' | 'wrapup' | 'waiting'> => {
    const incomingTask = page.locator('#incoming-task');

    const incomingText = (await incomingTask.innerText().catch(() => '')).toLowerCase();
    const held = await isCallHeld(page).catch(() => false);
    const taskSnapshot = await getTaskReadinessSnapshot(page);
    const wrapupEnabled = await page
      .locator('#wrapupCodesDropdown')
      .isEnabled()
      .catch(() => false);

    if (
      wrapupEnabled ||
      taskSnapshot.wrapupReady ||
      taskSnapshot.wrapUpRequired ||
      ['wrapup', 'wrap_up', 'post_call', 'terminated', 'ended'].includes(taskSnapshot.state) ||
      incomingText.includes('post_call') ||
      incomingText.includes('wrapup')
    ) {
      return 'wrapup';
    }

    if (held) {
      return 'held';
    }

    const [consultReady, transferReady, endReady, holdReady, resumeReady, connectedByUi] =
      await Promise.all([
        hasVisibleEnabledActionButton(page, 'Consult', '#consult'),
        hasVisibleEnabledActionButton(page, 'Transfer', '#transfer'),
        hasVisibleEnabledActionButton(page, 'End', '#end'),
        hasVisibleEnabledActionButton(page, 'Hold', '#hold-resume'),
        hasVisibleEnabledActionButton(page, 'Resume', '#hold-resume'),
        hasConnectedCall(page).catch(() => false),
      ]);
    const connectedByTaskModel =
      taskSnapshot.hasLiveTask &&
      !['consulted', 'consultingagent', 'consultedagent'].includes(taskSnapshot.relationshipType) &&
      ['connected', 'consult', 'conference'].includes(taskSnapshot.state);
    const primaryActionReady =
      consultReady ||
      transferReady ||
      endReady ||
      holdReady ||
      resumeReady ||
      taskSnapshot.mainControlReady ||
      taskSnapshot.endReady ||
      taskSnapshot.transferReady ||
      taskSnapshot.consultReady;
    const primaryCallVisible =
      incomingText.includes('connected') || connectedByUi || connectedByTaskModel;

    if (primaryCallVisible && primaryActionReady) {
      return 'active';
    }

    return 'waiting';
  };

  const consultControlsGone = async () => {
    const endConsultBtn = page.locator('#end-consult');
    const isVisible = await endConsultBtn.isVisible().catch(() => false);

    return !isVisible;
  };

  const consultControlsCleared = await pollTruthy(consultControlsGone, 3000, [200, 500, 1000]);

  if (!consultControlsCleared) {
    await cancelConsult(page).catch(() => {});
  }

  let primaryCallReady = await expect
    .poll(getPrimaryCallState, {timeout: 30000, intervals: [500, 1000, 2000]})
    .not.toBe('waiting')
    .then(() => true)
    .catch(() => false);

  if (!primaryCallReady) {
    await cancelConsult(page).catch(() => {});
    primaryCallReady = await expect
      .poll(getPrimaryCallState, {timeout: 30000, intervals: [500, 1000, 2000]})
      .not.toBe('waiting')
      .then(() => true)
      .catch(() => false);
  }

  if (!primaryCallReady) {
    throw new Error('Primary call did not become actionable after consult ended');
  }

  const finalState = await getPrimaryCallState();
  if (finalState === 'wrapup') {
    return 'wrapup';
  }

  const finalHeld = await isCallHeld(page).catch(() => false);

  return finalHeld ? 'held' : 'active';
}

export async function waitForConsultingAgentIdReady(page: Page, timeout = 15000): Promise<void> {
  const endConsultBtn = page.locator('#end-consult').first();
  await endConsultBtn.waitFor({state: 'attached', timeout});

  await expect
    .poll(
      async () => {
        const endConsultEnabled = await endConsultBtn
          .evaluate((el) => !(el as HTMLButtonElement).disabled)
          .catch(() => false);
        const consultTransferEnabled = await page
          .locator('#consult-transfer')
          .first()
          .evaluate((el) => !(el as HTMLButtonElement).disabled)
          .catch(() => false);
        const transferEnabled = await page
          .locator('#transfer')
          .first()
          .evaluate((el) => !(el as HTMLButtonElement).disabled)
          .catch(() => false);

        return endConsultEnabled || consultTransferEnabled || transferEnabled;
      },
      {timeout, intervals: [500, 1000, 2000]}
    )
    .toBeTruthy();

  await page.waitForTimeout(2000);
}

export async function cancelConsult(page: Page): Promise<void> {
  await page.bringToFront();
  const endConsultBtn = page.locator('#end-consult').first();
  const endBtn = page.locator('#end').first();
  const visibleEndConsultBtn = page.getByRole('button', {name: /end consult/i}).first();
  const visibleEndBtn = page.getByRole('button', {name: /^end$/i}).first();
  const switchBtn = page.getByRole('button', {name: /^switch$/i}).first();

  const hasSecondaryConsultCall = async (): Promise<boolean> => {
    return page
      .evaluate(() => {
        const task = currentTask;
        const interaction = task?.data?.interaction;
        const participants = interaction?.participants || {};
        const participant = Object.values(participants).find(
          (p) => p?.pType === 'Agent' && p?.id === agentId
        );

        return Boolean(
          task &&
            interaction &&
            interaction.callProcessingDetails?.relationshipType === 'consult' &&
            ((participant && participant.isConsulted) ||
              (interaction.callProcessingDetails?.parentInteractionId &&
                interaction.callProcessingDetails?.parentInteractionId !==
                  interaction.interactionId))
        );
      })
      .catch(() => false);
  };

  const hasConsultTaskModel = async (): Promise<boolean> => {
    return page
      .evaluate(() => {
        const task = currentTask;
        const interaction = task?.data?.interaction;
        const relationshipType = interaction?.callProcessingDetails?.relationshipType;
        const interactionState = String(interaction?.state || '').toLowerCase();

        return Boolean(
          task &&
            relationshipType === 'consult' &&
            interactionState !== 'wrapup' &&
            interactionState !== 'post_call' &&
            interactionState !== 'terminated'
        );
      })
      .catch(() => false);
  };

  const hasActiveConsultInteraction = async (): Promise<boolean> => {
    const incomingText = (
      (await page
        .locator('#incoming-task')
        .textContent()
        .catch(() => '')) || ''
    ).toLowerCase();
    const incomingShowsConsult = /state:\s*consult/.test(incomingText);

    const consultCard = page
      .locator('#taskControlsCards')
      .locator('text=/Consult Interaction/i')
      .first();
    const hasConsultCard = (await consultCard.count().catch(() => 0)) > 0;
    const consultCardsText = (
      await page
        .locator('#taskControlsCards')
        .innerText()
        .catch(() => '')
    ).toLowerCase();
    const hasActiveConsultCard =
      hasConsultCard &&
      /consult interaction[\s\S]*(\bactive\b|state:\s*(consulting|connected|conference))/.test(
        consultCardsText
      );

    const visibleEndConsult = await visibleEndConsultBtn.isVisible().catch(() => false);
    const hiddenEndConsultEnabled = await endConsultBtn
      .evaluate((el) => !(el as HTMLButtonElement).disabled)
      .catch(() => false);
    const secondaryConsultCall = await hasSecondaryConsultCall();
    const visibleEnd = await visibleEndBtn.isVisible().catch(() => false);
    const visibleEndEnabled = visibleEnd && (await visibleEndBtn.isEnabled().catch(() => false));

    return (
      incomingShowsConsult ||
      hasActiveConsultCard ||
      visibleEndConsult ||
      hiddenEndConsultEnabled ||
      (secondaryConsultCall && visibleEndEnabled)
    );
  };

  const hasPrimaryCallResumed = async (): Promise<boolean> => {
    const incomingText = (
      (await page
        .locator('#incoming-task')
        .textContent()
        .catch(() => '')) || ''
    ).toLowerCase();
    const incomingShowsConsult = /state:\s*consult/.test(incomingText);
    const visibleConsultControls =
      (await visibleEndConsultBtn.isVisible().catch(() => false)) ||
      (await switchBtn.isVisible().catch(() => false)) ||
      (await page
        .locator('#merge-conference')
        .first()
        .isVisible()
        .catch(() => false)) ||
      (await page
        .locator('#consult-transfer')
        .first()
        .isVisible()
        .catch(() => false));
    const consultEnabled = await page
      .locator('#consult')
      .first()
      .evaluate((el) => !(el as HTMLButtonElement).disabled)
      .catch(() => false);
    const transferEnabled = await page
      .locator('#transfer')
      .first()
      .evaluate((el) => !(el as HTMLButtonElement).disabled)
      .catch(() => false);
    const endEnabled = await page
      .locator('#end')
      .first()
      .evaluate((el) => !(el as HTMLButtonElement).disabled)
      .catch(() => false);
    const mainCallText =
      incomingText.includes('connected') ||
      incomingText.includes('state: connected') ||
      incomingText.includes('primary');

    return (
      !incomingShowsConsult &&
      !visibleConsultControls &&
      (mainCallText || endEnabled) &&
      consultEnabled &&
      transferEnabled
    );
  };

  const waitForConsultToClear = (timeout = 10000): Promise<boolean> =>
    pollTruthy(async () => {
      if (await hasPrimaryCallResumed()) {
        return true;
      }

      const consultStillActive =
        (await hasActiveConsultInteraction()) ||
        (await hasConsultTaskModel()) ||
        (await hasSecondaryConsultCall());

      return !consultStillActive;
    }, timeout);

  const clickVisibleEndConsult = (): Promise<boolean> =>
    clickVisibleTextButton(page, 'end consult');
  const clickVisibleEnd = (): Promise<boolean> => clickVisibleTextButton(page, 'end');

  const invokeDirectConsultEndAction = async (): Promise<boolean> => {
    return page
      .evaluate(async () => {
        try {
          const task = currentTask;
          const interaction = task?.data?.interaction;
          const participants = interaction?.participants || {};
          const participant = Object.values(participants).find(
            (p) => p?.pType === 'Agent' && p?.id === agentId
          );
          const isSecondaryConsult =
            interaction?.callProcessingDetails?.relationshipType === 'consult' &&
            ((participant && participant.isConsulted) ||
              (interaction?.callProcessingDetails?.parentInteractionId &&
                interaction.callProcessingDetails.parentInteractionId !==
                  interaction.interactionId));

          if (isSecondaryConsult) {
            if (typeof endCall === 'function') {
              const result = endCall();
              if (result && typeof result.then === 'function') {
                await result;
              }

              return true;
            }

            if (task?.end) {
              await task.end();

              return true;
            }
          }

          if (typeof endConsult === 'function') {
            const result = endConsult();
            if (result && typeof result.then === 'function') {
              await result;
            }

            return true;
          }

          if (task?.endConsult) {
            await task.endConsult({isConsult: true, taskId: task.data?.interactionId});

            return true;
          }
        } catch {
          return false;
        }

        return false;
      })
      .catch(() => false);
  };

  const consultBecameActive = await pollTruthy(
    async () => hasActiveConsultInteraction() || hasConsultTaskModel(),
    15000
  );

  if (!consultBecameActive) {
    return;
  }

  if (await hasSecondaryConsultCall()) {
    if (await clickVisibleEnd()) {
      if (!page.isClosed()) await page.waitForTimeout(300);
      if (await waitForConsultToClear()) {
        return;
      }
    }

    const hiddenEndEnabled = await endBtn
      .evaluate((el) => !(el as HTMLButtonElement).disabled)
      .catch(() => false);
    if (hiddenEndEnabled) {
      await clickDomButton(page, '#end');
      if (!page.isClosed()) await page.waitForTimeout(300);
      if (await waitForConsultToClear()) {
        return;
      }
    }

    if (await invokeDirectConsultEndAction()) {
      if (!page.isClosed()) await page.waitForTimeout(500);
      if (await waitForConsultToClear()) {
        return;
      }
    }
  }

  if (await clickVisibleEndConsult()) {
    if (!page.isClosed()) await page.waitForTimeout(300);
    if (await waitForConsultToClear()) {
      return;
    }
  }

  if ((await hasConsultTaskModel()) && (await invokeDirectConsultEndAction())) {
    if (!page.isClosed()) await page.waitForTimeout(500);
    if (await waitForConsultToClear()) {
      return;
    }
  }

  if (await hasSecondaryConsultCall()) {
    if (await clickVisibleEnd()) {
      if (!page.isClosed()) await page.waitForTimeout(300);
      if (await waitForConsultToClear()) {
        return;
      }
    }

    const hiddenEndEnabled = await endBtn
      .evaluate((el) => !(el as HTMLButtonElement).disabled)
      .catch(() => false);
    if (hiddenEndEnabled) {
      await clickDomButton(page, '#end');
      if (!page.isClosed()) await page.waitForTimeout(300);
      if (await waitForConsultToClear()) {
        return;
      }
    }
  }

  if (await invokeDirectConsultEndAction()) {
    if (!page.isClosed()) await page.waitForTimeout(500);
    if (await waitForConsultToClear()) {
      return;
    }
  }

  const canSwitch =
    (await switchBtn.isVisible().catch(() => false)) &&
    (await switchBtn.isEnabled().catch(() => false));
  if (canSwitch) {
    await clickVisibleTextButton(page, 'switch');
    if (!page.isClosed()) await page.waitForTimeout(300);
    if (await clickVisibleEndConsult()) {
      if (!page.isClosed()) await page.waitForTimeout(300);
      if (await waitForConsultToClear()) {
        return;
      }
    }
  }

  if (!(await hasActiveConsultInteraction())) {
    return;
  }
  const hiddenEnabled = await endConsultBtn
    .evaluate((el) => !(el as HTMLButtonElement).disabled)
    .catch(() => false);
  if (hiddenEnabled) {
    await page.evaluate(() => {
      const btn = document.querySelector('#end-consult') as HTMLButtonElement | null;
      if (!btn) return;
      if (btn.onclick) {
        btn.onclick(new MouseEvent('click'));
      } else {
        btn.click();
      }
    });
  }
  if (!(await page.isClosed()) && (await invokeDirectConsultEndAction())) {
    await page.waitForTimeout(500);
  }
  if (!page.isClosed()) await page.waitForTimeout(300);

  const consultCleared = await waitForConsultToClear(15000);
  if (!consultCleared) {
    throw new Error('Consult interaction did not clear after end attempt');
  }
}

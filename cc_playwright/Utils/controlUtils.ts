/* eslint-disable no-await-in-loop, no-plusplus, no-continue */
import {expect, Locator, Page} from '@playwright/test';
import {AWAIT_TIMEOUT} from '../constants';

export async function getTaskReadinessSnapshot(page: Page) {
  return page
    .evaluate(() => {
      const task = (globalThis as typeof globalThis & {currentTask?: any}).currentTask;
      const uiControls = task?.uiControls;
      const activeLeg = uiControls?.activeLeg || 'main';
      let activeControls = uiControls || {};
      if (uiControls?.main) {
        activeControls = activeLeg === 'consult' ? uiControls.consult || {} : uiControls.main;
      }
      const mainControls = uiControls?.main || activeControls || {};
      const consultControls = uiControls?.consult || {};
      const interaction = task?.data?.interaction;
      const state = String(interaction?.state || '').toLowerCase();
      const relationshipType = String(
        interaction?.callProcessingDetails?.relationshipType || ''
      ).toLowerCase();
      const terminalStates = ['wrapup', 'wrap_up', 'post_call', 'terminated', 'ended'];
      const interactionId = task?.data?.interactionId ?? '';
      const wrapUpRequired = Boolean(task?.data?.wrapUpRequired);
      const hasLiveTask = Boolean(
        interactionId && !wrapUpRequired && !terminalStates.includes(state)
      );

      return {
        hasTask: Boolean(task),
        interactionId,
        hasLiveTask,
        state,
        relationshipType,
        wrapUpRequired,
        activeLeg,
        hasConsultLegControls: Object.values(consultControls).some(
          (control: any) => control?.isVisible
        ),
        mainControlReady: Boolean(
          mainControls.consult?.isEnabled ||
            mainControls.transfer?.isEnabled ||
            mainControls.end?.isEnabled ||
            mainControls.hold?.isEnabled
        ),
        consultReady: Boolean(activeControls.consult?.isEnabled || mainControls.consult?.isEnabled),
        transferReady: Boolean(
          activeControls.transfer?.isEnabled ||
            activeControls.consultTransfer?.isEnabled ||
            mainControls.transfer?.isEnabled ||
            mainControls.consultTransfer?.isEnabled
        ),
        endReady: Boolean(activeControls.end?.isEnabled || mainControls.end?.isEnabled),
        wrapupReady: Boolean(activeControls.wrapup?.isEnabled || mainControls.wrapup?.isEnabled),
      };
    })
    .catch(() => ({
      hasTask: false,
      interactionId: '',
      hasLiveTask: false,
      state: '',
      relationshipType: '',
      wrapUpRequired: false,
      activeLeg: 'main',
      hasConsultLegControls: false,
      mainControlReady: false,
      consultReady: false,
      transferReady: false,
      endReady: false,
      wrapupReady: false,
    }));
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function findVisibleEnabledActionButton(
  page: Page,
  name: string,
  fallbackSelector?: string
): Promise<Locator | null> {
  const buttonGroups = [
    page.getByRole('button', {name: new RegExp(`^${escapeRegExp(name)}$`, 'i')}),
  ];

  if (fallbackSelector) {
    buttonGroups.push(page.locator(fallbackSelector));
  }

  for (const buttonGroup of buttonGroups) {
    const count = await buttonGroup.count().catch(() => 0);
    for (let i = 0; i < count; i += 1) {
      const button = buttonGroup.nth(i);
      const isVisible = await button.isVisible().catch(() => false);
      const isEnabled = isVisible ? await button.isEnabled().catch(() => false) : false;

      if (isVisible && isEnabled) {
        return button;
      }
    }
  }

  return null;
}

async function hasEnabledDomControl(page: Page, selector: string): Promise<boolean> {
  const controls = page.locator(selector);
  const count = await controls.count().catch(() => 0);

  for (let i = count - 1; i >= 0; i -= 1) {
    const enabled = await controls
      .nth(i)
      .evaluate((el) => !(el as HTMLButtonElement).disabled)
      .catch(() => false);

    if (enabled) {
      return true;
    }
  }

  return false;
}

export async function hasVisibleEnabledActionButton(
  page: Page,
  name: string,
  fallbackSelector?: string
): Promise<boolean> {
  if (await findVisibleEnabledActionButton(page, name, fallbackSelector)) {
    return true;
  }

  const taskSnapshot = await getTaskReadinessSnapshot(page);

  if (
    fallbackSelector &&
    (taskSnapshot.hasLiveTask || taskSnapshot.wrapupReady) &&
    (await hasEnabledDomControl(page, fallbackSelector))
  ) {
    return true;
  }

  const normalizedName = name.toLowerCase();
  if (normalizedName === 'consult') {
    return taskSnapshot.hasLiveTask && taskSnapshot.consultReady;
  }
  if (normalizedName === 'transfer') {
    return taskSnapshot.hasLiveTask && taskSnapshot.transferReady;
  }
  if (normalizedName === 'end') {
    return taskSnapshot.hasLiveTask && taskSnapshot.endReady;
  }
  if (normalizedName === 'wrapup') {
    return taskSnapshot.wrapupReady;
  }

  return false;
}

export async function dismissAgentStatePopupIfPresent(
  page: Page,
  options: {requireSetStateEnabled?: boolean; settleMs?: number} = {}
): Promise<void> {
  const popup = page.locator('#agentStatePopup');
  if (!(await popup.isVisible().catch(() => false))) {
    return;
  }

  const stateSelect = page.locator('#agentStateSelect');
  const setStateButton = page.locator('#setAgentState');
  const canUsePopupControls =
    (await stateSelect.isVisible().catch(() => false)) &&
    (await setStateButton.isVisible().catch(() => false));

  if (!canUsePopupControls) {
    await page.keyboard.press('Escape').catch(() => {});
    await popup.waitFor({state: 'hidden', timeout: 5000}).catch(() => {});

    return;
  }

  const currentValue = await stateSelect.inputValue().catch(() => '');
  if (!currentValue) {
    const optionTexts = await stateSelect
      .locator('option')
      .allTextContents()
      .catch(() => []);
    const fallbackOption =
      optionTexts.find((option) => option.trim().toLowerCase() === 'available') ??
      optionTexts.find((option) => option.trim().toLowerCase() === 'meeting') ??
      optionTexts.find((option) => option.trim());

    if (fallbackOption) {
      await stateSelect.selectOption({label: fallbackOption}, {timeout: AWAIT_TIMEOUT});
      await page.waitForTimeout(500);
    }
  }

  if (options.requireSetStateEnabled) {
    await setStateButton.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
    await setStateButton.click({timeout: AWAIT_TIMEOUT});
  } else if (await setStateButton.isEnabled().catch(() => false)) {
    await setStateButton.click({timeout: AWAIT_TIMEOUT}).catch(() => false);
  }

  await popup.waitFor({state: 'hidden', timeout: AWAIT_TIMEOUT}).catch(() => {});

  if (options.settleMs) {
    await page.waitForTimeout(options.settleMs);
  }
}

export async function clickDomButton(page: Page, selector: string): Promise<void> {
  await page.evaluate(async (buttonSelector) => {
    const button = document.querySelector(buttonSelector) as HTMLButtonElement | null;
    if (!button) {
      return;
    }

    if (button.onclick) {
      const result = button.onclick(new MouseEvent('click'));
      if (result && typeof result.then === 'function') {
        await result;
      }
    } else {
      button.click();
    }
  }, selector);
}

export async function clickEnabledDomButton(page: Page, selector: string): Promise<boolean> {
  return page
    .evaluate(async (buttonSelector) => {
      const buttons = Array.from(document.querySelectorAll(buttonSelector)) as HTMLButtonElement[];
      const button = buttons.reverse().find((candidate) => !candidate.disabled);
      if (!button) {
        return false;
      }

      if (button.onclick) {
        const result = button.onclick(new MouseEvent('click'));
        if (result && typeof result.then === 'function') {
          await result;
        }
      } else {
        button.click();
      }

      return true;
    }, selector)
    .catch(() => false);
}

export async function clickVisibleTextButton(page: Page, text: string): Promise<boolean> {
  return page
    .evaluate((buttonText) => {
      const expectedText = buttonText.trim().toLowerCase();
      const button = (Array.from(document.querySelectorAll('button')) as HTMLButtonElement[]).find(
        (candidate) => {
          const actualText = (candidate.textContent || '').trim().toLowerCase();
          const style = window.getComputedStyle(candidate);
          const visible =
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            candidate.offsetParent !== null;

          return actualText === expectedText && visible && !candidate.disabled;
        }
      );

      if (!button) {
        return false;
      }

      button.click();

      return true;
    }, text)
    .catch(() => false);
}

export async function clickControlWithDomFallback(page: Page, selector: string): Promise<void> {
  const control = page.locator(selector);
  await expect(control).toBeEnabled({timeout: AWAIT_TIMEOUT});

  try {
    await control.click({timeout: AWAIT_TIMEOUT});
  } catch {
    await clickDomButton(page, selector);
  }
}

export async function isTaskCleared(page: Page): Promise<boolean> {
  const taskListText = (
    await page
      .locator('#taskList')
      .innerText()
      .catch(() => '')
  ).toLowerCase();
  const incomingText = (
    await page
      .locator('#incoming-task')
      .innerText()
      .catch(() => '')
  ).toLowerCase();

  const taskListEmpty = taskListText.includes('no tasks available');
  const incomingIdle =
    incomingText === '' ||
    incomingText.includes('no incoming tasks') ||
    incomingText.includes('task accepted');
  const hasActiveSignal =
    incomingText.includes('connected') ||
    incomingText.includes('consult') ||
    incomingText.includes('hold');

  return taskListEmpty && incomingIdle && !hasActiveSignal;
}

/**
 * Finds the first visible control matching the selector.
 * For sample app, use CSS selectors like '#end', '#transfer', etc.
 * @param page - Playwright page
 * @param selector - CSS selector for sample app (e.g., '#end')
 * @returns Index of first visible control, or -1 if none found
 */
export async function findFirstVisibleControlIndex(page: Page, selector: string): Promise<number> {
  const controls = page.locator(selector);
  const count = await controls.count().catch(() => 0);

  for (let i = 0; i < count; i++) {
    const control = controls.nth(i);
    if (await control.isVisible().catch(() => false)) {
      return i;
    }
  }

  return -1;
}

/**
 * Finds the first visible and enabled control matching the selector.
 * For sample app, use CSS selectors like '#end', '#transfer', etc.
 * @param page - Playwright page
 * @param selector - CSS selector for sample app (e.g., '#end')
 * @returns Index of first visible enabled control, or -1 if none found
 */
export async function findFirstVisibleEnabledControlIndex(
  page: Page,
  selector: string
): Promise<number> {
  const controls = page.locator(selector);
  const count = await controls.count().catch(() => 0);

  for (let i = 0; i < count; i++) {
    const control = controls.nth(i);
    const isVisible = await control.isVisible().catch(() => false);
    if (!isVisible) {
      continue;
    }

    if (await control.isEnabled().catch(() => false)) {
      return i;
    }
  }

  return -1;
}

/**
 * Checks if any visible control exists matching the selector.
 * For sample app, use CSS selectors like '#end', '#transfer', etc.
 * @param page - Playwright page
 * @param selector - CSS selector for sample app (e.g., '#end')
 * @returns True if any visible control found
 */
export async function hasAnyVisibleControl(page: Page, selector: string): Promise<boolean> {
  return (await findFirstVisibleControlIndex(page, selector)) !== -1;
}

/**
 * Checks if any visible and enabled control exists matching the selector.
 * For sample app, use CSS selectors like '#end', '#transfer', etc.
 * @param page - Playwright page
 * @param selector - CSS selector for sample app (e.g., '#end')
 * @returns True if any visible enabled control found
 */
export async function hasAnyVisibleEnabledControl(page: Page, selector: string): Promise<boolean> {
  return (await findFirstVisibleEnabledControlIndex(page, selector)) !== -1;
}

/**
 * Clicks the first visible and enabled control matching the selector.
 * For sample app, use CSS selectors like '#end', '#transfer', etc.
 * @param page - Playwright page
 * @param selector - CSS selector for sample app (e.g., '#end')
 */
export async function clickFirstVisibleEnabledControl(page: Page, selector: string): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < AWAIT_TIMEOUT) {
    const enabledIndex = await findFirstVisibleEnabledControlIndex(page, selector);
    if (enabledIndex === -1) {
      await page.waitForTimeout(200);
      continue;
    }

    try {
      await page.locator(selector).nth(enabledIndex).click({timeout: AWAIT_TIMEOUT});

      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(200);
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(`No enabled visible control found for ${selector}`);
}

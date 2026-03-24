import {Page} from '@playwright/test';
import {AWAIT_TIMEOUT} from '../constants';

export async function findFirstVisibleControlIndex(page: Page, testId: string): Promise<number> {
  const controls = page.getByTestId(testId);
  const count = await controls.count().catch(() => 0);

  for (let i = 0; i < count; i++) {
    const control = controls.nth(i);
    if (await control.isVisible().catch(() => false)) {
      return i;
    }
  }

  return -1;
}

export async function findFirstVisibleEnabledControlIndex(
  page: Page,
  testId: string
): Promise<number> {
  const controls = page.getByTestId(testId);
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

export async function hasAnyVisibleControl(page: Page, testId: string): Promise<boolean> {
  return (await findFirstVisibleControlIndex(page, testId)) !== -1;
}

export async function hasAnyVisibleEnabledControl(page: Page, testId: string): Promise<boolean> {
  return (await findFirstVisibleEnabledControlIndex(page, testId)) !== -1;
}

export async function clickFirstVisibleEnabledControl(page: Page, testId: string): Promise<void> {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < AWAIT_TIMEOUT) {
    const enabledIndex = await findFirstVisibleEnabledControlIndex(page, testId);
    if (enabledIndex === -1) {
      await page.waitForTimeout(200);
      continue;
    }

    try {
      await page.getByTestId(testId).nth(enabledIndex).click({timeout: AWAIT_TIMEOUT});

      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(200);
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(`No enabled visible control found for ${testId}`);
}

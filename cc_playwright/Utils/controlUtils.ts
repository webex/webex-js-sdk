/* eslint-disable no-await-in-loop, no-plusplus, no-continue */
// Disabled no-await-in-loop: file contains polling utilities requiring sequential awaits
// Disabled no-plusplus: standard loop incrementing is clearer than alternatives
// Disabled no-continue: continue statements improve readability in these control flow scenarios
import {Page} from '@playwright/test';
import {AWAIT_TIMEOUT} from '../constants';

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

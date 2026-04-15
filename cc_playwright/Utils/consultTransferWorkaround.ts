import {Page} from '@playwright/test';

/**
 * Workaround for sample app limitation: consult-transfer button not visible due to SDK uiControls
 * This function clicks the #consult-transfer button directly via JavaScript
 * @param page - The page performing the transfer
 * @returns Promise<void>
 */
export async function executeConsultTransfer(page: Page): Promise<void> {
  // Click the consult-transfer button directly, bypassing visibility checks
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('#consult-transfer') as HTMLButtonElement;
    if (!btn) {
      return false;
    }

    // Call the onclick handler directly if available
    if (btn.onclick) {
      btn.onclick(new MouseEvent('click'));

      return true;
    }

    // Fallback: trigger click event
    btn.click();

    return true;
  });

  if (!clicked) {
    throw new Error('Could not find #consult-transfer button in the DOM');
  }

  console.log('Clicked #consult-transfer button');

  // Wait for the transfer to initiate
  await page.waitForTimeout(2000);
}

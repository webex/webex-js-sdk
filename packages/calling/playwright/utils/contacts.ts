import {Page, expect} from '@playwright/test';
import {OPERATION_TIMEOUT} from '../constants';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContactType = 'CUSTOM' | 'CLOUD';
export type GroupType = 'NORMAL' | 'EXTERNAL';

// ---------------------------------------------------------------------------
// UI readiness helpers
// ---------------------------------------------------------------------------

/**
 * Verify the Contacts SDK is ready by asserting the "Get contacts" button is
 * enabled in the UI.  Replaces the previous window.contacts readiness check.
 */
export const verifyContactsClientReady = async (page: Page): Promise<void> => {
  await expect(page.locator('#getContacts')).toBeEnabled({timeout: OPERATION_TIMEOUT});
};

/**
 * Wait for the Contacts SDK to be ready by waiting for the "Get contacts"
 * button to appear in the DOM.  Replaces the previous waitForFunction check.
 */
export const waitForContactsClient = async (
  page: Page,
  timeout = OPERATION_TIMEOUT
): Promise<void> => {
  await page.locator('#getContacts').waitFor({state: 'visible', timeout});
};

// ---------------------------------------------------------------------------
// UI interaction helpers — primary test interface for browser-visible actions
// ---------------------------------------------------------------------------

/**
 * Reset the #contact-object pre element back to its initial placeholder.
 * Call before any create-contact operation so the next waitForContactSuccess
 * detects a fresh state change.
 */
export const resetContactStatus = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const el = document.querySelector('#contact-object');
    if (el) el.textContent = 'Contact-Object';
  });
};

/**
 * Reset the #contactgroup-object pre element back to its initial placeholder.
 */
export const resetGroupStatus = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const el = document.querySelector('#contactgroup-object');
    if (el) el.textContent = 'ContactGroup-Object';
  });
};

/**
 * Click the "Get contacts" button and wait for the API response to render
 * into #contactsTableId and #contactGroupsTableId.
 */
export const clickGetContacts = async (page: Page): Promise<void> => {
  await page.locator('#getContacts').click();
  await page.waitForTimeout(2500);
};

/**
 * Fill the "Create Custom Contact" form and click "Create contact".
 * Resets the #contact-object status element first so waitForContactSuccess
 * reliably detects the new result.
 */
export const createCustomContact = async (
  page: Page,
  fields: {displayName?: string; phone?: string; email?: string; avatarURL?: string}
): Promise<void> => {
  await resetContactStatus(page);
  const form = page.locator('#contacts-form');
  await form.locator('input[name="displayName"]').fill(fields.displayName ?? '');
  await form.locator('input[name="phone"]').fill(fields.phone ?? '');
  await form.locator('input[name="email"]').fill(fields.email ?? '');
  await form.locator('input[name="avatarURL"]').fill(fields.avatarURL ?? '');
  await page.locator('button[onclick="createCustomContact()"]').click();
};

/**
 * Fill the "Create Cloud contact (Directory)" form and click "Create contact".
 * Leave contactId empty to simulate the missing-contactId error case (CONT-015).
 */
export const createCloudContact = async (
  page: Page,
  contactId: string,
  phone = ''
): Promise<void> => {
  await resetContactStatus(page);
  const form = page.locator('#cloud-contact-form');
  await form.locator('#contactId').fill(contactId);
  await form.locator('[name="phone"]').fill(phone);
  await page.locator('button[onclick="createCloudContact()"]').click();
};

/**
 * Fill the "Create Contact groups" form and click "Create Contact Group".
 * Resets the #contactgroup-object status element first.
 */
export const createContactGroup = async (
  page: Page,
  displayName: string,
  groupType: GroupType = 'NORMAL'
): Promise<void> => {
  await resetGroupStatus(page);
  await page.locator('#contactgroups-form input[name="displayName"]').fill(displayName);
  await page.locator('#groupType').selectOption(groupType);
  await page.locator('button[onclick="createContactGroup()"]').click();
};

// ---------------------------------------------------------------------------
// UI status assertion helpers
// ---------------------------------------------------------------------------

/**
 * Wait for the #contact-object pre to display "Status: SUCCESS".
 */
export const waitForContactSuccess = async (page: Page): Promise<void> => {
  await expect(page.locator('#contact-object')).toContainText('Status: SUCCESS', {
    timeout: OPERATION_TIMEOUT,
  });
};

/**
 * Wait for the #contactgroup-object pre to display "Status: SUCCESS".
 */
export const waitForGroupSuccess = async (page: Page): Promise<void> => {
  await expect(page.locator('#contactgroup-object')).toContainText('Status: SUCCESS', {
    timeout: OPERATION_TIMEOUT,
  });
};

/**
 * Wait for #contact-object to leave the reset placeholder.
 */
export const waitForContactOperationEnd = async (page: Page): Promise<void> => {
  await expect(page.locator('#contact-object')).not.toContainText('Contact-Object', {
    timeout: OPERATION_TIMEOUT,
  });
};

/**
 * Wait for #contactgroup-object to leave the reset placeholder.
 */
export const waitForGroupOperationEnd = async (page: Page): Promise<void> => {
  await expect(page.locator('#contactgroup-object')).not.toContainText('ContactGroup-Object', {
    timeout: OPERATION_TIMEOUT,
  });
};

// ---------------------------------------------------------------------------
// UI table assertion helpers
// ---------------------------------------------------------------------------

export const expectContactInTable = async (page: Page, displayName: string): Promise<void> => {
  await expect(page.locator('#contactsTableId')).toContainText(displayName, {timeout: 5_000});
};

export const expectContactTypeInRow = async (
  page: Page,
  displayName: string,
  contactType: ContactType
): Promise<void> => {
  const row = page.locator('#contactsTableId tr').filter({hasText: displayName});
  await expect(row).toContainText(contactType);
};

export const expectGroupInTable = async (page: Page, displayName: string): Promise<void> => {
  await expect(page.locator('#contactGroupsTableId')).toContainText(displayName, {timeout: 5_000});
};

export const expectGroupTypeInRow = async (
  page: Page,
  displayName: string,
  groupType: GroupType
): Promise<void> => {
  const row = page.locator('#contactGroupsTableId tr').filter({hasText: displayName});
  await expect(row).toContainText(groupType);
};

export const expectContactNotInTable = async (page: Page, displayName: string): Promise<void> => {
  await expect(page.locator('#contactsTableId')).not.toContainText(displayName, {timeout: 5_000});
};

export const expectGroupNotInTable = async (page: Page, displayName: string): Promise<void> => {
  await expect(page.locator('#contactGroupsTableId')).not.toContainText(displayName, {
    timeout: 5_000,
  });
};

// ---------------------------------------------------------------------------
// UI delete helpers
// ---------------------------------------------------------------------------

/**
 * Click the red Delete button in the contacts-table row that contains `displayName`.
 */
export const deleteContactByName = async (page: Page, displayName: string): Promise<void> => {
  const row = page.locator('#contactsTableId tr').filter({hasText: displayName});
  await row.locator('button.btn--red').click();
  await page.waitForTimeout(1500);
};

/**
 * Click the red Delete button in the groups-table row that contains `displayName`.
 */
export const deleteGroupByName = async (page: Page, displayName: string): Promise<void> => {
  const row = page.locator('#contactGroupsTableId tr').filter({hasText: displayName});
  await row.locator('button.btn--red').click();
  await page.waitForTimeout(1500);
};

// ---------------------------------------------------------------------------
// UI cleanup helper — used in afterEach / afterAll
// ---------------------------------------------------------------------------

/**
 * Delete all contacts and contact groups via the UI delete buttons.
 * All Delete buttons are wired with their own IDs, so we bulk-click all visible Delete buttons per table pass and refresh once per pass. This is faster than refreshing after each delete, and repeated passes ensure all rows are eventually removed.
 */
export const cleanupAllContacts = async (page: Page): Promise<void> => {
  // Click every currently visible Delete button for a table, then refresh once.
  // Recurses per pass (not per item) to satisfy the no-await-in-loop rule.
  const drainTable = async (selector: string, passes: number): Promise<void> => {
    if (passes <= 0) return;

    const buttons = await page.locator(selector).all();
    if (buttons.length === 0) return;

    // Click sequentially; reduce avoids the no-await-in-loop lint rule.
    await buttons.reduce(
      (prev, btn) => prev.then(() => btn.click().catch(() => {})),
      Promise.resolve()
    );

    // Let the backend deletes settle, then refresh the table a single time.
    await page.waitForTimeout(500);
    await clickGetContacts(page);

    await drainTable(selector, passes - 1);
  };

  try {
    await clickGetContacts(page);
    await drainTable('#contactsTableId tr button.btn--red', 5);
    await drainTable('#contactGroupsTableId tr button.btn--red', 5);
  } catch {
    // Best-effort cleanup — never fail the test suite on teardown errors
  }
};

import {Page, expect} from '@playwright/test';
import {OPERATION_TIMEOUT} from '../constants';

// ---------------------------------------------------------------------------
// Types mirroring the SDK ContactsClient API surface
// ---------------------------------------------------------------------------

export type ContactType = 'CUSTOM' | 'CLOUD';
export type GroupType = 'NORMAL' | 'EXTERNAL';

export interface ContactGroupResult {
  groupId: string;
  displayName: string;
  groupType: GroupType;
  encryptionKeyUrl: string;
  members?: string[];
  ownerId?: string;
}

export interface ContactResult {
  contactId: string;
  contactType: ContactType;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  emails?: Array<{type: string; value: string}>;
  phoneNumbers?: Array<{type: string; value: string}>;
  sipAddresses?: Array<{type: string; value: string}>;
  companyName?: string;
  department?: string;
  groups: string[];
  encryptionKeyUrl: string;
  resolved: boolean;
}

export interface ContactsResponse {
  statusCode: number;
  data: {
    contacts?: ContactResult[];
    groups?: ContactGroupResult[];
    contact?: ContactResult;
    group?: ContactGroupResult;
    error?: string;
  };
  message: string | null;
}

// ---------------------------------------------------------------------------
// SDK helpers — used for initialization, cleanup, and SDK-only test cases
// ---------------------------------------------------------------------------

/**
 * Verify `window.contacts` is available on the page.
 */
export const verifyContactsClientReady = async (page: Page): Promise<void> => {
  const ready = await page.evaluate(() => !!(window as any).contacts);
  expect(ready).toBe(true);
};

/**
 * Call contacts.getContacts() via the SDK and return the full response.
 * Used for: initialization, cleanup, and assertions that need response shape.
 */
export const getContacts = (page: Page): Promise<ContactsResponse> =>
  page.evaluate(async () => (window as any).contacts.getContacts());

/**
 * Call contacts.createContactGroup() via the SDK and return the response.
 * Used for: tests that need group assignment (CONT-014) and cleanup.
 */
export const createContactGroup = (
  page: Page,
  displayName: string,
  groupType?: GroupType
): Promise<ContactsResponse> =>
  page.evaluate(
    async ([name, type]) =>
      (window as any).contacts.createContactGroup(name, undefined, type ?? undefined),
    [displayName, groupType] as [string, GroupType | undefined]
  );

/**
 * Call contacts.deleteContactGroup() via the SDK.
 * Used for cleanup hooks (afterEach / afterAll).
 */
export const deleteContactGroup = (page: Page, groupId: string): Promise<ContactsResponse> =>
  page.evaluate(async ([id]) => (window as any).contacts.deleteContactGroup(id), [groupId] as [
    string
  ]);

/**
 * Call contacts.createContact() via the SDK and return the response.
 * Used for: tests that need fields not exposed in the UI form (CONT-012, CONT-014).
 */
export const createContact = (
  page: Page,
  contactInfo: Partial<ContactResult>
): Promise<ContactsResponse> =>
  page.evaluate(async ([info]) => (window as any).contacts.createContact(info), [contactInfo] as [
    Partial<ContactResult>
  ]);

/**
 * Call contacts.deleteContact() via the SDK.
 * Used for cleanup hooks and CONT-019.
 */
export const deleteContact = (page: Page, contactId: string): Promise<ContactsResponse> =>
  page.evaluate(async ([id]) => (window as any).contacts.deleteContact(id), [contactId] as [
    string
  ]);

// ---------------------------------------------------------------------------
// SDK assertion helpers (used in SDK-only tests: CONT-012, CONT-014, CONT-016)
// ---------------------------------------------------------------------------

export const expectContactSuccess = (response: ContactsResponse, expectedStatus = 200): void => {
  expect(response.statusCode).toBe(expectedStatus);
  expect(response.message).not.toBeNull();
  expect(response.data).toBeDefined();
  expect(response.data.error).toBeUndefined();
};

export const expectContactError = (response: ContactsResponse, expectedStatus: number): void => {
  expect(response.statusCode).toBe(expectedStatus);
  expect(response.data.error).toBeDefined();
};

// ---------------------------------------------------------------------------
// SDK cleanup helpers — used in afterEach / afterAll
// ---------------------------------------------------------------------------

export const safeDeleteContactGroup = async (page: Page, groupId: string): Promise<void> => {
  try {
    await deleteContactGroup(page, groupId);
  } catch {
    // Best-effort cleanup
  }
};

export const safeDeleteContact = async (page: Page, contactId: string): Promise<void> => {
  try {
    await deleteContact(page, contactId);
  } catch {
    // Best-effort cleanup
  }
};

/**
 * Delete all CUSTOM contacts and all contact groups via the SDK.
 * Reliable cleanup for afterAll hooks.
 */
export const cleanupAllContacts = async (page: Page): Promise<void> => {
  try {
    const response = await getContacts(page);
    if (!response.data) return;

    const {contacts = [], groups = []} = response.data;

    await Promise.all(
      contacts
        .filter((c) => c.contactType === 'CUSTOM')
        .map((c) => safeDeleteContact(page, c.contactId))
    );

    await Promise.all(groups.map((g) => safeDeleteContactGroup(page, g.groupId)));
  } catch {
    // Cleanup is best-effort
  }
};

// ---------------------------------------------------------------------------
// SDK build helpers
// ---------------------------------------------------------------------------

export const buildCustomContact = (
  overrides: Partial<ContactResult> = {}
): Partial<ContactResult> => ({
  contactType: 'CUSTOM',
  firstName: 'Test',
  lastName: 'User',
  displayName: 'Test User',
  emails: [{type: 'work', value: `test.e2e.${Date.now()}@example.com`}],
  phoneNumbers: [{type: 'work', value: '+15005550001'}],
  groups: [],
  encryptionKeyUrl: '',
  resolved: true,
  ...overrides,
});

export const buildCloudContact = (
  contactId: string,
  overrides: Partial<ContactResult> = {}
): Partial<ContactResult> => ({
  contactType: 'CLOUD',
  contactId,
  groups: [],
  encryptionKeyUrl: '',
  resolved: false,
  ...overrides,
});

export const waitForContactsClient = async (
  page: Page,
  timeout = OPERATION_TIMEOUT
): Promise<void> => {
  await page.waitForFunction(() => !!(window as any).contacts, {timeout});
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
export const uiCreateCustomContact = async (
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
export const uiCreateCloudContact = async (
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
export const uiCreateContactGroup = async (
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
 * app.js sets this after contacts.createContact() resolves successfully.
 */
export const waitForContactSuccess = async (page: Page): Promise<void> => {
  await expect(page.locator('#contact-object')).toContainText('Status: SUCCESS', {
    timeout: OPERATION_TIMEOUT,
  });
};

/**
 * Wait for the #contactgroup-object pre to display "Status: SUCCESS".
 * app.js sets this after contacts.createContactGroup() resolves successfully.
 */
export const waitForGroupSuccess = async (page: Page): Promise<void> => {
  await expect(page.locator('#contactgroup-object')).toContainText('Status: SUCCESS', {
    timeout: OPERATION_TIMEOUT,
  });
};

/**
 * Wait for #contact-object to leave the reset placeholder.
 * Indicates the SDK call has completed (successfully or with an error).
 * Use before asserting the error state so there is no timing gap.
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

/**
 * Assert that a row containing `displayName` appears in the contacts table.
 * Assumes clickGetContacts has already been called.
 */
export const expectContactInTable = async (page: Page, displayName: string): Promise<void> => {
  await expect(page.locator('#contactsTableId')).toContainText(displayName, {timeout: 5_000});
};

/**
 * Assert that the contacts-table row for `displayName` also shows the expected contactType.
 */
export const expectContactTypeInRow = async (
  page: Page,
  displayName: string,
  contactType: ContactType
): Promise<void> => {
  const row = page.locator('#contactsTableId tr').filter({hasText: displayName});
  await expect(row).toContainText(contactType);
};

/**
 * Assert that a row containing `displayName` appears in the contact-groups table.
 */
export const expectGroupInTable = async (page: Page, displayName: string): Promise<void> => {
  await expect(page.locator('#contactGroupsTableId')).toContainText(displayName, {timeout: 5_000});
};

/**
 * Assert that the groups-table row for `displayName` also shows the expected groupType.
 */
export const expectGroupTypeInRow = async (
  page: Page,
  displayName: string,
  groupType: GroupType
): Promise<void> => {
  const row = page.locator('#contactGroupsTableId tr').filter({hasText: displayName});
  await expect(row).toContainText(groupType);
};

/**
 * Assert that no row containing `displayName` exists in the contacts table.
 */
export const expectContactNotInTable = async (page: Page, displayName: string): Promise<void> => {
  await expect(page.locator('#contactsTableId')).not.toContainText(displayName, {timeout: 5_000});
};

/**
 * Assert that no row containing `displayName` exists in the contact-groups table.
 */
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
 * Requires clickGetContacts to have been called first to render the table.
 */
export const uiDeleteContactByName = async (page: Page, displayName: string): Promise<void> => {
  const row = page.locator('#contactsTableId tr').filter({hasText: displayName});
  await row.locator('button.btn--red').click();
  await page.waitForTimeout(1500);
};

/**
 * Click the red Delete button in the groups-table row that contains `displayName`.
 * Requires clickGetContacts to have been called first to render the table.
 */
export const uiDeleteGroupByName = async (page: Page, displayName: string): Promise<void> => {
  const row = page.locator('#contactGroupsTableId tr').filter({hasText: displayName});
  await row.locator('button.btn--red').click();
  await page.waitForTimeout(1500);
};

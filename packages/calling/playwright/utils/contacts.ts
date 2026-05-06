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
// Helpers — wrap page.evaluate() calls so tests stay readable
// ---------------------------------------------------------------------------

/**
 * Verify `window.contacts` is available on the page.
 */
export const verifyContactsClientReady = async (page: Page): Promise<void> => {
  const ready = await page.evaluate(() => !!(window as any).contacts);
  expect(ready).toBe(true);
};

/**
 * Call contacts.getContacts() and return the full ContactResponse.
 */
export const getContacts = (page: Page): Promise<ContactsResponse> =>
  page.evaluate(async () => (window as any).contacts.getContacts());

/**
 * Call contacts.createContactGroup() and return the ContactResponse.
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
 * Call contacts.deleteContactGroup() and return the ContactResponse.
 */
export const deleteContactGroup = (page: Page, groupId: string): Promise<ContactsResponse> =>
  page.evaluate(async ([id]) => (window as any).contacts.deleteContactGroup(id), [groupId] as [
    string
  ]);

/**
 * Call contacts.createContact() and return the ContactResponse.
 */
export const createContact = (
  page: Page,
  contactInfo: Partial<ContactResult>
): Promise<ContactsResponse> =>
  page.evaluate(async ([info]) => (window as any).contacts.createContact(info), [contactInfo] as [
    Partial<ContactResult>
  ]);

/**
 * Call contacts.deleteContact() and return the ContactResponse.
 */
export const deleteContact = (page: Page, contactId: string): Promise<ContactsResponse> =>
  page.evaluate(async ([id]) => (window as any).contacts.deleteContact(id), [contactId] as [
    string
  ]);

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

/**
 * Assert a ContactResponse is a success (2xx status, non-null message).
 */
export const expectContactSuccess = (response: ContactsResponse, expectedStatus = 200): void => {
  expect(response.statusCode).toBe(expectedStatus);
  expect(response.message).not.toBeNull();
  expect(response.data).toBeDefined();
  expect(response.data.error).toBeUndefined();
};

/**
 * Assert a ContactResponse is a client error (4xx status).
 */
export const expectContactError = (response: ContactsResponse, expectedStatus: number): void => {
  expect(response.statusCode).toBe(expectedStatus);
  expect(response.data.error).toBeDefined();
};

// ---------------------------------------------------------------------------
// Cleanup helpers — used in afterEach / afterAll to restore pristine state
// ---------------------------------------------------------------------------

/**
 * Delete a contact group by groupId, silently ignoring errors.
 * Use in afterEach/afterAll to avoid test pollution.
 */
export const safeDeleteContactGroup = async (page: Page, groupId: string): Promise<void> => {
  try {
    await deleteContactGroup(page, groupId);
  } catch {
    // Best-effort cleanup — not a test failure if already deleted
  }
};

/**
 * Delete a contact by contactId, silently ignoring errors.
 */
export const safeDeleteContact = async (page: Page, contactId: string): Promise<void> => {
  try {
    await deleteContact(page, contactId);
  } catch {
    // Best-effort cleanup
  }
};

/**
 * Fetch current contacts and delete all CUSTOM contacts and all groups created
 * during a test run. Use in afterAll to guarantee a clean state.
 */
export const cleanupAllContacts = async (page: Page): Promise<void> => {
  try {
    const response = await getContacts(page);
    if (!response.data) return;

    const {contacts = [], groups = []} = response.data;

    // Delete CUSTOM contacts first (CLOUD contacts are references, not owned records)
    await Promise.all(
      contacts
        .filter((c) => c.contactType === 'CUSTOM')
        .map((c) => safeDeleteContact(page, c.contactId))
    );

    // Delete groups (non-default groups; the default group may be required by the service)
    await Promise.all(groups.map((g) => safeDeleteContactGroup(page, g.groupId)));
  } catch {
    // Cleanup is best-effort
  }
};

/**
 * Build a minimal CUSTOM contact payload for testing.
 */
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

/**
 * Build a CLOUD contact payload for testing.
 * Requires a valid Webex user UUID as contactId.
 */
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

/**
 * Wait for the contacts client (window.contacts) to be ready with a timeout.
 */
export const waitForContactsClient = async (
  page: Page,
  timeout = OPERATION_TIMEOUT
): Promise<void> => {
  await page.waitForFunction(() => !!(window as any).contacts, {timeout});
};

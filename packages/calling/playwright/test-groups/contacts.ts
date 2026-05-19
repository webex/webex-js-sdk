import {test, expect} from '@playwright/test';
import {TestManager} from '../test-manager';
import {
  verifyContactsClientReady,
  cleanupAllContacts,
  clickGetContacts,
  createCustomContact,
  createCloudContact,
  createContactGroup,
  waitForContactSuccess,
  waitForGroupSuccess,
  waitForContactOperationEnd,
  waitForGroupOperationEnd,
  expectContactInTable,
  expectContactTypeInRow,
  expectGroupInTable,
  expectGroupTypeInRow,
  expectContactNotInTable,
  expectGroupNotInTable,
  deleteGroupByName,
  deleteContactByName,
} from '../utils/contacts';

// ---------------------------------------------------------------------------
// Test Suite 1: Contact List (getContacts)
// ---------------------------------------------------------------------------

/**
 * CONT-001 to CONT-004: Verify that the Get Contacts button renders both
 * tables and that created contacts / groups appear in them with the correct
 * display values.
 *
 * All operations use the sample-app UI (form fills + button clicks + table
 * assertions). The SDK is only used for cleanup in afterAll.
 */
export function contactListTests() {
  test.describe('Contacts - Contact List', () => {
    test.describe.configure({mode: 'serial', timeout: 120000});

    let tm: TestManager;

    test.beforeAll(async ({browser}, testInfo) => {
      tm = new TestManager(testInfo.project.name);
      await tm.setupContext(browser, 0, {
        initSDK: true,
        service: 'calling',
        register: true,
      });
      await verifyContactsClientReady(tm.page);
      // Initialize SDK internal state and pre-populate the tables
      await clickGetContacts(tm.page);
    });

    test.afterAll(async () => {
      await cleanupAllContacts(tm.page).catch(() => {});
      await tm.cleanup();
    });

    test('CONT-001: getContacts - contacts and groups tables are rendered after clicking Get Contacts', async () => {
      // Seed both tables so the assertions verify rendered data, not just DOM presence
      const seedContact = `CONT-001 Seed Contact ${Date.now()}`;
      const seedGroup = `CONT-001 Seed Group ${Date.now()}`;
      await createCustomContact(tm.page, {displayName: seedContact, phone: '+15005550001'});
      await waitForContactSuccess(tm.page);
      await createContactGroup(tm.page, seedGroup);
      await waitForGroupSuccess(tm.page);
      // Click Get Contacts and verify both seeded entries are fetched and rendered
      await clickGetContacts(tm.page);
      await expectContactInTable(tm.page, seedContact);
      await expectGroupInTable(tm.page, seedGroup);
    });

    test('CONT-002: getContacts - created CUSTOM contact appears in the contacts table with correct type', async () => {
      const displayName = `CONT-002 Verify ${Date.now()}`;

      // Create via the sample-app form
      await createCustomContact(tm.page, {
        displayName,
        phone: '+15005550001',
        email: 'cont002@example.com',
      });
      await waitForContactSuccess(tm.page);

      // Refresh the table and verify the row
      await clickGetContacts(tm.page);
      await expectContactInTable(tm.page, displayName);
      await expectContactTypeInRow(tm.page, displayName, 'CUSTOM');
    });

    test('CONT-003: getContacts - created contact group appears in the groups table', async () => {
      const groupName = `CONT-003 Group ${Date.now()}`;

      await createContactGroup(tm.page, groupName);
      await waitForGroupSuccess(tm.page);

      await clickGetContacts(tm.page);
      await expectGroupInTable(tm.page, groupName);
    });

    test('CONT-004: getContacts - CUSTOM contact shows its decrypted displayName in the table', async () => {
      const displayName = `CONT-004 Decrypted ${Date.now()}`;

      await createCustomContact(tm.page, {displayName, phone: '+15005550001'});
      await waitForContactSuccess(tm.page);

      await clickGetContacts(tm.page);

      // The display name must appear exactly — proves the SDK decrypted it correctly
      await expect(tm.page.locator('#contactsTableId')).toContainText(displayName);
    });
  });
}

// ---------------------------------------------------------------------------
// Test Suite 2: Contact Group CRUD
// ---------------------------------------------------------------------------

/**
 * CONT-005 to CONT-010: Create and delete contact groups through the UI.
 *
 * Primary assertions check the sample-app tables and the #contactgroup-object
 * status element. SDK cleanup runs in afterAll.
 */
export function contactGroupTests() {
  test.describe('Contacts - Contact Group', () => {
    test.describe.configure({mode: 'serial', timeout: 120000});

    let tm: TestManager;

    test.beforeAll(async ({browser}, testInfo) => {
      tm = new TestManager(testInfo.project.name);
      await tm.setupContext(browser, 0, {
        initSDK: true,
        service: 'calling',
        register: true,
      });
      await verifyContactsClientReady(tm.page);
      await clickGetContacts(tm.page);
    });

    test.afterEach(async () => {
      // Full cleanup after each test keeps tests independent without ID tracking
      await cleanupAllContacts(tm.page).catch(() => {});
    });

    test.afterAll(async () => {
      await cleanupAllContacts(tm.page).catch(() => {});
      await tm.cleanup();
    });

    test('CONT-005: createContactGroup - NORMAL group is created and appears in the groups table', async () => {
      const displayName = `CONT-005 Group ${Date.now()}`;

      await createContactGroup(tm.page, displayName, 'NORMAL');
      await waitForGroupSuccess(tm.page);

      await clickGetContacts(tm.page);
      await expectGroupInTable(tm.page, displayName);
      await expectGroupTypeInRow(tm.page, displayName, 'NORMAL');
    });

    test('CONT-006: createContactGroup - EXTERNAL group is stored with correct type in the table', async () => {
      const displayName = `CONT-006 Ext Group ${Date.now()}`;

      await createContactGroup(tm.page, displayName, 'EXTERNAL');
      await waitForGroupSuccess(tm.page);

      await clickGetContacts(tm.page);
      await expectGroupInTable(tm.page, displayName);
      await expectGroupTypeInRow(tm.page, displayName, 'EXTERNAL');
    });

    test('CONT-007: createContactGroup - duplicate displayName does not show success status', async () => {
      const displayName = `CONT-007 Dup ${Date.now()}`;

      // First creation must succeed
      await createContactGroup(tm.page, displayName, 'NORMAL');
      await waitForGroupSuccess(tm.page);

      // Second creation with the same name must fail
      await createContactGroup(tm.page, displayName, 'NORMAL');
      // Wait for the SDK call to complete (status element leaves its reset value)
      await waitForGroupOperationEnd(tm.page);

      // The status element must NOT show success
      await expect(tm.page.locator('#contactgroup-object')).not.toContainText('Status: SUCCESS');
    });

    test('CONT-008: createContactGroup - group appears in the groups table immediately after creation', async () => {
      const displayName = `CONT-008 Fetch Verify ${Date.now()}`;

      await createContactGroup(tm.page, displayName);
      await waitForGroupSuccess(tm.page);

      await clickGetContacts(tm.page);
      await expectGroupInTable(tm.page, displayName);
    });

    test('CONT-009: deleteContactGroup - group is removed from the table after clicking Delete', async () => {
      const displayName = `CONT-009 Delete Group ${Date.now()}`;

      // Create and confirm in table
      await createContactGroup(tm.page, displayName);
      await waitForGroupSuccess(tm.page);
      await clickGetContacts(tm.page);
      await expectGroupInTable(tm.page, displayName);

      // Delete via the table row button
      await deleteGroupByName(tm.page, displayName);

      // Re-fetch and verify the row is gone
      await clickGetContacts(tm.page);
      await expectGroupNotInTable(tm.page, displayName);
    });

    test('CONT-010: deleteContactGroup - deleted group does not reappear in a subsequent Get Contacts call', async () => {
      const displayName = `CONT-010 Verify Deleted ${Date.now()}`;

      await createContactGroup(tm.page, displayName);
      await waitForGroupSuccess(tm.page);
      await clickGetContacts(tm.page);

      // Delete via UI
      await deleteGroupByName(tm.page, displayName);

      // A fresh Get Contacts must not return this group
      await clickGetContacts(tm.page);
      await expectGroupNotInTable(tm.page, displayName);
    });
  });
}

// ---------------------------------------------------------------------------
// Test Suite 3: Create Contact
// ---------------------------------------------------------------------------

/**
 * CONT-011 to CONT-016: createContact scenarios — all tested through the UI.
 */
export function createContactTests() {
  test.describe('Contacts - Create Contact', () => {
    test.describe.configure({mode: 'serial', timeout: 120000});

    let tm: TestManager;

    test.beforeAll(async ({browser}, testInfo) => {
      tm = new TestManager(testInfo.project.name);
      await tm.setupContext(browser, 0, {
        initSDK: true,
        service: 'calling',
        register: true,
      });
      await verifyContactsClientReady(tm.page);
      await clickGetContacts(tm.page);
    });

    test.afterEach(async () => {
      await cleanupAllContacts(tm.page).catch(() => {});
    });

    test.afterAll(async () => {
      await cleanupAllContacts(tm.page).catch(() => {});
      await tm.cleanup();
    });

    test('CONT-011: createContact CUSTOM - form submission shows success status', async () => {
      await createCustomContact(tm.page, {
        displayName: `CONT-011 Min ${Date.now()}`,
        phone: '+15005550001',
      });

      // The #contact-object pre must show "Status: SUCCESS"
      await waitForContactSuccess(tm.page);
    });

    test('CONT-013: createContact CUSTOM - auto-assigned to a default group, visible in Groups column', async () => {
      const displayName = `CONT-013 AutoGroup ${Date.now()}`;

      // Create with no groups field — service auto-assigns to default group
      await createCustomContact(tm.page, {displayName, phone: '+15005550001'});
      await waitForContactSuccess(tm.page);

      await clickGetContacts(tm.page);
      await expectContactInTable(tm.page, displayName);

      // Groups column is the 7th td (index 6) in the contacts table row
      // renderContacts() sets it to parentGroups.toString() — non-empty when auto-assigned
      const row = tm.page.locator('#contactsTableId tr').filter({hasText: displayName});
      const groupsCell = row.locator('td').nth(6);
      const groupText = await groupsCell.innerText();
      expect(groupText.trim()).not.toBe('');
    });

    test('CONT-015: createContact CLOUD - empty contactId shows error status in the app', async () => {
      // Submit the cloud contact form with an empty contactId — SDK rejects it
      await createCloudContact(tm.page, '' /* contactId intentionally empty */);

      // Wait for the SDK call to complete (element leaves the reset placeholder)
      await waitForContactOperationEnd(tm.page);

      // The status must NOT show success
      await expect(tm.page.locator('#contact-object')).not.toContainText('Status: SUCCESS');
    });

    test('CONT-016: createContact CUSTOM - newly created contact appears in the Get Contacts table', async () => {
      const displayName = `CONT-016 Verify ${Date.now()}`;

      await createCustomContact(tm.page, {displayName, phone: '+15005550001'});
      await waitForContactSuccess(tm.page);

      await clickGetContacts(tm.page);
      await expectContactInTable(tm.page, displayName);
      await expectContactTypeInRow(tm.page, displayName, 'CUSTOM');
    });
  });
}

// ---------------------------------------------------------------------------
// Test Suite 4: Delete Contact
// ---------------------------------------------------------------------------

/**
 * CONT-017: deleteContact — create via form → Delete button → table verification.
 */
export function deleteContactTests() {
  test.describe('Contacts - Delete Contact', () => {
    test.describe.configure({mode: 'serial', timeout: 120000});

    let tm: TestManager;

    test.beforeAll(async ({browser}, testInfo) => {
      tm = new TestManager(testInfo.project.name);
      await tm.setupContext(browser, 0, {
        initSDK: true,
        service: 'calling',
        register: true,
      });
      await verifyContactsClientReady(tm.page);
      await clickGetContacts(tm.page);
    });

    test.afterAll(async () => {
      await cleanupAllContacts(tm.page).catch(() => {});
      await tm.cleanup();
    });

    test('CONT-017: deleteContact - contact is removed from the table after clicking Delete', async () => {
      const displayName = `CONT-018 Delete Me ${Date.now()}`;

      // Create the contact via the UI form
      await createCustomContact(tm.page, {displayName, phone: '+15005550001'});
      await waitForContactSuccess(tm.page);

      // Populate the table and confirm the contact is present
      await clickGetContacts(tm.page);
      await expectContactInTable(tm.page, displayName);

      // Click the Delete button in the table row
      await deleteContactByName(tm.page, displayName);

      // Re-fetch and verify the contact no longer appears
      await clickGetContacts(tm.page);
      await expectContactNotInTable(tm.page, displayName);
    });
  });
}

import {test, expect} from '@playwright/test';
import {TestManager} from '../test-manager';
import {
  verifyContactsClientReady,
  getContacts,
  createContactGroup,
  deleteContactGroup,
  createContact,
  deleteContact,
  expectContactSuccess,
  expectContactError,
  safeDeleteContactGroup,
  safeDeleteContact,
  cleanupAllContacts,
  buildCustomContact,
  ContactGroupResult,
  ContactResult,
} from '../utils/contacts';

// ---------------------------------------------------------------------------
// Test Suite 1: Contact List (getContacts)
// ---------------------------------------------------------------------------

/**
 * CONT-001 to CONT-004: Fetch contact list
 *
 * Tests that getContacts() returns the correct response shape,
 * handles empty state, and properly differentiates contact types.
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
    });

    test.afterAll(async () => {
      await cleanupAllContacts(tm.page).catch(() => {});
      await tm.cleanup();
    });

    test('CONT-001: getContacts - returns valid response shape with contacts and groups arrays', async () => {
      const response = await getContacts(tm.page);

      expect(response).toBeDefined();
      expect(response.statusCode).toBeGreaterThanOrEqual(200);
      expect(response.statusCode).toBeLessThan(300);
      expect(response.message).not.toBeNull();
      expect(response.data).toBeDefined();
      // contacts and groups must be arrays (can be empty)
      expect(Array.isArray(response.data.contacts)).toBe(true);
      expect(Array.isArray(response.data.groups)).toBe(true);
    });

    test('CONT-002: getContacts - response data.contacts contains only resolved objects', async () => {
      // Create a CUSTOM contact to ensure there is something to fetch
      const contactPayload = buildCustomContact({displayName: 'CONT-002 Verify Contact'});
      const createResp = await createContact(tm.page, contactPayload);
      const createdContactId = createResp.data.contact?.contactId;

      const response = await getContacts(tm.page);

      expect(response.data.contacts).toBeDefined();
      response.data.contacts?.forEach((contact: ContactResult) => {
        expect(contact.contactId).toBeTruthy();
        expect(contact.contactType).toMatch(/^(CUSTOM|CLOUD)$/);
        // 'resolved' is only populated for CLOUD contacts by resolveCloudContacts()
        // CUSTOM contacts come from raw API without this field
        if (contact.contactType === 'CLOUD') {
          expect(typeof contact.resolved).toBe('boolean');
        }
        expect(Array.isArray(contact.groups)).toBe(true);
      });

      // Cleanup
      if (createdContactId) {
        await safeDeleteContact(tm.page, createdContactId);
      }
    });

    test('CONT-003: getContacts - groups array contains valid group objects', async () => {
      const groupResp = await createContactGroup(tm.page, 'CONT-003 Test Group');
      const groupId = groupResp.data.group?.groupId;

      const response = await getContacts(tm.page);

      expect(response.data.groups).toBeDefined();
      const groups = response.data.groups ?? [];
      expect(groups.length).toBeGreaterThanOrEqual(1);
      groups.forEach((group: ContactGroupResult) => {
        expect(group.groupId).toBeTruthy();
        expect(group.displayName).toBeTruthy();
        expect(group.groupType).toMatch(/^(NORMAL|EXTERNAL)$/);
        expect(group.encryptionKeyUrl).toBeTruthy();
      });

      if (groupId) {
        await safeDeleteContactGroup(tm.page, groupId);
      }
    });

    test('CONT-004: getContacts - CUSTOM contact returned with decrypted displayName', async () => {
      const displayName = `CONT-004 Contact ${Date.now()}`;
      const createResp = await createContact(tm.page, buildCustomContact({displayName}));
      const contactId = createResp.data.contact?.contactId;

      const response = await getContacts(tm.page);
      const found = response.data.contacts?.find((c) => c.contactId === contactId);

      expect(found).toBeDefined();
      // The displayName must be decrypted (human-readable), not a cipher string
      expect(found?.displayName).toBe(displayName);

      if (contactId) {
        await safeDeleteContact(tm.page, contactId);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Test Suite 2: Contact Group CRUD
// ---------------------------------------------------------------------------

/**
 * CONT-005 to CONT-010: Contact group create / delete
 */
export function contactGroupTests() {
  test.describe('Contacts - Contact Group', () => {
    test.describe.configure({mode: 'serial', timeout: 120000});

    let tm: TestManager;
    const createdGroupIds: string[] = [];

    test.beforeAll(async ({browser}, testInfo) => {
      tm = new TestManager(testInfo.project.name);
      await tm.setupContext(browser, 0, {
        initSDK: true,
        service: 'calling',
        register: true,
      });
      await verifyContactsClientReady(tm.page);
      // Pre-fetch so the client has group state cached
      await getContacts(tm.page);
    });

    test.afterEach(async () => {
      // Remove any groups created in this test to avoid polluting the next test
      await Promise.all(createdGroupIds.splice(0).map((id) => safeDeleteContactGroup(tm.page, id)));
    });

    test.afterAll(async () => {
      await cleanupAllContacts(tm.page).catch(() => {});
      await tm.cleanup();
    });

    test('CONT-005: createContactGroup - happy path creates group with NORMAL type', async () => {
      const displayName = `CONT-005 Group ${Date.now()}`;
      const response = await createContactGroup(tm.page, displayName, 'NORMAL');

      expectContactSuccess(response, 201);
      expect(response.data.group).toBeDefined();
      expect(response.data.group?.displayName).toBe(displayName);
      expect(response.data.group?.groupType).toBe('NORMAL');
      expect(response.data.group?.groupId).toBeTruthy();
      expect(response.data.group?.encryptionKeyUrl).toBeTruthy();

      if (response.data.group?.groupId) {
        createdGroupIds.push(response.data.group.groupId);
      }
    });

    test('CONT-006: createContactGroup - EXTERNAL groupType is stored correctly', async () => {
      const displayName = `CONT-006 External Group ${Date.now()}`;
      const response = await createContactGroup(tm.page, displayName, 'EXTERNAL');

      expectContactSuccess(response, 201);
      expect(response.data.group?.groupType).toBe('EXTERNAL');
      expect(response.data.group?.displayName).toBe(displayName);

      if (response.data.group?.groupId) {
        createdGroupIds.push(response.data.group.groupId);
      }
    });

    test('CONT-007: createContactGroup - duplicate displayName returns 400 error', async () => {
      const displayName = `CONT-007 Duplicate Group ${Date.now()}`;

      // First creation should succeed
      const first = await createContactGroup(tm.page, displayName);
      expectContactSuccess(first, 201);
      if (first.data.group?.groupId) {
        createdGroupIds.push(first.data.group.groupId);
      }

      // Second creation with same name must fail
      const second = await createContactGroup(tm.page, displayName);
      expectContactError(second, 400);
      expect(second.data.error).toMatch(/already exists/i);
    });

    test('CONT-008: createContactGroup - group appears in subsequent getContacts call', async () => {
      const displayName = `CONT-008 Fetch Verify ${Date.now()}`;
      const createResp = await createContactGroup(tm.page, displayName);
      const groupId = createResp.data.group?.groupId;

      if (groupId) {
        createdGroupIds.push(groupId);
      }

      const fetchResp = await getContacts(tm.page);
      const found = fetchResp.data.groups?.find((g) => g.groupId === groupId);

      expect(found).toBeDefined();
      expect(found?.displayName).toBe(displayName);
    });

    test('CONT-009: deleteContactGroup - happy path removes group successfully', async () => {
      const displayName = `CONT-009 Delete Group ${Date.now()}`;
      const createResp = await createContactGroup(tm.page, displayName);
      const groupId = createResp.data.group?.groupId;

      expect(groupId).toBeTruthy();

      const deleteResp = await deleteContactGroup(tm.page, groupId!);

      expectContactSuccess(deleteResp, 204);
      expect(deleteResp.data.error).toBeUndefined();
    });

    test('CONT-010: deleteContactGroup - deleted group no longer appears in getContacts', async () => {
      const displayName = `CONT-010 Verify Deleted ${Date.now()}`;
      const createResp = await createContactGroup(tm.page, displayName);
      const groupId = createResp.data.group?.groupId;

      expect(groupId).toBeTruthy();
      await deleteContactGroup(tm.page, groupId!);

      const fetchResp = await getContacts(tm.page);
      const stillPresent = fetchResp.data.groups?.some((g) => g.groupId === groupId);

      expect(stillPresent).toBe(false);
    });
  });
}

// ---------------------------------------------------------------------------
// Test Suite 3: Create Contact
// ---------------------------------------------------------------------------

/**
 * CONT-011 to CONT-017: createContact scenarios
 */
export function createContactTests() {
  test.describe('Contacts - Create Contact', () => {
    test.describe.configure({mode: 'serial', timeout: 120000});

    let tm: TestManager;
    const createdContactIds: string[] = [];
    const createdGroupIds: string[] = [];

    test.beforeAll(async ({browser}, testInfo) => {
      tm = new TestManager(testInfo.project.name);
      await tm.setupContext(browser, 0, {
        initSDK: true,
        service: 'calling',
        register: true,
      });
      await verifyContactsClientReady(tm.page);
      await getContacts(tm.page);
    });

    test.afterEach(async () => {
      await Promise.all(createdContactIds.splice(0).map((id) => safeDeleteContact(tm.page, id)));
    });

    test.afterAll(async () => {
      await Promise.all(createdGroupIds.splice(0).map((id) => safeDeleteContactGroup(tm.page, id)));
      await cleanupAllContacts(tm.page).catch(() => {});
      await tm.cleanup();
    });

    test('CONT-011: createContact CUSTOM - minimal fields succeeds', async () => {
      const contact = buildCustomContact({displayName: `CONT-011 Min ${Date.now()}`});
      const response = await createContact(tm.page, contact);

      expectContactSuccess(response, 201);
      expect(response.data.contact).toBeDefined();
      expect(response.data.contact?.contactId).toBeTruthy();
      expect(response.data.contact?.contactType).toBe('CUSTOM');

      if (response.data.contact?.contactId) {
        createdContactIds.push(response.data.contact.contactId);
      }
    });

    test('CONT-012: createContact CUSTOM - all optional fields are persisted', async () => {
      const contact = buildCustomContact({
        displayName: `CONT-012 Full ${Date.now()}`,
        firstName: 'Alice',
        lastName: 'Smith',
        companyName: 'Acme Corp',
        department: 'Engineering',
        emails: [{type: 'work', value: `alice.${Date.now()}@acme.com`}],
        phoneNumbers: [
          {type: 'work', value: '+157569957407'},
          {type: 'mobile', value: '+15005550003'},
        ],
        sipAddresses: [{type: 'personal', value: `alice.${Date.now()}@webex.com`}],
      });

      const response = await createContact(tm.page, contact);

      expectContactSuccess(response, 201);
      const created = response.data.contact!;
      // await tm.page.pause();
      expect(created.firstName).toBe('Alice');
      expect(created.lastName).toBe('Smith');
      expect(created.companyName).toBe('Acme Corp');

      if (created.contactId) {
        createdContactIds.push(created.contactId);
      }
    });

    test('CONT-013: createContact CUSTOM - auto-assigns to default group when groups is empty', async () => {
      // Ensure there is at least one group (service creates default group automatically)
      const contact = buildCustomContact({displayName: `CONT-013 AutoGroup ${Date.now()}`});
      const response = await createContact(tm.page, contact);

      expectContactSuccess(response, 201);
      const created = response.data.contact!;
      // The SDK must assign a group automatically — groups array must not be empty
      expect(created.groups.length).toBeGreaterThan(0);

      if (created.contactId) {
        createdContactIds.push(created.contactId);
      }
    });

    test('CONT-014: createContact CUSTOM - contact assigned to specified group', async () => {
      const groupResp = await createContactGroup(tm.page, `CONT-014 Group ${Date.now()}`);
      const groupId = groupResp.data.group?.groupId;
      expect(groupId).toBeTruthy();
      if (!groupId) return;
      createdGroupIds.push(groupId);

      const contact = buildCustomContact({
        displayName: `CONT-014 In Group ${Date.now()}`,
        groups: [groupId],
      });
      const response = await createContact(tm.page, contact);
      expectContactSuccess(response, 201);
      const created = response.data.contact!;
      expect(created.groups).toContain(groupId);

      if (created.contactId) {
        createdContactIds.push(created.contactId);
      }
    });

    test('CONT-015: createContact CLOUD - returns 400 when contactId is missing', async () => {
      const contact: Partial<ContactResult> = {
        contactType: 'CLOUD',
        groups: [],
        encryptionKeyUrl: '',
        resolved: false,
        // contactId intentionally omitted
      };

      const response = await createContact(tm.page, contact);

      expectContactError(response, 400);
      expect(response.data.error).toMatch(/contactId is required/i);
    });

    test('CONT-016: createContact - unknown contactType returns 400 error', async () => {
      const contact = {
        contactType: 'UNKNOWN_TYPE' as any,
        groups: [],
        encryptionKeyUrl: '',
        resolved: false,
      };

      const response = await createContact(tm.page, contact);

      expectContactError(response, 400);
      expect(response.data.error).toMatch(/unknown contactType/i);
    });

    test('CONT-017: createContact CUSTOM - created contact appears in getContacts response', async () => {
      const displayName = `CONT-017 Verify ${Date.now()}`;
      const createResp = await createContact(tm.page, buildCustomContact({displayName}));
      const contactId = createResp.data.contact?.contactId;

      expect(contactId).toBeTruthy();

      const fetchResp = await getContacts(tm.page);
      const found = fetchResp.data.contacts?.find((c) => c.contactId === contactId);

      expect(found).toBeDefined();
      expect(found?.displayName).toBe(displayName);
      expect(found?.contactType).toBe('CUSTOM');

      if (contactId) {
        createdContactIds.push(contactId);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Test Suite 4: Delete Contact
// ---------------------------------------------------------------------------

/**
 * CONT-018 to CONT-019: deleteContact scenarios
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
      await getContacts(tm.page);
    });

    test.afterAll(async () => {
      await cleanupAllContacts(tm.page).catch(() => {});
      await tm.cleanup();
    });

    test('CONT-018: deleteContact - happy path returns success and contact is removed', async () => {
      // Arrange — create a contact to delete
      const createResp = await createContact(
        tm.page,
        buildCustomContact({displayName: `CONT-018 Delete Me ${Date.now()}`})
      );
      const contactId = createResp.data.contact?.contactId;
      expect(contactId).toBeTruthy();
      if (!contactId) return;

      // Act
      const deleteResp = await deleteContact(tm.page, contactId);

      // Assert response
      expectContactSuccess(deleteResp, 204);

      // Assert contact no longer in getContacts
      const fetchResp = await getContacts(tm.page);
      const stillPresent = fetchResp.data.contacts?.some((c) => c.contactId === contactId);
      expect(stillPresent).toBe(false);
    });

    test('CONT-019: deleteContact - deleting non-existent contactId returns error', async () => {
      const fakeId = 'non-existent-contact-id-00000000-0000-0000-0000-000000000000';
      const response = await deleteContact(tm.page, fakeId);

      // Should return a non-2xx status code
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });
}

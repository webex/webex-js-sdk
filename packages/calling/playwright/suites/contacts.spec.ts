/**
 * Contact supplementary service E2E tests.
 *
 * Covers: Contact List, Contact Group (create/delete), Create Contact,
 * Delete Contact, and full CRUD lifecycle flows.
 *
 * Account role is resolved from testInfo.project.name → USER_SETS (SET_CONTACTS).
 * Requires a single authenticated Webex Calling user with:
 *   - CONTACTS_USER_ACCESS_TOKEN (or CONTACTS_USER_INT_ACCESS_TOKEN for INT env)
 */
import {contactListTests} from '../test-groups/contacts';
import {contactGroupTests} from '../test-groups/contacts';
import {createContactTests} from '../test-groups/contacts';
import {deleteContactTests} from '../test-groups/contacts';

contactListTests();
contactGroupTests();
createContactTests();
deleteContactTests();

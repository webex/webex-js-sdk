import {ContactDetail} from '../common/types';

export enum ContactType {
  CUSTOM = 'CUSTOM',
  CLOUD = 'CLOUD',
}

export type AddressType = {
  city?: string;
  country?: string;
  state?: string;
  street?: string;
  zipCode?: string;
};

export type Contact = {
  addressInfo?: AddressType;
  avatarURL?: string;
  avatarUrlDomain?: string;
  companyName?: string;
  contactId?: string;
  contactType: ContactType;
  department?: string;
  displayName?: string;
  emails?: ContactDetail[];
  encryptionKeyUrl: string;
  firstName?: string;
  groups: string[];
  kmsResourceObjectUrl?: string;
  lastName?: string;
  manager?: string;
  ownerId?: string;
  phoneNumbers?: ContactDetail[];
  primaryContactMethod?: string;
  schemas?: string;
  sipAddresses?: ContactDetail[];
  title?: string;
};

export enum GroupType {
  NORMAL = 'NORMAL',
  EXTERNAL = 'EXTERNAL',
}

export type ContactGroup = {
  displayName: string;
  encryptionKeyUrl: string;
  groupId: string;
  groupType: GroupType;
  members?: string[];
  ownerId?: string;
};

export type ContactList = {
  contacts: Contact[];
  groups: ContactGroup[];
};

export type ContactResponse = {
  statusCode: number;
  data: {
    contacts?: Contact[];
    groups?: ContactGroup[];
    contact?: Contact;
    group?: ContactGroup;
    error?: string;
  };
  message: string | null;
};

/**
 * Interface for Contacts Module
 * This contains the APIs that allows to fetch, create and update the contacts and groups.
 *
 * To access these APIs, instance of ContactsClient is required.
 *
 * Example
 * ```javascript
 * const contactClient = createContactClient(webex, logger);
 * ```
 */
export interface IContacts {
  /**
   * This API is used to fetch the list of contacts and groups for a user.
   *
   * Example
   * ```javascript
   * const contactsResponse = await contactClient.getContacts();
   * ```
   *
   * The contactsResponse object will have the list of contacts and groups
   * Each contact object will have properties as mentioned in Contact
   * Each group object will have properties as mentioned in ContactGroup
   *
   * Example - Contact
   * ```json
   * {
   *  addressInfo: {
   *    city: 'Test City',
   *    country: 'Test Country',
   *    state: 'Test State',
   *    street: 'Test Street',
   *    zipCode: '123456'
   *  },
   *  avatarURL: 'https://avatarURL',
   *  avatarUrlDomain: 'https://avatarUrlDomain',
   *  companyName: 'Test Company',
   *  contactId: '1234567890',
   *  contactType: 'CUSTOM',
   *  department: 'Test Department',
   *  displayName: 'Test User',
   *  emails: [],
   *  encryptionKeyUrl: 'https://encryptionKeyUrl',
   *  firstName: 'Test',
   *  groups: [],
   *  kmsResourceObjectUrl: 'https://kmsResourceObjectUrl',
   *  lastName: 'User',
   *  manager: 'Test Manager',
   *  ownerId: '1234567890',
   *  phoneNumbers: [],
   *  primaryContactMethod: 'Test Contact Method',
   *  schemas: 'Test Schema',
   *  sipAddresses: [],
   *  title: 'Test Title'
   * }
   * ```
   *
   *  Example - ContactGroup
   * ```json
   * {
   *  displayName: 'Test Group',
   *  encryptionKeyUrl: 'https://encryptionKeyUrl',
   *  groupId: '1234567890',
   *  groupType: 'NORMAL',
   *  members: [],
   *  ownerId: '1234567890'
   * }
   * ```
   */
  getContacts: () => Promise<ContactResponse>;

  /**
   * This API is used to create a contact group with the given display name.
   *
   * Example
   * ```javascript
   * const contactGroup = await contactClient.createContactGroup(displayName, encryptionKeyUrl, groupType);
   * ```
   *
   * The contactGroup object for the given display name will be created and returned as a response with the properties of ContactGroup.
   *
   * Example - ContactGroup
   * ```json
   * {
   *  displayName: 'Test Group',
   *  encryptionKeyUrl: 'https://encryptionKeyUrl',
   *  groupId: '1234567890',
   *  groupType: 'NORMAL',
   *  members: [],
   *  ownerId: '1234567890'
   * }
   * ```
   */
  createContactGroup: (
    displayName: string,
    encryptionKeyUrl?: string,
    groupType?: GroupType
  ) => Promise<ContactResponse>;

  /**
   * This API is used to delete a contact group whose gorupId is received.
   *
   * Example
   * ```javascript
   * const response = await contactClient.deleteContactGroup(groupId);
   * ```
   * The response received contains the status code and message based on the success or failure of the API call.
   */
  deleteContactGroup: (groupId: string) => Promise<ContactResponse>;

  /**
   * This API is responsible for creating a new contact.
   * Example
   * ```javascript
   * const contact = await contactClient.createContact(contactInfo);
   * ```
   */
  createContact: (contactInfo: Contact) => Promise<ContactResponse>;

  /**
   * This API is responsible for deleting an existing contact for the given contactId.
   * Example
   * ```javascript
   * const response = await contactClient.deleteContact(contactId);
   * ```
   * The response received contains the status code and message based on the success or failure of the API call.
   */
  deleteContact: (contactId: string) => Promise<ContactResponse>;
}

export type ContactIdContactInfo = {
  [Key: string]: Contact;
};

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
 * Interface for Contacts Module.
 * This encompasses a set of APIs that enable the fetching, creation, and updating of contacts and groups.
 * These APIs return promises that resolve to a `ContactResponse` object, which contains a status code, data, and message.
 * The data field within this response object holds the contacts and groups object.
 *
 * Example - ContactResponse
 *
 * ```json
 * {
 *  statusCode: 200,
 *  data: {
 *    contacts: Contact[],
 *    groups: ContactGroup[],
 *  },
 *  message: null
 * }
 * ````
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
   * The `ContactsResponse` object contains a comprehensive list of both contacts and groups for the user.
   * Each `Contact` object within this list is defined by the properties detailed in the {@link Contact}.
   * Each `ContactGroup` adheres to the properties specified in the {@link ContactGroup}.
   *
   */
  getContacts(): Promise<ContactResponse>;

  /**
   * This API is used to create a contact group with the given display name.
   *
   * Example
   * ```javascript
   * const contactGroup = await contactClient.createContactGroup(displayName, encryptionKeyUrl, groupType);
   * ```
   *
   * The `ContactGroup` object for the given display name will be created and returned as a response with the properties of {@link ContactGroup}.
   */
  createContactGroup(
    displayName: string,
    encryptionKeyUrl?: string,
    groupType?: GroupType
  ): Promise<ContactResponse>;

  /**
   * This API is used to delete a contact group whose groupId is received.
   *
   * Example
   * ```javascript
   * const response = await contactClient.deleteContactGroup(groupId);
   * ```
   *
   * The received response includes a status code and a message that reflect the success or failure of the API call
   */
  deleteContactGroup(groupId: string): Promise<ContactResponse>;

  /**
   * This API is responsible for creating a new contact.
   *
   * Example
   * ```javascript
   * const contact = await contactClient.createContact(contactInfo);
   * ```
   */
  createContact(contactInfo: Contact): Promise<ContactResponse>;

  /**
   * This API is responsible for deleting an existing contact for the given contactId.
   *
   * Example
   * ```javascript
   * const response = await contactClient.deleteContact(contactId);
   * ```
   *
   * The received response includes a status code and a message that reflect the success or failure of the API call
   */
  deleteContact(contactId: string): Promise<ContactResponse>;
}

export type ContactIdContactInfo = {
  [Key: string]: Contact;
};

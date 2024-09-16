import {ISDKConnector} from '../SDKConnector/types';
import {Address, PhoneNumber, URIAddress} from '../common/types';

export enum ContactType {
  CUSTOM = 'CUSTOM',
  CLOUD = 'CLOUD',
}

/**
 * `Contact` object is used to represent a contact.
 */
export type Contact = {
  /**
   * This represents the complete address of the contact.
   */
  addressInfo?: Address;
  /**
   * This represents the URL of the avatar of the contact.
   */
  avatarURL?: string;
  /**
   * This represents the domain of the avatar of the contact.
   */
  avatarUrlDomain?: string;
  /**
   * This represents the company name of the contact.
   */
  companyName?: string;
  /**
   * Unique identifier of the contact.
   */
  contactId: string;
  /**
   * Indicates the type of the contact, can be `CLOUD` or `CUSTOM`.
   */
  contactType: ContactType;
  /**
   * Department of the contact in the company if it's a corporate contact.
   */
  department?: string;
  /**
   * This represents the display name of the contact.
   */
  displayName?: string;
  /**
   * This represents the array of different email addresses of the contact.
   */
  emails?: URIAddress[];
  /**
   * This is encrypted key url of the contact used for encryption.
   */
  encryptionKeyUrl: string;
  /**
   * This represents the first name of the contact.
   */
  firstName?: string;
  /**
   * Array of different groups and it's details available for the user
   */
  groups: string[];
  /**
   * The kms resource object url used to generate the encryption key.
   */
  kmsResourceObjectUrl?: string;
  /**
   * This represents the last name of the contact.
   */
  lastName?: string;
  /**
   * This represents the manager of the contact.
   */
  manager?: string;
  /**
   * Userd ID of the user who has the contact.
   */
  ownerId?: string;
  /**
   * This represents the array of different phone numbers of the contact.
   */
  phoneNumbers?: PhoneNumber[];
  /**
   * Primary contact method as set by the contact.
   */
  primaryContactMethod?: string;
  /**
   * This represents the schema of the contact.
   */
  schemas?: string;
  /**
   * This represents the array of different sip addresses of the contact.
   */
  sipAddresses?: URIAddress[];
  /**
   * This represents the job title of the contact.
   */
  title?: string;
};

export enum GroupType {
  NORMAL = 'NORMAL',
  EXTERNAL = 'EXTERNAL',
}

/**
 * `ContactGroup` object is used to represent a contact group.
 */
export type ContactGroup = {
  /**
   * Name of the contact group.
   */
  displayName: string;
  /**
   * Encrypted key url used for encryption.
   */
  encryptionKeyUrl: string;
  /**
   * Unique identifier of the contact group.
   */
  groupId: string;
  /**
   * Type of the contact group, can be `NORMAL` or `EXTERNAL`.
   */
  groupType: GroupType;
  /**
   * String array containing details of the contacts in each group.
   */
  members?: string[];
  /**
   * User ID of the user who owns the contact group.
   */
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
  getSDKConnector: () => ISDKConnector;
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

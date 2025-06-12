export const CONTACTS_FILE = 'Contacts';
export const CONTACT_FILTER = 'contacts';
export const GROUP_FILTER = 'groups';
export const ENCRYPT_FILTER = 'encrypt';
export const USERS = 'Users';
export const DEFAULT_GROUP_NAME = 'Other contacts';
export const CONTACTS_SCHEMA = 'urn:cisco:codev:identity:contact:core:1.0';
export const SCIM_ID_FILTER = 'id eq';
export const OR = ' or ';

export enum encryptedFields {
  ADDRESS_INFO = 'addressInfo',
  AVATAR_URL = 'avatarURL',
  COMPANY = 'companyName',
  DISPLAY_NAME = 'displayName',
  EMAILS = 'emails',
  FIRST_NAME = 'firstName',
  LAST_NAME = 'lastName',
  PHONE_NUMBERS = 'phoneNumbers',
  SIP_ADDRESSES = 'sipAddresses',
  TITLE = 'title',
}

export const METHODS = {
  GET_CONTACTS: 'getContacts',
  CREATE_NEW_ENCRYPTION_KEY_URL: 'createNewEncryptionKeyUrl',
  FETCH_ENCRYPTION_KEY_URL: 'fetchEncryptionKeyUrl',
  FETCH_DEFAULT_GROUP: 'fetchDefaultGroup',
  CREATE_CONTACT_GROUP: 'createContactGroup',
  DELETE_CONTACT_GROUP: 'deleteContactGroup',
  CREATE_CONTACT: 'createContact',
  DELETE_CONTACT: 'deleteContact',
};

import {ISDKConnector} from '../SDKConnector/types';

export enum ContactType {
  CUSTOM = 'CUSTOM',
  CLOUD = 'CLOUD',
}

export interface LookupOptions {
  ids: string[];
}

export type AddressType = {
  city?: string;
  country?: string;
  state?: string;
  street?: string;
  zipCode?: string;
};

export type ContactDetail = {
  type?: string;
  value: string;
};

export type Contact = {
  addressInfo?: AddressType;
  avatarUrlDomain: string;
  companyName?: string;
  contactId: string;
  contactType: ContactType;
  department?: string;
  displayName: string;
  encryptionKeyUrl: string;
  emails?: ContactDetail[];
  firstName?: string;
  groups: string[];
  lastName?: string;
  ownerId: string;
  manager?: string;
  phoneNumbers?: ContactDetail[];
  sipAddresses?: ContactDetail[];
  title?: string;
};

export type ContactList = {
  contacts: Contact[];
};

export type ContactResponse = {
  statusCode: number;
  data: {
    contactList?: Contact[];
    error?: string;
  };
  message: string;
};

export interface IContacts {
  getSDKConnector: () => ISDKConnector;
  getContacts: () => Promise<ContactResponse>;
}

export type DSSLookupResponse = {
  additionalInfo: {
    department: string;
    firstName: string;
    identityManager: {
      managerId: string;
      displayName: string;
    };
    jobTitle: string;
    lastName: string;
  };
  displayName: string;
  emails: ContactDetail[];
  entityProviderType: string;
  identity: string;
  orgId: string;
  phoneNumbers: ContactDetail[];
  photos: ContactDetail[];
  sipAddresses: ContactDetail[];
  type: string;
};

export type ContactIdGroupInfoMap = {
  [Key: string]: string[];
};

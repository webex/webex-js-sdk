import {ContactDetail, ISDKConnector} from '../SDKConnector/types';

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

export type ContactIdGroupInfoMap = {
  [Key: string]: string[];
};

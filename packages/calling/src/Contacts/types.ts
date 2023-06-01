import {ContactDetail} from '../common/types';
import {ISDKConnector} from '../SDKConnector/types';

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

export interface IContacts {
  getSDKConnector: () => ISDKConnector;
  getContacts: () => Promise<ContactResponse>;
  createContactGroup: (
    displayName: string,
    encryptionKeyUrl?: string,
    groupType?: GroupType
  ) => Promise<ContactResponse>;
  deleteContactGroup: (groupId: string) => Promise<ContactResponse>;
  createContact: (contactInfo: Contact) => Promise<ContactResponse>;
  deleteContact: (contactId: string) => Promise<ContactResponse>;
}

export type ContactIdContactInfo = {
  [Key: string]: Contact;
};

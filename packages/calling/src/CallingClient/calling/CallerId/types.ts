import {CallerIdInfo} from '../../../Events/types';
import {DisplayInformation, PhoneNumber} from '../../../common/types';

export type EmailType = {
  primary: boolean;
  type: string;
  value: string;
};

export type SipAddressType = {
  type: string;
  value: string;
  primary?: boolean;
};

export type PhotoType = {
  type: string;
  value: string;
};

export type ResourceType = {
  userName: string;
  emails: Array<EmailType>;
  name: {
    givenName: string;
    familyName: string;
  };
  phoneNumbers: Array<PhoneNumber>;
  entitlements: Array<string>;
  id: string;
  photos: Array<PhotoType>;
  displayName: string;
  active: boolean;
  sipAddresses: Array<SipAddressType>;
};

/* The scim response has many fields , dropping few of them as they are not to be consumed by us */
export type scimResponseBody = {
  totalResults: number;
  itemsPerPage: number;
  startIndex: number;
  schemas: Array<string>;
  Resources: Array<ResourceType>;
};

export interface ICallerId {
  fetchCallerDetails: (callerId: CallerIdInfo) => DisplayInformation;
}

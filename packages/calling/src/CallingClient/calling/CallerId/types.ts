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

/**
 * Represents the interface for fetching caller ID details.
 */
export interface ICallerId {
  /**
   * Fetches caller ID details based on the provided caller ID information.
   *
   * This method takes a {@link CallerIdInfo} object as input and performs caller ID
   * resolution in the background, returning a {@link DisplayInformation} object
   * containing intermediate name and number.
   *
   * @param callerId - Caller ID data passed to the method.
   *
   * @remarks
   * The `fetchCallerDetails` method is the main entrypoint for retrieving
   * caller ID information. It initiates the caller ID resolution process
   * based on the provided {@link CallerIdInfo} and returns the result as
   * {@link DisplayInformation}.
   *
   * @example
   * ```typescript
   * const callerIdInfo: CallerIdInfo = { callerIdData };
   * const displayInfo = callerIdInstance.fetchCallerDetails(callerIdInfo);
   * console.log(`Name: ${displayInfo.name}, Number: ${displayInfo.number}`);
   * ```
   */
  fetchCallerDetails: (callerId: CallerIdInfo) => DisplayInformation;
}

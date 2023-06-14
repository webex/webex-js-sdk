/* eslint-disable no-await-in-loop */
import {STATUS_CODE, SUCCESS_MESSAGE} from '../common/constants';
import {HTTP_METHODS, WebexRequestPayload} from '../common/types';
import {ISDKConnector, WebexSDK} from '../SDKConnector/types';
import SDKConnector from '../SDKConnector';

import log from '../Logger';
import {CONTACTS_FILE, CONTACT_FILTER, ENCRYPT_FILTER, USERS} from './constants';
import {
  Contact,
  ContactIdGroupInfoMap,
  ContactList,
  ContactResponse,
  ContactType,
  IContacts,
} from './types';
import {serviceErrorCodeHandler} from '../common/Utils';
import {LoggerConfig} from '../Calling/types';

/**
 *
 */
export class ContactsClient implements IContacts {
  private sdkConnector: ISDKConnector;

  private webex: WebexSDK;

  /**
   * @param webex - A webex instance.
   * @param logger - Logger to set logger level.
   */
  constructor(logger: LoggerConfig) {
    this.sdkConnector = SDKConnector;

    // if (!this.sdkConnector.getWebex()) {
    //   SDKConnector.setWebex(webex);
    // }

    this.webex = this.sdkConnector.getWebex();

    log.setLogger(logger.level);
  }

  /**
   * SDK connector function.
   *
   * Returns SdkConnector.
   */
  public getSDKConnector(): ISDKConnector {
    return this.sdkConnector;
  }

  /**
   * @param contact - Encrypted contact object.
   * @param avatarUrlDomain - Avatar Url.
   * @param encryptionKeyUrl - Encryption key received from KMS.
   * @param ownerId - OwnerId.
   * @returns Promise for decrypted contact object.
   */
  private async decryptContact(
    contact: Contact,
    avatarUrlDomain: string,
    encryptionKeyUrl: string,
    ownerId: string
  ): Promise<Contact> {
    const {
      addressInfo,
      companyName,
      displayName,
      emails,
      firstName,
      lastName,
      phoneNumbers,
      sipAddresses,
      title,
    } = contact;
    let decryptedCompanyName;
    let decryptedFirstName;
    let decryptedLastName;
    let decryptedTitle;

    if (addressInfo) {
      // eslint-disable-next-line prefer-const
      for (let [key, value] of Object.entries(addressInfo)) {
        if (value) {
          value = await this.webex.internal.encryption.decryptText(encryptionKeyUrl, value);
        }
        addressInfo[key] = value;
      }
    }

    if (companyName) {
      decryptedCompanyName = await this.webex.internal.encryption.decryptText(
        encryptionKeyUrl,
        companyName
      );
    }

    const decryptedDisplayName = await this.webex.internal.encryption.decryptText(
      encryptionKeyUrl,
      displayName
    );

    if (firstName) {
      decryptedFirstName = await this.webex.internal.encryption.decryptText(
        encryptionKeyUrl,
        firstName
      );
    }

    if (lastName) {
      decryptedLastName = await this.webex.internal.encryption.decryptText(
        encryptionKeyUrl,
        lastName
      );
    }

    if (emails) {
      for (let i = 0; i < emails.length; i += 1) {
        const email = emails[i].value;

        emails[i].value = await this.webex.internal.encryption.decryptText(encryptionKeyUrl, email);
      }
    }

    if (phoneNumbers) {
      for (let i = 0; i < phoneNumbers.length; i += 1) {
        const number = phoneNumbers[i].value;

        phoneNumbers[i].value = await this.webex.internal.encryption.decryptText(
          encryptionKeyUrl,
          number
        );
      }
    }

    if (sipAddresses) {
      for (let i = 0; i < sipAddresses.length; i += 1) {
        const sipAddress = sipAddresses[i].value;

        sipAddresses[i].value = await this.webex.internal.encryption.decryptText(
          encryptionKeyUrl,
          sipAddress
        );
      }
    }

    if (title) {
      decryptedTitle = await this.webex.internal.encryption.decryptText(encryptionKeyUrl, title);
    }

    const decryptedContact = {
      addressInfo,
      avatarUrlDomain,
      companyName: decryptedCompanyName,
      contactId: contact.contactId,
      contactType: ContactType.CUSTOM,
      displayName: decryptedDisplayName,
      emails,
      encryptionKeyUrl,
      firstName: decryptedFirstName,
      groups: contact.groups,
      lastName: decryptedLastName,
      ownerId,
      phoneNumbers,
      sipAddresses,
      title: decryptedTitle,
    };

    return decryptedContact;
  }

  /**
   * @param contact - Contact object.
   * @param contactGroupData - Object with contactId as key and value with group info for corresponding contact.
   * @param avatarUrlDomain - Avatar Url.
   * @param encryptionKeyUrl - Encryption key received from KMS.
   * @param ownerId - OwnerId.
   * @returns Array of contact detail fetched from DSS.
   */
  private async fetchContactFromDSS(
    contactGroupData: ContactIdGroupInfoMap,
    avatarUrlDomain: string,
    encryptionKeyUrl: string,
    ownerId: string
  ): Promise<Contact[]> {
    const contactList = [];
    const dssResult = await this.webex.internal.dss.lookup({ids: Object.keys(contactGroupData)});

    for (let i = 0; i < dssResult.length; i += 1) {
      const contact = dssResult[i];
      const contactId = contact.identity;
      const {displayName, emails, phoneNumbers, sipAddresses} = contact;
      const {department, firstName, identityManager, jobTitle, lastName} = contact.additionalInfo;
      const manager =
        identityManager && identityManager.displayName ? identityManager.displayName : undefined;

      const cloudContact = {
        avatarUrlDomain,
        contactId,
        contactType: ContactType.CLOUD,
        department,
        displayName,
        emails,
        encryptionKeyUrl,
        firstName,
        groups: contactGroupData[contactId],
        lastName,
        manager,
        ownerId,
        phoneNumbers,
        sipAddresses,
        title: jobTitle,
      };

      contactList.push(cloudContact);
    }

    return contactList;
  }

  /**
   * Returns list of contacts.
   */
  public async getContacts(): Promise<ContactResponse> {
    const loggerContext = {
      file: CONTACTS_FILE,
      method: 'getContacts',
    };

    const contactList: Contact[] = [];
    const contactGroupData: ContactIdGroupInfoMap = {};
    let avatarUrlDomain = '';
    let encryptionKeyUrl = '';
    let ownerId = '';

    try {
      const response = <WebexRequestPayload>await this.webex.request({
        // eslint-disable-next-line no-underscore-dangle
        uri: `${this.webex.internal.services._serviceUrls.contactsService}/${ENCRYPT_FILTER}/${USERS}/${CONTACT_FILTER}`,
        method: HTTP_METHODS.GET,
      });

      const responseBody = response.body as ContactList;

      if (!responseBody) {
        throw new Error(`${response}`);
      }

      const {contacts} = responseBody;

      for (let i = 0; i < contacts.length; i += 1) {
        const contact = contacts[i];

        ({avatarUrlDomain, encryptionKeyUrl, ownerId} = contact);

        if (contact.contactType === ContactType.CUSTOM) {
          const decryptedContact = await this.decryptContact(
            contact,
            avatarUrlDomain,
            encryptionKeyUrl,
            ownerId
          );

          contactList.push(decryptedContact);
        } else if (contact.contactType === ContactType.CLOUD) {
          const {contactId, groups} = contact;

          contactGroupData[contactId] = groups;
        }
      }

      if (Object.keys(contactGroupData).length) {
        const cloudContacts = await this.fetchContactFromDSS(
          contactGroupData,
          avatarUrlDomain,
          encryptionKeyUrl,
          ownerId
        );

        contactList.push(...cloudContacts);
      }

      const contactResponse: ContactResponse = {
        statusCode: response[STATUS_CODE] as number,
        data: {
          contactList,
        },
        message: SUCCESS_MESSAGE,
      };

      return contactResponse;
    } catch (err: unknown) {
      const errorInfo = err as WebexRequestPayload;
      const errorStatus = serviceErrorCodeHandler(errorInfo, loggerContext);

      return errorStatus;
    }
  }
}

/**
 * @param webex - A webex instance.
 * @param logger - Logger to set logger level.
 */
export const createContactsClient = (logger: LoggerConfig): IContacts =>
  new ContactsClient(logger);

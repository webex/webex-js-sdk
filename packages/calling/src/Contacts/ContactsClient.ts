/* eslint-disable no-await-in-loop */
import {
  FAILURE_MESSAGE,
  SCIM_ENTERPRISE_USER,
  SCIM_WEBEXIDENTITY_USER,
  STATUS_CODE,
  SUCCESS_MESSAGE,
} from '../common/constants';
import {HTTP_METHODS, WebexRequestPayload, ContactDetail, SCIMListResponse} from '../common/types';
import {LoggerInterface} from '../Voicemail/types';
import {ISDKConnector, WebexSDK} from '../SDKConnector/types';
import SDKConnector from '../SDKConnector';

import log from '../Logger';
import {
  CONTACTS_FILE,
  CONTACTS_SCHEMA,
  CONTACT_FILTER,
  DEFAULT_GROUP_NAME,
  ENCRYPT_FILTER,
  GROUP_FILTER,
  OR,
  SCIM_ID_FILTER,
  USERS,
  encryptedFields,
} from './constants';
import {
  Contact,
  ContactIdContactInfo,
  ContactList,
  ContactResponse,
  ContactType,
  IContacts,
  ContactGroup,
  GroupType,
} from './types';

import {scimQuery, serviceErrorCodeHandler} from '../common/Utils';

/**
 * `ContactsClient` module is designed to offer a set of APIs for retrieving and updating contacts and groups from the contacts-service.
 *
 * This code snippet demonstrates how to create an instance of `ContactClient` using webex and logger.
 *
 * Example
 * ```javascript
 * const contactClient = createContactsClient(webex, logger);
 * ```
 */
export class ContactsClient implements IContacts {
  private sdkConnector: ISDKConnector;

  private encryptionKeyUrl: string;

  private webex: WebexSDK;

  private groups: ContactGroup[] | undefined;

  private contacts: Contact[] | undefined;

  private defaultGroupId: string;

  /**
   * @ignore
   */
  constructor(webex: WebexSDK, logger: LoggerInterface) {
    this.sdkConnector = SDKConnector;

    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }

    this.webex = this.sdkConnector.getWebex();

    this.encryptionKeyUrl = '';
    this.groups = undefined;
    this.contacts = undefined;
    this.defaultGroupId = '';

    log.setLogger(logger.level, CONTACTS_FILE);
  }

  /**
   * Decrypt emails, phoneNumbers, sipAddresses.
   */
  private async decryptContactDetail(
    encryptionKeyUrl: string,
    contactDetails: ContactDetail[]
  ): Promise<ContactDetail[]> {
    const decryptedContactDetail = [...contactDetails];

    const decryptedValues = await Promise.all(
      decryptedContactDetail.map((detail) =>
        this.webex.internal.encryption.decryptText(encryptionKeyUrl, detail.value)
      )
    );

    decryptedValues.forEach((decryptedValue, index) => {
      decryptedContactDetail[index].value = decryptedValue;
    });

    return decryptedContactDetail;
  }

  /**
   * Encrypt emails, phoneNumbers, sipAddresses.
   *
   */
  private async encryptContactDetail(
    encryptionKeyUrl: string,
    contactDetails: ContactDetail[]
  ): Promise<ContactDetail[]> {
    const encryptedContactDetail = [...contactDetails];

    const encryptedValues = await Promise.all(
      encryptedContactDetail.map((detail) =>
        this.webex.internal.encryption.encryptText(encryptionKeyUrl, detail.value)
      )
    );

    encryptedValues.forEach((encryptedValue, index) => {
      encryptedContactDetail[index].value = encryptedValue;
    });

    return encryptedContactDetail;
  }

  /**
   * Encrypts a given contact.
   */
  private async encryptContact(contact: Contact): Promise<Contact> {
    const {encryptionKeyUrl} = contact;
    const encryptedContact: Contact = {...contact};

    const encryptionPromises = Object.values(encryptedFields).map(async (field) => {
      switch (field) {
        case encryptedFields.ADDRESS_INFO: {
          const plaintextAddressInfo = encryptedContact.addressInfo;
          let encryptedAddressInfo;

          if (plaintextAddressInfo) {
            const encryptedAddressInfoPromises = Object.entries(plaintextAddressInfo).map(
              async ([key, value]) => [
                key,
                await this.webex.internal.encryption.encryptText(encryptionKeyUrl, value),
              ]
            );

            encryptedAddressInfo = Object.fromEntries(
              await Promise.all(encryptedAddressInfoPromises)
            );
          }

          return [field, encryptedAddressInfo];
        }
        case encryptedFields.EMAILS:
        case encryptedFields.PHONE_NUMBERS:
        case encryptedFields.SIP_ADDRESSES: {
          const plainTextDetails = encryptedContact[field];
          let encryptedDetails;

          if (plainTextDetails) {
            encryptedDetails = await this.encryptContactDetail(encryptionKeyUrl, plainTextDetails);
          }

          return [field, encryptedDetails];
        }
        default: {
          let encryptedValue;

          if (Object.values(encryptedFields).includes(field) && encryptedContact[field]) {
            encryptedValue = await this.webex.internal.encryption.encryptText(
              encryptionKeyUrl,
              encryptedContact[field]
            );
          }

          return [field, encryptedValue];
        }
      }
    });

    const encryptedFieldsList = await Promise.all(encryptionPromises);

    encryptedFieldsList.forEach(([field, value]) => {
      if (value !== undefined) {
        encryptedContact[field] = value;
      }
    });

    return encryptedContact;
  }

  /**
   * Decrypts a given contact.
   */
  private async decryptContact(contact: Contact): Promise<Contact> {
    const {encryptionKeyUrl} = contact;
    const decryptedContact: Contact = {...contact};

    const decryptionPromises = Object.values(encryptedFields).map(async (field) => {
      switch (field) {
        case encryptedFields.ADDRESS_INFO: {
          const plaintextAddressInfo = decryptedContact.addressInfo;
          let decryptedAddressInfo;

          if (plaintextAddressInfo) {
            const decryptedAddressInfoPromises = Object.entries(plaintextAddressInfo).map(
              async ([key, value]) => [
                key,
                await this.webex.internal.encryption.decryptText(encryptionKeyUrl, value),
              ]
            );

            decryptedAddressInfo = Object.fromEntries(
              await Promise.all(decryptedAddressInfoPromises)
            );
          }

          return [field, decryptedAddressInfo];
        }
        case encryptedFields.EMAILS:
        case encryptedFields.PHONE_NUMBERS:
        case encryptedFields.SIP_ADDRESSES: {
          const plainTextDetails = decryptedContact[field];
          let decryptedDetails;

          if (plainTextDetails) {
            decryptedDetails = await this.decryptContactDetail(encryptionKeyUrl, plainTextDetails);
          }

          return [field, decryptedDetails];
        }
        default: {
          let decryptedValue;

          if (Object.values(encryptedFields).includes(field) && decryptedContact[field]) {
            decryptedValue = await this.webex.internal.encryption.decryptText(
              encryptionKeyUrl,
              decryptedContact[field]
            );
          }

          return [field, decryptedValue];
        }
      }
    });

    const decryptedFieldsList = await Promise.all(decryptionPromises);

    decryptedFieldsList.forEach(([field, value]) => {
      if (value !== undefined) {
        decryptedContact[field] = value;
      }
    });

    return decryptedContact;
  }

  private resolveCloudContacts(
    contactsDataMap: ContactIdContactInfo,
    inputList: SCIMListResponse
  ): Contact[] | null {
    const loggerContext = {
      file: CONTACTS_FILE,
      method: 'resolveCloudContacts',
    };
    const finalContactList: Contact[] = [];

    try {
      for (let n = 0; n < inputList.Resources.length; n += 1) {
        const filteredContact = inputList.Resources[n];
        const {displayName, emails, phoneNumbers, photos} = filteredContact;
        let sipAddresses;
        if (filteredContact[SCIM_WEBEXIDENTITY_USER]) {
          sipAddresses = filteredContact[SCIM_WEBEXIDENTITY_USER].sipAddresses;
        }
        const firstName = filteredContact.name?.givenName;
        const lastName = filteredContact.name?.familyName;
        const manager = filteredContact[SCIM_ENTERPRISE_USER]?.manager?.displayName;
        const department = filteredContact[SCIM_ENTERPRISE_USER]?.department;
        const avatarURL = photos?.length ? photos[0].value : '';

        const {contactType, avatarUrlDomain, encryptionKeyUrl, ownerId, groups} =
          contactsDataMap[inputList.Resources[n].id];

        const cloudContact = {
          avatarUrlDomain,
          avatarURL,
          contactId: inputList.Resources[n].id,
          contactType,
          department,
          displayName,
          emails,
          encryptionKeyUrl,
          firstName,
          groups,
          lastName,
          manager,
          ownerId,
          phoneNumbers,
          sipAddresses,
        };

        finalContactList.push(cloudContact);
      }
    } catch (error: any) {
      log.warn('Error occurred while parsing resolved contacts', loggerContext);

      return null;
    }

    return finalContactList;
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
    const cloudContactsMap: ContactIdContactInfo = {};

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

      const {contacts, groups} = responseBody;

      contacts.map(async (contact) => {
        if (contact.contactType === ContactType.CUSTOM) {
          const decryptedContact = await this.decryptContact(contact);

          contactList.push(decryptedContact);
        } else if (contact.contactType === ContactType.CLOUD && contact.contactId) {
          cloudContactsMap[contact.contactId] = contact;
        }
      });

      // Resolve cloud contacts
      if (Object.keys(cloudContactsMap).length) {
        const contactIdList = Object.keys(cloudContactsMap);
        const query = contactIdList.map((item) => `${SCIM_ID_FILTER} "${item}"`).join(OR);
        const result = await scimQuery(query);
        const resolvedContacts = this.resolveCloudContacts(
          cloudContactsMap,
          result.body as SCIMListResponse
        );
        if (resolvedContacts) {
          resolvedContacts.map((item) => contactList.push(item));
        }
      }

      await Promise.all(
        groups.map(async (group, idx) => {
          groups[idx].displayName = await this.webex.internal.encryption.decryptText(
            group.encryptionKeyUrl,
            group.displayName
          );
        })
      );

      this.groups = groups;
      this.contacts = contactList;
      const contactResponse: ContactResponse = {
        statusCode: Number(response[STATUS_CODE]),
        data: {
          contacts: contactList,
          groups,
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

  /**
   * Creates a new KMS Resource Object (KRO) and Content Key (CK) which is used for encryption.
   *
   * @returns EncryptionKeyUrl as a Promise.
   */
  private async createNewEncryptionKeyUrl(): Promise<string> {
    const loggerContext = {
      file: CONTACTS_FILE,
      method: this.createNewEncryptionKeyUrl.name,
    };

    let unboundedKeyUri = '';

    log.info('Requesting kms for a new KRO and key', loggerContext);
    const unboundedKeys = await this.webex.internal.encryption.kms.createUnboundKeys({count: 1});

    unboundedKeyUri = unboundedKeys[0].uri;
    this.webex.internal.encryption.kms.createResource({keyUris: [unboundedKeyUri]});

    return unboundedKeyUri;
  }

  /**
   * Fetches the encryptionKeyUrl from one of the groups. Creates a new key and default group if there is no data.
   *
   * @returns EncryptionKeyUrl as a Promise.
   */
  private async fetchEncryptionKeyUrl(): Promise<string> {
    if (this.encryptionKeyUrl) {
      return this.encryptionKeyUrl;
    }
    // istanbul ignore else
    if (this.groups === undefined) {
      this.getContacts();
    }
    // istanbul ignore else
    if (this.groups && this.groups.length) {
      /** Use the encryptionKeyUrl of any one of the groups */
      return this.groups[0].encryptionKeyUrl;
    }

    this.encryptionKeyUrl = await this.createNewEncryptionKeyUrl();
    log.info(`Creating a default group: ${DEFAULT_GROUP_NAME}`, {
      file: CONTACTS_FILE,
      method: this.fetchEncryptionKeyUrl.name,
    });
    const response: ContactResponse = await this.createContactGroup(
      DEFAULT_GROUP_NAME,
      this.encryptionKeyUrl
    );

    if (response.data.group?.groupId) {
      this.defaultGroupId = response.data.group?.groupId;
    }

    return this.encryptionKeyUrl;
  }

  /**
   * Fetches a default group.
   *
   * @returns GroupId of default group.
   */
  private async fetchDefaultGroup(): Promise<string> {
    if (this.defaultGroupId) {
      return this.defaultGroupId;
    }

    /* Check the groups list and determine the defaultGroupId */
    if (this.groups && this.groups.length) {
      for (let i = 0; i < this.groups.length; i += 1) {
        if (this.groups[i].displayName === DEFAULT_GROUP_NAME) {
          this.defaultGroupId = this.groups[i].groupId;

          return this.defaultGroupId;
        }
      }
    }

    log.info('No default group found.', {
      file: CONTACTS_FILE,
      method: this.fetchDefaultGroup.name,
    });

    const response: ContactResponse = await this.createContactGroup(DEFAULT_GROUP_NAME);

    const {group} = response.data;

    if (group) {
      return group.groupId;
    }

    return '';
  }

  /**
   * Creates a personal contact group.
   * Also creates a KRO, if there aren't any groups.
   * @param displayName - Name of the group to create.
   * @param encryptionKeyUrl - EncryptionKeyUrl to encrypt the displayName.
   * @param groupType - Type of the group to create.
   */
  public async createContactGroup(
    displayName: string,
    encryptionKeyUrl?: string,
    groupType?: GroupType
  ): Promise<ContactResponse> {
    const loggerContext = {
      file: CONTACTS_FILE,
      method: this.createContactGroup.name,
    };

    log.info(`Creating contact group ${displayName}`, loggerContext);

    const encryptionKeyUrlFinal = encryptionKeyUrl || (await this.fetchEncryptionKeyUrl());

    if (this.groups === undefined) {
      await this.getContacts();
    }

    if (this.groups && this.groups.length) {
      const isExistingGroup = this.groups.find((group) => {
        return group.displayName === displayName;
      });

      if (isExistingGroup) {
        log.warn(`Group name ${displayName} already exists.`, loggerContext);

        return {
          statusCode: 400 as number,
          data: {error: 'Group displayName already exists'},
          message: FAILURE_MESSAGE,
        } as ContactResponse;
      }
    }

    const encryptedDisplayName = await this.webex.internal.encryption.encryptText(
      encryptionKeyUrlFinal,
      displayName
    );

    const groupInfo = {
      schemas: CONTACTS_SCHEMA,
      displayName: encryptedDisplayName,
      groupType: groupType || GroupType.NORMAL,
      encryptionKeyUrl: encryptionKeyUrlFinal,
    };

    try {
      const response = <WebexRequestPayload>await this.webex.request({
        // eslint-disable-next-line no-underscore-dangle
        uri: `${this.webex.internal.services._serviceUrls.contactsService}/${ENCRYPT_FILTER}/${USERS}/${GROUP_FILTER}`,
        method: HTTP_METHODS.POST,
        body: groupInfo,
      });

      const group = response.body as ContactGroup;

      group.displayName = displayName;
      const contactResponse: ContactResponse = {
        statusCode: Number(response[STATUS_CODE]),
        data: {
          group,
        },
        message: SUCCESS_MESSAGE,
      };

      this.groups?.push(group);

      return contactResponse;
    } catch (err: unknown) {
      log.warn('Unable to create contact group.', loggerContext);
      const errorInfo = err as WebexRequestPayload;
      const errorStatus = serviceErrorCodeHandler(errorInfo, loggerContext);

      return errorStatus;
    }
  }

  /**
   * Deletes a contact group.
   * @param groupId - GroupId of the group to delete.
   */
  public async deleteContactGroup(groupId: string) {
    const loggerContext = {
      file: CONTACTS_FILE,
      method: this.deleteContactGroup.name,
    };

    try {
      log.info(`Deleting contact group: ${groupId}`, loggerContext);
      const response = <WebexRequestPayload>await this.webex.request({
        // eslint-disable-next-line no-underscore-dangle
        uri: `${this.webex.internal.services._serviceUrls.contactsService}/${ENCRYPT_FILTER}/${USERS}/${GROUP_FILTER}/${groupId}`,
        method: HTTP_METHODS.DELETE,
      });
      const contactResponse: ContactResponse = {
        statusCode: Number(response[STATUS_CODE]),
        data: {},
        message: SUCCESS_MESSAGE,
      };

      const groupToDelete = this.groups?.findIndex((group) => group.groupId === groupId);

      if (groupToDelete !== undefined && groupToDelete !== -1) {
        this.groups?.splice(groupToDelete, 1);
      }

      if (!this.groups?.length) {
        this.defaultGroupId = '';
      }

      return contactResponse;
    } catch (err: unknown) {
      log.warn(`Unable to delete contact group ${groupId}`, loggerContext);
      const errorInfo = err as WebexRequestPayload;
      const errorStatus = serviceErrorCodeHandler(errorInfo, loggerContext);

      return errorStatus;
    }
  }

  /**
   * Creates a custom contact.
   * @param contactInfo - Contact object to create.
   */
  public async createContact(contactInfo: Contact): Promise<ContactResponse> {
    const loggerContext = {
      file: CONTACTS_FILE,
      method: this.createContact.name,
    };

    log.info(`Request to create contact: contactType: ${contactInfo.contactType}`, loggerContext);

    try {
      const contact = {...contactInfo};

      if (!contact.encryptionKeyUrl) {
        contact.encryptionKeyUrl = await this.fetchEncryptionKeyUrl();
      }

      if (!contact.groups || contact.groups.length === 0) {
        /** Fetch the groupId for the default group if not create  */
        const defaultGroupId = await this.fetchDefaultGroup();

        contact.groups = [defaultGroupId];
      }

      contact.schemas = CONTACTS_SCHEMA;
      let requestBody = {};

      switch (contact.contactType) {
        case ContactType.CUSTOM: {
          const encryptedContact = await this.encryptContact(contact);

          requestBody = encryptedContact;
          break;
        }
        case ContactType.CLOUD: {
          if (!contact.contactId) {
            return {
              statusCode: 400 as number,
              data: {
                error: 'contactId is required for contactType:CLOUD.',
              },
              message: FAILURE_MESSAGE,
            } as ContactResponse;
          }
          const encryptedContact = await this.encryptContact(contact);

          requestBody = encryptedContact;
          break;
        }
        default: {
          return {
            statusCode: 400 as number,
            data: {
              error: 'Unknown contactType received.',
            },
            message: FAILURE_MESSAGE,
          } as ContactResponse;
        }
      }

      const response = <WebexRequestPayload>await this.webex.request({
        // eslint-disable-next-line no-underscore-dangle
        uri: `${this.webex.internal.services._serviceUrls.contactsService}/${ENCRYPT_FILTER}/${USERS}/${CONTACT_FILTER}`,
        method: HTTP_METHODS.POST,
        body: requestBody,
      });

      const newContact = response.body as Contact;

      contact.contactId = newContact.contactId;
      const contactResponse: ContactResponse = {
        statusCode: Number(response[STATUS_CODE]),
        data: {
          contact,
        },
        message: SUCCESS_MESSAGE,
      };

      if (contact.contactType === ContactType.CLOUD && newContact.contactId) {
        const query = `${SCIM_ID_FILTER} "${newContact.contactId}"`;
        const res = await scimQuery(query);
        const resolvedContact = this.resolveCloudContacts(
          Object.fromEntries([[newContact.contactId, newContact]]) as ContactIdContactInfo,
          res.body as SCIMListResponse
        );
        if (resolvedContact) {
          this.contacts?.push(resolvedContact[0]);
        }
      } else {
        this.contacts?.push(contact);
      }

      return contactResponse;
    } catch (err: unknown) {
      log.warn('Failed to create contact.', {
        file: CONTACTS_FILE,
        method: this.createContact.name,
      });
      const errorInfo = err as WebexRequestPayload;
      const errorStatus = serviceErrorCodeHandler(errorInfo, loggerContext);

      return errorStatus;
    }
  }

  /**
   * Delete a contact.
   * @param contactId - ContactId of the contact to delete.
   */
  public async deleteContact(contactId: string): Promise<ContactResponse> {
    const loggerContext = {
      file: CONTACTS_FILE,
      method: this.deleteContact.name,
    };

    try {
      log.info(`Deleting contact : ${contactId}`, loggerContext);
      const response = <WebexRequestPayload>await this.webex.request({
        // eslint-disable-next-line no-underscore-dangle
        uri: `${this.webex.internal.services._serviceUrls.contactsService}/${ENCRYPT_FILTER}/${USERS}/${CONTACT_FILTER}/${contactId}`,
        method: HTTP_METHODS.DELETE,
      });

      const contactResponse: ContactResponse = {
        statusCode: Number(response[STATUS_CODE]),
        data: {},
        message: SUCCESS_MESSAGE,
      };

      const contactToDelete = this.contacts?.findIndex(
        (contact) => contact.contactId === contactId
      );

      if (contactToDelete !== undefined && contactToDelete !== -1) {
        this.contacts?.splice(contactToDelete, 1);
      }

      return contactResponse;
    } catch (err: unknown) {
      log.warn(`Unable to delete contact ${contactId}`, loggerContext);
      const errorInfo = err as WebexRequestPayload;
      const errorStatus = serviceErrorCodeHandler(errorInfo, loggerContext);

      return errorStatus;
    }
  }

  /**
   * @ignore
   */
  public getSDKConnector(): ISDKConnector {
    return this.sdkConnector;
  }
}

/**
 * Creates a ContactsClient instance
 *
 * @param {WebexSDK} webex - `Webex SDK`instance.
 * @param {LoggerInterface} logger - An instance implementing LoggerInterface used to set the log level for the module.
 */
export const createContactsClient = (webex: WebexSDK, logger: LoggerInterface): IContacts =>
  new ContactsClient(webex, logger);

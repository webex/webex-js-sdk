import {HTTP_METHODS, SCIMListResponse, WebexRequestPayload} from '../common/types';
import {getTestUtilsWebex, flushPromises} from '../common/testUtil';
import {LOGGER} from '../Logger/types';
import {Contact, ContactGroup, ContactResponse, GroupType, IContacts} from './types';
import {createContactsClient} from './ContactsClient';
import {
  FAILURE_MESSAGE,
  IDENTITY_ENDPOINT_RESOURCE,
  METHOD_START_MESSAGE,
  SCIM_ENDPOINT_RESOURCE,
  SCIM_USER_FILTER,
  SUCCESS_MESSAGE,
  WEBEX_API_BTS,
} from '../common/constants';
import log from '../Logger';
import {
  CONTACTS_CLIENT,
  CONTACT_FILTER,
  ENCRYPT_FILTER,
  DEFAULT_GROUP_NAME,
  USERS,
  GROUP_FILTER,
  CONTACTS_SCHEMA,
  METHODS,
} from './constants';
import * as utils from '../common/Utils';
import {CISCO_DEVICE_URL} from '../CallingClient/constants';
import {
  mockCity,
  mockCompany,
  mockContactListTwo,
  mockContactResponseBodyTwo,
  mockContactListOne,
  mockContactResponseBodyOne,
  mockCountry,
  mockDisplayNameOne,
  mockEmail,
  mockFirstName,
  mockLastName,
  mockNumber1,
  mockNumber2,
  mockSCIMListResponse,
  mockSipAddress,
  mockState,
  mockStreet,
  mockTitle,
  mockZipCode,
  mockDisplayNameTwo,
  mockContactResponseBodyThird,
  mockKmsKey,
  mockGroupName,
  mockContactGroupListOne,
  mockContactGroupListTwo,
  mockAvatarURL,
  mockSCIMMinListResponse,
  mockContactMinimum,
} from './contactFixtures';

describe('ContactClient Tests', () => {
  const webex = getTestUtilsWebex();

  let contactClient: IContacts;

  // eslint-disable-next-line no-underscore-dangle
  const contactServiceUrl = `${webex.internal.services._serviceUrls.contactsService}/${ENCRYPT_FILTER}/${USERS}/${CONTACT_FILTER}`;
  const scimUrl = `${WEBEX_API_BTS}/${IDENTITY_ENDPOINT_RESOURCE}/${SCIM_ENDPOINT_RESOURCE}/${webex.internal.device.orgId}/${SCIM_USER_FILTER}id%20eq%20%22801bb994-343b-4f6b-97ae-d13c91d4b877%22`;
  // eslint-disable-next-line no-underscore-dangle
  const contactServiceGroupUrl = `${webex.internal.services._serviceUrls.contactsService}/${ENCRYPT_FILTER}/${USERS}/${GROUP_FILTER}`;
  const serviceErrorCodeHandlerSpy = jest.spyOn(utils, 'serviceErrorCodeHandler');
  const uploadLogsSpy = jest.spyOn(utils, 'uploadLogs').mockResolvedValue();
  const failureResponsePayload = <WebexRequestPayload>{
    statusCode: 503,
    body: {},
  };
  const mockGroupResponse = mockContactResponseBodyOne.groups[0];

  beforeEach(() => {
    contactClient = createContactsClient(webex, {level: LOGGER.INFO});

    expect(contactClient).toBeTruthy();
    expect(contactClient.getSDKConnector().getWebex()).toBeTruthy();

    // Set up log spies for each test
    jest.spyOn(log, 'info');
    jest.spyOn(log, 'log');
    jest.spyOn(log, 'warn');
    jest.spyOn(log, 'error');
  });

  afterEach(() => {
    webex.request.mockClear();
    jest.clearAllMocks();
  });

  /**
   * TestCase inputs
   * name: TestCase name
   * payloadData: Response body
   * inputStatusCode: Status code received in response
   * expectedData: Expected data field in ContactResponse after processing
   * expectedMessage: Expected message field in ContactResponse after processing
   * expectedStatusCode: Expected status code field in ContactResponse after processing
   * decryptTextList: Array of decrypted contact list.
   */
  const errorCodes: {
    name: string;
    payloadData: unknown;
    inputStatusCode: number;
    expectedData: unknown;
    expectedMessage: string;
    expectedStatusCode: number;
    decryptTextList: Array<string>;
    cloudContactPresent?: boolean;
    scimResponse?: SCIMListResponse;
  }[] = [
    {
      name: 'Success case 1: fetch contacts using get contacts api, custom and cloud contact present',
      payloadData: mockContactResponseBodyOne,
      inputStatusCode: 200,
      expectedData: {contacts: mockContactListOne, groups: mockContactGroupListOne},
      expectedMessage: SUCCESS_MESSAGE,
      expectedStatusCode: 200,
      decryptTextList: [
        mockCity,
        mockCountry,
        mockState,
        mockStreet,
        mockZipCode,
        mockAvatarURL,
        mockCompany,
        mockDisplayNameOne,
        mockEmail,
        mockFirstName,
        mockLastName,
        mockNumber1,
        mockNumber2,
        mockSipAddress,
        mockTitle,
        mockNumber2,
        mockSipAddress,
        mockGroupName,
      ],
      cloudContactPresent: true,
      scimResponse: mockSCIMListResponse,
    },
    {
      name: 'Success case 2: fetch contacts using get contacts api, single custom contact with mandatory details present',
      payloadData: mockContactResponseBodyTwo,
      inputStatusCode: 200,
      expectedData: {contacts: mockContactListTwo, groups: mockContactGroupListTwo},
      expectedMessage: SUCCESS_MESSAGE,
      expectedStatusCode: 200,
      decryptTextList: [mockDisplayNameTwo, mockGroupName],
    },
    {
      name: 'Success case 3: fetch contacts using get contacts api, no contacts returned',
      payloadData: mockContactResponseBodyThird,
      inputStatusCode: 200,
      expectedData: {contacts: [], groups: []},
      expectedMessage: SUCCESS_MESSAGE,
      expectedStatusCode: 200,
      decryptTextList: [],
    },
    {
      name: 'Failed case: 200 OK with no response body',
      payloadData: undefined,
      inputStatusCode: 200,
      expectedData: {error: '422 Exception has occurred'},
      expectedMessage: FAILURE_MESSAGE,
      expectedStatusCode: 422,
      decryptTextList: [],
    },
    {
      name: 'Failed case 403: fetch contacts using get contacts api',
      payloadData: {error: '403 Forbidden'},
      inputStatusCode: 403,
      expectedData: {error: 'User request is forbidden'},
      expectedMessage: FAILURE_MESSAGE,
      expectedStatusCode: 403,
      decryptTextList: [],
    },
    {
      name: 'Failed case 408: fetch contacts using get contacts api',
      payloadData: {error: '408 Request Timeout'},
      inputStatusCode: 408,
      expectedData: {error: 'Request to the server timedout'},
      expectedMessage: FAILURE_MESSAGE,
      expectedStatusCode: 408,
      decryptTextList: [],
    },
    {
      name: 'Failed case 500: fetch contacts using get contacts api',
      payloadData: {error: '500 Internal Server Error'},
      inputStatusCode: 500,
      expectedData: {error: 'Internal server error occurred'},
      expectedMessage: FAILURE_MESSAGE,
      expectedStatusCode: 500,
      decryptTextList: [],
    },
    {
      name: 'Failed case 503: fetch contacts using get contacts api',
      payloadData: {error: '503 Service Unavailable'},
      inputStatusCode: 503,
      expectedData: {error: 'Unable to establish a connection with the server'},
      expectedMessage: FAILURE_MESSAGE,
      expectedStatusCode: 503,
      decryptTextList: [],
    },
  ].map((stat) =>
    Object.assign(stat, {
      toString() {
        /* eslint-disable dot-notation */
        return this['name'];
      },
    })
  );

  it.each(errorCodes)('%s', async (codeObj) => {
    const respPayload = {
      statusCode: codeObj.inputStatusCode,
    };

    if (codeObj.inputStatusCode === 200) {
      respPayload['body'] = codeObj.payloadData;
      webex.request.mockResolvedValueOnce(respPayload);
      codeObj.decryptTextList.forEach((text) => {
        webex.internal.encryption.decryptText.mockResolvedValueOnce(text);
      });

      if (codeObj.scimResponse) {
        webex.request.mockResolvedValueOnce(mockSCIMListResponse);
      }
    } else {
      respPayload['message'] = FAILURE_MESSAGE;
      respPayload['data'] = codeObj.payloadData;
      webex.request.mockRejectedValueOnce(respPayload);
    }

    const contactsResponse = await contactClient.getContacts();

    if (codeObj.inputStatusCode === 200) {
      if (codeObj.cloudContactPresent) {
        expect(webex.request).toBeCalledTimes(2);
      } else {
        expect(webex.request).toBeCalledTimes(1);
      }
      expect(webex.request).toHaveBeenNthCalledWith(1, {
        uri: contactServiceUrl,
        method: HTTP_METHODS.GET,
      });

      if (codeObj.cloudContactPresent) {
        expect(webex.request).toHaveBeenNthCalledWith(2, {
          uri: scimUrl,
          method: HTTP_METHODS.GET,
          headers: {
            [CISCO_DEVICE_URL]:
              'https://wdm-intb.ciscospark.com/wdm/api/v1/devices/c5ae3b86-1bb7-40f1-a6a9-c296ee7e61d5',
            'spark-user-agent': 'webex-calling/beta',
          },
        });
      }

      expect(log.info).toHaveBeenCalledWith(METHOD_START_MESSAGE, {
        file: CONTACTS_CLIENT,
        method: METHODS.GET_CONTACTS,
      });

      if (codeObj.payloadData) {
        expect(log.log).toHaveBeenCalledWith('Successfully fetched contacts and groups', {
          file: CONTACTS_CLIENT,
          method: METHODS.GET_CONTACTS,
        });
      } else {
        expect(log.error).toHaveBeenCalled();
      }
    } else {
      expect(webex.request).toBeCalledOnceWith({
        uri: contactServiceUrl,
        method: HTTP_METHODS.GET,
      });

      expect(log.info).toHaveBeenCalledWith(METHOD_START_MESSAGE, {
        file: CONTACTS_CLIENT,
        method: METHODS.GET_CONTACTS,
      });
      expect(log.error).toHaveBeenCalled();
    }

    expect(contactsResponse).toEqual({
      data: expect.any(Object),
      message: codeObj.expectedMessage,
      statusCode: codeObj.expectedStatusCode,
    });

    if (codeObj.expectedMessage === SUCCESS_MESSAGE) {
      expect(serviceErrorCodeHandlerSpy).not.toBeCalled();
    } else {
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        codeObj.payloadData ? respPayload : expect.any(Error),
        {
          file: CONTACTS_CLIENT,
          method: METHODS.GET_CONTACTS,
        }
      );
    }
  });

  it('create a contact group without encryptionKey', async () => {
    const successResponsePayload = <WebexRequestPayload>{
      statusCode: 201,
      body: mockGroupResponse,
    };

    contactClient['groups'] = [];
    contactClient['encryptionKeyUrl'] = '';

    webex.request.mockResolvedValue(successResponsePayload);
    webex.internal.encryption.kms.createUnboundKeys.mockResolvedValue([mockKmsKey]);
    webex.internal.encryption.kms.createResource.mockResolvedValue(mockKmsKey);
    webex.internal.encryption.encryptText
      .mockResolvedValueOnce('Encrypted Other')
      .mockResolvedValueOnce('Encrypted Top');

    const contactsResponse = await contactClient.createContactGroup('Top Contacts');

    expect(contactsResponse.statusCode).toEqual(201);
    expect(contactsResponse.data.group?.groupId).toBe(mockGroupResponse.groupId);
    expect(webex.internal.encryption.kms.createUnboundKeys).toBeCalledOnceWith({count: 1});
    expect(webex.internal.encryption.kms.createResource).toBeCalledOnceWith({
      keyUris: [mockKmsKey.uri],
    });
    expect(webex.request).toBeCalledTimes(2);
    expect(webex.request).toHaveBeenNthCalledWith(1, {
      uri: contactServiceGroupUrl,
      method: 'POST',
      body: {
        displayName: 'Encrypted Other',
        encryptionKeyUrl: mockKmsKey.uri,
        groupType: 'NORMAL',
        schemas: 'urn:cisco:codev:identity:contact:core:1.0',
      },
    });

    expect(webex.request).toHaveBeenNthCalledWith(2, {
      uri: contactServiceGroupUrl,
      method: 'POST',
      body: {
        displayName: 'Encrypted Top',
        encryptionKeyUrl: mockKmsKey.uri,
        groupType: 'NORMAL',
        schemas: 'urn:cisco:codev:identity:contact:core:1.0',
      },
    });
    expect(contactClient['groups'].length).toEqual(2);
    expect(contactClient['groups'][1].displayName).toEqual('Top Contacts');

    expect(log.info).toHaveBeenCalledWith(
      `${METHOD_START_MESSAGE} with displayName: Top Contacts`,
      {
        file: CONTACTS_CLIENT,
        method: METHODS.CREATE_CONTACT_GROUP,
      }
    );
    expect(log.info).toHaveBeenCalledWith(METHOD_START_MESSAGE, {
      file: CONTACTS_CLIENT,
      method: METHODS.CREATE_NEW_ENCRYPTION_KEY_URL,
    });
    expect(log.info).toHaveBeenCalledWith('Requesting kms for a new KRO and key', {
      file: CONTACTS_CLIENT,
      method: METHODS.CREATE_NEW_ENCRYPTION_KEY_URL,
    });
    expect(log.log).toHaveBeenCalledWith(`Creating a default group: ${DEFAULT_GROUP_NAME}`, {
      file: CONTACTS_CLIENT,
      method: 'fetchEncryptionKeyUrl',
    });
    expect(log.log).toHaveBeenCalledWith(`Contact group Top Contacts successfully created`, {
      file: CONTACTS_CLIENT,
      method: METHODS.CREATE_CONTACT_GROUP,
    });
  });

  it('create a contact group with existing key info', async () => {
    const successResponsePayload = <WebexRequestPayload>{
      statusCode: 201,
      body: mockGroupResponse,
    };

    contactClient['groups'] = mockContactGroupListOne;
    webex.request.mockResolvedValue(successResponsePayload);

    webex.internal.encryption.encryptText.mockResolvedValue('Encrypted Top Contacts');
    const infoSpy = jest.spyOn(log, 'info');
    const contactsResponse = await contactClient.createContactGroup('Top Contacts');

    expect(contactsResponse.statusCode).toEqual(201);
    expect(contactsResponse.data.group?.groupId).toBe(mockGroupResponse.groupId);
    expect(infoSpy).toBeCalledWith(`${METHOD_START_MESSAGE} with displayName: Top Contacts`, {
      file: CONTACTS_CLIENT,
      method: METHODS.CREATE_CONTACT_GROUP,
    });
    expect(log.log).toBeCalledWith(`Contact group Top Contacts successfully created`, {
      file: CONTACTS_CLIENT,
      method: METHODS.CREATE_CONTACT_GROUP,
    });
    expect(infoSpy).not.toBeCalledWith(METHOD_START_MESSAGE, {
      file: CONTACTS_CLIENT,
      method: METHODS.CREATE_NEW_ENCRYPTION_KEY_URL,
    });

    expect(webex.request).toBeCalledOnceWith({
      uri: contactServiceGroupUrl,
      method: HTTP_METHODS.POST,
      body: {
        displayName: 'Encrypted Top Contacts',
        encryptionKeyUrl: mockContactGroupListOne[0].encryptionKeyUrl,
        groupType: 'NORMAL',
        schemas: CONTACTS_SCHEMA,
      },
    });

    expect(contactClient['groups'].length).toEqual(2);
    expect(contactClient['groups'][1].displayName).toEqual('Top Contacts');
  });

  it('create a contact group with same displayName', async () => {
    contactClient['groups'] = mockContactResponseBodyOne.groups;
    webex.internal.encryption.kms.createUnboundKeys.mockResolvedValue([mockKmsKey]);
    webex.internal.encryption.kms.createResource.mockResolvedValue(mockKmsKey);
    const logSpy = jest.spyOn(log, 'warn');
    const contactsResponse = await contactClient.createContactGroup(mockGroupResponse.displayName);

    expect(webex.request).not.toBeCalled();
    expect(contactsResponse.statusCode).toBe(400);
    expect(logSpy).toBeCalledOnceWith(
      `Group name ${mockGroupResponse.displayName} already exists.`,
      {
        file: CONTACTS_CLIENT,
        method: METHODS.CREATE_CONTACT_GROUP,
      }
    );
    expect(log.info).toBeCalledWith(
      `${METHOD_START_MESSAGE} with displayName: ${mockGroupResponse.displayName}`,
      {
        file: CONTACTS_CLIENT,
        method: METHODS.CREATE_CONTACT_GROUP,
      }
    );
    expect(contactClient['groups']).toEqual(mockContactResponseBodyOne.groups);
  });

  it('create a contact group - service unavailable', async () => {
    const loggerContext = {
      file: CONTACTS_CLIENT,
      method: 'createContactGroup',
    };

    contactClient['groups'] = mockContactGroupListOne;
    webex.request.mockRejectedValue(failureResponsePayload);
    webex.internal.encryption.kms.createUnboundKeys.mockResolvedValue([mockKmsKey]);
    webex.internal.encryption.kms.createResource.mockResolvedValue(mockKmsKey);
    webex.internal.encryption.encryptText.mockResolvedValueOnce('Encrypted group name');
    const warnSpy = jest.spyOn(log, 'warn');
    const errorSpy = jest.spyOn(log, 'error');

    const contactsResponse = await contactClient.createContactGroup('New group');

    expect(contactsResponse.statusCode).toBe(503);
    expect(webex.request).toBeCalledOnceWith({
      uri: contactServiceGroupUrl,
      method: HTTP_METHODS.POST,
      body: {
        displayName: 'Encrypted group name',
        encryptionKeyUrl: 'kms://cisco.com/keys/dcf18f9d-155e-44ff-ad61-c8a69b7103ab',
        groupType: 'NORMAL',
        schemas: 'urn:cisco:codev:identity:contact:core:1.0',
      },
    });
    expect(log.info).toBeCalledWith(
      `${METHOD_START_MESSAGE} with displayName: New group`,
      loggerContext
    );
    expect(warnSpy).toBeCalledTimes(1);
    expect(warnSpy).toHaveBeenNthCalledWith(
      1,
      '503 Unable to establish a connection with the server',
      loggerContext
    );
    expect(errorSpy).toBeCalledTimes(1);
    expect(errorSpy).toHaveBeenNthCalledWith(
      1,
      `Unable to create contact group: ${JSON.stringify(failureResponsePayload)}`,
      loggerContext
    );

    expect(contactClient['groups']).toEqual(mockContactGroupListOne);
    expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(failureResponsePayload, loggerContext);
  });

  it('delete a contact group - service unavailable', async () => {
    const loggerContext = {
      file: CONTACTS_CLIENT,
      method: 'deleteContactGroup',
    };

    contactClient['groups'] = mockContactGroupListOne;
    webex.request.mockRejectedValue(failureResponsePayload);
    webex.internal.encryption.kms.createUnboundKeys.mockResolvedValue([mockKmsKey]);
    webex.internal.encryption.kms.createResource.mockResolvedValue(mockKmsKey);
    const warnSpy = jest.spyOn(log, 'warn');
    const errorSpy = jest.spyOn(log, 'error');
    const contactsResponse = await contactClient.deleteContactGroup(mockGroupResponse.groupId);

    expect(contactsResponse.statusCode).toBe(503);
    expect(webex.request).toBeCalledOnceWith({
      method: HTTP_METHODS.DELETE,
      uri: `${contactServiceGroupUrl}/${mockGroupResponse.groupId}`,
    });
    expect(log.info).toBeCalledWith(
      `${METHOD_START_MESSAGE} with groupId: ${mockGroupResponse.groupId}`,
      loggerContext
    );
    expect(log.info).toBeCalledWith(
      `Deleting contact group: ${mockGroupResponse.groupId}`,
      loggerContext
    );
    expect(warnSpy).toBeCalledTimes(1);
    expect(errorSpy).toBeCalledTimes(1);
    expect(uploadLogsSpy).toBeCalledTimes(1);
    expect(errorSpy).toHaveBeenNthCalledWith(
      1,
      `Unable to delete contact group ${mockGroupResponse.groupId}: ${JSON.stringify(
        failureResponsePayload
      )}`,
      loggerContext
    );
    expect(warnSpy).toHaveBeenNthCalledWith(
      1,
      '503 Unable to establish a connection with the server',
      loggerContext
    );

    expect(contactClient['groups']).toEqual(mockContactGroupListOne);
    expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(failureResponsePayload, loggerContext);
  });

  it('successful deletion of contact group', async () => {
    const successResponsePayload = <WebexRequestPayload>{
      statusCode: 204,
    };

    contactClient['groups'] = [mockContactGroupListOne[0]];
    webex.request.mockResolvedValue(successResponsePayload);
    const response = await contactClient.deleteContactGroup(mockContactGroupListOne[0].groupId);

    expect(response.statusCode).toEqual(204);
    expect(webex.request).toBeCalledOnceWith({
      uri: `${contactServiceGroupUrl}/${mockContactGroupListOne[0].groupId}`,
      method: HTTP_METHODS.DELETE,
    });
    expect(contactClient['groups']).toEqual([]);

    expect(log.info).toBeCalledWith(
      `Deleting contact group: ${mockContactGroupListOne[0].groupId}`,
      {
        file: CONTACTS_CLIENT,
        method: 'deleteContactGroup',
      }
    );
    expect(log.log).toBeCalledWith(
      `Contact group ${mockContactGroupListOne[0].groupId} successfully deleted`,
      {
        file: CONTACTS_CLIENT,
        method: 'deleteContactGroup',
      }
    );
  });

  it('create a contact with an existing group', async () => {
    const mockContactResponse = mockContactResponseBodyTwo.contacts[0];
    const successResponsePayload = <WebexRequestPayload>{
      statusCode: 201,
      body: mockContactResponse,
    };

    webex.request.mockResolvedValue(successResponsePayload);
    webex.internal.encryption.encryptText.mockResolvedValue('Encrypted contact name');
    const infoSpy = jest.spyOn(log, 'info');
    const logSpy = jest.spyOn(log, 'log');

    contactClient['groups'] = mockContactGroupListOne;
    contactClient['encryptionKeyUrl'] = mockContactGroupListOne[0].encryptionKeyUrl;

    const contact = mockContactListTwo.slice()[0] as Contact;

    contact.groups = [];

    const res: ContactResponse = await contactClient.createContact(contact);

    expect(res.statusCode).toEqual(201);
    expect(res.data.contact?.contactId).toBe(mockContactResponse.contactId);
    expect(infoSpy).toBeCalledWith(
      `${METHOD_START_MESSAGE} with contactType: ${contact.contactType}`,
      {
        file: CONTACTS_CLIENT,
        method: METHODS.CREATE_CONTACT,
      }
    );
    expect(logSpy).toBeCalledWith(`Contact successfully created`, {
      file: CONTACTS_CLIENT,
      method: METHODS.CREATE_CONTACT,
    });
    expect(logSpy).not.toBeCalledWith('Created a KRO and encryptionKeyUrl', {
      file: CONTACTS_CLIENT,
      method: 'createNewEncryptionKeyUrl',
    });

    expect(logSpy).not.toBeCalledWith('Created a KRO and encryptionKeyUrl', {
      file: CONTACTS_CLIENT,
      method: 'createNewEncryptionKeyUrl',
    });
    expect(infoSpy).not.toBeCalledWith(`Creating a default group: ${DEFAULT_GROUP_NAME}`, {
      file: CONTACTS_CLIENT,
      method: 'fetchEncryptionKeyUrl',
    });

    expect(webex.internal.encryption.encryptText).toBeCalledOnceWith(
      mockContactGroupListOne[0].encryptionKeyUrl,
      contact.displayName
    );

    expect(webex.request).toBeCalledOnceWith({
      body: {
        ...contact,
        displayName: 'Encrypted contact name',
        groups: [mockContactGroupListOne[0].groupId],
        schemas: CONTACTS_SCHEMA,
      },
      uri: contactServiceUrl,
      method: HTTP_METHODS.POST,
    });

    logSpy.mockClear();

    /* for coverage */
    const result: ContactResponse = await contactClient.createContact(contact);

    expect(result.data.contact?.contactId).toBe(mockContactResponse.contactId);
    expect(logSpy).not.toBeCalledWith(`Creating a default group: ${DEFAULT_GROUP_NAME}`, {
      file: CONTACTS_CLIENT,
      method: 'fetchEncryptionKeyUrl',
    });
  });

  describe('encryptContact', () => {
    it('encryptContact rejects an untrusted caller-supplied encryptionKeyUrl', async () => {
      contactClient['groups'] = mockContactGroupListOne;
      contactClient['encryptionKeyUrl'] = mockContactGroupListOne[0].encryptionKeyUrl;

      webex.internal.encryption.encryptText.mockResolvedValue('Encrypted contact name');

      const untrustedKeyUrl = 'kms://attacker.example.com/keys/untrusted-key';
      const contact = {
        ...mockContactListTwo[0],
        encryptionKeyUrl: untrustedKeyUrl,
      } as Contact;

      await contactClient['encryptContact'](contact);

      /* The attacker-controlled key must never be used to encrypt contact fields. */
      expect(webex.internal.encryption.encryptText).not.toHaveBeenCalledWith(
        untrustedKeyUrl,
        expect.anything()
      );
      /* A validated/known key is used instead of the untrusted caller-supplied one. */
      expect(webex.internal.encryption.encryptText).toHaveBeenCalledWith(
        mockContactGroupListOne[0].encryptionKeyUrl,
        contact.displayName
      );
    });

    it('encryptContact uses a validated key for a trusted contact', async () => {
      contactClient['groups'] = mockContactGroupListOne;
      contactClient['encryptionKeyUrl'] = mockContactGroupListOne[0].encryptionKeyUrl;

      webex.internal.encryption.encryptText.mockResolvedValue('Encrypted contact name');

      const contact = {
        ...mockContactListTwo[0],
        encryptionKeyUrl: mockContactGroupListOne[0].encryptionKeyUrl,
      } as Contact;

      const encryptedContact = await contactClient['encryptContact'](contact);

      expect(webex.internal.encryption.encryptText).toHaveBeenCalledWith(
        mockContactGroupListOne[0].encryptionKeyUrl,
        contact.displayName
      );
      expect(encryptedContact.displayName).toEqual('Encrypted contact name');
      expect(encryptedContact.encryptionKeyUrl).toEqual(mockContactGroupListOne[0].encryptionKeyUrl);
    });
  });

  it('create a contact without a group and encryptionKey', async () => {
    const mockContactResponse = mockContactResponseBodyOne.contacts[1];

    contactClient['groups'] = [];
    contactClient['encryptionKey'] = '';
    contactClient['defaultGroupId'] = '';
    const successContactGroupResponsePayload = <WebexRequestPayload>{
      statusCode: 201,
      body: mockGroupResponse,
    };
    const successContactResponsePayload = <WebexRequestPayload>{
      statusCode: 201,
      body: mockContactResponse,
    };

    webex.request
      .mockResolvedValueOnce(successContactGroupResponsePayload)
      .mockResolvedValueOnce(successContactResponsePayload);
    webex.internal.encryption.kms.createUnboundKeys.mockResolvedValue([mockKmsKey]);
    webex.internal.encryption.kms.createResource.mockResolvedValue(mockKmsKey);
    webex.internal.encryption.encryptText.mockResolvedValueOnce('Encrypted group name');

    const contact = {
      contactType: 'CUSTOM',
    } as Contact;

    const res = await contactClient.createContact(contact);

    expect(res.statusCode).toEqual(201);

    expect(webex.request).toBeCalledTimes(2);
    expect(webex.request).toHaveBeenNthCalledWith(1, {
      body: {
        displayName: 'Encrypted group name',
        encryptionKeyUrl: mockKmsKey.uri,
        groupType: 'NORMAL',
        schemas: CONTACTS_SCHEMA,
      },
      uri: contactServiceGroupUrl,
      method: HTTP_METHODS.POST,
    });
    expect(webex.request).toHaveBeenNthCalledWith(2, {
      body: {
        contactType: 'CUSTOM',
        encryptionKeyUrl: mockKmsKey.uri,
        groups: ['1561977e-3443-4ccf-a591-69686275d7d2'],
        schemas: CONTACTS_SCHEMA,
      },
      method: HTTP_METHODS.POST,
      uri: contactServiceUrl,
    });
    expect(webex.internal.encryption.kms.createUnboundKeys).toBeCalledOnceWith({count: 1});
    expect(webex.internal.encryption.kms.createResource).toBeCalledOnceWith({
      keyUris: [mockKmsKey.uri],
    });
    expect(res.data.contact?.contactId).toBe(mockContactResponse.contactId);

    expect(log.info).toBeCalledWith(`${METHOD_START_MESSAGE} with contactType: CUSTOM`, {
      file: CONTACTS_CLIENT,
      method: METHODS.CREATE_CONTACT,
    });
    expect(log.info).toBeCalledWith(METHOD_START_MESSAGE, {
      file: CONTACTS_CLIENT,
      method: METHODS.CREATE_NEW_ENCRYPTION_KEY_URL,
    });
    expect(log.info).toBeCalledWith('Requesting kms for a new KRO and key', {
      file: CONTACTS_CLIENT,
      method: METHODS.CREATE_NEW_ENCRYPTION_KEY_URL,
    });
    expect(log.log).toBeCalledWith(`Creating a default group: ${DEFAULT_GROUP_NAME}`, {
      file: CONTACTS_CLIENT,
      method: METHODS.FETCH_ENCRYPTION_KEY_URL,
    });
    expect(log.log).toBeCalledWith(`Contact successfully created`, {
      file: CONTACTS_CLIENT,
      method: 'createContact',
    });
  });

  it('create a cloud contact with no existing groups', async () => {
    const mockContactResponse = mockContactResponseBodyOne.contacts[0];
    const successResponsePayload = <WebexRequestPayload>{
      statusCode: 201,
      body: mockContactResponse,
    };
    const successResponsePayloadGroup = <WebexRequestPayload>{
      statusCode: 201,
      body: mockContactResponseBodyOne.groups[0],
    };

    webex.request
      .mockResolvedValueOnce(successResponsePayloadGroup)
      .mockResolvedValueOnce(successResponsePayload)
      .mockResolvedValueOnce(mockSCIMListResponse);

    webex.internal.encryption.encryptText.mockResolvedValueOnce('Encrypted group name');

    contactClient['groups'] = [];
    contactClient['encryptionKeyUrl'] = mockContactResponseBodyOne.groups[0].encryptionKeyUrl;

    const contact = {
      contactType: 'CLOUD',
    } as Contact;

    contact.groups = [];

    let res: ContactResponse = await contactClient.createContact(contact);

    expect(res.statusCode).toEqual(400);
    expect(res.data.error).toEqual('contactId is required for contactType:CLOUD.');
    expect(log.info).toBeCalledWith(`${METHOD_START_MESSAGE} with contactType: CLOUD`, {
      file: CONTACTS_CLIENT,
      method: METHODS.CREATE_CONTACT,
    });

    contact.contactId = mockContactResponse.contactId;

    res = await contactClient.createContact(contact);
    expect(res.statusCode).toEqual(201);
    expect(res.data.contact?.contactId).toBe(mockContactResponse.contactId);

    expect(webex.request).toBeCalledTimes(3);
    expect(webex.request).toHaveBeenNthCalledWith(1, {
      method: HTTP_METHODS.POST,
      uri: contactServiceGroupUrl,
      body: {
        displayName: 'Encrypted group name',
        groupType: 'NORMAL',
        encryptionKeyUrl: mockContactResponseBodyOne.groups[0].encryptionKeyUrl,
        schemas: CONTACTS_SCHEMA,
      },
    });
    expect(webex.request).toHaveBeenNthCalledWith(2, {
      method: HTTP_METHODS.POST,
      uri: contactServiceUrl,
      body: {
        contactId: mockContactResponse.contactId,
        contactType: 'CLOUD',
        encryptionKeyUrl: mockContactResponseBodyOne.groups[0].encryptionKeyUrl,
        schemas: CONTACTS_SCHEMA,
        groups: ['1561977e-3443-4ccf-a591-69686275d7d2'],
      },
    });
    expect(webex.request).toHaveBeenNthCalledWith(3, {
      uri: scimUrl,
      method: HTTP_METHODS.GET,
      headers: {
        [CISCO_DEVICE_URL]:
          'https://wdm-intb.ciscospark.com/wdm/api/v1/devices/c5ae3b86-1bb7-40f1-a6a9-c296ee7e61d5',
        'spark-user-agent': 'webex-calling/beta',
      },
    });

    expect(log.log).toBeCalledWith(`Contact successfully created`, {
      file: CONTACTS_CLIENT,
      method: 'createContact',
    });
  });

  it('create a contact - service unavailable', async () => {
    webex.request.mockRejectedValue(failureResponsePayload);

    contactClient['groups'] = mockContactGroupListOne.slice();
    contactClient['encryptionKeyUrl'] = mockContactResponseBodyOne.groups[0].encryptionKeyUrl;
    const contact = {
      contactType: 'CLOUD',
      contactId: '801bb994-343b-4f6b-97ae-d13c91d4b877',
    } as Contact;

    const res: ContactResponse = await contactClient.createContact(contact);

    expect(webex.request).toBeCalledOnceWith({
      uri: contactServiceUrl,
      method: HTTP_METHODS.POST,
      body: {
        ...contact,
        encryptionKeyUrl: mockContactResponseBodyOne.groups[0].encryptionKeyUrl,
        groups: [mockContactGroupListOne[0].groupId],
        schemas: CONTACTS_SCHEMA,
      },
    });
    expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(failureResponsePayload, {
      file: CONTACTS_CLIENT,
      method: METHODS.CREATE_CONTACT,
    });
    expect(res.statusCode).toEqual(503);

    expect(log.info).toBeCalledWith(`${METHOD_START_MESSAGE} with contactType: CLOUD`, {
      file: CONTACTS_CLIENT,
      method: METHODS.CREATE_CONTACT,
    });
    expect(log.error).toBeCalledWith(
      `Failed to create contact: ${JSON.stringify(failureResponsePayload)}`,
      {
        file: CONTACTS_CLIENT,
        method: METHODS.CREATE_CONTACT,
      }
    );
  });

  it('successful deletion of contacts', async () => {
    const successResponsePayload = <WebexRequestPayload>{
      statusCode: 204,
    };

    contactClient['contacts'] = [mockContactListOne[0]];
    webex.request.mockResolvedValue(successResponsePayload);
    const response = await contactClient.deleteContact(mockContactListOne[0].contactId);

    expect(response.statusCode).toEqual(204);
    expect(webex.request).toBeCalledOnceWith({
      uri: `${contactServiceUrl}/${mockContactListOne[0].contactId}`,
      method: HTTP_METHODS.DELETE,
    });
    expect(contactClient['contacts']).toEqual([]);

    expect(log.info).toBeCalledWith(
      `${METHOD_START_MESSAGE} with contactId: ${mockContactListOne[0].contactId}`,
      {
        file: CONTACTS_CLIENT,
        method: METHODS.DELETE_CONTACT,
      }
    );
    expect(log.info).toBeCalledWith(`Deleting contact : ${mockContactListOne[0].contactId}`, {
      file: CONTACTS_CLIENT,
      method: METHODS.DELETE_CONTACT,
    });
  });

  it('delete a contact - service unavailable', async () => {
    contactClient['contacts'] = mockContactListOne;

    webex.request.mockRejectedValue(failureResponsePayload);
    const response = await contactClient.deleteContact(mockContactListOne[0].contactId);

    expect(response.statusCode).toEqual(503);
    expect(webex.request).toBeCalledOnceWith({
      uri: `${contactServiceUrl}/${mockContactListOne[0].contactId}`,
      method: HTTP_METHODS.DELETE,
    });

    expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(failureResponsePayload, {
      file: CONTACTS_CLIENT,
      method: METHODS.DELETE_CONTACT,
    });

    expect(contactClient['contacts']).toEqual(mockContactListOne);

    expect(log.info).toBeCalledWith(
      `${METHOD_START_MESSAGE} with contactId: ${mockContactListOne[0].contactId}`,
      {
        file: CONTACTS_CLIENT,
        method: METHODS.DELETE_CONTACT,
      }
    );
    expect(log.info).toBeCalledWith(`Deleting contact : ${mockContactListOne[0].contactId}`, {
      file: CONTACTS_CLIENT,
      method: METHODS.DELETE_CONTACT,
    });
  });

  it('test resolveContacts function for a minimal contact with few details', () => {
    const contact = contactClient['resolveCloudContacts'](
      {userId: mockContactMinimum},
      mockSCIMMinListResponse.body
    );

    expect(contact).toEqual([
      {
        avatarURL: '',
        avatarUrlDomain: undefined,
        contactId: 'userId',
        contactType: 'CLOUD',
        department: undefined,
        displayName: undefined,
        emails: undefined,
        encryptionKeyUrl: 'kms://cisco.com/keys/dcf18f9d-155e-44ff-ad61-c8a69b7103ab',
        firstName: undefined,
        groups: ['1561977e-3443-4ccf-a591-69686275d7d2'],
        lastName: undefined,
        manager: undefined,
        ownerId: 'ownerId',
        phoneNumbers: undefined,
        sipAddresses: undefined,
        resolved: true,
      },
    ]);
  });

  it("test resolveContacts function when contactsDataMap list doesn't match resolved list", () => {
    const mockContact = {
      firstName: 'Jane',
      lastName: 'Doe',
      contactId: 'janeDoe',
    };

    const contact = contactClient['resolveCloudContacts'](
      {userId: mockContactMinimum, janeDoe: mockContact},
      mockSCIMMinListResponse.body
    );

    expect(contact).toEqual([
      {
        firstName: 'Jane',
        lastName: 'Doe',
        contactId: 'janeDoe',
        resolved: false,
      },
      {
        avatarURL: '',
        avatarUrlDomain: undefined,
        contactId: 'userId',
        contactType: 'CLOUD',
        department: undefined,
        displayName: undefined,
        emails: undefined,
        encryptionKeyUrl: 'kms://cisco.com/keys/dcf18f9d-155e-44ff-ad61-c8a69b7103ab',
        firstName: undefined,
        groups: ['1561977e-3443-4ccf-a591-69686275d7d2'],
        lastName: undefined,
        manager: undefined,
        ownerId: 'ownerId',
        phoneNumbers: undefined,
        sipAddresses: undefined,
        resolved: true,
      },
    ]);
  });

  it('test resolveContacts function encountering an error', () => {
    const warnSpy = jest.spyOn(log, 'warn');

    const contact = contactClient['resolveCloudContacts'](
      {userId: mockContactMinimum},
      mockSCIMMinListResponse
    );

    expect(contact).toEqual(null);
    expect(warnSpy).toHaveBeenCalledWith('Error occurred while parsing resolved contacts', {
      file: CONTACTS_CLIENT,
      method: 'resolveCloudContacts',
    });
  });

  it('logs error for chunk when scimQuery API call fails in the loop for getContacts', async () => {
    const mockData = errorCodes[0];
    const respPayload = {
      statusCode: mockData.inputStatusCode,
      body: mockData.payloadData,
    };
    webex.request.mockResolvedValueOnce(respPayload).mockRejectedValueOnce({
      ...respPayload,
      statusCode: 503,
      message: FAILURE_MESSAGE,
      data: mockData.payloadData,
    });

    mockData.decryptTextList.forEach((text) => {
      webex.internal.encryption.decryptText.mockResolvedValueOnce(text);
    });

    const warnSpy = jest.spyOn(log, 'warn');
    const infoSpy = jest.spyOn(log, 'info');
    const logSpy = jest.spyOn(log, 'log');

    await contactClient.getContacts();

    expect(webex.request).toBeCalledTimes(2);
    expect(warnSpy).toBeCalledTimes(1);
    expect(warnSpy).toBeCalledWith('Error processing contact chunk 0-50', {
      file: CONTACTS_CLIENT,
      method: METHODS.GET_CONTACTS,
    });
    expect(infoSpy).toBeCalledWith(METHOD_START_MESSAGE, {
      file: CONTACTS_CLIENT,
      method: METHODS.GET_CONTACTS,
    });
    expect(logSpy).toBeCalledWith('Successfully fetched contacts and groups', {
      file: CONTACTS_CLIENT,
      method: METHODS.GET_CONTACTS,
    });
  });

  describe('ContactsClient concurrency', () => {
    /*
     * Several fixtures used elsewhere in this file (e.g. mockGroupResponse,
     * mockContactGroupListOne) are shared object/array references that other
     * tests mutate in place (createContactGroup does `group.displayName =
     * displayName` on the response body, and `this.groups?.push(group)` can
     * leak a created group into a shared array). These concurrency tests build
     * their own independent response payloads and groups arrays so they are
     * not affected by, and do not contribute to, that cross-test state.
     */
    const buildGroupResponsePayload = (): WebexRequestPayload =>
      (<WebexRequestPayload>{
        statusCode: 201,
        body: {
          meta: {created: '2024-01-01T00:00:00.000Z', lastModified: '2024-01-01T00:00:00.000Z'},
          groupId: 'concurrency-test-group-id',
          groupType: 'NORMAL',
          ownerId: 'concurrency-test-owner',
          displayName: 'placeholder',
          members: [] as string[],
          encryptionKeyUrl: 'kms://cisco.com/keys/concurrency-test-key',
          isMigration: false,
        },
      }) as WebexRequestPayload;

    it('createContactGroup uniqueness is race-safe', async () => {
      contactClient['groups'] = [];

      webex.request.mockReset();
      webex.request.mockImplementation(() => Promise.resolve(buildGroupResponsePayload()));
      webex.internal.encryption.encryptText.mockReset();
      webex.internal.encryption.encryptText.mockResolvedValue('Encrypted Concurrency Group');

      /* Two concurrent calls for the same displayName race the check-then-push;
       * only one may create the group (R2/AC-5). */
      const concurrencyGroupName = 'Concurrency Test Group';
      const firstCall = contactClient.createContactGroup(
        concurrencyGroupName,
        'kms://cisco.com/keys/concurrency-test-key'
      );
      const secondCall = contactClient.createContactGroup(
        concurrencyGroupName,
        'kms://cisco.com/keys/concurrency-test-key'
      );

      const responses = await Promise.all([firstCall, secondCall]);

      expect(responses.filter((res) => res.statusCode === 201)).toHaveLength(1);
      const duplicateResponse = responses.find((res) => res.statusCode === 400);

      expect(duplicateResponse?.data).toEqual({error: 'Group displayName already exists'});
      expect(webex.request).toHaveBeenCalledTimes(1);
      expect(contactClient['groups']).toHaveLength(1);
    });

    it('getContacts does not overwrite concurrent updates', async () => {
      /* webex.request/encryptText/decryptText are shared mocks across this
       * file's tests and mockClear()/clearAllMocks() (afterEach, jest.config.js
       * clearMocks) do not drop queued once-implementations left over from an
       * earlier test; reset them so this test's exact call sequence is
       * deterministic. */
      webex.request.mockReset();
      webex.internal.encryption.encryptText.mockReset();
      webex.internal.encryption.decryptText.mockReset();

      const initialGroups: ContactGroup[] = [
        {
          meta: {created: '2024-01-01T00:00:00.000Z', lastModified: '2024-01-01T00:00:00.000Z'},
          groupId: 'concurrency-initial-group-id',
          groupType: GroupType.NORMAL,
          ownerId: 'concurrency-test-owner',
          displayName: 'Initial Group',
          members: [],
          encryptionKeyUrl: 'kms://cisco.com/keys/concurrency-test-key',
        } as ContactGroup,
      ];

      contactClient['groups'] = initialGroups;
      contactClient['contacts'] = [];

      /* createContactGroup's check-then-push holds the shared mutex across its
       * awaited network request. Keep that request pending so its critical
       * section stays open while a concurrent getContacts() is exercised. */
      let resolveGroupRequest: (value: WebexRequestPayload) => void = () => {};
      const pendingGroupRequest = new Promise<WebexRequestPayload>((resolve) => {
        resolveGroupRequest = resolve;
      });

      webex.request.mockImplementationOnce(() => pendingGroupRequest);
      webex.internal.encryption.encryptText.mockResolvedValue('Encrypted Concurrency Group');

      const groupCall = contactClient.createContactGroup(
        'Concurrency Test Group',
        'kms://cisco.com/keys/concurrency-test-key'
      );

      /* Let createContactGroup reach its awaited (still-pending) request while
       * holding the mutex for its check-then-push critical section. Advance the
       * microtask queue one tick at a time - flushPromises(N) awaits N
       * already-resolved promises together and settles in ~1-2 ticks regardless
       * of N, it does not step through N sequential awaits. */
      const advanceMicrotasks = async (steps: number) => {
        for (let i = 0; i < steps; i += 1) {
          await flushPromises(1);
        }
      };

      await advanceMicrotasks(5);

      const respPayload = <WebexRequestPayload>{
        statusCode: 200,
        body: mockContactResponseBodyTwo,
      };

      webex.request.mockResolvedValueOnce(respPayload);
      webex.internal.encryption.decryptText
        .mockResolvedValueOnce(mockDisplayNameTwo)
        .mockResolvedValueOnce(mockGroupName);

      const getContactsCall = contactClient.getContacts();

      await advanceMicrotasks(20);

      /* getContacts has fetched and decrypted its response but must not have
       * overwritten this.groups/this.contacts yet - createContactGroup's
       * critical section still holds the mutex (R2/AC-5). */
      expect(contactClient['groups']).toEqual(initialGroups);
      expect(contactClient['contacts']).toEqual([]);

      resolveGroupRequest(buildGroupResponsePayload());
      await groupCall;
      const getContactsResponse = await getContactsCall;

      /* Spot-check stable fields rather than deep-equal against
       * mockContactGroupListTwo/mockContactListTwo: those fixtures are shared,
       * mutable object references that other tests in this file modify in
       * place (e.g. slicing then reassigning a contact's `groups`), so a full
       * snapshot comparison here would be order-dependent on unrelated tests. */
      expect(getContactsResponse.statusCode).toEqual(200);
      expect(contactClient['groups']).toHaveLength(1);
      expect(contactClient['groups']?.[0].displayName).toEqual(mockGroupName);
      expect(contactClient['contacts']).toHaveLength(1);
      expect(contactClient['contacts']?.[0].displayName).toEqual(mockDisplayNameTwo);
      expect(contactClient['contacts']?.[0].contactId).toEqual(
        mockContactResponseBodyTwo.contacts[0].contactId
      );
    });

    it('fetchDefaultGroup does not create duplicate default groups', async () => {
      contactClient['groups'] = [];
      contactClient['defaultGroupId'] = '';
      contactClient['encryptionKeyUrl'] = 'kms://cisco.com/keys/concurrency-test-key';

      webex.request.mockReset();
      webex.request.mockImplementation(() => Promise.resolve(buildGroupResponsePayload()));
      webex.internal.encryption.encryptText.mockReset();
      webex.internal.encryption.encryptText.mockResolvedValue('Encrypted Other');

      /* Two concurrent callers with no default group yet race the
       * check-then-create; both must converge on the same defaultGroupId
       * rather than creating two default groups (R2/AC-5). */
      const [firstGroupId, secondGroupId] = await Promise.all([
        contactClient['fetchDefaultGroup'](),
        contactClient['fetchDefaultGroup'](),
      ]);

      expect(firstGroupId).toEqual(secondGroupId);
      expect(firstGroupId).not.toEqual('');
      expect(webex.request).toHaveBeenCalledTimes(1);
      expect(contactClient['groups']).toHaveLength(1);
    });
  });
});

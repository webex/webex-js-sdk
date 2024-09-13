import {HTTP_METHODS, SCIMListResponse, WebexRequestPayload} from '../common/types';
import {getTestUtilsWebex} from '../common/testUtil';
import {LOGGER} from '../Logger/types';
import {Contact, ContactResponse, IContacts} from './types';
import {createContactsClient} from './ContactsClient';
import {
  FAILURE_MESSAGE,
  IDENTITY_ENDPOINT_RESOURCE,
  SCIM_ENDPOINT_RESOURCE,
  SCIM_USER_FILTER,
  SUCCESS_MESSAGE,
} from '../common/constants';
import log from '../Logger';
import {
  CONTACTS_FILE,
  CONTACT_FILTER,
  ENCRYPT_FILTER,
  DEFAULT_GROUP_NAME,
  USERS,
  GROUP_FILTER,
  CONTACTS_SCHEMA,
} from './constants';
import * as utils from '../common/Utils';
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
  const scimUrl = `${webex.internal.services._serviceUrls.identity}/${IDENTITY_ENDPOINT_RESOURCE}/${SCIM_ENDPOINT_RESOURCE}/${webex.internal.device.orgId}/${SCIM_USER_FILTER}id%20eq%20%22801bb994-343b-4f6b-97ae-d13c91d4b877%22`;
  // eslint-disable-next-line no-underscore-dangle
  const contactServiceGroupUrl = `${webex.internal.services._serviceUrls.contactsService}/${ENCRYPT_FILTER}/${USERS}/${GROUP_FILTER}`;
  const serviceErrorCodeHandlerSpy = jest.spyOn(utils, 'serviceErrorCodeHandler');
  const failureResponsePayload = <WebexRequestPayload>{
    statusCode: 503,
    body: {},
  };
  const mockGroupResponse = mockContactResponseBodyOne.groups[0];

  beforeEach(() => {
    contactClient = createContactsClient(webex, {level: LOGGER.INFO});

    expect(contactClient).toBeTruthy();
    expect(contactClient.getSDKConnector().getWebex()).toBeTruthy();
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
            'cisco-device-url':
              'https://wdm-intb.ciscospark.com/wdm/api/v1/devices/c5ae3b86-1bb7-40f1-a6a9-c296ee7e61d5',
            'spark-user-agent': 'webex-calling/beta',
          },
        });
      }
    } else {
      expect(webex.request).toBeCalledOnceWith({
        uri: contactServiceUrl,
        method: HTTP_METHODS.GET,
      });
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
          file: CONTACTS_FILE,
          method: 'getContacts',
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
  });

  it('create a contact group with existing key info', async () => {
    const successResponsePayload = <WebexRequestPayload>{
      statusCode: 201,
      body: mockGroupResponse,
    };

    contactClient['groups'] = mockContactGroupListOne;
    webex.request.mockResolvedValue(successResponsePayload);

    webex.internal.encryption.encryptText.mockResolvedValue('Encrypted Top Contacts');
    const logInfoSpy = jest.spyOn(log, 'info');
    const contactsResponse = await contactClient.createContactGroup('Top Contacts');

    expect(contactsResponse.statusCode).toEqual(201);
    expect(contactsResponse.data.group?.groupId).toBe(mockGroupResponse.groupId);
    expect(logInfoSpy).not.toBeCalledWith('Requesting kms for a new KRO and key', {
      file: CONTACTS_FILE,
      method: 'createNewEncryptionKeyUrl',
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
        file: CONTACTS_FILE,
        method: 'createContactGroup',
      }
    );
    expect(contactClient['groups']).toEqual(mockContactResponseBodyOne.groups);
  });

  it('create a contact group - service unavailable', async () => {
    const loggerContext = {
      file: CONTACTS_FILE,
      method: 'createContactGroup',
    };

    contactClient['groups'] = mockContactGroupListOne;
    webex.request.mockRejectedValue(failureResponsePayload);
    webex.internal.encryption.kms.createUnboundKeys.mockResolvedValue([mockKmsKey]);
    webex.internal.encryption.kms.createResource.mockResolvedValue(mockKmsKey);
    webex.internal.encryption.encryptText.mockResolvedValueOnce('Encrypted group name');
    const warnSpy = jest.spyOn(log, 'warn');
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
    expect(warnSpy).toBeCalledTimes(2);
    expect(warnSpy).toHaveBeenNthCalledWith(1, 'Unable to create contact group.', loggerContext);
    expect(warnSpy).toHaveBeenNthCalledWith(
      2,
      '503 Unable to establish a connection with the server',
      loggerContext
    );

    expect(contactClient['groups']).toEqual(mockContactGroupListOne);
    expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(failureResponsePayload, loggerContext);
  });

  it('delete a contact group - service unavailable', async () => {
    const loggerContext = {
      file: CONTACTS_FILE,
      method: 'deleteContactGroup',
    };

    contactClient['groups'] = mockContactGroupListOne;
    webex.request.mockRejectedValue(failureResponsePayload);
    webex.internal.encryption.kms.createUnboundKeys.mockResolvedValue([mockKmsKey]);
    webex.internal.encryption.kms.createResource.mockResolvedValue(mockKmsKey);
    const warnSpy = jest.spyOn(log, 'warn');
    const contactsResponse = await contactClient.deleteContactGroup(mockGroupResponse.groupId);

    expect(contactsResponse.statusCode).toBe(503);
    expect(webex.request).toBeCalledOnceWith({
      method: HTTP_METHODS.DELETE,
      uri: `${contactServiceGroupUrl}/${mockGroupResponse.groupId}`,
    });
    expect(warnSpy).toBeCalledTimes(2);
    expect(warnSpy).toHaveBeenNthCalledWith(
      1,
      `Unable to delete contact group ${mockGroupResponse.groupId}`,
      loggerContext
    );
    expect(warnSpy).toHaveBeenNthCalledWith(
      2,
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
  });

  it('create a contact with an existing group', async () => {
    const mockContactResponse = mockContactResponseBodyTwo.contacts[0];
    const successResponsePayload = <WebexRequestPayload>{
      statusCode: 201,
      body: mockContactResponse,
    };

    webex.request.mockResolvedValue(successResponsePayload);
    webex.internal.encryption.encryptText.mockResolvedValue('Encrypted contact name');
    const logSpy = jest.spyOn(log, 'info');

    contactClient['groups'] = mockContactGroupListOne;
    contactClient['encryptionKeyUrl'] = mockContactGroupListOne[0].encryptionKeyUrl;

    const contact = mockContactListTwo.slice()[0] as Contact;

    contact.groups = [];

    const res: ContactResponse = await contactClient.createContact(contact);

    expect(res.statusCode).toEqual(201);
    expect(res.data.contact?.contactId).toBe(mockContactResponse.contactId);
    expect(logSpy).not.toBeCalledWith('Created a KRO and encryptionKeyUrl', {
      file: CONTACTS_FILE,
      method: 'createNewEncryptionKeyUrl',
    });

    expect(logSpy).not.toBeCalledWith('Created a KRO and encryptionKeyUrl', {
      file: CONTACTS_FILE,
      method: 'createNewEncryptionKeyUrl',
    });
    expect(logSpy).not.toBeCalledWith(`Creating a default group: ${DEFAULT_GROUP_NAME}`, {
      file: CONTACTS_FILE,
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
      file: CONTACTS_FILE,
      method: 'fetchEncryptionKeyUrl',
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
        'cisco-device-url':
          'https://wdm-intb.ciscospark.com/wdm/api/v1/devices/c5ae3b86-1bb7-40f1-a6a9-c296ee7e61d5',
        'spark-user-agent': 'webex-calling/beta',
      },
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
      file: CONTACTS_FILE,
      method: 'createContact',
    });
    expect(res.statusCode).toEqual(503);
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
      file: CONTACTS_FILE,
      method: 'deleteContact',
    });

    expect(contactClient['contacts']).toEqual(mockContactListOne);
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
      },
    ]);
  });

  it('test resolveContacts function encountering an error', () => {
    const contact = contactClient['resolveCloudContacts'](
      {userId: mockContactMinimum},
      mockSCIMMinListResponse
    );

    expect(contact).toEqual(null);
  });
});

import {HTTP_METHODS} from '../common/types';
import {getTestUtilsWebex} from '../common/testUtil';
import {LOGGER} from '../Logger/types';
import {IContacts} from './types';
import {createContactsClient} from './ContactsClient';
import {CONTACTS_FILE, CONTACT_FILTER, ENCRYPT_FILTER, USERS} from './constants';
import * as utils from '../common/Utils';
import {FAILURE_MESSAGE, SUCCESS_MESSAGE} from '../common/constants';
import {
  mockCity,
  mockCompany,
  mockContactListTwo,
  mockContactResponseBodyTwo,
  mockContactListOne,
  mockContactResponseBodyOne,
  mockCountry,
  mockDisplayNameOne,
  mockDSSResponse,
  mockEmail,
  mockFirstName,
  mockLastName,
  mockNumber1,
  mockNumber2,
  mockSipAddress,
  mockState,
  mockStreet,
  mockTitle,
  mockZipCode,
  mockDisplayNameTwo,
  mockContactResponseBodyThird,
} from './contactFixtures';

describe('ContactClient Tests', () => {
  const webex = getTestUtilsWebex();

  let contactClient: IContacts | undefined;

  afterEach(() => {
    contactClient = undefined;
  });

  // eslint-disable-next-line no-underscore-dangle
  const contactServiceUrl = `${webex.internal.services._serviceUrls.contactsService}/${ENCRYPT_FILTER}/${USERS}/${CONTACT_FILTER}`;
  const serviceErrorCodeHandlerSpy = jest.spyOn(utils, 'serviceErrorCodeHandler');

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
  }[] = [
    {
      name: 'Success case 1: fetch contacts using get contacts api, custom and cloud contact present',
      payloadData: mockContactResponseBodyOne,
      inputStatusCode: 200,
      expectedData: {contactList: mockContactListOne},
      expectedMessage: SUCCESS_MESSAGE,
      expectedStatusCode: 200,
      decryptTextList: [
        mockCity,
        mockCountry,
        mockState,
        mockStreet,
        mockZipCode,
        mockCompany,
        mockDisplayNameOne,
        mockFirstName,
        mockLastName,
        mockEmail,
        mockNumber1,
        mockNumber2,
        mockSipAddress,
        mockTitle,
      ],
    },
    {
      name: 'Success case 2: fetch contacts using get contacts api, single custom contact with mandatory details present',
      payloadData: mockContactResponseBodyTwo,
      inputStatusCode: 200,
      expectedData: {contactList: mockContactListTwo},
      expectedMessage: SUCCESS_MESSAGE,
      expectedStatusCode: 200,
      decryptTextList: [mockDisplayNameTwo],
    },
    {
      name: 'Success case 3: fetch contacts using get contacts api, no contacts returned',
      payloadData: mockContactResponseBodyThird,
      inputStatusCode: 200,
      expectedData: {contactList: []},
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
      webex.internal.dss.lookup.mockResolvedValueOnce(mockDSSResponse);
    } else {
      respPayload['message'] = FAILURE_MESSAGE;
      respPayload['data'] = codeObj.payloadData;
      webex.request.mockRejectedValueOnce(respPayload);
    }

    contactClient = createContactsClient(webex, {level: LOGGER.INFO});

    expect(contactClient).toBeTruthy();
    expect(contactClient.getSDKConnector().getWebex()).toBeTruthy();

    const contactsResponse = await contactClient.getContacts();

    expect(webex.request).toBeCalledOnceWith({
      uri: contactServiceUrl,
      method: HTTP_METHODS.GET,
    });

    expect(contactsResponse).toEqual({
      data: codeObj.expectedData,
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
});

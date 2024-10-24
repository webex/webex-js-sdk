/* eslint-disable dot-notation */
import {DisplayInformation} from '../../../common/types';
import {getTestUtilsWebex} from '../../../common/testUtil';
import {createCallerId} from '.';
import log from '../../../Logger';
import {ICallerId} from './types';

const waitForMsecs = (msec: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, msec);
  });

const webex = getTestUtilsWebex();

describe('CallerId tests', () => {
  const dummyAvatar =
    'https://avatar-int-us-east-1.webexcontent.com/Avtr~V1~1704d30d-a131-4bc7-9449-948487643793/V1~bf911e86a1561896d7d0053b46a8d0c9ed82a7bc434a1f84621c2c45cc825f37~3720694b1e4340818a3d12d70eb2b6e1~80';

  const dummyScimResponse = {
    totalResults: '1',
    itemsPerPage: '1',
    startIndex: '1',
    schemas: ['urn:scim:schemas:core:1.0', 'urn:scim:schemas:extension:cisco:commonidentity:1.0'],
    Resources: [
      {
        userName: 'atlas.test.wxcwebrtc+user8@gmail.com',
        emails: [
          {
            primary: true,
            type: 'work',
            value: 'atlas.test.wxcwebrtc+user8@gmail.com',
          },
        ],
        name: {
          givenName: 'Cathy',
          familyName: 'James',
        },
        phoneNumbers: [
          {
            primary: true,
            type: 'work',
            value: '5008',
          },
        ],
        entitlements: [
          'basic-meeting',
          'basic-message',
          'bc-sp-standard',
          'screen-share',
          'spark',
          'spark-test-account',
          'squared-call-initiation',
          'webex-squared',
        ],
        cisSyncSource: 'SCIM',
        photos: [
          {
            type: 'photo',
            value: dummyAvatar,
          },
          {
            type: 'thumbnail',
            value: dummyAvatar,
          },
        ],
        id: '652fe0c7-05ce-4acd-8bda-9a080830187f',
        meta: {
          created: '2022-03-16T16:13:53.847Z',
          lastModified: '2022-05-31T14:39:12.782Z',
          lastLoginTime: '2022-05-31T14:39:12.780Z',
          version: 'W/"66025591113"',
          location:
            'https://identitybts.webex.com/identity/scim/1704d30d-a131-4bc7-9449-948487643793/v1/Users/652fe0c7-05ce-4acd-8bda-9a080830187f',
          organizationID: '1704d30d-a131-4bc7-9449-948487643793',
          creator: '97fe25e3-d3e8-400e-856b-5b0cd5b0c790',
          modifier: '8c7abf2f-0c8e-49cf-b8e4-693d4ec7daee',
        },
        displayName: 'Cathy',
        active: true,
        licenseID: ['BCSTD_8c81f40c-e848-484e-8ca8-0fb6dabc75a5'],
        userSettings: ['{"spark.signUpDate":"1648547902173"}', '{"user-origin":"admin-invited"}'],
        sipAddresses: [
          {
            type: 'cloud-calling',
            value: 'atlas.test.wxcwebrtc+user8@webrtcmobius.call.wbx2.com',
            primary: true,
          },
        ],
        isTeamsOnJabberEnabled: false,
        isUCCallOnJabberEnabled: false,
        userType: 'user',
        mfaEnabled: false,
        teamsClusterId: 'urn:TEAM:us-east-1_int13',
      },
    ],
  };

  webex.request.mockResolvedValue({
    statusCode: 200,
    body: dummyScimResponse,
  });

  let callerId: ICallerId;

  it('create callerId Object', () => {
    callerId = createCallerId(webex, () => log.log('dummy print', {}));
    expect(callerId).toBeTruthy();
  });

  /* Follow tests will follow different combinations of the headers.
   * We will check whether the priority order is followed or not.
   */
  it(' When PA-ID, From header is present along with x-broad-works, ', async () => {
    const dummyCallerId = {
      'x-broadworks-remote-party-info':
        'userId="nkjwuovmbo@64941297.int10.bcld.webex.com";userDn="tel:+12142865888;ext=5888;country-code=1";externalId=69fde5ad-fb8b-4a1b-9998-b0999e95719b',
      'p-asserted-identity': '"John O\'Connor - ( Guest )" <sip:5888@10.155.4.7;user=phone>',
      from: '"Alice" <sip:5889@64941297.int10.bcld.webex.com>;tag=1932136170-1654008881246',
    };

    const output = callerId.fetchCallerDetails(dummyCallerId);

    /* PAI should be preferred */
    expect(output.name).toStrictEqual("John O'Connor - ( Guest )");
    expect(output.num).toStrictEqual('5888');
    await waitForMsecs(50);

    /* Should be overwritten by x-broadworks */
    expect(callerId['callerInfo'].avatarSrc).toStrictEqual(dummyAvatar);
    expect(callerId['callerInfo'].id).toStrictEqual(dummyScimResponse.Resources[0].id);
    expect(callerId['callerInfo'].name).toStrictEqual('Cathy');
    expect(callerId['callerInfo'].num).toStrictEqual('5008');
  });

  it(' When PA-ID ,From header is present along with x-broad-works , but name in PAI is missing', async () => {
    const dummyCallerId = {
      'x-broadworks-remote-party-info':
        'userId="nkjwuovmbo@64941297.int10.bcld.webex.com";userDn="tel:+12142865888;ext=5888;country-code=1";externalId=69fde5ad-fb8b-4a1b-9998-b0999e95719b',
      'p-asserted-identity': '<sip:5888@10.155.4.7;user=phone>',
      from: '"Alice" <sip:5889@64941297.int10.bcld.webex.com>;tag=1932136170-1654008881246',
    };

    callerId['callerInfo'] = {} as DisplayInformation;
    const output = callerId.fetchCallerDetails(dummyCallerId);

    /* PAI name is ignored and From's name should be taken, but number is taken from PAI */
    expect(output.name).toStrictEqual('Alice');
    expect(output.num).toStrictEqual('5888');
    await waitForMsecs(50);

    /* Should be overwritten by x-broadworks */
    expect(callerId['callerInfo'].avatarSrc).toStrictEqual(dummyAvatar);
    expect(callerId['callerInfo'].id).toStrictEqual(dummyScimResponse.Resources[0].id);
    expect(callerId['callerInfo'].name).toStrictEqual('Cathy');
    expect(callerId['callerInfo'].num).toStrictEqual('5008');
  });

  it(' When PA-ID ,From header is present along with x-broad-works , but name, number in PAI is missing', async () => {
    const dummyCallerId = {
      'x-broadworks-remote-party-info':
        'userId="nkjwuovmbo@64941297.int10.bcld.webex.com";userDn="tel:+12142865888;ext=5888;country-code=1";externalId=69fde5ad-fb8b-4a1b-9998-b0999e95719b',
      'p-asserted-identity': '<sip:69fde5ad-fb8b-4a1b-9998-b0999e95719b@10.155.4.7;user=phone>',
      from: '"Alice" <sip:5889@64941297.int10.bcld.webex.com>;tag=1932136170-1654008881246',
    };

    callerId['callerInfo'] = {} as DisplayInformation;
    const output = callerId.fetchCallerDetails(dummyCallerId);

    /* PAI name and number is ignored and From's name, number should be taken  */
    expect(output.name).toStrictEqual('Alice');
    expect(output.num).toStrictEqual('5889');
    await waitForMsecs(50);

    /* Should be overwritten by x-broadworks */
    expect(callerId['callerInfo'].avatarSrc).toStrictEqual(dummyAvatar);
    expect(callerId['callerInfo'].id).toStrictEqual(dummyScimResponse.Resources[0].id);
    expect(callerId['callerInfo'].name).toStrictEqual('Cathy');
    expect(callerId['callerInfo'].num).toStrictEqual('5008');
  });

  it(' When PA-ID is present but From header is absent', async () => {
    const dummyCallerId = {
      'x-broadworks-remote-party-info':
        'userId="nkjwuovmbo@64941297.int10.bcld.webex.com";userDn="tel:+12142865888;ext=5888;country-code=1";externalId=69fde5ad-fb8b-4a1b-9998-b0999e95719b',
      'p-asserted-identity': '"Bob Marley" <sip:5888@10.155.4.7;user=phone>',
    };

    callerId['callerInfo'] = {} as DisplayInformation;
    const output = callerId.fetchCallerDetails(dummyCallerId);

    /* PAI name and number is taken */
    expect(output.name).toStrictEqual('Bob Marley');
    expect(output.num).toStrictEqual('5888');
    await waitForMsecs(50);

    /* Should be overwritten by x-broadworks */
    expect(callerId['callerInfo'].avatarSrc).toStrictEqual(dummyAvatar);
    expect(callerId['callerInfo'].id).toStrictEqual(dummyScimResponse.Resources[0].id);
    expect(callerId['callerInfo'].name).toStrictEqual('Cathy');
    expect(callerId['callerInfo'].num).toStrictEqual('5008');
  });

  it(' When PA-ID, From header is present but x-broad-works does not have externalId, ', async () => {
    const dummyCallerId = {
      'x-broadworks-remote-party-info':
        'userId="nkjwuovmbo@64941297.int10.bcld.webex.com";userDn="tel:+12142865888;ext=5888;country-code=1";',
      'p-asserted-identity': '"Bob Marley" <sip:5888@10.155.4.7;user=phone>',
      from: '"Alice" <sip:5889@64941297.int10.bcld.webex.com>;tag=1932136170-1654008881246',
    };

    callerId['callerInfo'] = {} as DisplayInformation;
    const output = callerId.fetchCallerDetails(dummyCallerId);

    /* PAI should be preferred */
    expect(output.name).toStrictEqual('Bob Marley');
    expect(output.num).toStrictEqual('5888');
    await waitForMsecs(50);

    /* Since x-broadworks is not present , intermediary details should be retained */
    expect(callerId['callerInfo'].avatarSrc).toBeFalsy();
    expect(callerId['callerInfo'].id).toBeFalsy();
    expect(callerId['callerInfo'].name).toStrictEqual('Bob Marley');
    expect(callerId['callerInfo'].num).toStrictEqual('5888');
  });

  it(' When PA-ID, From header is present along with x-broad-works but SCIM query fails, ', async () => {
    const dummyCallerId = {
      'x-broadworks-remote-party-info':
        'userId="nkjwuovmbo@64941297.int10.bcld.webex.com";userDn="tel:+12142865888;ext=5888;country-code=1";externalId=69fde5ad-fb8b-4a1b-9998-b0999e95719b',
      'p-asserted-identity': '"Bob Marley" <sip:5888@10.155.4.7;user=phone>',
      from: '"Alice" <sip:5889@64941297.int10.bcld.webex.com>;tag=1932136170-1654008881246',
    };

    webex.request.mockRejectedValue({
      statusCode: 404,
      body: dummyScimResponse,
    });

    const warnSpy = jest.spyOn(log, 'warn');
    const output = callerId.fetchCallerDetails(dummyCallerId);

    /* PAI should be preferred */
    expect(output.name).toStrictEqual('Bob Marley');
    expect(output.num).toStrictEqual('5888');
    await waitForMsecs(50);

    expect(warnSpy).toHaveBeenCalledWith('Error response: - 404', {
      file: 'utils',
      method: 'resolveCallerIdDisplay',
    });

    /* Should not be overwritten by x-broadworks */
    expect(callerId['callerInfo'].avatarSrc).toBe(undefined);
    expect(callerId['callerInfo'].id).toBe(undefined);
    expect(callerId['callerInfo'].name).toStrictEqual('Bob Marley');
    expect(callerId['callerInfo'].num).toStrictEqual('5888');
  });
});

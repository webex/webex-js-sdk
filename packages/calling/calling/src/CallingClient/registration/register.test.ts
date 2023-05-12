import {createRegistration} from './register';
import {getTestUtilsWebex} from '../../common/testUtil';
import {ServiceIndicator} from '../../common/types';

const webex = getTestUtilsWebex();

describe('Registration Tests', () => {
  const DEVICE_ID = '9381a370-b26b-3c5b-8901-4e8dab405dcc';
  const URL = 'https://wdm-intb.ciscospark.com/wdm/api/v1/';
  const CLIENT_DEVICE_URL = 'https://clientDeviceUrl';

  const MockCreateResponse = {
    userId: '8a67806f-fc4d-446b-a131-31e71ea5b0e9',
    device: {
      deviceId: 'beb3c025-8c6a-3c44-8f3d-9b7d65363ac1',
      uri: 'https://mobius.aintgen-a-1.int.infra.webex.com/api/v1/calling/web/devices/beb3c025-8c6a-3c44-8f3d-9b7d65363ac1',
      status: 'active',
      lastSeen: '2022-04-05T05:08:46Z',
      addresses: ['sip:pbs9p4cbr9_G6JJNI5DD5NP@64941297.int10.bcld.webex.com'],
      clientDeviceUri: CLIENT_DEVICE_URL,
    },
    keepaliveInterval: 30,
    rehomingIntervalMin: 60,
    rehomingIntervalMax: 120,
  };
  const MockDeleteResponse = {
    userId: '8a67806f-fc4d-446b-a131-31e71ea5b0e9',
    device: {
      deviceId: DEVICE_ID,
      uri: 'https://mobius.aintgen-a-1.int.infra.webex.com/api/v1/calling/web/devices/9381a370-b26b-3c5b-8901-4e8dab405dcc',
      status: 'active',
      lastSeen: '2022-04-05T05:16:37Z',
      addresses: ['sip:pbs9p4cbr9_G6JJNI5DD5NP@64941297.int10.bcld.webex.com'],
      clientDeviceUri: CLIENT_DEVICE_URL,
    },
  };

  const MockServiceData = {
    indicator: ServiceIndicator.CALLING,
    domain: '',
  };
  const MockKeepAliveResponse = MockDeleteResponse;

  const reg = createRegistration(webex, MockServiceData);

  afterEach(() => {
    webex.request = jest.fn();
  });
  it('create device', async () => {
    webex.request.mockReturnValueOnce({
      body: {
        userId: '8a67806f-fc4d-446b-a131-31e71ea5b0e9',
        device: {
          deviceId: 'beb3c025-8c6a-3c44-8f3d-9b7d65363ac1',
          uri: 'https://mobius.aintgen-a-1.int.infra.webex.com/api/v1/calling/web/devices/beb3c025-8c6a-3c44-8f3d-9b7d65363ac1',
          status: 'active',
          lastSeen: '2022-04-05T05:08:46Z',
          addresses: ['sip:pbs9p4cbr9_G6JJNI5DD5NP@64941297.int10.bcld.webex.com'],
          clientDeviceUri: CLIENT_DEVICE_URL,
        },
        keepaliveInterval: 30,
        rehomingIntervalMin: 60,
        rehomingIntervalMax: 120,
      },
    });
    const response = await reg.createDevice(URL);

    expect(response.body).toStrictEqual(MockCreateResponse);
  });

  it('post keepalive ', async () => {
    webex.request.mockReturnValueOnce({
      body: {
        userId: '8a67806f-fc4d-446b-a131-31e71ea5b0e9',
        device: {
          deviceId: DEVICE_ID,
          uri: 'https://mobius.aintgen-a-1.int.infra.webex.com/api/v1/calling/web/devices/9381a370-b26b-3c5b-8901-4e8dab405dcc',
          status: 'active',
          lastSeen: '2022-04-05T05:16:37Z',
          addresses: ['sip:pbs9p4cbr9_G6JJNI5DD5NP@64941297.int10.bcld.webex.com'],
          clientDeviceUri: CLIENT_DEVICE_URL,
        },
      },
    });
    const keepAliveUrl = `${MockKeepAliveResponse.device.uri}/status`;

    const response = await reg.postKeepAlive(keepAliveUrl);

    expect(response.body).toStrictEqual(MockKeepAliveResponse);
  });

  it('delete device', async () => {
    const mockResponseBody = JSON.stringify({
      userId: '8a67806f-fc4d-446b-a131-31e71ea5b0e9',
      device: {
        deviceId: DEVICE_ID,
        uri: 'https://mobius.aintgen-a-1.int.infra.webex.com/api/v1/calling/web/devices/9381a370-b26b-3c5b-8901-4e8dab405dcc',
        status: 'active',
        lastSeen: '2022-04-05T05:16:37Z',
        addresses: ['sip:pbs9p4cbr9_G6JJNI5DD5NP@64941297.int10.bcld.webex.com'],
        clientDeviceUri: CLIENT_DEVICE_URL,
      },
    });

    global.fetch = jest.fn(() => Promise.resolve({json: () => mockResponseBody})) as jest.Mock;

    const response = await reg.deleteDevice(URL, DEVICE_ID, CLIENT_DEVICE_URL);

    expect(response).toStrictEqual(mockResponseBody);
  });
});

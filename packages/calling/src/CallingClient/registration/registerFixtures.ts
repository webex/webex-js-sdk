export const DEVICE_ID = '9381a370-b26b-3c5b-8901-4e8dab405dcc';
export const CLIENT_DEVICE_URL = 'https://clientDeviceUrl';

export const URL = 'https://wdm-intb.ciscospark.com/wdm/api/v1/';
export const mockPostResponse = {
  userId: '8a67806f-fc4d-446b-a131-31e71ea5b0e9',
  device: {
    deviceId: 'beb3c025-8c6a-3c44-8f3d-9b7d65363ac1',
    uri: 'https://wdm-intb.ciscospark.com/wdm/api/v1/calling/web/devices/beb3c025-8c6a-3c44-8f3d-9b7d65363ac1',
    status: 'active',
    lastSeen: '2022-04-05T05:08:46Z',
    addresses: ['sip:pbs9p4cbr9_G6JJNI5DD5NP@64941297.int10.bcld.webex.com'],
    clientDeviceUri: CLIENT_DEVICE_URL,
  },
  keepaliveInterval: 30,
  rehomingIntervalMin: 90,
  rehomingIntervalMax: 180,
};

export const mockDeleteResponse = {
  userId: '8a67806f-fc4d-446b-a131-31e71ea5b0e9',
  device: {
    deviceId: DEVICE_ID,
    uri: 'https://wdm-intb.ciscospark.com/wdm/api/v1/calling/web/devices/9381a370-b26b-3c5b-8901-4e8dab405dcc',
    status: 'active',
    lastSeen: '2022-04-05T05:16:37Z',
    addresses: ['sip:pbs9p4cbr9_G6JJNI5DD5NP@64941297.int10.bcld.webex.com'],
    clientDeviceUri: CLIENT_DEVICE_URL,
  },
};

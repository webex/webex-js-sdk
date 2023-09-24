export const bwToken = 'bwtoken';
export const broadworksTokenType = {
  body: {
    token: {
      bearer: bwToken,
    },
  },
};

export const broadworksUserInfoUrl =
  'https://xsp-alpha.broadcloudpbx.net/com.broadsoft.xsi-actions/v2.0/user/bgerman@wcslab.broadcloud.org/VoiceMessagingMessages';

export const broadworksUserMessageId = '274a236c-9212-4679-8b40-2786ea460538';

export const braodworksUserMessageInfo =
  '/v2.0/user/bgerman@wcslab.broadcloud.org/VoiceMessagingMessages';

export const ucmBackendInfoUrl =
  'https://gw.telemetry.int-ucmgmt.cisco.com/vmgateway/api/v1/users/8a67806f-fc4d-446b-a131-31e71ea5b0e9/voicemails';

export const voicemailContent = '/?offset=0&limit=20&sortOrder=DESC';

export const orgId = '1704d30d-a131-4bc7-9449-948487643793';

export const name = 'Adrian';
export const userid = 'admin';
export const address = 'tel1372';
export const userId = '8a67806f-fc4d-446b-a131-31e71ea5b0e9';
export const voicemailSummaryUrl = `https://api-rialto.broadcloudpbx.com/com.broadsoft.xsi-actions/v2.0/user/${userId}/calls/MessageSummary`;

const MOCK_VOICEMAIL_FIRST_MESSAGE = {
  duration: {$: '780'},
  callingPartyInfo: {
    name: {$: `${name}`},
    userId: {$: `${userid}`},
    address: {$: `${address}`},
  },
  time: {$: '1546000110000'},
  messageId: {
    $: `${braodworksUserMessageInfo}/${broadworksUserMessageId}`,
  },
};

const MOCK_VOICEMAIL_SECOND_MESSAGE = {
  duration: {$: '7800'},
  callingPartyInfo: {
    name: {$: `${name}`},
    userId: {$: `${userid}`},
    address: {$: `${address}`},
  },
  time: {$: '1658394808932'},
  messageId: {
    $: `${braodworksUserMessageInfo}/${broadworksUserMessageId}`,
  },
};

const MOCK_VOICEMAIL_THIRD_MESSAGE = {
  duration: {$: '800'},
  callingPartyInfo: {
    name: {$: `${name}`},
    userId: {$: `${userid}`},
    address: {$: `${address}`},
  },
  time: {$: '1658394908932'},
  messageId: {
    $: `${braodworksUserMessageInfo}/cc237e9e-211a-4a0a-bb58-2a931eca061d`,
  },
};

const MOCK_UCM_VOICEMAIL_FIRST_MESSAGE = {
  Duration: 780,
  MsgId: '0:476725ea-ab68-4c5d-9222-918c5bba7b6',
  ArrivalTime: 1546000110000,
  Read: 'false',
  callingPartyInfo: {
    name: `${name}`,
    userId: `${userId}`,
  },
  CallerId: {
    CallerNumber: '+14927000061',
    CallerName: `${name}`,
  },
};

const MOCK_UCM_VOICEMAIL_SECOND_MESSAGE = {
  Duration: 7800,
  MsgId: '0:67dbe36e-4a29-4d97-81ec-2dd256555cad',
  ArrivalTime: 1658394808932,
  Read: 'true',
  callingPartyInfo: {
    name: `${name}`,
    userId: `${userId}`,
  },
  CallerId: {
    CallerNumber: '+14927000061',
    CallerName: `${name}`,
  },
};

const MOCK_UCM_VOICEMAIL_THIRD_MESSAGE = {
  Duration: 800,
  MsgId: '0:e070b949-de5b-4c6b-b0d1-f696333159c2',
  ArrivalTime: 1658394908932,
  Read: 'false',
  callingPartyInfo: {
    name: `${name}`,
    userId: `${userId}`,
  },
  CallerId: {
    CallerNumber: '+14927000061',
    CallerName: `${name}`,
  },
};

const MOCK_UCM_VOICEMAIL_FOURTH_MESSAGE = {
  Duration: 27460,
  MsgId: '0:f214e5d6-cb44-4feb-a584-676bef8fe23a',
  ArrivalTime: 1658395027115,
  Read: 'true',
  callingPartyInfo: {
    name: `${name}`,
    userId: `${userId}`,
  },
  CallerId: {
    CallerNumber: '+14927000061',
    CallerName: `${name}`,
  },
};

const MOCK_UCM_VOICEMAIL_FIFTH_MESSAGE = {
  Duration: 8000,
  MsgId: '0:4a49fa22-4fbe-4d84-91ab-55867f8ded82',
  ArrivalTime: 1664900110000,
  Read: 'false',
  callingPartyInfo: {
    name: `${name}`,
    userId: `${userId}`,
  },
  CallerId: {
    CallerNumber: '+14927000061',
    CallerName: `${name}`,
  },
};

const MOCK_UCM_VOICEMAIL_EXPECTED_FIFTH_MESSAGE = {
  duration: {
    $: 8000,
  },
  time: {
    $: 1664900110000,
  },
  messageId: {
    $: '0:4a49fa22-4fbe-4d84-91ab-55867f8ded82',
  },
  callingPartyInfo: {
    name: {
      $: name,
    },
    userId: {
      $: userId,
    },
    address: {
      $: '+14927000061',
    },
  },
};

const MOCK_UCM_VOICEMAIL_EXPECTED_FOURTH_MESSAGE = {
  duration: {
    $: 27460,
  },
  time: {
    $: 1658395027115,
  },
  messageId: {
    $: '0:f214e5d6-cb44-4feb-a584-676bef8fe23a',
  },
  read: {},
  callingPartyInfo: {
    name: {
      $: name,
    },
    userId: {
      $: userId,
    },
    address: {
      $: '+14927000061',
    },
  },
};

const MOCK_UCM_VOICEMAIL_EXPECTED_THIRD_MESSAGE = {
  duration: {
    $: 800,
  },
  time: {
    $: 1658394908932,
  },
  messageId: {
    $: '0:e070b949-de5b-4c6b-b0d1-f696333159c2',
  },
  callingPartyInfo: {
    name: {
      $: name,
    },
    userId: {
      $: userId,
    },
    address: {
      $: '+14927000061',
    },
  },
};

const MOCK_UCM_VOICEMAIL_EXPECTED_SECOND_MESSAGE = {
  duration: {
    $: 7800,
  },
  time: {
    $: 1658394808932,
  },
  messageId: {
    $: '0:67dbe36e-4a29-4d97-81ec-2dd256555cad',
  },
  read: {},
  callingPartyInfo: {
    name: {
      $: name,
    },
    userId: {
      $: userId,
    },
    address: {
      $: '+14927000061',
    },
  },
};

const MOCK_UCM_VOICEMAIL_EXPECTED_FIRST_MESSAGE = {
  duration: {
    $: 780,
  },
  time: {
    $: 1546000110000,
  },
  messageId: {
    $: '0:476725ea-ab68-4c5d-9222-918c5bba7b6',
  },
  callingPartyInfo: {
    name: {
      $: name,
    },
    userId: {
      $: userId,
    },
    address: {
      $: '+14927000061',
    },
  },
};

const MOCK_VOICEMAIL_FOURTH_MESSAGE = {
  duration: {$: '27460'},
  callingPartyInfo: {
    name: {$: `${name}`},
    userId: {$: `${userid}`},
    address: {$: `${address}`},
  },
  time: {$: '1658395027115'},
  messageId: {
    $: `${braodworksUserMessageInfo}/bb99e8ca-c8b1-49cf-b3b7-42d503abeda8`,
  },
};

const MOCK_VOICEMAIL_FIFTH_MESSAGE = {
  duration: {$: '8000'},
  callingPartyInfo: {
    name: {$: `${name}`},
    userId: {$: `${userid}`},
    address: {$: `${address}`},
  },
  time: {$: '1664900110000'},
  messageId: {
    $: `${braodworksUserMessageInfo}/aa237e9e-211a-4a0a-bb58-2a931eca061d`,
  },
};

export const getEmptyVoicemailListJsonBWRKS = {
  statusCode: 200,
  VoiceMessagingMessages: {
    messageInfoList: {},
  },
};

export const getInvalidVoicemailListJsonBWRKS = {
  statusCode: 200,
  VoiceMessagingMessages: {
    messageInfoList: {
      messageInfo: {},
    },
  },
};

export const getVoicemailListJsonBWRKS = {
  statusCode: 200,
  VoiceMessagingMessages: {
    messageInfoList: {
      messageInfo: [
        MOCK_VOICEMAIL_SECOND_MESSAGE,
        MOCK_VOICEMAIL_FIFTH_MESSAGE,
        MOCK_VOICEMAIL_THIRD_MESSAGE,
        MOCK_VOICEMAIL_FIRST_MESSAGE,
        MOCK_VOICEMAIL_FOURTH_MESSAGE,
      ],
    },
  },
};

export const getAscVoicemailListJsonBWRKS = {
  statusCode: 200,
  VoiceMessagingMessages: {
    messageInfoList: {
      messageInfo: [
        MOCK_VOICEMAIL_FIRST_MESSAGE,
        MOCK_VOICEMAIL_SECOND_MESSAGE,
        MOCK_VOICEMAIL_THIRD_MESSAGE,
        MOCK_VOICEMAIL_FOURTH_MESSAGE,
        MOCK_VOICEMAIL_FIFTH_MESSAGE,
      ],
    },
  },
};

export const getDescVoicemailListJsonBWRKS = {
  statusCode: 200,
  VoiceMessagingMessages: {
    messageInfoList: {
      messageInfo: [
        MOCK_VOICEMAIL_FIFTH_MESSAGE,
        MOCK_VOICEMAIL_FOURTH_MESSAGE,
        MOCK_VOICEMAIL_THIRD_MESSAGE,
        MOCK_VOICEMAIL_SECOND_MESSAGE,
        MOCK_VOICEMAIL_FIRST_MESSAGE,
      ],
    },
  },
};

export const getVoicemailListJsonWXC = {
  statusCode: 200,
  body: {
    VoiceMessagingMessages: {
      messageInfoList: {
        messageInfo: [
          MOCK_VOICEMAIL_THIRD_MESSAGE,
          MOCK_VOICEMAIL_FOURTH_MESSAGE,
          MOCK_VOICEMAIL_FIRST_MESSAGE,
          MOCK_VOICEMAIL_SECOND_MESSAGE,
          MOCK_VOICEMAIL_FIFTH_MESSAGE,
        ],
      },
    },
  },
};

export const mockBWRKSData = {
  body: {
    devices: [
      {
        settings: {
          broadworksXsiActionsUrl:
            'https://xsp-alpha.broadcloudpbx.net/com.broadsoft.xsi-actions/v2.0',
        },
      },
    ],
  },
};

export const mockVoicemailBody = {
  body: {
    statusCode: 200,
    items: [MOCK_VOICEMAIL_FIRST_MESSAGE],
  },
};

export const mockWXCData = {
  body: {
    items: [
      {
        xsiActionsEndpoint: 'https://api-rialto.broadcloudpbx.com/com.broadsoft.xsi-actions',
      },
    ],
  },
};

export const getAscVoicemailListJsonWXC = {
  statusCode: 200,
  body: {
    VoiceMessagingMessages: {
      messageInfoList: {
        messageInfo: [
          MOCK_VOICEMAIL_FIRST_MESSAGE,
          MOCK_VOICEMAIL_SECOND_MESSAGE,
          MOCK_VOICEMAIL_THIRD_MESSAGE,
          MOCK_VOICEMAIL_FOURTH_MESSAGE,
          MOCK_VOICEMAIL_FIFTH_MESSAGE,
        ],
      },
    },
  },
};

export const getDescVoicemailListJsonWXC = {
  statusCode: 200,
  body: {
    VoiceMessagingMessages: {
      messageInfoList: {
        messageInfo: [
          MOCK_VOICEMAIL_FIFTH_MESSAGE,
          MOCK_VOICEMAIL_FOURTH_MESSAGE,
          MOCK_VOICEMAIL_THIRD_MESSAGE,
          MOCK_VOICEMAIL_SECOND_MESSAGE,
          MOCK_VOICEMAIL_FIRST_MESSAGE,
        ],
      },
    },
  },
};

export const mockUCMVoicemailBody = {
  body: {
    statusCode: 200,
    items: [MOCK_UCM_VOICEMAIL_FIRST_MESSAGE],
  },
};

export const mockVoicemailContentResponse = {
  statusCode: 200,
  headers: {
    mediatype: 'audio/wav',
  },
  body: voicemailContent,
};

export const voicemailEventProcessingPayload = {
  data: {
    messageId: '1234567890',
    eventType: 'processing',
    status: 'waiting',
  },
};

export const getVoiceMailListJsonUCM = {
  statusCode: 200,
  body: {
    Message: [
      MOCK_UCM_VOICEMAIL_FIRST_MESSAGE,
      MOCK_UCM_VOICEMAIL_SECOND_MESSAGE,
      MOCK_UCM_VOICEMAIL_THIRD_MESSAGE,
      MOCK_UCM_VOICEMAIL_FOURTH_MESSAGE,
      MOCK_UCM_VOICEMAIL_FIFTH_MESSAGE,
    ],
  },
};

export const getDescVoiceMailListJsonUCM = {
  statusCode: 200,
  body: {
    Message: {
      voicemailList: [
        MOCK_UCM_VOICEMAIL_EXPECTED_FIRST_MESSAGE,
        MOCK_UCM_VOICEMAIL_EXPECTED_SECOND_MESSAGE,
        MOCK_UCM_VOICEMAIL_EXPECTED_THIRD_MESSAGE,
        MOCK_UCM_VOICEMAIL_EXPECTED_FOURTH_MESSAGE,
        MOCK_UCM_VOICEMAIL_EXPECTED_FIFTH_MESSAGE,
      ],
    },
  },
};

export const failure = 'FAILURE';

export const responseDetails422 = {
  data: {error: '422 Exception has occurred'},
  message: failure,
  statusCode: 422,
};

export const mockVoicemailTranscriptResponse = {
  body: '<?xml version="1.0" encoding="UTF-8"?>\n<VoiceMessageTranscript xmlns="http://schema.broadsoft.com/xsi"><status>READY</status><content lang="EN">Hi, uh, testing, voice mail script, so dropping this message to be able to fetch it later.</content></VoiceMessageTranscript>',
  statusCode: 200,
  method: 'GET',
  headers: {
    'cache-control': 'no-cache, no-store',
    connection: 'keep-alive',
    'content-language': 'en-US',
    'content-type': 'application/xml;charset=UTF-8',
    date: 'Wed, 08 Feb 2023 17:58:19 GMT',
    expires: 'Thu, 01 Jan 1970 00:00:00 GMT',
    'keep-alive': 'timeout=4',
    pragma: 'no-cache',
    'strict-transport-security': 'max-age=16070400; includeSubDomains',
    trackingid: 'webex-js-sdk_f723f33d-e48b-4f00-94df-e3996bb9fbd1_13',
    'transfer-encoding': 'chunked',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'x-xss-protection': '1; mode=block',
  },
  url: 'https://api-proxy-si.broadcloudpbx.net/com.broadsoft.xsi-actions/v2.0/user/bd8d7e70-7f28-49e5-b6c2-dfca281a5f64/VoiceMessagingMessages/98099432-9d81-4224-bd04-00def73cd262/transcript',
  options: {
    uri: 'https://api-proxy-si.broadcloudpbx.net/com.broadsoft.xsi-actions/v2.0/user/bd8d7e70-7f28-49e5-b6c2-dfca281a5f64/VoiceMessagingMessages/98099432-9d81-4224-bd04-00def73cd262/transcript',
    method: 'GET',
    json: true,
    headers: {
      trackingid: 'webex-js-sdk_f723f33d-e48b-4f00-94df-e3996bb9fbd1_13',
      'spark-user-agent': 'webex/2.38.0 (web)',
      authorization:
        'Bearer eyJhbGciOiJSUzI1NiJ9.eyJjbHVzdGVyIjoiQTUyRCIsInByaXZhdGUiOiJleUpqZEhraU9pSktWMVFpTENKbGJtTWlPaUpCTVRJNFEwSkRMVWhUTWpVMklpd2lZV3huSWpvaVpHbHlJbjAuLlY3N2dUMmdwSE9TV0w5b1ptbDJTT2cuUW1ZNWZEUUN6eFo2ZFBwaGFqa0dBbkVUcGxKQmI3WlR5V0hZSUd3NGpvbUNucjZDdmZDYlpSdGU5RUl2UlM5VDUxZXZpMURzamtNMWhrcWw3a1U2QU5NSEw1YjhLQ0RSS1d5Rk0yeUdPSWktekpzN2F4MGhvak9Td3o2cEt6LXJWenV5N0YtZ19mRkwydDFBcmw3U3lzWG40UUxBb2NpZzNnZGhlYkQ2eXl3cHJFOGpFLXc1SGFYb01ZanNfWUtTZ3lNQjBVYkVvcFloZWhCc2lkNDhOUGZDVUxWOU5rZnlBYl9uTFNqRDdsb0o5ZVRRR0JHMWxKSTR2NXNmX0RTUGVTRUZfdG15aFo1WWJuS19ZQ1I5M0VIazBKM1JVY19QX2dXeEJXaTM3dDlyWUJZOWRmU1RwUFQyUTNvb09yVm5vNEQ2c3BCYzEyVWN6Rkh2Q1YzV1ZmTE5YOUQtcnJjNFp1QWVDT3UxdnFfRjlRdkFEa0x2Tmdsb0QwVHU2NExmVWxJcE5Wck9xam5DSDdVdVN4anlDLVlYd2MyRVo3MkREcjVLWHg4eEdaSGVzaTFHcEo3cml0OVl2cERDX3pyQmNMbmZTV1M2a1c0WlhpR1o0SDhQQ0liaFZfY3ZzTzBqV05QeU90dHV4eFhBUllINEY1VXNFOUphdzc5SDlYMzZGRGlkMzV2VG53TWpQMG81Ri1JeVNPeHBQekZybGh0ZTRLUGNFQ0pTeGRDbjNKWndmTkQ4aUNwWGxseDhiQ25DSVR3TlNWamJuTVQ0cENWYW1rSGU1aW1kNkZYMllUUVpqVFhBV25sZURBdXVlMHM1cTM1Qkt1WXk5eGZhZ0dRN3dkMmREMXRnbmVuYnJoYVZkUzktamRzYkF1SHFEVXJFcm05emQ4VE1ObXBvU3N6VmhjeWxraHJwbFZWRXRUX3IxeDdZZ3RsajBUbENTTE5pRlQxYTItYU5XZ3dQVzIwTzZIVG5TMlJuX0xxaVFsVzBsdVptTzRPZ2dGQmRUTHh0WEhsOWNJSGljXzZ3MlkxeEpzcHpEUFZfVmxqVlRrMnlta0VyejdtNDJmYnhRdXhSbVA0ZnQzTEF3N2xBamc4Ti4yUkRFRTZ1WHhCYnYwWXMwODR5YXJ3IiwidXNlcl90eXBlIjoidXNlciIsInRva2VuX2lkIjoiQWFaM3IwWTJNMU9UTXdNR0l0TldJMk1pMDBaRGd5TFRnMU1EZ3RPR1E0WVdVeFl6WXpNamc0T1RaaU1UZzVZbU10TlRsbCIsInJlZmVyZW5jZV9pZCI6ImFhN2UyODg2LTM3YWMtNGFiYy1iNWI2LWYzYzdjMWJlOGYwYSIsImlzcyI6Imh0dHBzOlwvXC9pZGJyb2tlcmJ0cy53ZWJleC5jb21cL2lkYiIsInVzZXJfbW9kaWZ5X3RpbWVzdGFtcCI6IjIwMjIxMTIzMDgyODU3LjIxM1oiLCJyZWFsbSI6IjE3MDRkMzBkLWExMzEtNGJjNy05NDQ5LTk0ODQ4NzY0Mzc5MyIsImNpc191dWlkIjoiYmQ4ZDdlNzAtN2YyOC00OWU1LWI2YzItZGZjYTI4MWE1ZjY0IiwidG9rZW5fdHlwZSI6IkJlYXJlciIsImV4cGlyeV90aW1lIjoxNjc1OTQzNTgwODc1LCJjbGllbnRfaWQiOiJDNjRhYjA0NjM5ZWVmZWU0Nzk4ZjU4ZTdiYzNmZTAxZDQ3MTYxYmUwZDk3ZmYwZDMxZTA0MGE2ZmZlNjZkN2YwYSJ9.DKV6GnBZLHT5sDV8eJC5rr31WWvFz8kx27AInICi-2liGW9cRoDDBGESD96dctAD5vN9_KBJm5hQAy5WeiDJyoGnwYhTQLPRwXsCEnp04ChfRDypxgPriT3CkfuSegKH9H9XNn_FaP7GT5CdUa6gxQPu2GEw1iHD-VPm6hH1xTIyKkr8IB2svYdtaeZGuQy3gqemuAiwrJv56SCJ2Xr2Z9tWRzkGyxYXLeXaKHM6zYWmFeBbxMAo95vrLK7LGPjR-fWTAWnjwJrMlIhOBwtmdbak6War1Z0xIiDXKyJsvcAcyAUyaklWt6F9pg7yeZtB0FypvtRzVb7wa70tQHIodQ',
      'cisco-no-http-redirect': true,
    },
    $timings: {
      requestStart: 1675879099125,
      networkStart: 1675879099141,
      networkEnd: 1675879100572,
      requestEnd: 1675879100573,
    },
    $redirectCount: 0,
  },
};

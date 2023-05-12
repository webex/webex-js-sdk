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

export const name = 'Adrian';
export const userid = 'admin';
export const address = 'tel1372';

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

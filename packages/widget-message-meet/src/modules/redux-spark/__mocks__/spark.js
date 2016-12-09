const mocks = [];

function genMockFunction() {
  const mock = jest.genMockFunction();
  mocks.push(mock);

  // ensure all mock functions are thenable
  mock.mockReturnValue(Promise.resolve());

  return mock;
}

const spark = {
  isAuthenticated: false,
  isAuthenticating: false,
  ready: false,
  util: {
    html: {
      filterSync: genMockFunction(),
      escapeSync: jest.genMockFunction().mockImplementation((param) => param.toString())
    }
  },
  authenticate: genMockFunction(),
  listenToAndRun: genMockFunction(),
  config: {trackingIdPrefix: `testTrackingIdPrefix`},
  client: {trackingIdBase: `testTrackingIdBase`},
  credentials: {
    authorization: {
    }
  },
  device: {
    url: `https://example.com/devices/1`,
    services: {
      roomServiceUrl: `https://example.com/devices/services/room/1`
    },
    remove: genMockFunction(),
    getServiceUrl: jest.genMockFunction().mockReturnValue(``),
    register: genMockFunction()
  },

  encryption: {
    decryptScr: genMockFunction(),
    decryptText: genMockFunction(),
    encryptText: genMockFunction(),
    getUnusedKey: genMockFunction(),
    download: genMockFunction(),
    keystore: {
      clear: genMockFunction()
    },
    kms: {
      prepareRequest: genMockFunction(),
      request: genMockFunction()
    }
  },

  user: {
    activate: genMockFunction(),
    register: genMockFunction()
  },

  feature: {
    getFeature: genMockFunction()
  },

  mercury: {
    connect: genMockFunction(),
    on: genMockFunction(),
    once: genMockFunction(),
    listen: genMockFunction(),
    listenToAndRun: genMockFunction(),
    stopListening: genMockFunction()
  },

  conversation: {
    assign: genMockFunction(),
    download: genMockFunction(),
    get: genMockFunction(),
    unassign: genMockFunction(),
    update: genMockFunction()
  },

  metrics: {
    sendUnstructured: genMockFunction(),
    sendSemiStructured: genMockFunction()
  },

  support: {
    submitCallLogs: genMockFunction()
  },

  flagging: {
    flag: genMockFunction(),
    mapToActivities: genMockFunction()
  },

  board: {
    decryptContents: genMockFunction(),
    decryptSingleContent: genMockFunction(),
    encryptContents: genMockFunction(),
    encryptSingleContent: genMockFunction(),
    persistence: {
      ping: genMockFunction(),
      register: genMockFunction(),
      createChannel: genMockFunction(),
      getChannel: genMockFunction(),
      getChannels: genMockFunction(),
      addContent: genMockFunction(),
      addImage: genMockFunction(),
      getAllContent: genMockFunction(),
      deleteContent: genMockFunction(),
      deleteAllContent: genMockFunction()
    },
    realtime: {
      on: genMockFunction(),
      publish: genMockFunction(),
      once: genMockFunction(),
      set: genMockFunction()
    }
  },

  on: genMockFunction(),

  request: genMockFunction(),

  search: {
    search: genMockFunction(),
    people: genMockFunction()
  },

  $resetAllMocks: () => {
    spark.isAuthenticated = false;
    spark.isAuthenticating = false;
    spark.ready = false;

    mocks.forEach((mock) => mock.mockClear());
  }
};

export function createSpark() {
  return spark;
}

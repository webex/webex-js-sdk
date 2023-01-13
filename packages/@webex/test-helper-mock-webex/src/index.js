/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* istanbul ignore next */
if (typeof Promise === 'undefined') {
  // eslint-disable-next-line global-require
  require('es6-promise').polyfill();
}

const _ = require('lodash');
const sinon = require('sinon');
const State = require('ampersand-state');

const nonInternalPlugins = [
  'authorization',
  'credentials',
  'memberships',
  'messages',
  'logger',
  'people',
  'phone',
  'meetings',
  'rooms',
  'teams',
  'teamMemberships',
  'webhooks',
];

/**
 * Mock Webex constructor
 * @param {Object} options
 * @returns {MockWebex}
 */
function makeWebex(options) {
  const requestPromise = Promise.resolve({statusCode: 200, body: {}});
  const uploadPromise = Promise.resolve({});

  options = options || {};
  options.children = options.children || {};

  const internalOptions = {};

  const internalChildren = {};
  const externalChildren = {};

  Object.keys(options.children).forEach((key) => {
    if (nonInternalPlugins.indexOf(key) === -1) {
      internalChildren[key] = options.children[key];
    } else {
      externalChildren[key] = options.children[key];
    }
  });

  internalOptions.children = internalChildren;
  options.children = externalChildren;

  // This weird assignment is to make sure "internal" is the first property.
  // Because it turns out we're relying on ordering
  options.children = {
    internal: State.extend(internalOptions),
    ...options.children,
  };

  requestPromise.on = uploadPromise.on = function on() {
    return requestPromise;
  };

  /**
   * produces a mock storage object
   * @param {Object} data
   * @returns {Storage}
   */
  function makeMockStorage(data) {
    data = data || {};

    return {
      data,
      on: sinon.spy(),
      once: sinon.spy(),
      listenTo: sinon.spy(),
      listenToAndRun: sinon.spy(),
      clear: function clear(namespace) {
        this.data = this.data || data;
        this.data[namespace] = {};
      },
      del: function del(namespace, key) {
        this.data = this.data || data;
        this.data[namespace] = this.data[namespace] || {};
        // eslint-disable-next-line prefer-reflect
        delete this.data[namespace][key];
      },
      get: function get(namespace, key) {
        this.data = this.data || data;
        this.data[namespace] = this.data[namespace] || {};
        const ret = this.data[namespace][key];

        if (ret) {
          return Promise.resolve(ret);
        }

        return Promise.reject(new Error('MockNotFoundError'));
      },
      put: function put(namespace, key, value) {
        this.data = this.data || data;
        try {
          // this is the simplest way to to turn ampstate objects into bare
          // objects without actually checking if they're ampstate objects
          value = JSON.parse(JSON.stringify(value));
        } catch (err) {
          // ignore
        }
        this.data[namespace] = this.data[namespace] || {};
        this.data[namespace][key] = value;

        return Promise.resolve();
      },
    };
  }

  const request = sinon.stub().returns(requestPromise);
  const upload = sinon.stub().returns(uploadPromise);
  const MockWebex = State.extend(
    _.defaults(options, {
      extraProperies: 'allow',
      request,
      upload,
      refresh: function refresh() {
        return Promise.resolve();
      },
      setConfig: function setConfig(config) {
        this.config.credentials.idbroker.url =
          config.credentials.idbroker.url || process.env.IDBROKER_BASE_URL;
        this.config.credentials.identity.url =
          config.credentials.identity.url || process.env.IDENTITY_BASE_URL;

        return Promise.resolve();
      },
      config: {
        credentials: {
          idbroker: {
            url: process.env.IDBROKER_BASE_URL,
            defaultUrl: process.env.IDBROKER_BASE_URL,
          },
          identity: {
            url: process.env.IDENTITY_BASE_URL,
            defaultUrl: process.env.IDENTITY_BASE_URL,
          },
          activationUrl: `${
            process.env.IDBROKER_BASE_URL || 'https://idbroker.webex.com'
          }/idb/token/v1/actions/UserActivation/invoke`,
          authorizeUrl: `${
            process.env.IDBROKER_BASE_URL || 'https://idbroker.webex.com'
          }/idb/oauth2/v1/authorize`,
          setPasswordUrl: `${
            process.env.IDBROKER_BASE_URL || 'https://identity.webex.com'
          }/identity/scim/v1/Users`,
          logoutUrl: `${
            process.env.IDBROKER_BASE_URL || 'https://idbroker.webex.com'
          }/idb/oauth2/v1/logout`,
          // eslint-disable-next-line camelcase
          client_id: 'fake',
          // eslint-disable-next-line camelcase
          client_secret: 'fake',
          // eslint-disable-next-line camelcase
          redirect_uri: 'http://example.com',
          // eslint-disable-next-line camelcase
          scope: 'scope:one',
          service: 'webex',
        },
        conversation: {
          allowedTags: {
            'webex-mention': ['data-object-type', 'data-object-id', 'data-object-url'],
          },
        },
        avatar: {},
        device: {},
        encryption: {},
        logger: {},
        mercury: {},
        metrics: {},
        support: {},
        user: {},
        llm: {},
        voicea: {},
        meetings: {
          mediaSettings: {
            sendAudio: true,
            sendVideo: true,
            receiveAudio: true,
            receiveVideo: true,
            pstn: false,
            sendShare: false,
            receiveShare: false,
          },
          reconnection: {
            enabled: true,
            detection: true,
            retry: {
              times: 2,
              backOff: {
                start: 1000,
                rate: 2,
              },
            },
          },
          stats: {
            interval: 1000,
            historyMax: 120,
          },
          metrics: {
            clientType: 'TEAMS_CLIENT',
            clientName: 'WEBEX_JS_SDK',
            mqaMetricsInterval: 60000,
            autoSendMQA: true,
          },
        },
      },
      initialize: function initialize(attrs) {
        this.boundedStorage = makeMockStorage(attrs && attrs.initialBoundedStorage);
        this.unboundedStorage = makeMockStorage(attrs && attrs.initialUnboundedStorage);
      },
    })
  );

  const webex = new MockWebex(options && options.attrs);

  sinon.spy(webex, 'refresh');
  _.defaults(webex, {
    credentials: {
      authorization: 'Basic NOTATOKEN',
      getUserToken: sinon.stub().returns(
        Promise.resolve({
          toString: function toString() {
            return 'Basic NOTATOKEN';
          },
        })
      ),
      getClientToken: sinon.stub().returns(
        Promise.resolve({
          toString: function toString() {
            return 'Basic NOTATOKEN';
          },
        })
      ),
    },
    sessionId: 'mock-webex_88888888-4444-4444-4444-aaaaaaaaaaaa',
    logger: process.env.MOCK_LOGGER
      ? console
      : {
          error: sinon.spy(),
          warn: sinon.spy(),
          log: sinon.spy(),
          info: sinon.spy(),
          debug: sinon.spy(),
        },
  });

  _.defaults(webex.internal, {
    avatar: {},
    conversation: {},
    device: {
      webSocketUrl: 'ws://example.com',
      getWebSocketUrl: sinon.stub().returns(Promise.resolve('ws://example-2.com')),
      features: {
        developer: {
          get: sinon.stub(),
        },
        entitlement: {
          get: sinon.stub(),
        },
        user: {
          get: sinon.stub(),
        },
      },
      registered: true,
      register: sinon.stub().returns(Promise.resolve()),
    },
    feature: {
      setFeature: sinon.stub().returns(Promise.resolve(false)),
      getFeature: sinon.stub().returns(Promise.resolve(false)),
    },
    encryption: {},
    metrics: {
      sendUnstructured: sinon.spy(),
    },
    support: {},
    user: {},
    mercury: {},
    llm: {},
    voicea: {},
  });

  return webex;
}

module.exports = makeWebex;

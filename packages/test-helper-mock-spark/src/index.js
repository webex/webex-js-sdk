/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* istanbul ignore next */
if (typeof Promise === 'undefined') {
  // eslint-disable-next-line global-require
  require('es6-promise').polyfill();
}

var _ = require('lodash');
var sinon = require('@ciscospark/test-helper-sinon');
var State = require('ampersand-state');

function makeSpark(options) {
  var requestPromise = Promise.resolve({statusCode: 200, body: {}});
  var uploadPromise = Promise.resolve({});

  requestPromise.on = uploadPromise.on = function on() {
    return requestPromise;
  };

  function makeMockStorage() {
    return {
      on: sinon.spy(),
      once: sinon.spy(),
      listenTo: sinon.spy(),
      listenToAndRun: sinon.spy(),
      clear: function clear(namespace) {
        this.data = this.data || {};
        this.data[namespace] = {};
      },
      del: function del(namespace, key) {
        this.data = this.data || {};
        this.data[namespace] = this.data[namespace] || {};
        delete this.data[namespace][key];
      },
      get: function get(namespace, key) {
        this.data = this.data || {};
        this.data[namespace] = this.data[namespace] || {};
        var ret = this[key];
        if (ret) {
          return Promise.resolve(ret);
        }
        return Promise.reject(new Error('MockNotFoundError'));
      },
      put: function put(namespace, key, value) {
        this.data = this.data || {};
        this.data[namespace] = this.data[namespace] || {};
        this.data[namespace][key] = value;
        return Promise.resolve();
      }
    };
  }

  var request = sinon.stub().returns(requestPromise);
  var upload = sinon.stub().returns(uploadPromise);
  var MockSpark = State.extend(_.defaults(options, {
    extraProperies: 'allow',
    request: request,
    upload: upload,
    refresh: function refresh() {
      return Promise.resolve();
    },
    config: {
      credentials: {
        oauth: {
          // eslint-disable-next-line camelcase
          client_id: 'fake',
          // eslint-disable-next-line camelcase
          client_secret: 'fake',
          // eslint-disable-next-line camelcase
          redirect_uri: 'http://example.com',
          // eslint-disable-next-line camelcase
          scope: 'scope:one'
        }
      },
      // eslint-disable-next-line camelcase
      client_id: 'fake',
      // eslint-disable-next-line camelcase
      client_secret: 'fake',
      // eslint-disable-next-line camelcase
      redirect_uri: 'http://example.com',
      // eslint-disable-next-line camelcase
      scope: 'scope:one',
      conversation: {
        allowedTags: {
          'spark-mention': ['data-object-type', 'data-object-id', 'data-object-url']
        }
      },
      avatar: {},
      device: {},
      encryption: {},
      logger: {},
      mercury: {},
      metrics: {},
      support: {},
      user: {}
    },
    initialize: function initialize() {
      this.boundedStorage = makeMockStorage();
      this.unboundedStorage = makeMockStorage();
    }
  }));

  var spark = new MockSpark();

  sinon.spy(spark, 'refresh');
  _.defaults(spark, {
    credentials: {
      authorization: 'Basic NOTATOKEN',
      getAuthorization: sinon.stub().returns(Promise.resolve('Basic NOTATOKEN'))
    },
    conversation: {},
    avatar: {},
    device: {
      webSocketUrl: 'ws://example.com',
      features: {
        developer: {
          get: sinon.stub()
        },
        entitlement: {
          get: sinon.stub()
        },
        user: {
          get: sinon.stub()
        }
      },
      registered: true,
      register: sinon.stub().returns(Promise.resolve())
    },
    encryption: {},
    metrics: {
      sendUnstructured: sinon.spy()
    },
    sessionId: 'mock-spark_88888888-4444-4444-4444-aaaaaaaaaaaa',
    support: {},
    user: {},
    mercury: {},
    logger: {
      error: sinon.spy(),
      warn: sinon.spy(),
      log: sinon.spy(),
      info: sinon.spy(),
      debug: sinon.spy()
    }
  });

  return spark;
}

module.exports = makeSpark;

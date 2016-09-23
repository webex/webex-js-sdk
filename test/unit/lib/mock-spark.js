/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var defaults = require('lodash.defaults');
var sinon = require('sinon');
var State = require('ampersand-state');

function makeSpark(options) {
  var requestPromise = Promise.resolve({statusCode: 200, body: {}});
  var uploadPromise = Promise.resolve({});

  requestPromise.on = uploadPromise.on = function() {
    return requestPromise;
  };

  var request = sinon.stub().returns(requestPromise);
  var upload = sinon.stub().returns(uploadPromise);

  var MockSpark = State.extend(options, {
    extraProperies: 'allow',
    on: sinon.spy(),
    request: request,
    upload: upload,
    refresh: function() {
      return Promise.resolve();
    },
    config: {
      credentials: {
        oauth: {
          scope: ''
        }
      },
      conversation: {
        allowedInboundTags: {
          'spark-mention': ['data-object-type', 'data-object-id', 'data-object-url']
        },
        allowedOutboundTags: {
          'spark-mention': ['data-object-type', 'data-object-id', 'data-object-url']
        }
      },
      avatar: {},
      board: {},
      device: {},
      encryption: {},
      logger: {},
      mercury: {},
      metrics: {},
      support: {},
      user: {}
    }
  });

  var spark = new MockSpark();
  sinon.spy(spark, 'refresh');
  defaults(spark, {
    credentials: {
      authorization: 'Basic NOTATOKEN',
      getAuthorization: sinon.stub().returns(Promise.resolve('Basic NOTATOKEN'))
    },
    conversation: {
      on: function() {},
      off: function() {}
    },
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
      }
    },
    encryption: {},
    feature: {
      getFeature: sinon.stub(),
      setFeature: sinon.stub()
    },
    metrics: {
      sendUnstructured: sinon.spy()
    },
    support: {},
    user: {},
    mercury: {},
    logger: {
      error: sinon.spy(),
      warn: sinon.spy(),
      log: sinon.spy(),
      info: sinon.spy(),
      debug: sinon.spy()
    },
    logout: function() {}
  });

  return spark;
}

module.exports = makeSpark;

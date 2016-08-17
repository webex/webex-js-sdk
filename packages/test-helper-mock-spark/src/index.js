/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

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

  requestPromise.on = uploadPromise.on = function() {
    return requestPromise;
  };

  var request = sinon.stub().returns(requestPromise);
  var upload = sinon.stub().returns(uploadPromise);

  var MockSpark = State.extend(options, {
    extraProperies: 'allow',
    request: request,
    upload: upload,
    refresh: function() {
      return Promise.resolve();
    },
    config: {
      credentials: {},
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
    }
  });

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

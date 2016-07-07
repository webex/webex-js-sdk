/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint no-invalid-this: [0] */

import {wd} from '@ciscospark/test-helper-automation';
import {defaults as protorequest} from '@ciscospark/http-core';
import {
  ResponseLoggerInterceptor,
  RequestTimingInterceptor,
  SparkTrackingIdInterceptor,
  NetworkTimingInterceptor,
  RequestLoggerInterceptor
} from '@ciscospark/spark-core';
import S from 'string';

const request = protorequest({
  json: true,
  interceptors: [
    ResponseLoggerInterceptor.create(),
    RequestTimingInterceptor.create(),
    SparkTrackingIdInterceptor.create({prefix: `spark-js-sdk-testsuite`}),
    NetworkTimingInterceptor.create(),
    RequestLoggerInterceptor.create()
  ]
});

const users = new WeakMap();
const drones = new WeakMap();

function setDrone(browser, type, drone) {
  let browserDroneMap = drones.get(browser);
  if (!browserDroneMap) {
    browserDroneMap = new Map();
    drones.set(browser, browserDroneMap);
  }

  browserDroneMap.set(type, drone);
}

function getDrone(browser, type) {
  let browserDroneMap = drones.get(browser);
  if (!browserDroneMap) {
    browserDroneMap = new Map();
    drones.set(browser, browserDroneMap);
  }

  return browserDroneMap.get(type);
}

wd.addPromiseChainMethod(`setDroneUser`, function(user) {
  users.set(this, user);
  return this;
});

wd.addPromiseChainMethod(`createDrone`, function(type, options) {
  const user = users.get(this);
  if (!user) {
    throw new Error(`call setDroneUser before using createDrone`);
  }

  const resource = S(type).underscore().s;
  let body = {
    /* eslint camelcase: [0] */
    call_duration_secs: 30,
    real_participant_email: user.email
  };

  if (options) {
    body = Object.keys(options).reduce((body, key) => {
      const underscoreKey = S(key).underscore().s;
      body[underscoreKey] = options[key];
      return body;
    }, body);
  }

  return request({
    method: `POST`,
    uri: `http://internal-testing-services.wbx2.com:8086/api/v1/${resource}`,
    body
  })
    .then((res) => {
      console.log(`body`, res.body);
      setDrone(this, type, res.body);
    })
    .then(() => this);
});

wd.addPromiseChainMethod(`getDrone`, function(type) {
  return getDrone(this, type);
});

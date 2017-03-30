/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '../..';

import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';
// import uuid from 'uuid';

describe(`plugin-mercury`, function() {
  this.timeout(30000);
  describe(`Mercury`, () => {
    let spark;

    beforeEach(() => testUsers.create({count: 1})
      .then((users) => {
        spark = new CiscoSpark({
          credentials: {
            authorization: users[0].token
          }
        });
      }));

    afterEach(() => spark && spark.mercury.disconnect());

    describe(`#connect()`, () => {
      it(`connects to mercury`, () => assert.isFulfilled(spark.mercury.connect()));

      it(`refreshes the access token when a 4401 is received`, () => spark.device.register()
        .then(() => {
          // eslint-disable-next-line camelcase
          spark.credentials.authorization.access_token = `fake token`;
          return assert.isFulfilled(spark.mercury.connect());
        })
        // eslint-disable-next-line camelcase
        .then(() => assert.notEqual(spark.credentials.authorization.access_token, `fake token`)));

      // This doesn't work as designed yet. The only way to get a 4404 is to try
      // to connect to someone else's valid registration; the intent was to get
      // a 4404 any time we try to connect to an invalid url. Actually, as it's
      // implemented, it should really be a 4403.
      // it(`refreshes the device when a 4404 is received`, () => spark.device.register()
      //   .then(() => {
      //     const webSocketUrl = spark.device.webSocketUrl;
      //     const wsu = spark.device.webSocketUrl.split(`/`);
      //     wsu.reverse();
      //     wsu[1] = uuid.v4();
      //     wsu.reverse();
      //     spark.device.webSocketUrl = wsu.join(`/`);
      //     return spark.mercury.connect()
      //       .then(() => assert.notEqual(spark.device.webSocketUrl, webSocketUrl));
      //   }));
    });

    it(`emits messages that arrive before authorization completes`, () => {
      const spy = sinon.spy();
      spark.mercury.on(`event:mercury.buffer_state`, spy);
      return spark.mercury.connect()
        .then(() => {
          assert.calledOnce(spy);
        });
    });
  });
});

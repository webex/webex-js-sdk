/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @
 */

import '../..';

import {tap} from '@ciscospark/common';
import {assert} from '@ciscospark/test-helper-chai';
import retry from '@ciscospark/test-helper-retry';
import testUsers from '@ciscospark/test-helper-test-users';
import uuid from 'uuid';
import Spark from '@ciscospark/spark-core';

describe(`spark-core`, () => {
  describe(`MachineAcount`, () => {
    let spark, user;
    const bots = [];
    before(() => testUsers.create({count: 1})
      .then(([u]) => {
        user = u;
        spark = new Spark({
          credentials: {
            authorization: u.token
          }
        });

        return spark.device.register();
      }));

    after(() => Promise.all(bots.map((bot) => spark.machineAccount.delete(bot))));

    // after(() => Promise.all(bots.map((bot) => {
    //   const spark = new Spark({});
    //   return retry(spark.credentials.requestSamlExtensionGrant(bot))
    //     .then(() => spark.device.register())
    //     .then(() => spark.machineAccount.delete());
    // })));

    describe(`#create()`, () => {
      it(`creates a machine account`, () => spark.machineAccount.create({
        name: `spark-js-sdk-testbot-${uuid.v4()}`,
        contactEmail: user.email
      })
        .then(tap((bot) => bots.push(bot)))
        .then((bot) => assert.isMachineAccount(bot)));
    });

    describe(`#delete()`, () => {
      describe(`when the current account owns the machine account`, () => {
        let bot;
        before(() => spark.machineAccount.create({
          name: `spark-js-sdk-testbot-${uuid.v4()}`,
          contactEmail: user.email
        })
          .then((b) => {
            // not addign to bots array because we're going to delete it as part of the test
            bot = b;
          }));

        it(`deletes the machine account`, () => spark.machineAccount.delete(bot));
      });
    });
  });
});

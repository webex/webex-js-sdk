/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '../..';

import {assert} from '@ciscospark/test-helper-chai';
import testUsers from '@ciscospark/test-helper-test-users';
import CiscoSpark from '@ciscospark/spark-core';

describe(`plugin-mashups`, function() {
  this.timeout(20000);
  let conversation, mccoy, participants, spark, spock;
  before(() => testUsers.create({count: 3})
    .then((users) => {
      participants = [spock, mccoy] = users;

      spark = new CiscoSpark({
        credentials: {
          authorization: spock.token
        }
      });
      mccoy.spark = new CiscoSpark({
        credentials: {
          authorization: mccoy.token
        }
      });

      return Promise.all([
        spark.mercury.connect(),
        mccoy.spark.mercury.connect()
      ])
        .then(() => spark.conversation.create({participants}))
        .then((c) => {
          conversation = c;
        });
    }));

  after(() => Promise.all([
    spark.mercury.disconnect(),
    mccoy.spark.mercury.disconnect()
  ]));

  describe(`#create()`, () => {

    it(`creates an integration`, () => {
      const options = {};
      options.type = `test`;
      options.roomId = conversation.id;
      options.testData1 = `testData1`;
      options.testData2 = `testData2`;
      return spark.mashups.create(options)
        .then((createdIntegration) => {
          assert.isObject(createdIntegration);
          assert.equal(createdIntegration.roomId, options.roomId);
          assert.equal(createdIntegration.testData1, options.testData1);
          assert.equal(createdIntegration.testData2, options.testData2);
        });
    });
  });

  describe(`#delete()`, () => {
    it(`deletes integration`, () => {
      const options = {};
      options.type = `test`;
      options.roomId = conversation.id;
      return spark.mashups.create(options)
        .then((createdIntegration) => {
          assert.isObject(createdIntegration);
          const deleteOptions = {};
          deleteOptions.id = createdIntegration.id;
          deleteOptions.type = `test`;
          return spark.mashups.remove(deleteOptions);
        });
    });

  });

  describe(`#get()`, () => {
    it(`retrieves integrations for a single room using roomId`, () => {
      const options = {};
      options.roomId = conversation.id;
      return spark.mashups.get(options)
        .then((integrations) => {
          assert.isArray(integrations.test);
          assert.equal(integrations.test.length, 1);
          assert.equal(integrations.test[0].roomId, conversation.id);
        });
    });

    it(`retrieves integrations for a single room using a conversation object`, () => spark.mashups.get(conversation)
      .then((integrations) => {
        assert.isArray(integrations.test);
        assert.equal(integrations.test.length, 1);
        assert.equal(integrations.test[0].roomId, conversation.id);
      }));

    it(`retrieves all integrations`, () => spark.mashups.create({type: `test`, roomId: conversation.id})
      .then(() => spark.mashups.get({roomId: conversation.id}))
      .then((mashups) => {
        assert.isArray(mashups.test);
        assert.lengthOf(mashups.test, 2);
        assert.equal(mashups.test[0].roomId, conversation.id);
      })
    );
  });

  describe(`#list()`, () => {
    it(`retrieves list of all integrations`, () => spark.mashups.create({type: `test`, roomId: conversation.id})
      .then(() => spark.mashups.create({type: `test`, roomId: conversation.id}))
      .then(() => spark.mashups.list({roomId: conversation.id}))
      .then((mashups) => {
        assert.isArray(mashups.test);
        // 2 from the previous tests and two from now (4)
        assert.lengthOf(mashups.test, 4);
        assert.equal(mashups.test[0].roomId, conversation.id);
      })
    );
  });

});

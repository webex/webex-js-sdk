/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import '../..';

import {patterns} from '@ciscospark/common';
import CiscoSpark from '@ciscospark/spark-core';
import {assert} from '@ciscospark/test-helper-chai';
import testUsers from '@ciscospark/test-helper-test-users';
import {find, last, map} from 'lodash';
import uuid from 'uuid';
import fh from '@ciscospark/test-helper-file';

describe(`plugin-conversation`, function() {
  this.timeout(60000);
  describe(`#create()`, () => {
    let checkov, mccoy, participants, spark, spock;

    before(() => testUsers.create({count: 3})
      .then((users) => {
        participants = [spock, mccoy, checkov] = users;

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
        ]);
      }));

    let sampleTextOne = `sample-text-one.txt`;
    before(() => fh.fetch(sampleTextOne)
      .then((f) => {sampleTextOne = f;}));

    after(() => Promise.all([
      spark && spark.mercury.disconnect(),
      mccoy && mccoy.spark.mercury.disconnect()
    ]));

    function makeEmailAddress() {
      return `spark-js-sdk--test-${uuid.v4()}@example.com`;
    }

    describe(`when there is only one other participant`, () => {
      it(`creates a 1:1 conversation`, () => spark.conversation.create({participants: [mccoy]})
        .then((conversation) => {
          assert.isConversation(conversation);
          assert.isOneOnOneConversation(conversation);
          assert.isNewEncryptedConversation(conversation);

          assert.lengthOf(conversation.participants.items, 2);
          assert.lengthOf(conversation.activities.items, 1);
        }));

      describe(`when the other user doesn't exist`, () => {
        let email;
        beforeEach(() => {email = makeEmailAddress();});

        it(`invites the other user`, () => spark.conversation.create({participants: [email]})
          .then((conversation) => {
            assert.isConversation(conversation);
            assert.isOneOnOneConversation(conversation);
            assert.isNewEncryptedConversation(conversation);

            const participant = find(conversation.participants.items, {emailAddress: email});
            assert.include(participant.tags, `SIDE_BOARDED`);
            assert.match(participant.id, patterns.uuid);
          }));
      });

      describe(`when the conversation already exists`, () => {
        it(`returns the preexisting conversation`, () => spark.conversation.create({participants: [checkov]})
          .then((conversation) => spark.conversation.create({participants: [checkov]})
            .then((conversation2) => assert.equal(conversation2.url, conversation.url))));
      });

      describe(`when {forceGrouped: true} is specified`, () => {
        it(`creates a grouped conversation`, () => spark.conversation.create({participants: [mccoy]}, {forceGrouped: true})
          .then((conversation) => {
            assert.isConversation(conversation);
            assert.isGroupConversation(conversation);
            assert.isNewEncryptedConversation(conversation);

            assert.lengthOf(conversation.participants.items, 2);
            assert.lengthOf(conversation.activities.items, 1);
          }));
      });
    });

    describe(`when {compact: ?} is not specified`, () => {
      it(`creates a compact conversation`, () => spark.conversation.create({participants})
        .then((c) => spark.conversation.get(c, {activitiesLimit: 5}))
        .then((c) => assert.lengthOf(c.activities.items, 1)));
    });

    it(`creates a conversation with a name`, () => spark.conversation.create({displayName: `displayName`, participants})
      .then((c) => spark.conversation.get(c))
      .then((c) => assert.equal(c.displayName, `displayName`)));

    it(`creates a conversation with a comment`, () => spark.conversation.create({comment: `comment`, participants})
      .then((c) => spark.conversation.get(c, {activitiesLimit: 2}))
      .then((c) => assert.equal(c.activities.items[1].object.displayName, `comment`)));

    it(`creates a conversation with a share`, () => spark.conversation.create({participants, files: [sampleTextOne]})
      .then((c) => spark.conversation.get(c, {activitiesLimit: 10}))
      .then((c) => {
        assert.equal(last(c.activities.items).verb, `share`);
        return spark.conversation.download(last(c.activities.items).object.files.items[0]);
      })
      .then((file) => fh.isMatchingFile(file, sampleTextOne)));

    it(`ensures the current user is in the participants list`, () => spark.conversation.create({comment: `comment`, participants: [mccoy, checkov]})
      .then((c) => spark.conversation.get(c, {includeParticipants: true}))
      .then((c) => assert.include(map(c.participants.items, `id`), spock.id)));

    it(`does not allow me to create a conversation with zero participants`, () => assert.isRejected(spark.conversation.create({participants: []}, /`params.participants` is required/)));
  });
});

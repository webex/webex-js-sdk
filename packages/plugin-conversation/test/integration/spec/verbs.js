/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import '../..';

import CiscoSpark from '@ciscospark/spark-core';
import {assert} from '@ciscospark/test-helper-chai';
import testUsers from '@ciscospark/test-helper-test-users';

describe(`plugin-conversation`, function() {
  this.timeout(20000);
  describe(`verbs`, () => {
    let mccoy, participants, spark, spock;

    before(() => testUsers.create({count: 3})
      .then((users) => {
        [spock, mccoy] = participants = users;

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

    after(() => Promise.all([
      spark.mercury.disconnect(),
      mccoy.spark.mercury.disconnect()
    ]));

    let conversation;
    beforeEach(() => {
      if (conversation) {
        return Promise.resolve();
      }

      return spark.conversation.create({participants})
        .then((c) => {conversation = c;});
    });

    describe(`#post()`, () => {
      let message, richMessage;
      beforeEach(() => {
        message = `mccoy, THIS IS A TEST MESSAGE`;
        richMessage = `<spark-mention data-object-id="${mccoy.id}" data-object-type="person">mccoy</spark-mention>, THIS IS A TEST MESSAGE`;
      });

      it(`posts a comment to the specified conversation`, () => spark.conversation.post(conversation, {
        displayName: message
      })
        .then((activity) => {
          assert.isActivity(activity);

          assert.isEncryptedActivity(activity);
          assert.equal(activity.encryptionKeyUrl, conversation.defaultActivityEncryptionKeyUrl);

          assert.equal(activity.object.displayName, message);
        }));

      it(`posts a sticky to the specified conversation`, () => spark.request({
        service: `stickies`,
        resource: `pack`
      })
        .then((res) => spark.conversation.post(conversation, {
          location: res.body.pads[0].stickies[0].location,
          objectType: `imageURI`
        })
        .then((activity) => {
          assert.isActivity(activity);

          assert.isEncryptedActivity(activity);
          assert.equal(activity.encryptionKeyUrl, conversation.defaultActivityEncryptionKeyUrl);

          assert.equal(activity.object.location, res.body.pads[0].stickies[0].location);
        })));

      it(`updates the specified conversation's unread status`);

      it(`posts rich content to the specified conversation`, () => spark.conversation.post(conversation, {
        displayName: message,
        content: richMessage
      })
        .then((activity) => {
          assert.isActivity(activity);

          assert.isEncryptedActivity(activity);
          assert.equal(activity.encryptionKeyUrl, conversation.defaultActivityEncryptionKeyUrl);

          assert.equal(activity.object.displayName, message);
          assert.equal(activity.object.content, richMessage);
        }));

      it(`submits mentions to the specified conversation`, () => spark.conversation.post(conversation, {
        displayName: message,
        content: richMessage,
        mentions: {
          items: [{
            id: mccoy.id,
            objectType: `person`
          }]
        }
      })
        .then((activity) => {
          assert.isActivity(activity);

          assert.isEncryptedActivity(activity);
          assert.equal(activity.encryptionKeyUrl, conversation.defaultActivityEncryptionKeyUrl);

          assert.equal(activity.object.displayName, message);
          assert.equal(activity.object.content, richMessage);

          assert.isDefined(activity.object.mentions);
          assert.isDefined(activity.object.mentions.items);
          assert.lengthOf(activity.object.mentions.items, 1);
          assert.equal(activity.object.mentions.items[0].id, mccoy.id);
        }));
    });
  });
});

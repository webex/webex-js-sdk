/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import '../..';

import CiscoSpark from '@ciscospark/spark-core';
import {assert} from '@ciscospark/test-helper-chai';
import testUsers from '@ciscospark/test-helper-test-users';
import {map} from 'lodash';

describe(`plugin-conversation`, function() {
  this.timeout(20000);

  let mccoy, participants, spark, spock;

  before(() => testUsers.create({count: 3})
    .then((users) => {
      participants = [spock, mccoy] = users;

      spark = new CiscoSpark({
        credentials: {
          authorization: spock.token
        }
      });

      return spark.mercury.connect();
    }));

  after(() => spark.mercury.disconnect());


  describe(`#get()`, () => {
    let conversation;
    before(() => spark.conversation.create({participants: [mccoy.id]})
      .then((c) => {conversation = c;}));

    it(`retrieves a single conversation by url`, () => spark.conversation.get({url: conversation.url})
      .then((c) => {
        assert.equal(c.id, conversation.id);
        assert.equal(c.url, conversation.url);
      }));

    it(`retrieves a single conversation by id`, () => spark.conversation.get({id: conversation.id})
      .then((c) => {
        assert.equal(c.id, conversation.id);
        assert.equal(c.url, conversation.url);
      }));

    it(`retrieves a 1:1 conversation by userId`, () => spark.conversation.get({user: mccoy})
      .then((c) => {
        assert.equal(c.id, conversation.id);
        assert.equal(c.url, conversation.url);
      }));
  });

  describe(`#list()`, () => {
    let conversation1, conversation2;

    before(() => Promise.all([
      spark.conversation.create({participants})
        .then((c) => {conversation1 = c;}),
      spark.conversation.create({participants})
        .then((c) => {conversation2 = c;})
    ]));

    it(`retrieves a set of conversations`, () => spark.conversation.list({
      conversationsLimit: 2
    })
      .then((conversations) => {
        assert.include(map(conversations, `url`), conversation1.url);
        assert.include(map(conversations, `url`), conversation2.url);
      }));
  });

  describe.skip(`#listLeft()`, () => {
    let conversation;
    before(() => spark.conversation.create({participants})
      .then((c) => {conversation = c;}));

    it(`retrieves the conversations the current user has left`, () => spark.conversation.listLeft()
      .then((c) => {
        assert.lengthOf(c, 0);
        return spark.conversation.leave(conversation);
      })
      .then(() => spark.conversation.listLeft())
      .then((c) => {
        assert.lengthOf(c, 1);
        assert.equal(c[0].url, conversation.url);
      }));
  });

  describe(`#listActivities()`, () => {
    let conversation;
    before(() => spark.conversation.create({participants})
      .then((c) => {
        conversation = c;
        assert.lengthOf(conversation.participants.items, 3);
        return spark.conversation.post(conversation, {displayName: `first message`});
      }));

    it(`retrieves activities for the specified conversation`, () => spark.conversation.listActivities({conversationId: conversation.id})
      .then((activities) => {
        assert.isArray(activities);
        assert.lengthOf(activities, 2);
      }));
  });

  describe(`#listMentions()`, () => {
    let spark2;

    before(() => {
      spark2 = new CiscoSpark({
        credentials: {
          authorization: mccoy.token
        }
      });

      return spark2.mercury.connect();
    });

    after(() => spark2.mercury.disconnect());

    let conversation;
    before(() => spark.conversation.create({participants})
      .then((c) => {
        conversation = c;
        assert.lengthOf(conversation.participants.items, 3);
      }));

    it(`retrieves activities in which the current user was mentioned`, () => spark2.conversation.post(conversation, {
      displayName: `Green blooded hobgloblin`,
      content: `<spark-mention data-object-type="person" data-object-id="${spock.id}">Green blooded hobgloblin</spark-mention>`,
      mentions: {
        items: [{
          id: `${spock.id}`,
          objectType: `person`
        }]
      }
    })
      .then((activity) => {
        return spark.conversation.listMentions({sinceDate: Date.parse(activity.published) - 1})
          .then((mentions) => {
            assert.lengthOf(mentions, 1);
            assert.equal(mentions[0].url, activity.url);
          });
      }));
  });
});

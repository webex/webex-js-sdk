/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import CiscoSpark, {SparkHttpError} from '@ciscospark/spark-core';
import {assert} from '@ciscospark/test-helper-chai';
import testUsers from '@ciscospark/test-helper-test-users';

describe(`plugin-conversation`, () => {
  describe(`when interacting with a non-encrypted conversation`, () => {
    let checkov, mccoy, spark, spock;

    before(() => testUsers.create({count: 3})
      .then((users) => {
        [spock, mccoy, checkov] = users;

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

        checkov.spark = new CiscoSpark({
          credentials: {
            authorization: checkov.token
          }
        });

        return Promise.all([
          checkov.spark.mercury.connect(),
          spark.mercury.connect(),
          mccoy.spark.mercury.connect()
        ]);
      }));

    after(() => Promise.all([
      checkov && checkov.spark.mercury.disconnect(),
      spark && spark.mercury.disconnect(),
      mccoy && mccoy.spark.mercury.disconnect()
    ]));

    let conversation;
    beforeEach(() => spark.request({
      method: `POST`,
      service: `conversation`,
      resource: `/conversations`,
      body: {
        objectType: `conversation`,
        activities: {
          items: [
            {
              verb: `create`,
              actor: {
                id: spock.id,
                objectType: `person`
              }
            },
            {
              verb: `add`,
              actor: {
                id: spock.id,
                objectType: `person`
              },
              object: {
                id: spock.id,
                objectType: `person`
              }
            },
            {
              verb: `add`,
              actor: {
                id: spock.id,
                objectType: `person`
              },
              object: {
                id: checkov.id,
                objectType: `person`
              }
            }
          ]
        }
      }
    })
      .then((res) => res.body)
      .then((c) => {
        conversation = c;
        assert.notProperty(conversation, `defaultActivityEncryptionKeyUrl`);
        assert.property(conversation, `kmsResourceObjectUrl`);
      }));

    describe(`when the conversation is a grouped conversation`, () => {
      describe(`#add()`, () => {
        it(`adds the specified user`, () => spark.conversation.add(conversation, mccoy)
          .then(() => mccoy.spark.conversation.get(conversation))
          .then((c) => assert.property(c, `defaultActivityEncryptionKeyUrl`, `The conversation was encrypted as a side effect of the add activity`)));
      });

      describe(`#leave()`, () => {
        it(`removes the current user`, () => spark.conversation.leave(conversation)
          .then(() => assert.isRejected(spark.conversation.get(conversation)))
          .then((reason) => assert.instanceOf(reason, SparkHttpError.NotFound))
          .then(() => checkov.spark.conversation.get(conversation))
          .then((c) => assert.notProperty(c, `defaultActivityEncryptionKeyUrl`, `The conversation was not encrypted as a side effect of the leave activity`)));

        it(`removes the specified user`, () => spark.conversation.leave(conversation, checkov)
          .then(() => assert.isRejected(checkov.spark.conversation.get(conversation)))
          .then((reason) => assert.instanceOf(reason, SparkHttpError.NotFound))
          .then(() => spark.conversation.get(conversation))
          .then((c) => assert.notProperty(c, `defaultActivityEncryptionKeyUrl`, `The conversation was not encrypted as a side effect of the leave activity`)));
      });

      describe(`#post()`, () => {
        it(`posts a message`, () => spark.conversation.post(conversation, {displayName: `Ahoy`})
          .then(() => checkov.spark.conversation.get(conversation, {activitiesLimit: 1}))
          .then((c) => {
            assert.property(c, `defaultActivityEncryptionKeyUrl`);
            assert.equal(c.activities.items[0].object.displayName, `Ahoy`);
          }));
      });

      describe(`#update()`, () => {
        it(`sets the conversation's title`, () => spark.conversation.update(conversation, {
          displayName: `New Name!`,
          objectType: `conversation`
        })
          .then(() => checkov.spark.conversation.get(conversation))
          .then((c) => {
            assert.equal(c.displayName, `New Name!`);
            assert.property(c, `defaultActivityEncryptionKeyUrl`);
            assert.property(c, `encryptionKeyUrl`);
          }));
      });
    });

    describe(`when the conversation is a 1:1 conversation`, () => {
      let conversation;
      beforeEach(() => spark.request({
        method: `POST`,
        service: `conversation`,
        resource: `/conversations`,
        body: {
          objectType: `conversation`,
          activities: {
            items: [
              {
                verb: `create`,
                actor: {
                  id: spock.id,
                  objectType: `person`
                }
              },
              {
                verb: `add`,
                actor: {
                  id: spock.id,
                  objectType: `person`
                },
                object: {
                  id: spock.id,
                  objectType: `person`
                }
              },
              {
                verb: `add`,
                actor: {
                  id: spock.id,
                  objectType: `person`
                },
                object: {
                  id: mccoy.id,
                  objectType: `person`
                }
              }
            ]
          },
          tags: [`ONE_ON_ONE`]
        }
      })
        .then((res) => res.body)
        .then((c) => {
          conversation = c;
          assert.notProperty(conversation, `defaultActivityEncryptionKeyUrl`);
          assert.property(conversation, `kmsResourceObjectUrl`);
          assert.include(c.tags, `ONE_ON_ONE`);
        }));

      describe(`#post()`, () => {
        it(`posts a message`, () => spark.conversation.post(conversation, {displayName: `First Message`})
          .then(() => mccoy.spark.conversation.get(conversation, {activitiesLimit: 1}))
          .then((c) => {
            assert.property(c, `defaultActivityEncryptionKeyUrl`);
            assert.equal(c.activities.items[0].object.displayName, `First Message`);
          }));
      });
    });
  });
});

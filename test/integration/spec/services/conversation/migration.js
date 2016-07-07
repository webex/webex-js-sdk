/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var landingparty = require('../../../lib/landingparty');
var pluck = require('lodash.pluck');

describe('Services', function() {
  describe('Conversation', function() {
    describe('when interacting with a non-encrypted conversation', function() {
      this.timeout(60000);
      var conversation;
      var redshirt;

      var party = {
        spock: true,
        mccoy: true,
        checkov: false
      };

      before(function beamDown() {
        return landingparty.beamDown(party);
      });

      beforeEach(function() {
        return landingparty.beamDownRedshirt()
          .then(function(rs) {
            redshirt = rs;
          });
      });

      afterEach(function() {
        return landingparty.killRedshirt(redshirt);
      });

      beforeEach(function() {
        return makeUnencryptedConversation({
          participants: pluck(party, 'id')
        }, party.spock.spark)
          .then(function(c) {
            conversation = c;
          });
      });

      function makeUnencryptedConversation(object, spark) {
        var payload = {
          activities: {
            items: [{
              actor: {
                objectType: 'person',
                id: spark.device.userId
              },
              objectType: 'activity',
              verb: 'create'
            }]
          },
          objectType: 'conversation'
        };

        object.participants.forEach(function(participant) {
          var id = participant.id || participant.entryUUID || participant;
          payload.activities.items.push({
            verb: 'add',
            objectType: 'activity',
            object: {
              objectType: 'person',
              id: id
            },
            actor: {
              objectType: 'person',
              id: spark.device.userId
            }
          });
        });

        if (object.comment) {
          payload.activities.items.push({
            verb: 'post',
            objectType: 'activity',
            object: {
              objectType: 'comment',
              displayName: object.comment
            },
            actor: {
              objectType: 'person',
              id: spark.device.userId
            }
          });
        }

        payload.tags = object.tags;

        return spark.request({
          method: 'POST',
          api: 'conversation',
          resource: 'conversations',
          body: payload
        })
          .then(function(res) {
            return res.body;
          });
      }

      function assertIsEncryptedResponse(object) {
        assert.property(object, 'kmsMessage');
      }

      function assertIsEncryptedActivity(activity) {
        assert.property(activity, 'encryptionKeyUrl');
        if (activity.verb === 'post') {
          assert.property(activity.object, 'encryptedDisplayName');
          assert.notEqual(activity.object.encryptedDisplayName, activity.object.displayName);
        }
      }

      function assertIsEncryptedConversation(conversation) {
        assert.property(conversation, 'kmsResourceObjectUrl');
        assert.property(conversation, 'defaultActivityEncryptionKeyUrl');
        if (conversation.displayName) {
          assert.property(conversation, 'encryptedDisplayName');
          assert.property(conversation, 'encryptionKeyUrl');
          assert.notEqual(conversation.displayName, conversation.encryptedDisplayName);
        }
      }

      describe('#add()', function() {
        it.skip('adds the specified user', function() {
          return party.spock.spark.conversation.add(conversation, redshirt)
            .then(function(activity) {
              assertIsEncryptedResponse(activity);
              assertIsEncryptedActivity(activity);
              return party.spock.spark.conversation.get(conversation);
            })
            .then(function(conversation) {
              assertIsEncryptedConversation(conversation);
            });
        });
      });

      describe('#leave()', function() {
        it.skip('removes the current user', function() {
          return assert.isFulfilled(party.spock.spark.conversation.leave(conversation))
            .then(function() {
              return assert.isRejected(party.spock.spark.conversation.get(conversation));
            })
            .catch(function(reason) {
              console.log(reason);
              assert.equal(reason.statusCode, 403);
            });
        });

        it.skip('removes the specified user', function() {
          return assert.isFulfilled(party.spock.spark.conversation.leave(conversation, redshirt))
            .then(function() {
              return party.spock.spark.conversation.get(conversation);
            })
            .then(function(conversation) {
              assert.notEmpty(conversation.participants.items);
              assert.isNotDefined(find(conversation.participants.items, {id: redshirt.id}));
            });
        });
      });

      describe('#post()', function() {
        describe('when the conversation is a grouped conversation', function() {
          it('posts a message', function() {
            console.log(conversation);
            return party.spock.spark.conversation.post(conversation, {displayName: 'test message'})
              .then(function(activity) {
                assertIsEncryptedActivity(activity);
                return party.spock.spark.conversation.get(conversation);
              })
              .then(function(conversation) {
                assertIsEncryptedConversation(conversation);
              });
          });
        });

        describe('when the conversation is a 1:1 conversation', function() {
          var conversation;
          beforeEach(function() {
            return makeUnencryptedConversation({
              participants: [
                party.spock,
                redshirt
              ],
              tags: ['ONE_ON_ONE']
            }, party.spock.spark)
              .then(function(c) {
                console.log(c);
                assert.include(c.tags, 'ONE_ON_ONE');
                assert.lengthOf(c.participants.items, 2);
                conversation = c;
              });
          });

          it('posts a message', function() {
            return party.spock.spark.conversation.post(conversation, {displayName: 'test message'})
              .then(function(activity) {
                assertIsEncryptedActivity(activity);
                return party.spock.spark.conversation.get(conversation);
              })
              .then(function(conversation) {
                assertIsEncryptedConversation(conversation);
              });
          });
        });
      });

      describe('#update()', function() {
        it('sets the conversation\'s title', function() {
          conversation.displayName = 'A new displayName';
          return party.spock.spark.conversation.update(conversation)
            .then(function(activity) {
              assertIsEncryptedActivity(activity);
              return party.spock.spark.conversation.get(conversation);
            })
            .then(function(conversation) {
              assertIsEncryptedConversation(conversation);
            });
        });
      });

    });
  });
});

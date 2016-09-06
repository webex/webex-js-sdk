/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint no-undef: [0] */

var assert = require('chai').assert;
var contains = require('lodash.contains');
var delay = require('../../../../lib/delay');
var find = require('lodash.find');
var fh2 = require('../../../lib/fixtures-v2');
var helpers = require('../../../lib/helpers');
var landingparty = require('../../../lib/landingparty');
var last = require('lodash.last');
var map = require('lodash.map');
var patterns = require('../../../../../src/util/patterns');
var pluck = require('lodash.pluck');
var sinon = require('sinon');
var uuid = require('uuid');
var values = require('lodash.values');
var Defer = require('../../../../../src/util/defer');

function makeEmailAddress() {
  return 'spark-js-sdk--test-' + uuid.v4() + '-@example.com';
}

describe('Services', function() {
  describe('Conversation', function() {
    describe('Verbs', function() {
      /* eslint max-statements: [0] */

      this.timeout(60000);

      var comment = 'if we go "by the book", like Lieutenant Saavik, hours could seem like days.';
      var fixtures = {
        hashTestText: '#test.txt',
        sampleImageSmallOnePng: 'sample-image-small-one.png',
        sampleImageSmallTwoPng: 'sample-image-small-two.png',
        samplePowerpointTwoPagePpt: 'sample-powerpoint-two-page.ppt',
        sampleTextOne: 'sample-text-one.txt',
        sampleTextTwo: 'sample-text-two.txt'
      };

      // Set up fixtures for content share tests if running tests in karma.
      before(function() {
        return fh2.fetchFixtures(fixtures);
      });

      var party = {
        spock: true,
        mccoy: true,
        checkov: false
      };

      before(function beamDown() {
        return landingparty.beamDown(party);
      });

      var conversation;
      function ensureConversation() {
        beforeEach(function() {
          if (!conversation) {
            return party.spock.spark.conversation.create({
              displayName: 'Test Conversation',
              participants: pluck(party, 'id')
            })
              .then(function(c) {
                conversation = c;
              });
          }
        });
      }

      function lockIfUnlocked() {
        return party.spock.spark.request({
          uri: conversation.url
        })
          .then(function(res) {
            if (res.body.tags.indexOf('LOCKED') === -1) {
              return party.spock.spark.conversation.lock(conversation)
                .then(function() {
                  return res.body;
                });
            }
            return res.body;
          });
      }

      function unlockIfLocked() {
        return party.spock.spark.request({
          uri: conversation.url
        })
          .then(function(res) {
            if (res.body.tags.indexOf('LOCKED') > -1) {
              return party.spock.spark.conversation.unlock(conversation);
            }
          });
      }

      describe('#acknowledge()', function() {
        ensureConversation();

        it('acknowledges the specified activity', function() {
          var activity;
          return party.spock.spark.conversation.post(conversation, {displayName: comment})
            .then(function(res) {
              activity = res;
              return party.spock.spark.conversation.acknowledge(conversation, res);
            })
            .then(function() {
              return party.spock.spark.conversation.get({
                url: conversation.url,
                participantAckFilter: 'all'
              });
            })
            .then(function(conversation) {
              var participant = find(conversation.participants.items, {id: party.spock.spark.device.userId});
              assert.isDefined(participant);
              assert.equal(participant.roomProperties.lastSeenActivityDate, activity.published);
              assert.equal(participant.roomProperties.lastSeenActivityUUID, activity.id);
              assert.equal(conversation.lastSeenActivityDate, activity.published);
            });
        });
      });

      describe('#add()', function() {
        ensureConversation();

        var comment;
        var redshirt;
        before(function() {
          comment = uuid.v4();
          return party.spock.spark.conversation.post(conversation, {displayName: comment});
        });
        before(function beamDownRedshirt() {
          return landingparty.beamDownRedshirt({createClient: true})
            .then(function(r) {
              redshirt = r;
            });
        });

        after(function() {
          if (redshirt) {
            return landingparty.killRedshirt(redshirt);
          }
        });

        it('adds the specified user to the specified conversation', function() {
          return party.spock.spark.conversation.add(conversation, redshirt)
            .then(function(activity) {
              assert.isDefined(activity.encryptedKmsMessage, 'The activity has a kms message');
              assert.isDefined(activity.kmsMessage, 'The activity\'s encrypted kms message was decrypted automatically');
              return redshirt.spark.conversation.get(conversation);
            })
            .then(function(c) {
              conversation = c;
              assert.property(conversation, 'kmsResourceObjectUrl');

              var activity = conversation.activities.items[conversation.activities.items.length - 2];
              assert.equal(activity.verb, 'post');
              assert.property(activity.object, 'encryptedDisplayName');
              assert.property(activity.object, 'displayName');
              assert.equal(activity.object.displayName, comment);
              assert.notEqual(activity.object.displayName, activity.object.encryptedDisplayName);
            });
        });

        it('grants the specified user permission to access the conversation\'s key', function() {
          return new Promise(function(resolve, reject) {
            if (contains(pluck(conversation.participants.items, 'id'), redshirt.email)) {
              resolve();
            }

            party.spock.spark.conversation.add(conversation, redshirt)
              .catch(function(reason) {
                // We expect a 409 because the user got added to the
                // conversation in the previous test (403 is a remnant of a
                // previous implementation)
                if (reason.statusCode === 403 || reason.statusCode === 409) {
                  return;
                }
                return Promise.reject(reason);
              })
              .then(function() {
                return party.spock.spark.request({
                  uri: conversation.url
                });
              })
              .then(function(res) {
                conversation = res.body;
                resolve();
              })
              .catch(reject);
          })
            .then(function() {
              return assert.isFulfilled(redshirt.spark.encryption.kms.retrieveKeys({uri: conversation.defaultActivityEncryptionKeyUrl}));
            });
        });

        it('sideboards a non-existent user', function() {
          var email = makeEmailAddress();
          var conversation;
          return party.spock.spark.conversation.create({
            comment: 'comment',
            participants: pluck(party, 'id')
          })
           .then(function(c) {
             conversation = c;

             return party.spock.spark.conversation.add(conversation, {
               id: email
             });
           })
           .then(function(activity) {
             assert.include(activity.object.tags, 'SIDE_BOARDED');
             assert.match(activity.object.id, patterns.uuid);
             assert.equal(activity.kmsMessage.authorizations[0].authId, activity.object.id);
           });
        });
      });

      describe('#create()', function() {
        // Yes, it appears to take a very long time to create a conversation
        // with a file
        this.timeout(120000);

        it('creates a compact conversation by default', function() {
          return party.spock.spark.conversation.create({
            participants: pluck(party, 'id')
          })
            .then(function(conversation) {
              assert.isDefined(conversation.encryptedKmsMessage, 'The conversation has a kms message');
              assert.isDefined(conversation.kmsMessage, 'The conversation\'s encrypted kms message was decrypted automatically');
              assert.lengthOf(conversation.kmsMessage.resource.authorizationUris, Object.keys(party).length);

              assert.isDefined(conversation.defaultActivityEncryptionKeyUrl, '`conversation.defaultActivityEncryptionKeyUrl` is defined');
              assert.lengthOf(conversation.participants.items, 3, 'The conversation has three participants');
              assert.lengthOf(conversation.activities.items, 1, 'The conversation only has an `add` activity');

              assert.notInclude(pluck(conversation.activities.items, 'verb'), 'post', 'The conversation does not have `post` activity');
            });
        });

        it('creates a conversation with compact param false', function() {
          return party.spock.spark.conversation.create({
            participants: pluck(party, 'id')
          }, {
            compact: false
          })
            .then(function(conversation) {
              assert.isDefined(conversation.encryptedKmsMessage, 'The conversation has a kms message');
              assert.isDefined(conversation.kmsMessage, 'The conversation\'s encrypted kms message was decrypted automatically');
              assert.lengthOf(conversation.kmsMessage.resource.authorizationUris, Object.keys(party).length);

              assert.isDefined(conversation.defaultActivityEncryptionKeyUrl, '`conversation.defaultActivityEncryptionKeyUrl` is defined');
              assert.lengthOf(conversation.participants.items, 3);
              assert.lengthOf(conversation.activities.items, 4);

              assert.notInclude(pluck(conversation.activities.items, 'verb'), 'post');
            });
        });

        it('creates a conversation with a name', function() {
          return party.spock.spark.conversation.create({
            displayName: 'No first message',
            participants: pluck(party, 'id')
          })
            .then(function(conversation) {
              assert.isDefined(conversation.encryptedKmsMessage, 'The conversation has a kms message');
              assert.isDefined(conversation.kmsMessage, 'The conversation\'s encrypted kms message was decrypted automatically');
              assert.lengthOf(conversation.kmsMessage.resource.authorizationUris, Object.keys(party).length);

              assert.isDefined(conversation.defaultActivityEncryptionKeyUrl);
              assert.lengthOf(conversation.participants.items, 3);
              assert.lengthOf(conversation.activities.items, 1);

              assert.notInclude(pluck(conversation.activities.items, 'verb'), 'post');

              assert.equal(conversation.displayName, 'No first message');
            });
        });

        it('creates a conversation with a comment', function() {
          return party.spock.spark.conversation.create({
            comment: comment,
            participants: pluck(party, 'id')
          })
            .then(function(conversation) {
              assert.isDefined(conversation.defaultActivityEncryptionKeyUrl);
              assert.lengthOf(conversation.participants.items, 3);
              assert.lengthOf(conversation.activities.items, 2);

              assert.isUndefined(conversation.displayName);

              assert.include(pluck(conversation.activities.items, 'verb'), 'post');
              assert.isDefined(find(conversation.activities.items, {verb: 'post'}).object.displayName);

              assert.equal(last(conversation.activities.items).object.displayName, comment);
              assert.isDefined(last(conversation.activities.items).object.encryptedDisplayName);
              assert.notEqual(last(conversation.activities.items).object.encryptedDisplayName, comment);
            });
        });

        it('creates a conversation with a name and a comment', function() {
          return party.spock.spark.conversation.create({
            displayName: 'Has first message',
            comment: comment,
            participants: pluck(party, 'id')
          })
            .then(function(conversation) {
              assert.isDefined(conversation.defaultActivityEncryptionKeyUrl);
              assert.lengthOf(conversation.participants.items, 3);
              assert.lengthOf(conversation.activities.items, 2);

              assert.equal(conversation.displayName, 'Has first message');

              assert.include(pluck(conversation.activities.items, 'verb'), 'post');
              assert.isDefined(find(conversation.activities.items, {verb: 'post'}).object.displayName);

              assert.equal(last(conversation.activities.items).object.displayName, comment);
              assert.isDefined(last(conversation.activities.items).object.encryptedDisplayName);
              assert.notEqual(last(conversation.activities.items).object.encryptedDisplayName, comment);
            });
        });

        it('creates a conversation with a share without a comment', function() {
          return party.spock.spark.conversation.create({
            participants: pluck(party, 'id'),
            files: [fixtures.sampleImageSmallOnePng]
          })
            .then(function(conversation) {
              assert.isDefined(conversation.defaultActivityEncryptionKeyUrl);
              assert.lengthOf(conversation.participants.items, 3);
              assert.lengthOf(conversation.activities.items, 2);

              assert.isUndefined(conversation.displayName);

              assert.include(pluck(conversation.activities.items, 'verb'), 'share');
              assert.isUndefined(last(conversation.activities.items).object.displayName);

              return helpers.assertIsValidFileItem(last(conversation.activities.items).object.files.items[0]);
            });
        });

        it('creates a conversation with a share including a comment', function() {
          return party.spock.spark.conversation.create({
            participants: pluck(party, 'id'),
            files: [fixtures.sampleImageSmallOnePng],
            comment: comment
          })
            .then(function(conversation) {
              assert.isDefined(conversation.defaultActivityEncryptionKeyUrl);
              assert.lengthOf(conversation.participants.items, 3);
              assert.lengthOf(conversation.activities.items, 2);

              assert.isUndefined(conversation.displayName);

              assert.include(pluck(conversation.activities.items, 'verb'), 'share');
              assert.isDefined(last(conversation.activities.items).object.displayName);
              assert.equal(last(conversation.activities.items).object.displayName, comment);
              return helpers.assertIsValidFileItem(last(conversation.activities.items).object.files.items[0]);
            });
        });

        it('creates a conversation with full user objects', function() {
          return party.spock.spark.conversation.create({
            participants: values(party),
            comment: comment
          })
            .then(function(conversation) {
              assert.isDefined(conversation.defaultActivityEncryptionKeyUrl);
              assert.lengthOf(conversation.participants.items, 3);
            });
        });

        it('creates a 1:1 conversation with a share without a comment', function() {
          var redshirt;
          landingparty.beamDownRedshirt()
            .then(function(rs) {
              redshirt = rs;
              return party.spock.spark.conversation.create({
                participants: [redshirt.id],
                files: [fixtures.sampleImageSmallOnePng]
              })
                .then(function(conversation) {
                  assert.include(conversation.tags, 'ONE_ON_ONE');
                  assert.lengthOf(conversation.participants.items, 2);
                  assert.lengthOf(conversation.activities.items, 4);

                  assert.isUndefined(conversation.displayName);

                  assert.include(pluck(conversation.activities.items, 'verb'), 'share');
                  assert.isUndefined(last(conversation.activities.items).object.displayName);
                  return helpers.assertIsValidFileItem(last(conversation.activities.items).object.files.items[0]);
                });
            });
        });

        it('creates a 1:1 conversation with a share with a comment', function() {
          var redshirt;
          landingparty.beamDownRedshirt()
            .then(function(rs) {
              redshirt = rs;

              return party.spock.spark.conversation.create({
                participants: [redshirt.id],
                files: [fixtures.sampleImageSmallOnePng],
                comment: comment
              })
                .then(function(conversation) {
                  assert.include(conversation.tags, 'ONE_ON_ONE');
                  assert.lengthOf(conversation.participants.items, 2);
                  assert.lengthOf(conversation.activities.items, 4);

                  assert.isUndefined(conversation.displayName);

                  assert.include(pluck(conversation.activities.items, 'verb'), 'share');
                  assert.isDefined(last(conversation.activities.items).object.displayName);
                  assert.equal(last(conversation.activities.items).object.displayName, comment);
                  return helpers.assertIsValidFileItem(last(conversation.activities.items).object.files.items[0]);
                });
            });
        });

        it('creates a 1:1', function() {
          var redshirt;
          return landingparty.beamDownRedshirt({createClient: true})
            .then(function(rs) {
              redshirt = rs;

              return party.spock.spark.conversation.create({
                participants: [
                  redshirt.id
                ]
              })
                .then(function(conversation) {
                  assert.include(conversation.tags, 'ONE_ON_ONE');
                  return redshirt.spark.conversation.get(conversation);
                })
                .then(function(conversation) {
                  assert.include(conversation.tags, 'ONE_ON_ONE');
                  return party.spock.spark.encryption._fetchKey(conversation.defaultActivityEncryptionKeyUrl);
                })
                .then(function(key) {
                  assert.match(key.resourceUri, /\/resources\//);
                  return landingparty.killRedshirt(redshirt);
                });
            });
        });

        describe('with a preexisting 1:1', function() {
          var redshirt;
          before(function beamDownRedshirt() {
            return landingparty.beamDownRedshirt({createClient: false})
              .then(function(rs) {
                redshirt = rs;
              });
          });

          var conversation;
          before(function createPreexistingConversation() {
            return party.spock.spark.conversation.create({
              participants: [
                redshirt.id
              ]
            })
              .then(function(c) {
                assert.include(c.tags, 'ONE_ON_ONE');
                conversation = c;
              });
          });

          it('returns the conversation', function() {
            return party.spock.spark.conversation.create({
              participants: [
                redshirt.id
              ]
            })
              .then(function(c) {
                assert.include(c.tags, 'ONE_ON_ONE');
                assert.equal(c.url, conversation.url);
              });
          });

          it('posts the specified comment', function() {
            return party.spock.spark.conversation.create({
              participants: [
                redshirt.id
              ],
              comment: 'specifiedComment'
            })
              .then(function(c) {
                assert.include(c.tags, 'ONE_ON_ONE');
                assert.equal(c.url, conversation.url);

                var activity = last(c.activities.items);
                assert.equal(activity.verb, 'post');
                assert.equal(activity.object.displayName, 'specifiedComment');
              });
          });

          it('shares the specified file(s)', function() {
            return party.spock.spark.conversation.create({
              participants: [
                redshirt.id
              ],
              files: [fixtures.sampleImageSmallOnePng]
            })
              .then(function(c) {
                assert.include(c.tags, 'ONE_ON_ONE');
                assert.equal(c.url, conversation.url);
                var activity = last(c.activities.items);
                assert.equal(activity.verb, 'share');
                // There could probably be more complete assertions here, but
                // I'd like to think the other tests guarantee that a `share`
                // activity works.
              });
          });
        });

        it('creates a 1:1 unless explicitly told not to', function() {
          return party.spock.spark.conversation.create({
            participants: [
              party.checkov.id
            ]
          }, {forceGrouped: true})
            .then(function(conversation) {
              assert.notInclude(conversation.tags, 'ONE_ON_ONE');
            });
        });

        it('creates a conversation and adds the current user to the participants list', function() {
          return party.spock.spark.conversation.create({
            participants: [
              party.mccoy.id,
              party.checkov.id
            ],
            displayName: 'auto add actor to participants list',
            comment: 'first message'
          })
            .then(function(conversation) {
              assert.lengthOf(conversation.participants.items, 3);
            });
        });

        it('creates a 1:1 by inviting new users', function() {
          var email = makeEmailAddress();

          return party.spock.spark.conversation.create({
            participants: [
              email
            ]
          })
            .then(function(conversation) {
              assert.include(conversation.tags, 'ONE_ON_ONE');
              var participant = find(conversation.participants.items, {emailAddress: email});
              assert.include(participant.tags, 'SIDE_BOARDED');
              assert.match(participant.id, patterns.uuid);
            });
        });

        it('creates a grouped conversation by inviting new users', function() {
          var email = makeEmailAddress();

          return party.spock.spark.conversation.create({
            participants: [
              party.mccoy.id,
              email
            ]
          })
            .then(function(conversation) {
              var participant = find(conversation.participants.items, {emailAddress: email});
              assert.include(participant.tags, 'SIDE_BOARDED');
              assert.match(participant.id, patterns.uuid);
            });
        });

        it('does not allow me to create a conversation with zero participants', function() {
          return assert.isRejected(party.spock.spark.conversation.create({
              participants: []
            }, /`conversation.participants` cannot be empty/));
        });

        it('does not allow me to create a 1:1 with myself', function() {
          return assert.isRejected(party.spock.spark.conversation.create({
            participants: [party.spock.spark.device.userId]
          }), /cannot create conversation with self as only participant/);
        });

        it('creates a grouped conversation with myself if forced', function() {
          return party.spock.spark.conversation.create({
            participants: [party.spock.spark.device.userId]
          }, {
            forceGrouped: true
          })
            .then(function(conversation) {
              assert.notInclude(conversation.tags, 'ONE_ON_ONE');
            });
        });
      });

      describe('#delete', function() {
        ensureConversation();

        function findActivityById(conv, activityId) {
          return find(conv.activities.items, {
            id: activityId
          });
        }

        it('deletes your own content', function() {
          var activityToDelete;
          return party.spock.spark.conversation.post(conversation, {
            displayName: comment
          })
            .then(function(activity) {
              activityToDelete = activity;
              return party.spock.spark.conversation.delete(conversation, activity);
            })
            .then(party.spock.spark.request.bind(party.spock.spark, {uri: conversation.url}))
            .then(function(res) {
              assert.equal(activityToDelete.verb, 'post');

              var existingActivity = findActivityById(res.body, activityToDelete.id);
              assert.isDefined(existingActivity);
              assert.notEqual(existingActivity, -1);
              assert.equal(existingActivity.verb, 'tombstone');
              assert.equal(existingActivity.url, activityToDelete.url);
            });
        });

        it('fails to delete other participant\'s content');

        it('deletes any content in a locked room as a moderator');
      });

      describe('#favorite()', function() {
        ensureConversation();

        it('favorites the specified conversation', function() {
          return party.spock.spark.conversation.favorite(conversation)
            .then(function() {
              return party.spock.spark.request({
                uri: conversation.url
              });
            })
            .then(function(res) {
              assert.include(res.body.tags, 'FAVORITE');
            });
        });
      });

      describe('#leave()', function() {
        ensureConversation();
        var redshirt;
        before(function beamDownAndAddRedshirt() {
          return landingparty.beamDownRedshirt({createClient: true})
            .then(function(rs) {
              redshirt = rs;
            });
        });

        beforeEach(function() {
          return party.spock.spark.conversation.add(conversation, redshirt)
            .then(function() {
              return party.spock.spark.request({
                uri: conversation.url
              });
            })
            .then(function(res) {
              conversation = res.body;
              assert.include(pluck(conversation.participants.items, 'id'), redshirt.email);
            })
            .catch(function(reason) {
              // We might be trying to add the user again - that's ok.
              if (reason.statusCode === 403 || reason.statusCode === 409) {
                return;
              }
              return Promise.reject(reason);
            });
        });

        after(function() {
          return landingparty.killRedshirt(redshirt);
        });

        it('removes the current user from the specified conversation', function() {
          return party.spock.spark.conversation.leave(conversation)
            .then(function(activity) {
              var defaultActivityEncryptionKeyUrl = conversation.defaultActivityEncryptionKeyUrl;
              conversation = undefined;
              assert.isDefined(activity.encryptedKmsMessage, 'The activity has a kms message');
              assert.isDefined(activity.kmsMessage, 'The activity\'s encrypted kms message was decrypted automatically');

              return assert.isRejected(party.spock.spark.encryption._fetchKey(defaultActivityEncryptionKeyUrl));
            })
            .then(function(err) {
              try {
                assert.equal(err.status, 403);
              }
              catch (reason) {
                assert.equal(err.status, 409);
              }
            });
        });

        it('removes the specified user from the specified conversation', function() {
          return party.spock.spark.conversation.leave(conversation, redshirt)
            .then(function(activity) {
              assert.isDefined(activity.encryptedKmsMessage, 'The activity has a kms message');
              assert.isDefined(activity.kmsMessage, 'The activity\'s encrypted kms message was decrypted automatically');

              return assert.isRejected(redshirt.spark.encryption._fetchKey(conversation.defaultActivityEncryptionKeyUrl));
            })
            .then(function(err) {
              try {
                assert.equal(err.status, 403);
              }
              catch (reason) {
                assert.equal(err.status, 409);
              }

              return party.spock.spark.request({
                uri: conversation.url
              });
            })
            .then(function(res) {
              conversation = res.body;
              assert.notInclude(pluck(conversation.participants.items, 'id'), redshirt.email);
            });
        });

        describe('with deleted users', function() {
          var redshirt;
          var rsParticipant;

          beforeEach(function beamDownAddAndDeleteRedshirt() {
            return landingparty.beamDownRedshirt()
              .then(function addRedshirt(rs) {
                redshirt = rs;
                return party.spock.spark.conversation.add(conversation, redshirt)
                  .catch(function(reason) {
                    if (reason.statusCode === 403 || reason.statusCode === 409) {
                      return;
                    }

                    return Promise.reject(reason);
                  });
              })
              .then(function killRedshirt() {
                return landingparty.killRedshirt(redshirt);
              })
              .then(function() {
                return delay(1500)
                  .then(function() {
                    return party.spock.spark.conversation.get(conversation);
                  })
                  .then(function(c) {
                    conversation = c;
                    rsParticipant = find(conversation.participants.items, {emailAddress: redshirt.email});
                    assert.include(rsParticipant.tags, 'CI_NOTFOUND');
                  });
              });
          });

          it('removes a deleted user from the specified conversation by participant object', function() {
            return party.spock.spark.conversation.leave(conversation, rsParticipant)
              .then(function retrieveConversation() {
                return party.spock.spark.request({
                  uri: conversation.url
                });
              })
              .then(function confirmRedshirtLeft(res) {
                conversation = res.body;
                assert.notInclude(pluck(conversation.participants.items, 'id'), redshirt.email);
              });
          });

          it('removes a deleted user from the specified conversation by user object', function() {
            return party.spock.spark.conversation.leave(conversation, redshirt)
              .then(function retrieveConversation() {
                return party.spock.spark.request({
                  uri: conversation.url
                });
              })
              .then(function confirmRedshirtLeft(res) {
                conversation = res.body;
                assert.notInclude(pluck(conversation.participants.items, 'id'), redshirt.email);
              });
          });
        });
      });

      describe('#mute()', function() {
        ensureConversation();

        it('mutes the specified conversation', function() {
          return party.spock.spark.conversation.mute(conversation)
            .then(function() {
              return party.spock.spark.request({
                uri: conversation.url
              });
            })
            .then(function(res) {
              assert.include(res.body.tags, 'MUTED');
            });
        });
      });

      describe('#unmute()', function() {
        ensureConversation();

        before(function() {
          return party.spock.spark.conversation.mute(conversation);
        });

        it('unmutes the specified conversation', function() {
          return party.spock.spark.conversation.unmute(conversation)
            .then(function() {
              return party.spock.spark.request({
                uri: conversation.url
              });
            })
            .then(function(res) {
              assert.notInclude(res.body.tags, 'MUTED');
            });
        });
      });

      describe('#muteMentions()', function() {
        ensureConversation();

        it('mutes the specified conversation of Mentions only', function() {
          return party.spock.spark.conversation.muteMentions(conversation)
            .then(function() {
              return party.spock.spark.request({
                uri: conversation.url
              });
            })
            .then(function(res) {
              assert.include(res.body.tags, 'MENTION_NOTIFICATIONS_OFF');
              assert.notInclude(res.body.tags, 'MENTION_NOTIFICATIONS_ON');
            });
        });
      });

      describe('#unmuteMentions()', function() {
        ensureConversation();

        before(function() {
          return party.spock.spark.conversation.muteMentions(conversation);
        });

        it('unmutes the specified conversation of Mentions', function() {
          return party.spock.spark.conversation.unmuteMentions(conversation)
            .then(function() {
              return party.spock.spark.request({
                uri: conversation.url
              });
            })
            .then(function(res) {
              assert.include(res.body.tags, 'MENTION_NOTIFICATIONS_ON');
              assert.notInclude(res.body.tags, 'MENTION_NOTIFICATIONS_OFF');
            });
        });
      });

      describe('#muteMessages()', function() {
        ensureConversation();

        it('mutes the specified conversation of Messages only', function() {
          return party.spock.spark.conversation.muteMessages(conversation)
            .then(function() {
              return party.spock.spark.request({
                uri: conversation.url
              });
            })
            .then(function(res) {
              assert.include(res.body.tags, 'MESSAGE_NOTIFICATIONS_OFF');
              assert.notInclude(res.body.tags, 'MESSAGE_NOTIFICATIONS_ON');
            });
        });
      });

      describe('#unmuteMessages()', function() {
        ensureConversation();

        before(function() {
          return party.spock.spark.conversation.muteMessages(conversation);
        });

        it('unmutes the specified conversation of Messages only', function() {
          return party.spock.spark.conversation.unmuteMessages(conversation)
            .then(function() {
              return party.spock.spark.request({
                uri: conversation.url
              });
            })
            .then(function(res) {
              assert.include(res.body.tags, 'MESSAGE_NOTIFICATIONS_ON');
              assert.notInclude(res.body.tags, 'MESSAGE_NOTIFICATIONS_OFF');
            });
        });
      });

      describe('#removeAllMuteTags()', function() {
        ensureConversation();

        it('removes all mute tags on the convo', function() {
          return party.spock.spark.conversation.muteMessages(conversation)
            .then(function() {
              return party.spock.spark.conversation.muteMentions(conversation);
            })
            .then(function() {
              return party.spock.spark.conversation.removeAllMuteTags(conversation);
            })
            .then(function() {
              return party.spock.spark.request({
                uri: conversation.url
              });
            })
            .then(function(res) {
              assert.notInclude(res.body.tags, 'MESSAGE_NOTIFICATIONS_ON');
              assert.notInclude(res.body.tags, 'MESSAGE_NOTIFICATIONS_OFF');
              assert.notInclude(res.body.tags, 'MENTION_NOTIFICATIONS_ON');
              assert.notInclude(res.body.tags, 'MESSAGE_NOTIFICATIONS_OFF');
            });
        });

        it('removes all unmute tags on the convo', function() {
          return party.spock.spark.conversation.unmuteMentions(conversation)
            .then(function() {
              return party.spock.spark.conversation.unmuteMessages(conversation);
            })
            .then(function() {
              return party.spock.spark.conversation.removeAllMuteTags(conversation);
            })
            .then(function() {
              return party.spock.spark.request({
                uri: conversation.url
              });
            })
            .then(function(res) {
              assert.notInclude(res.body.tags, 'MESSAGE_NOTIFICATIONS_ON');
              assert.notInclude(res.body.tags, 'MESSAGE_NOTIFICATIONS_OFF');
              assert.notInclude(res.body.tags, 'MENTION_NOTIFICATIONS_ON');
              assert.notInclude(res.body.tags, 'MESSAGE_NOTIFICATIONS_OFF');
            });
        });
      });

      describe('#hide()', function() {
        ensureConversation();

        it('hides the specified conversation', function() {
          return party.spock.spark.conversation.hide(conversation)
            .then(function() {
              return party.spock.spark.request({
                uri: conversation.url
              });
            })
            .then(function(res) {
              assert.include(res.body.tags, 'HIDDEN');
            });
        });
      });

      describe('#unhide()', function() {
        ensureConversation();

        before(function() {
          return party.spock.spark.conversation.hide(conversation);
        });

        it('unhides the specified conversation', function() {
          return party.spock.spark.conversation.unhide(conversation)
            .then(function() {
              return party.spock.spark.request({
                uri: conversation.url
              });
            })
            .then(function(res) {
              assert.notInclude(res.body.tags, 'HIDDEN');
            });
        });
      });

      describe('#lock()', function() {
        ensureConversation();

        before(unlockIfLocked);
        after(unlockIfLocked);

        it('locks the specified conversation', function() {
          return party.spock.spark.conversation.lock(conversation)
            .then(function() {
              return party.spock.spark.request({
                uri: conversation.url
              });
            })
            .then(function(res) {
              assert.include(res.body.tags, 'LOCKED');
            });
        });
      });

      describe('#unlock()', function() {
        ensureConversation();

        before(lockIfUnlocked);
        after(unlockIfLocked);

        it('unlocks the specified conversation', function() {
          return party.spock.spark.conversation.unlock(conversation)
            .then(function() {
              return party.spock.spark.request({
                uri: conversation.url
              });
            })
            .then(function(res) {
              assert.notInclude(res.body.tags, 'LOCKED');
            });
        });
      });

      describe('#assignModerator()', function() {
        ensureConversation();
        afterEach(unlockIfLocked);

        it('assigns a moderator to the specified locked conversation', function() {
          return lockIfUnlocked()
            .then(function() {
              return party.spock.spark.conversation.assignModerator(conversation, {
                id: party.mccoy.id
              });
            })
            .then(function() {
              return party.spock.spark.request({
                uri: conversation.url
              });
            })
            .then(function(res) {
              var mccoy = find(res.body.participants.items, function(participant) {
                return (participant.id === party.mccoy.email);
              });
              assert.equal(mccoy.roomProperties.isModerator, 'true');
            });
        });

        // server side's work is still in progress. Ask Bo Zou about this.
        it.skip('fails to assign a moderator to an unlocked conversation', function() {
          var promise = party.spock.spark.conversation.assignModerator(conversation, {
            id: party.mccoy.id
          });
          return assert.isRejected(promise);
        });
      });

      describe('#unassignModerator()', function() {
        ensureConversation();
        afterEach(unlockIfLocked);

        function findMcCoy(conversation) {
          var mccoy = find(conversation.participants.items, function(participant) {
            return (participant.id === party.mccoy.email);
          });
          mccoy.roomProperties = mccoy.roomProperties || {};
          return mccoy;
        }

        it('unassigns a moderator of the specified locked conversation', function() {
          return lockIfUnlocked()
            .then(function(conversation) {
              var mccoy = findMcCoy(conversation);
              if (!mccoy.roomProperties.isModerator) {
                return party.spock.spark.conversation.assignModerator(conversation, {
                  id: party.mccoy.id
                });
              }
            })
            .then(function() {
              return party.spock.spark.conversation.unassignModerator(conversation, {
                id: party.mccoy.id
              });
            })
            .then(function() {
              return party.spock.spark.request({
                uri: conversation.url
              });
            })
            .then(function(res) {
              assert.isUndefined(findMcCoy(res.body).roomProperties.isModerator);
            });
        });

        // server side's work is still in progress. Ask Bo Zou about this.
        it.skip('fails to unassign a non-moderator of the specified locked conversation', function() {
          return lockIfUnlocked()
            .then(function(conversation) {
              var mccoy = findMcCoy(conversation);
              if (mccoy.roomProperties.isModerator) {
                return party.spock.spark.conversation.unassignModerator(conversation, {
                  id: party.mccoy.id
                });
              }
            })
            .then(function() {
              var promise = party.spock.spark.conversation.unassignModerator(conversation, {
                id: party.mccoy.id
              });
              return assert.isRejected(promise);
            });
        });
      });

      describe('#post()', function() {
        ensureConversation();
        it('posts the specified message to the specified conversation', function() {
          var uniqueComment = uuid.v4();
          var waitForActivity = new Promise(function(resolve) {
            party.spock.spark.mercury.on('conversation.activity', function(message) {
              if (message.activity.object.displayName === uniqueComment) {
                resolve(message);
              }
            });
          });

          return party.spock.spark.conversation.post(conversation, {
            displayName: uniqueComment
          })
            .then(function(activity) {
              return waitForActivity
                .then(function(message) {
                  assert.isDefined(activity.encryptionKeyUrl, 'The activity is encrypted');
                  assert.equal(activity.encryptionKeyUrl, conversation.defaultActivityEncryptionKeyUrl);

                  assert.equal(activity.object.displayName, uniqueComment);
                  assert.isDefined(activity.object.encryptedDisplayName);
                  assert.notEqual(activity.object.encryptedDisplayName, uniqueComment);

                  assert.equal(message.activity.id, activity.id);
                  assert.equal(message.activity.encryptionKeyUrl, activity.encryptionKeyUrl);
                  assert.equal(message.activity.object.displayName, activity.object.displayName);
                  assert.equal(message.activity.object.encryptedDisplayName, activity.object.encryptedDisplayName);
                });
            });
        });

        it('posts the specified message and ensure read/unread information', function() {
          var uniqueComment = uuid.v4();
          var spockMercury = party.spock.spark.mercury;
          var waitForActivity = new Promise(function(resolve) {
            spockMercury.on('conversation.activity', function(message) {
              if (message.activity.object.displayName === uniqueComment) {
                resolve(message);
              }
            });
          });

          sinon.spy(spockMercury, '_moveHeadersToData');

          return party.spock.spark.conversation.post(conversation, {
            displayName: uniqueComment
          })
          .then(function(activity) {
            return waitForActivity
              .then(function(message) {
                assert.equal(activity.id, message.activity.id);

                var correctFunctionCall = false;
                for (var i = 0; i < spockMercury._moveHeadersToData.callCount; i++) {
                  var firstArg = spockMercury._moveHeadersToData.getCall(i).args[0];
                  if (firstArg && firstArg.data.activity.object.displayName === uniqueComment) {
                    correctFunctionCall = true;
                  }
                }
                assert.equal(correctFunctionCall, true,  'The activity has a header field');
                spockMercury._moveHeadersToData.restore();

                assert.isDefined(message.activity.target.lastReadableActivityDate);
                assert.isDefined(message.activity.target.lastSeenActivityDate);
                assert.isDefined(message.activity.target.lastSeenActivityUUID);
              });
          });
        });

        it('posts the specified sticker to the specified conversation', function() {
          return party.spock.spark.request({
            api: 'stickies',
            resource: 'pack'
          })
          .then(function(res) {
            var pads = res.body.pads;
            var stickies = pads[0].stickies;
            var stickerLocation = stickies[0].location;

            return party.spock.spark.conversation.post(conversation, {
              location: stickerLocation,
              objectType: 'imageURI'
            })
            .then(function(activity) {
              assert.isDefined(activity.encryptionKeyUrl, 'The activity is encrypted');
              assert.equal(activity.encryptionKeyUrl, conversation.defaultActivityEncryptionKeyUrl);
              assert.equal(activity.object.location, stickerLocation);
              assert.isDefined(activity.object.encryptedLocation);
              assert.notEqual(activity.object.encryptedLocation, stickerLocation);
            });
          });
        });

        it('accepts a `content` property', function() {
          var richComment = '<spark-mention>' + comment + '</spark-mention>';
          return party.spock.spark.conversation.post(conversation, {
            displayName: comment,
            content: richComment
          })
            .then(function(activity) {
              assert.isDefined(activity.encryptionKeyUrl, 'The activity is encrypted');
              assert.equal(activity.encryptionKeyUrl, conversation.defaultActivityEncryptionKeyUrl);

              assert.equal(activity.object.displayName, comment);
              assert.isDefined(activity.object.encryptedDisplayName);
              assert.notEqual(activity.object.encryptedDisplayName, comment);

              assert.equal(activity.object.content, richComment);
              assert.isDefined(activity.object.encryptedContent);
              assert.notEqual(activity.object.encryptedContent, richComment);
            });
        });

        it('submits mentions to the api', function() {
          var displayName = 'Hey @' + party.mccoy.displayName + ', make me a sandwich';
          var content = 'Hey <spark-mention data-object-type="person" data-object-id="' + party.mccoy.id + '">' + party.mccoy.displayName + '</spark-mention>, make me a sandwich';

          return party.spock.spark.conversation.post(conversation, {
            displayName: displayName,
            content: content,
            mentions: {
              items: [{
                id: party.mccoy.id,
                objectType: 'person'
              }]
            }
          })
            .then(function(activity) {
              assert.isDefined(activity.encryptionKeyUrl, 'The activity is encrypted');
              assert.equal(activity.encryptionKeyUrl, conversation.defaultActivityEncryptionKeyUrl);

              assert.equal(activity.object.displayName, displayName);
              assert.isDefined(activity.object.encryptedDisplayName);
              assert.notEqual(activity.object.encryptedDisplayName, displayName);

              assert.equal(activity.object.content, content);
              assert.isDefined(activity.object.encryptedContent);
              assert.notEqual(activity.object.encryptedContent, content);

              assert.isDefined(activity.object.mentions);
              assert.isDefined(activity.object.mentions.items);
              assert.lengthOf(activity.object.mentions.items, 1);
              assert.equal(activity.object.mentions.items[0].id, party.mccoy.id);
            });
        });
      });

      describe('#share()', function() {
        this.timeout(120000);
        ensureConversation();

        describe('sharing an image', function() {
          this.timeout(60000);
          var activity;

          before(function() {
            sinon.spy(party.spock.spark, 'upload');
            return party.spock.spark.conversation.share(conversation, {
              files: [
                fixtures.sampleImageSmallTwoPng
              ]
            })
              .then(function(a) {
                activity = a;
              });
          });

          it('shares the specified image to the conversation', function() {
            assert.isDefined(activity.encryptionKeyUrl, 'The activity is encrypted');

            helpers.assertIsValidFileItem(activity.object.files.items[0]);

            return party.spock.spark.conversation.download(activity.object.files.items[0], {preferBlob: true})
              .then(function(file) {
                return helpers.assertIsSameFile(file, fixtures.sampleImageSmallTwoPng);
              });
          });

          it('creates a thumbnail for that image', function() {
            helpers.assertIsValidThumbnailItem(activity.object.files.items[0].image);

            return party.spock.spark.conversation.download(activity.object.files.items[0].image, {preferBlob: true})
              .then(function(file) {
                assert(party.spock.spark.upload.called);
                // Check that the thumbnail file has the correct '_thumbnail' suffix on the upload path
                return helpers.assertIsExpectedThumbnail(file, activity.object.files.items[0].image);
              });
          });

          it('provides progress events for the image');
        });

        describe('sharing a set of images', function() {
          var activity;

          var images;

          before(function() {
            images = [
              fixtures.sampleImageSmallOnePng,
              fixtures.sampleImageSmallTwoPng
            ];

            return party.spock.spark.conversation.share(conversation, {
              files: images
            })
              .then(function(a) {
                activity = a;
              });
          });

          it('shares the specified images to the conversation', function() {
            assert.isDefined(activity.encryptionKeyUrl, 'The activity has an encryptionKeyUrl');

            assert.lengthOf(activity.object.files.items, 2, 'The activity has two file items');

            return Promise.all(map(activity.object.files.items, function(item, i) {
              helpers.assertIsValidFileItem(item);

              return party.spock.spark.conversation.download(item, {preferBlob: true})
                .then(function(file) {
                  return helpers.assertIsSameFile(file, images[i]);
                });
            }));
          });

          it('creates a set of thumbnails for those images', function() {
            return Promise.all(activity.object.files.items.map(function(item) {
              helpers.assertIsValidThumbnailItem(item.image);

              return party.spock.spark.conversation.download(item.image, {preferBlob: true})
                .then(function(file) {
                  return helpers.assertIsExpectedThumbnail(file, item.image);
                });
            }));
          });

          it('provides progress events for those images');
        });

        describe('sharing a file', function() {
          var activity;
          var hashTestActivity;

          before(function() {
            return party.spock.spark.conversation.share(conversation, {
              files: [
                fixtures.sampleTextTwo
              ]
            })
              .then(function(a) {
                activity = a;
              });
          });

          before(function() {
            return party.spock.spark.conversation.share(conversation, {
              files: [
                fixtures.hashTestText
              ]
            })
              .then(function(a) {
                hashTestActivity = a;
              });
          });

          it('shares the specified file to the conversation', function() {
            assert.isDefined(activity.encryptionKeyUrl, 'The activity is encrypted');

            helpers.assertIsValidFileItem(activity.object.files.items[0]);

            return party.spock.spark.conversation.download(activity.object.files.items[0], {preferBlob: true})
              .then(function(file) {
                return helpers.assertIsSameFile(file, fixtures.sampleTextTwo);
              });
          });


          it('shares a file with a filename containing a special character', function() {
            assert.isDefined(hashTestActivity.encryptionKeyUrl);

            helpers.assertIsValidFileItem(hashTestActivity.object.files.items[0]);

            // TODO: use conversation#download() once we have removed support for getBinary
            return party.spock.spark.encryption.getBinary(hashTestActivity.object.files.items[0], {preferBlob: true})
              .then(function(file) {
                return helpers.assertIsSameFile(file, fixtures.hashTestText);
              });
          });

          it('provides progress events for the file');
        });

        describe('sharing a set of files', function() {
          var activity;
          var files;

          before(function() {
            files = [
              fixtures.sampleTextOne,
              fixtures.sampleTextTwo
            ];

            return party.spock.spark.conversation.share(conversation, {
              files: files
            })
              .then(function(a) {
                activity = a;
              });
          });

          it('shares the specified files to the conversation', function() {
            assert.isDefined(activity.encryptionKeyUrl, 'The activity is encrypted');

            assert.lengthOf(activity.object.files.items, 2, 'The activity has two file items');

            return Promise.all(map(activity.object.files.items, function(item, i) {
              helpers.assertIsValidFileItem(item);

              party.spock.spark.conversation.download(item, {preferBlob: true})
                .then(function(file) {
                  return helpers.assertIsSameFile(file, files[i]);
                });
            }));
          });

          it('provides progress events for those files');
        });

        describe('sharing a transcodeable file', function() {
          var activities;
          var clientTempId;
          var objectUrl;
          var blockUntilTranscode;


          function onMessage(message) {
            activities.push(message.activity);

            if (message.activity.clientTempId === clientTempId) {
              objectUrl = message.activity.object.url;
            }

            if (objectUrl) {
              var updateActivity = find(activities, function(activity) {
                return activity.verb === 'update' && activity.object.url === objectUrl;
              });
              if (updateActivity) {
                blockUntilTranscode.resolve(updateActivity);
              }
            }
          }

          beforeEach(function() {
            clientTempId = uuid.v4();
            activities = [];
            party.spock.spark.mercury.on('conversation.activity', onMessage);
            blockUntilTranscode = new Defer();
          });

          afterEach(function() {
            party.spock.spark.mercury.off('conversation.activity', onMessage);
          });

          it('produces an update activity when the shared file is transcoded', function() {
            return party.spock.spark.conversation.share(conversation, {
              files: [
                fixtures.samplePowerpointTwoPagePpt
              ]
            }, {clientTempId: clientTempId})
              .then(function(activity) {
                activities.push(activity);
                return blockUntilTranscode.promise
                  .then(function(updateActivity) {
                    assert.equal(updateActivity.object.url, activity.object.url);
                    assert.lengthOf(updateActivity.object.files.items[0].transcodedCollection.items[0].files.items, 3);
                  });
              });
          });
        });
      });

      describe('#unfavorite()', function() {
        ensureConversation();

        before(function() {
          return party.spock.spark.conversation.favorite(conversation);
        });

        it('unfavorites the specified conversation', function() {
          return party.spock.spark.conversation.unfavorite(conversation)
            .then(function() {
              return party.spock.spark.request({
                uri: conversation.url
              });
            })
            .then(function(res) {
              assert.notInclude(res.body.tags, 'FAVORITE');
            });
        });
      });

      describe('#update()', function() {
        ensureConversation();

        it('renames the specified conversation', function() {
          conversation.displayName = 'Renamed Test Conversation';
          return party.spock.spark.conversation.update(conversation)
            .then(function(activity) {
              return party.spock.spark.request({
                uri: conversation.url
              })
              .then(function(res) {
                assert.equal(res.body.displayName, activity.object.encryptedDisplayName);
              });
            });
        });
      });

      describe('#updateKey()', function() {
        ensureConversation();

        var originalKeyUrl;

        // Make sure the conversation gets updated so other tests aren't
        // impacted by the new key.
        after(function() {
          assert.isDefined(conversation.url);
          return party.spock.spark.conversation.get(conversation)
            .then(function(c) {
              conversation = c;
            });
        });

        it('assigns an unused key to the specified conversation', function() {
          var newKeyUrl;
          var kmsResourceObjectUrl = conversation.kmsResourceObjectUrl;
          var defaultActivityEncryptionKeyUrl = conversation.defaultActivityEncryptionKeyUrl;

          return party.spock.spark.conversation.updateKey(conversation)
            .then(function(activity) {
              assert.isDefined(activity.encryptedKmsMessage, 'The activity has a kms message');
              assert.isDefined(activity.kmsMessage, 'The activity\'s encrypted kms message was decrypted automatically');

              assert.isDefined(activity.object.defaultActivityEncryptionKeyUrl);
              newKeyUrl = activity.object.defaultActivityEncryptionKeyUrl;

              return party.spock.spark.conversation.get({
                url: conversation.url,
                activitiesLimit: 0,
                participantsLimit: 0
              });
            })
            .then(function(c) {
              conversation = c;
              assert.notEqual(conversation.defaultActivityEncryptionKeyUrl, defaultActivityEncryptionKeyUrl);
              assert.equal(conversation.defaultActivityEncryptionKeyUrl, newKeyUrl);
              assert.equal(conversation.kmsResourceObjectUrl, kmsResourceObjectUrl);
              return party.spock.spark.conversation.post(conversation, {
                displayName: comment
              });
            })
            .then(function() {
              return party.mccoy.spark.conversation.get(conversation);
            })
            .then(function(conversation) {
              var activity = last(conversation.activities.items);
              assert.equal(activity.verb, 'post');
              assert.property(activity.object, 'encryptedDisplayName');
              assert.property(activity.object, 'displayName');
              assert.equal(activity.object.displayName, comment);
              assert.notEqual(activity.object.displayName, activity.object.encryptedDisplayName);
            });
        });

        it('assigns the specified key to the specified conversation', function() {
          return party.spock.spark.encryption.getUnusedKey()
            .then(function(key) {
              return party.spock.spark.conversation.updateKey(conversation, key)
                .then(function() {
                  return party.spock.spark.request({
                    uri: conversation.url
                  });
                })
                .then(function(res) {
                  assert.equal(res.body.defaultActivityEncryptionKeyUrl, key.keyUrl);
                });
            });
        });

        it('grants access to the key for all users in the conversation', function() {
          return new Promise(function(resolve) {
            if (conversation.defaultActivityEncryptionKeyUrl !== originalKeyUrl) {
              resolve();
            }
            else {
              assert.isDefined(conversation.url);
              party.spock.spark.conversation.updateKey(conversation)
                .then(function() {
                  return party.spock.spark.request({
                    uri: conversation.url
                  });
                })
                .then(function(res) {
                  conversation = res.body;
                  resolve();
                });
            }
          })
            .then(function() {
              return assert.isFulfilled(party.mccoy.spark.encryption.kms.retrieveKeys({uri: conversation.defaultActivityEncryptionKeyUrl}));
            });
        });
      });

      describe('options', function() {
        // skipping due to flakiness
        describe.skip('#includePublished', function() {
          ensureConversation();

          var activity;
          var comment = 'test comment';
          var date;
          beforeEach(function() {
            date = new Date(Date.now() - 5*60*1000);

            activity = {
              published: date,
              object: {
                displayName: comment
              }
            };
          });

          // Make sure the conversation is up to date
          before(function() {
            return party.spock.spark.conversation.get(conversation)
              .then(function(c) {
                conversation = c;
              });
          });

          it('prevents `published` from being sent if not specified', function() {
            return party.spock.spark.conversation.post(conversation, {displayName: comment}, activity)
              .then(function(activity) {
                var published = new Date(activity.published);
                assert(published.getTime() > (date.getTime() + 4*60*1000));
              });
          });

          it('sends `published` if specified', function() {
            return party.spock.spark.conversation.post(conversation, {displayName: comment}, activity, {includePublished: true})
              .then(function(activity) {
                var published = new Date(activity.published);
                assert.equal(published.getTime(), date.getTime());
              });
          });
        });
      });

      describe('#starTyping()', function() {
        it('submits a start-typing event');
        it('is rate-limited');
      });

      describe('#stopTyping', function() {
        it('submits a stop-typing event');
      });
    });
  });
});

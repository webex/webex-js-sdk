/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint no-undef: [0] */

var assert = require('chai').assert;
var every = require('lodash.every');
var find = require('lodash.find');
var fh2 = require('../../../lib/fixtures-v2');
var flaky = require('../../../../lib/mocha-helpers').flaky;
var helpers = require('../../../lib/helpers');
var inNode = require('../../../../lib/mocha-helpers').inNode;
var landingparty = require('../../../lib/landingparty');
var last = require('lodash.last');
var noop = require('lodash.noop');
var patterns = require('../../../../../src/util/patterns');
var pluck = require('lodash.pluck');
var sinon = require('sinon');
var skipInNode = require('../../../../lib/mocha-helpers').skipInNode;
var uuid = require('uuid');

describe('Services', function() {
  describe('Conversation', function() {
    describe('Retrieval', function() {
      this.timeout(120000);

      // NOTE: These first two users (scotty and uhura) must only be used in this test module.
      //       Otherwise it breaks feature toggle dependent tests since conv has a feature toggle cache.
      var party = {
        uhura: true,
        scotty: true,
        mccoy: true,
        checkov: true
      };

      before(function beamDown() {
        return landingparty.beamDown(party);
      });

      var conversations;

      var CONVERSATION_COUNT = 3;

      before(function createConversations() {

        var arr = [];

        for (var i = 0; i < CONVERSATION_COUNT; i++) {
          arr.push(i);
        }

        return arr.reduce(function(promise) {
          return promise.then(function() {
            return party.uhura.spark.conversation.create({
              participants: pluck(party, 'id'),
              comment: helpers.generateComment(),
              displayName: helpers.generateSubject()
            });
          });
        }, Promise.resolve());
      });

      before(function prepareConversations() {
        return party.uhura.spark.request({
          api: 'conversation',
          resource: 'conversations',
          qs: {
            participantsLimit: 0,
            activitiesLimit: 0
          }
        })
          .then(function(res) {
            conversations = res.body.items;
          });
      });

      before(function sendCommentsToConversations() {
        var crew = Object.keys(party);

        return Promise.all(conversations.map(function sendCommentsToConversation(conversation) {
          var promises = [];

          for (var i = 0; i < 3; i++) {
            var crewman = crew[i%crew.length];

            promises.push(party[crewman].spark.conversation.post(conversation, {
              displayName: helpers.generateComment()
            }));
          }

          return Promise.all(promises);
        }));
      });

      before(function retrieveConversations() {
        return party.uhura.spark.request({
          api: 'conversation',
          resource: 'conversations'
        })
          .then(function(res) {
            conversations = res.body.items;
            assert.lengthOf(conversations, CONVERSATION_COUNT);
          });
      });

      describe('#get()', function() {
        // GET /conversations?sinceDate=&maxDate=&conversationsLimit=&activitiesLimit=&isActive=&isFavorite=

        it('retrieves the specified conversation', function() {
          return party.uhura.spark.conversation.get(conversations[0])
            .then(function(conversation) {
              assert.isDefined(conversation.url);
              assert.equal(conversation.url, conversations[0].url);

              assert.isDefined(conversation.activities);
              assert.equal(conversation.activities.items.length, conversations[0].activities.items.length);

              assert.isDefined(conversation.defaultActivityEncryptionKeyUrl);
              assert.equal(conversation.defaultActivityEncryptionKeyUrl, conversations[0].defaultActivityEncryptionKeyUrl);

              assert.isDefined(conversation.participants);
              assert.equal(conversation.participants.items.length, conversations[0].participants.items.length);

              assert.isDefined(conversation.encryptedDisplayName);
              assert.equal(conversation.encryptedDisplayName, conversations[0].displayName);
              // TODO make assertions about the displayName
            });
        });

        it('retrieves all conversations', function() {
          return party.uhura.spark.conversation.get()
            .then(function(c) {
              assert.equal(c.length, conversations.length);
            });
        });

        it('retrieves all activities (and their conversation shells) since X', function() {
          return party.mccoy.spark.conversation.post(conversations[0], {
            displayName: helpers.generateComment()
          })
            .then(function(activity) {
              var published = (new Date(activity.published)).getTime();

              return party.uhura.spark.conversation.get({
                activitiesAfter: published - 100
              });
            })
            .then(function(c) {
              assert.lengthOf(c, 1);
              assert.lengthOf(c[0].activities.items, 1);
              assert.equal(c[0].url, conversations[0].url);
            });
        });

        it('retrieves all conversations with activities before X', function() {
          return party.mccoy.spark.conversation.post(conversations[0], {
            displayName: helpers.generateComment()
          })
            .then(function(activity) {
              var published = (new Date(activity.published)).getTime();

              return party.uhura.spark.conversation.get({
                lastActivityBefore: published - 10
              });
            })
            .then(function(c) {
              assert.lengthOf(c, CONVERSATION_COUNT - 1);
              assert.notInclude(pluck(c, 'url'), conversations[0].url);
            });
        });

        it('retrieves conversations with a limited number of activities', function() {
          return party.uhura.spark.conversation.get({
            activitiesLimit: 2
          })
            .then(function(c) {
              assert.lengthOf(c, CONVERSATION_COUNT);
              c.forEach(function(c) {
                assert.lengthOf(c.activities.items, 2);
              });
            });
        });

        it('retrieves conversations with a limited number of participants', function() {
          return party.uhura.spark.conversation.get({
            participantsLimit: 2
          })
            .then(function(c) {
              assert.lengthOf(c, CONVERSATION_COUNT);
              c.forEach(function(c) {
                assert.lengthOf(c.participants.items, 2);
              });
            });
        });

        it('retrieves a limited number of conversations', function() {
          return party.uhura.spark.conversation.get({
            conversationsLimit: 2
          })
            .then(function(c) {
              assert.lengthOf(c, 2);
            });
        });

        it('retrieves favorite conversations', function() {
          return Promise.all([
            party.uhura.spark.conversation.favorite(conversations[0]),
            party.uhura.spark.conversation.favorite(conversations[1])
          ])
            .then(function() {
              return party.uhura.spark.conversation.get({favorites: true});
            })
            .then(function(c) {
              assert.lengthOf(c, 2);
              assert.include(pluck(c, 'url'), conversations[0].url);
              assert.include(pluck(c, 'url'), conversations[1].url);
            });
        });

        // Skipping until the API is fixed to send back conversations that have
        // not been explicitly unfavorited.
        it.skip('retrieves non-favorite conversations', function() {
          return Promise.all([
            party.uhura.spark.conversation.favorite(conversations[0]),
            party.uhura.spark.conversation.favorite(conversations[1])
          ])
            .then(function() {
              return party.uhura.spark.conversation.get({favorites: false});
            })
            .then(function(c) {
              assert.lengthOf(c, CONVERSATION_COUNT - 2);
              assert.notInclude(pluck(c, 'url'), conversations[0].url);
              assert.notInclude(pluck(c, 'url'), conversations[1].url);
            });
        });

        it('retrieves conversations without participants', function() {
          return party.uhura.spark.conversation.get({participantsLimit: 0})
            .then(function(c) {
              assert.lengthOf(c, CONVERSATION_COUNT);
            });
        });

        it('retrieves a conversation with user\'s last read activity id in participant list', function() {
          var comment = helpers.generateComment();
          var ackedActivity;

          return party.checkov.spark.conversation.post(conversations[1], {
            displayName: comment
          })
            .then(function() {
              ackedActivity = last(conversations[1].activities.items);
              return party.uhura.spark.conversation.acknowledge(conversations[1], ackedActivity);
            })
            .then(function() {
              return party.uhura.spark.conversation.get({
                url: conversations[1].url,
                participantAckFilter: 'all'
              });
            })
            .then(function(conversation) {
              var uhura = find(conversation.participants.items, {
                id: party.uhura.id
              });
              assert.isDefined(uhura);
              assert.isDefined(uhura.roomProperties);
              assert.equal(uhura.roomProperties.lastSeenActivityUUID, ackedActivity.id);
              assert.isDefined(uhura.roomProperties.lastAckTime);
            });
        });

        it('retrieves conversations without activities', function() {
          return party.uhura.spark.conversation.get({activitiesLimit: 0})
            .then(function(c) {
              assert.lengthOf(c, CONVERSATION_COUNT);
            });
        });

        it('decrypts retrieved conversation comments', function() {
          var comment = helpers.generateComment();

          return party.uhura.spark.conversation.post(conversations[0], {
            displayName: comment
          })
            .then(function() {
              return party.uhura.spark.request({
                uri: conversations[0].url
              });
            })
            .then(function(res) {
              assert.equal(res.body.url, conversations[0].url);
              assert.notEqual(last(res.body.activities.items).object.displayName, comment);
            })
            .then(function() {
              return party.uhura.spark.conversation.get();
            })
            .then(function(c) {
              assert.equal(c[0].url, conversations[0].url);
              conversations = c;
              assert.equal(last(conversations[0].activities.items).object.displayName, comment);
            });
        });

        it('decrypts retrieved conversation events with non-encrypted location field', function() {
          var plaintextDisplayName = 'TestMeeting1';
          var plaintextLocation = '@spark';
          var mockedEventActivity = {
            verb: 'schedule',
            object: {
                id: uuid.v4(),
                objectType: 'event',
                displayName: plaintextDisplayName,
                location: plaintextLocation,
                startTime: '2015-05-18T20:00:00.000Z',
                endTime: '2015-05-18T20:30:00.000Z'
              }
          };
          return party.uhura.spark.encryption.encryptText(mockedEventActivity.object.displayName, conversations[0].defaultActivityEncryptionKeyUrl)
            .then(function(c) {
              mockedEventActivity.object.displayName = c;
              return party.uhura.spark.request({
                method: 'POST',
                api: 'conversation',
                resource: 'activities',
                body: {
                  verb: 'schedule',
                  target: {
                    objectType: 'conversation',
                    id: conversations[0].id
                  },
                  actor: {
                    objectType: 'person',
                    id: party.uhura.id
                  },
                  object: {
                    id: mockedEventActivity.object.id,
                    objectType: mockedEventActivity.object.objectType,
                    displayName: mockedEventActivity.object.displayName,
                    location: mockedEventActivity.object.location,
                    startTime: mockedEventActivity.object.startTime,
                    endTime: mockedEventActivity.object.endTime
                  },
                  encryptionKeyUrl: conversations[0].defaultActivityEncryptionKeyUrl
                }
              });
            })
          .then(function() {
            return party.uhura.spark.request({
              uri: conversations[0].url
            });
          })
          .then(function(res) {
            assert.equal(res.body.url, conversations[0].url);
            assert.notEqual(last(res.body.activities.items).object.displayName, plaintextDisplayName);
            assert.equal(last(res.body.activities.items).object.location, plaintextLocation);
          })
          .then(function() {
            return party.uhura.spark.conversation.get();
          })
          .then(function(c) {
            assert.equal(c[0].url, conversations[0].url);
            conversations = c;
            assert.equal(last(conversations[0].activities.items).object.displayName, plaintextDisplayName);
            assert.equal(last(conversations[0].activities.items).object.location, plaintextLocation);
          });
        });

        it('decrypts retrieved conversation events', function() {
          var plaintextDisplayName = 'TestMeeting2';
          var plaintextLocation = '@spark';
          var mockedEventActivity = {
            verb: 'schedule',
            object: {
                id: uuid.v4(),
                objectType: 'event',
                displayName: plaintextDisplayName,
                location: plaintextLocation,
                startTime: '2015-05-18T20:00:00.000Z',
                endTime: '2015-05-18T20:30:00.000Z'
              }
          };
          return Promise.all([
            party.uhura.spark.encryption.encryptText(mockedEventActivity.object.displayName, conversations[0].defaultActivityEncryptionKeyUrl),
            party.uhura.spark.encryption.encryptText(mockedEventActivity.object.location, conversations[0].defaultActivityEncryptionKeyUrl)
          ])
            .then(function(ciphertext) {
              mockedEventActivity.encryptionKeyUrl = conversations[0].defaultActivityEncryptionKeyUrl;
              mockedEventActivity.object.displayName = ciphertext[0];
              mockedEventActivity.object.location = ciphertext[1];

              return party.uhura.spark.request({
                method: 'POST',
                api: 'conversation',
                resource: 'activities',
                body: {
                  verb: 'schedule',
                  target: {
                    objectType: 'conversation',
                    id: conversations[0].id
                  },
                  actor: {
                    objectType: 'person',
                    id: party.uhura.id
                  },
                  object: {
                    id: mockedEventActivity.object.id,
                    objectType: mockedEventActivity.object.objectType,
                    displayName: mockedEventActivity.object.displayName,
                    location: mockedEventActivity.object.location,
                    startTime: mockedEventActivity.object.startTime,
                    endTime: mockedEventActivity.object.endTime
                  },
                  encryptionKeyUrl: conversations[0].defaultActivityEncryptionKeyUrl
                }
              });
            })
          .then(function() {
            return party.uhura.spark.request({
              uri: conversations[0].url
            });
          })
          .then(function(res) {
            assert.equal(res.body.url, conversations[0].url);
            assert.notEqual(last(res.body.activities.items).object.displayName, plaintextDisplayName);
            assert.notEqual(last(res.body.activities.items).object.location, plaintextLocation);
          })
          .then(function() {
            return party.uhura.spark.conversation.get();
          })
          .then(function(c) {
            assert.equal(c[0].url, conversations[0].url);
            conversations = c;
            assert.equal(last(conversations[0].activities.items).object.displayName, plaintextDisplayName);
            assert.equal(last(conversations[0].activities.items).object.location, plaintextLocation);
          });
        });

        it('decrypts retrieved conversation comments', function() {
          var comment = helpers.generateComment();

          return party.uhura.spark.conversation.post(conversations[0], {
            displayName: comment
          })
            .then(function() {
              return party.uhura.spark.request({
                uri: conversations[0].url
              });
            })
            .then(function(res) {
              assert.equal(res.body.url, conversations[0].url);
              assert.notEqual(last(res.body.activities.items).object.displayName, comment);
            })
            .then(function() {
              return party.uhura.spark.conversation.get();
            })
            .then(function(c) {
              assert.equal(c[0].url, conversations[0].url);
              conversations = c;
              assert.equal(last(conversations[0].activities.items).object.displayName, comment);
            });
        });

        it('handles an activity with a missing object', function() {
          var comment1 = helpers.generateComment();
          var comment2 = helpers.generateComment();
          return party.uhura.spark.conversation.post(conversations[0], {
            displayName: comment1
          })
          .then(function() {
            return party.uhura.spark.conversation.post(conversations[0], {
              displayName: comment2
            });
          })
          .then(function() {
            return party.uhura.spark.request({
              uri: conversations[0].url
            });
          })
          .then(function(res) {
            delete last(res.body.activities.items).object;
            return party.uhura.spark.conversation.decrypter.decryptObject(res.body);
          })
          .then(function(conversation) {
            var len = conversation.activities.items.length;
            assert.equal(conversation.activities.items[len - 2].object.displayName, comment1);
            assert.equal(last(conversation.activities.items).object, undefined);
          });
        });

        it('decrypts retrieved conversation shares', function() {
          var file;

          var fixtures = {
            file: 'sample-image-small-one.png'
          };

          return fh2.fetchFixtures(fixtures)
            .then(function() {
              file = fixtures.file;

              return party.uhura.spark.conversation.share(conversations[0], {
                displayName: 'Get back to work',
                files: [
                  file
                ]
              });
            })
            .then(function() {
              return party.uhura.spark.conversation.get(conversations[0]);
            })
            .then(function(c) {
              conversations[0] = c;
              var activity = last(c.activities.items);

              assert.equal(activity.verb, 'share');

              assert.equal(activity.object.displayName, 'Get back to work');
              assert.isDefined(activity.object.encryptedDisplayName);

              assert.equal(activity.object.files.items[0].displayName, file.name);

              assert.isString(activity.object.files.items[0].encryptedScr);
              assert.isObject(activity.object.files.items[0].scr);

              assert.isString(activity.object.files.items[0].image.encryptedScr);
              assert.isObject(activity.object.files.items[0].image.scr);

              return Promise.all([
                helpers.assertIsValidFileItem(activity.object.files.items[0]),
                helpers.assertIsValidThumbnailItem(activity.object.files.items[0].image)
              ]);
            });
        });

        it('ensures all actors have proper uuids', function() {
          return party.uhura.spark.conversation.get()
            .then(function(conversations) {
              conversations.forEach(function(conversation) {
                conversation.activities.items.forEach(function(activity) {
                  assert.notMatch(activity.actor.id, patterns.email);
                  assert.match(activity.actor.id, patterns.uuid);
                  assert.match(activity.actor.emailAddress, patterns.email);
                });
              });
            });
        });

        // FIXME test is disabled due to high cloudapps instability
        describe.skip('with `options.relevant === true`', function() {

          var startTime;

          before(function setLastRelevantActivityDate() {
            // First make sure there are no relevant convos for scotty
            return party.scotty.spark.conversation.get(conversations[0])
              .then(function(c) {
                var lastRelevantActivityDate = new Date(c.lastRelevantActivityDate);
                var publishedDate = new Date(c.published);
                startTime = Math.max(lastRelevantActivityDate.getTime(), publishedDate.getTime()) + 1000;
              });
          });

          before(function postToConvo() {
            // First make sure there are no relevant convos for scotty
            return party.scotty.spark.conversation.get({
              sinceDate: startTime,
              relevant: true,
              activitiesLimit: 1,
              ackFilter: 'noack',
              participantAckFilter: 'all'
            })
              .then(function(c) {
                assert.lengthOf(c, 0);
              });
          });

          it('retrieves relevant conversations', function() {
            // uhura mentions scotty
            return party.uhura.spark.conversation.post(conversations[0], {
              displayName: 'Make room relevant',
              mentions: {
                  items: [{
                    id: party.scotty.id,
                    objectType: 'person'
                  }]
                }
            })
              .then(function() {
                // check conv is relevant to scotty now
                return party.scotty.spark.conversation.get({
                  sinceDate: startTime,
                  relevant: true,
                  activitiesLimit: 1,
                  ackFilter: 'noack',
                  participantAckFilter: 'all'
                });
              })
              .then(function(c) {
                assert.lengthOf(c, 1);
              });
          });

        });

      });

      describe('#getPersonalConversation', function() {
        var redshirt;

        before(function beamDownReshirt() {
          return landingparty.beamDownRedshirt({createClient: true})
            .then(function(r) {
              redshirt = r;
            });
        });

        after(function killRedshirt() {
          if (redshirt) {
            return landingparty.killRedshirt(redshirt);
          }
        });

        it('retrieves a personal conversation using an email address', function() {
          return redshirt.spark.conversation.getPersonalConversation({
            email: redshirt.email
          })
            .then(function(conversation) {
              assert.isDefined(conversation.url);
              assert.equal(conversation.creatorUUID, redshirt.id);

              assert.isDefined(conversation.tags);
              assert.include(conversation.tags, 'SQURL');
            });
        });

        it('retrieves a limited number of activities using activitiesLimit param', function() {
          return redshirt.spark.conversation.getPersonalConversation({
            email: redshirt.email
          })
            .then(function(conversation) {
              return redshirt.spark.conversation.post(conversation, {
                displayName: helpers.generateComment()
              });
            })
            .then(function() {
              return redshirt.spark.conversation.getPersonalConversation({
                email: redshirt.email
              },
              {
                activitiesLimit: 1
              });
            })
            .then(function(conversation) {
              assert.isDefined(conversation.activities.items);
              assert.equal(conversation.activities.items.length, 1);

              assert.equal(last(conversation.activities.items).verb, 'post');
            });

        });

        describe('participantAckFilter', function() {

          before(function() {
            return redshirt.spark.conversation.getPersonalConversation({
              email: redshirt.email
            })
              .then(function(conversation) {
                return redshirt.spark.conversation.post(conversation, {
                  displayName: helpers.generateComment()
                })
                .then(function() {
                  return redshirt.spark.conversation.acknowledge(conversation, last(conversation.activities.items));
                });
              });
          });

          describe('when options.participantAckFilter === all', function() {
            it('retrieves a personal room with ack information on participant', function() {
              return redshirt.spark.conversation.getPersonalConversation({
                  email: redshirt.email
                },
                {
                  participantAckFilter: 'all'
                })
                .then(function(conversation) {
                  assert.isDefined(conversation.participants.items);
                  assert(every(conversation.participants.items, function(participant) {
                    return participant.roomProperties.lastSeenActivityUUID;
                  }), 'all participants include `roomProperties.lastSeenActivityUUID` field');
                });
            });
          });

          describe('when options.participantAckFilter === noack', function() {
            it('retrieves a personal room with no ack information on participant', function() {
              return redshirt.spark.conversation.getPersonalConversation({
                  email: redshirt.email
                },
                {
                  participantAckFilter: 'noack'
                })
                .then(function(conversation) {
                  assert.isDefined(conversation.participants.items);
                  assert(every(conversation.participants.items, function(participant) {
                    return !participant.roomProperties || (participant.roomProperties && !participant.roomProperties.lastSeenActivityUUID);
                  }), 'all participants do not include `roomProperties` or `roomProperties.lastSeenActivityUUID` fields');
                });
            });
          });
        });
      });

      // FIXME disabling listUnread test due to increased cloudapps flakiness
      // reenable once
      // https://sqbu-github.cisco.com/WebExSquared/prod-impact/issues/34 is
      // resolved.
      describe.skip('#listUnread()', function() {
        // GET /conversations/unread
        it('retrieves a list of the current user\'s unread conversation ids', function() {
          // Make sure all conversations are currently unread
          return Promise.all(conversations.map(function(conversation) {
            return party.checkov.spark.conversation.post(conversation, {
              displayName: helpers.generateComment()
            });
          }))
            .then(function(activities) {
              assert.lengthOf(activities, CONVERSATION_COUNT);
              return party.uhura.spark.conversation.listUnread();
            })
            .then(function(c) {
              assert.lengthOf(c, CONVERSATION_COUNT);
              return party.uhura.spark.conversation.acknowledge(conversations[0], last(conversations[0].activities.items));
            })
            .then(function() {
              return party.uhura.spark.conversation.listUnread();
            })
            .then(function(c) {
              assert.lengthOf(c, CONVERSATION_COUNT - 1);
            });
        });

        it('retrieves a list of the current user\'s unread conversation ids including muted rooms', function() {
          // Make sure all conversations are currently unread
          return Promise.all(conversations.map(function(conversation) {
            return party.checkov.spark.conversation.post(conversation, {
              displayName: helpers.generateComment()
            });
          }))
            .then(function() {
              // unmute all conversations
              return Promise.all(conversations.map(function(conversation) {
                return party.uhura.spark.conversation.unmute(conversation);
              }));
            })
            .then(function(activities) {
              assert.lengthOf(activities, CONVERSATION_COUNT);
              return party.uhura.spark.conversation.listUnread();
            })
            .then(function(c) {
              assert.lengthOf(c, CONVERSATION_COUNT);
              return party.uhura.spark.conversation.acknowledge(conversations[0], last(conversations[0].activities.items));
            })
            .then(function() {
              return party.uhura.spark.conversation.mute(conversations[1]);
            })
            .then(function() {
              return party.uhura.spark.conversation.listUnread({includeMutedConversation: true});
            })
            .then(function(c) {
              assert.lengthOf(c, CONVERSATION_COUNT - 1);
            });
        });
      });

      flaky(describe)('#listLeft()', function() {
        // GET /conversations/left?sinceDate=&maxDate=&conversationsLimit=
        it('retrieves a list of conversation ids the current users has left', function() {
          return party.mccoy.spark.conversation.listLeft()
            .then(function(c) {
              assert.lengthOf(c, 0);
              return party.mccoy.spark.conversation.leave(conversations[0]);
            })
            .then(function() {
              return party.mccoy.spark.conversation.listLeft();
            })
            .then(function(c) {
              assert.lengthOf(c, 1);
              assert.equal(c[0].id, conversations[0].id);
            });
        });

        it('retrieves a list of conversation ids the current users has left bounded by a maximum date', function() {
          var published;

          return party.checkov.spark.conversation.leave(conversations[0])
            .then(function(activity) {
              published = (new Date(activity.published)).getTime();

              return party.checkov.spark.conversation.listLeft({
                maxDate: published - 10
              });
            })
            .then(function(c) {
              assert.lengthOf(c, 0);

              return party.checkov.spark.conversation.listLeft({
                maxDate: published + 10
              });
            })
            .then(function(c) {
              assert.lengthOf(c, 1);
              assert.include(pluck(c, 'id'), conversations[0].id);
            });
        });

        it('retrieves a list of conversation ids the current users has left bounded by a minimum date', function() {
          var published;

          return party.mccoy.spark.conversation.leave(conversations[1])
            .then(function(activity) {
              published = (new Date(activity.published)).getTime();

              return party.mccoy.spark.conversation.listLeft({
                sinceDate: published + 10
              });
            })
            .then(function(c) {
              assert.lengthOf(c, 0);

              return party.mccoy.spark.conversation.listLeft({
                sinceDate: published - 10
              });
            })
            .then(function(c) {
              assert.lengthOf(c, 1);
              assert.include(pluck(c, 'id'), conversations[1].id);
            });
        });

        it('retrieves a list of conversation ids the current users has left bounded by a maximum quantity', function() {
          return Promise.all([
            // Since checkov may have left a conversation in another test, we
            // need `catch` statements to make sure `Promise.all` doesn't get
            // short-circuited.
            party.checkov.spark.conversation.leave(conversations[0]).catch(noop),
            party.checkov.spark.conversation.leave(conversations[1]).catch(noop)
          ])
            .then(function() {
              return party.checkov.spark.conversation.listLeft({
                conversationsLimit: 1
              });
            })
            .then(function(c) {
              assert.lengthOf(c, 1);

              var leftIds = [
                conversations[0].id,
                conversations[1].id
              ];

              assert.include(leftIds, c[0].id);
            });
        });
      });

      describe('#getActivities()', function() {
        it('retrieves the activities for the specified conversation in ascending order', function() {
          return party.uhura.spark.conversation.getActivities({
            conversationId: conversations[0].id,
            // Put a limit because the endpoint defaults to 6.
            limit: conversations[0].activities.items.length
          })
            .then(function(activities) {
              assert.equal(activities.length, conversations[0].activities.items.length);
              assert.isBelow(activities[0].published, last(activities).published);
            });
        });

        it('decrypts retrieved activities comments', function() {
          var comment = helpers.generateComment();

          return party.uhura.spark.conversation.post(conversations[0], {
            displayName: comment
          })
            .then(function() {
              return party.uhura.spark.request({
                uri: conversations[0].url
              });
            })
            .then(function(res) {
              assert.equal(res.body.url, conversations[0].url);
              assert.notEqual(last(res.body.activities.items).object.displayName, comment);
            })
            .then(function() {
              return party.uhura.spark.conversation.getActivities({
                conversationId: conversations[0].id,
                // Put a limit because the endpoint defaults to 6.
                limit: conversations[0].activities.items.length
              });
            })
            .then(function(activities) {
              assert.equal(last(activities).verb, 'post');
              assert.equal(last(activities).object.displayName, comment);
            });
        });

        it('retrieves activities in which the current user was mentioned', function() {
          var mentionAct;
          // scotty mentions uhura
          return party.scotty.spark.conversation.post(conversations[0], {
            displayName: 'Hi Uhura',
            content: 'Hi <spark-mention data-object-type="person" data-object-id="' + party.uhura.id + '">Uhura</spark-mention>',
            mentions: {
              items: [{
                id: party.uhura.id,
                objectType: 'person'
              }]
            }
          })
            .then(function(activity) {
              mentionAct = activity;
              return party.uhura.spark.conversation.getActivities({
                mentions: true,
                sinceDate: Date.parse(activity.published) - 1
              });
            })
            .then(function(mentions) {
              assert.lengthOf(mentions, 1);
              assert.equal(mentions[0].id, mentionAct.id);
            });
        });
      });

      describe('#create', function() {
        var redshirt;
        var oneToOne;
        var crew = [];

        before(function beamDownReshirt() {
          return landingparty.beamDownRedshirt({createClient: true})
            .then(function(r) {
              redshirt = r;
              crew.push(party.mccoy);
              crew.push(redshirt);
            });
        });

        before(function createOneToOne() {
          return party.mccoy.spark.conversation.create({
            participants: [redshirt.id],
            comment: helpers.generateComment()
          })
          .then(function receiveConvo(res) {
            oneToOne = res;
            return party.mccoy.spark.conversation.post(oneToOne, {displayName: 'more filler'});
          });
        });

        before(function addActivities() {
          var promises = [];
          for (var i = 0; i < 10; i++) {
            var actor = crew[i%2];

            promises.push(actor.spark.conversation.post(oneToOne, {
              displayName: helpers.generateComment()
            }));
          }

          return Promise.all(promises);
        });

        after(function killRedshirt() {
          if (redshirt) {
            return landingparty.killRedshirt(redshirt);
          }
        });

        it('returns an existing 1:1 conversation\'s earliest 6 activities by default', function() {
          return party.mccoy.spark.conversation.create({
            participants: [redshirt.id]
          })
          .then(function(conversation) {
            assert.isDefined(conversation.url);
            assert.equal(conversation.url, oneToOne.url);

            assert.isDefined(conversation.tags);
            assert.include(conversation.tags, 'ONE_ON_ONE');

            assert.isDefined(conversation.activities);
            assert.equal(conversation.activities.items.length, 6);
            assert.equal(conversation.activities.items[0].verb, 'create');
          });
        });

        it('optionally returns 1:1 conversation\'s latest 6 activities', function() {
          return party.mccoy.spark.conversation.create({
            participants: [redshirt.id]
          }, {
            latestActivity: true
          })
          .then(function(conversation) {
            assert.isDefined(conversation.url);
            assert.equal(conversation.url, oneToOne.url);

            assert.isDefined(conversation.tags);
            assert.include(conversation.tags, 'ONE_ON_ONE');

            assert.isDefined(conversation.activities);
            assert.equal(conversation.activities.items.length, 6);
            assert.notEqual(conversation.activities.items[0].verb, 'create');
          });
        });

        it('returns an existing conversation with user\'s last read activity id in participant list', function() {
          var comment = helpers.generateComment();
          var ackedActivity;

          return redshirt.spark.conversation.post(oneToOne, {
            displayName: comment
          })
            .then(function() {
              ackedActivity = last(oneToOne.activities.items);
              return party.mccoy.spark.conversation.acknowledge(oneToOne, ackedActivity);
            })
            .then(function() {
              return party.mccoy.spark.conversation.create({
                participants: [redshirt.id]
              }, {
                participantAckFilter: 'all'
              });
            })
            .then(function(conversation) {
              var mccoy = find(conversation.participants.items, {
                id: party.mccoy.id
              });
              assert.isDefined(mccoy);
              assert.isDefined(mccoy.roomProperties);
              assert.equal(mccoy.roomProperties.lastSeenActivityUUID, ackedActivity.id);
              assert.isDefined(mccoy.roomProperties.lastAckTime);
            });
        });
      });

      describe('#getParticipants()', function() {
        it('retrieves the participants for the specified conversation');
      });

      describe('#download()', function() {
        var conversation;
        var fixtures = {
          sampleImageLargeJpg: 'sample-image-large.jpg',
          sampleImageSmallOnePng: 'sample-image-small-one.png'
        };

        before(function() {
          conversation = conversations[0];

          return fh2.fetchFixtures(fixtures);
        });

        // FIXME: Passes locally but see flakiness remotely.
        xit('downloads and decrypts an encrypted file with no options', function() {
          return party.uhura.spark.conversation.share(conversation, {
            files: [fixtures.sampleImageSmallOnePng]
          })
            .then(function(activity) {
              return party.uhura.spark.conversation.download(activity.object.files.items[0]);
            })
            .then(function(file) {
              return helpers.assertIsSameFile(file, fixtures.sampleImageSmallOnePng);
            });
        });

        it('downloads and decrypts an encrypted file identified by a file item', function() {
          return party.uhura.spark.conversation.share(conversation, {
            files: [fixtures.sampleImageSmallOnePng]
          })
            .then(function(activity) {
              return party.uhura.spark.conversation.download(activity.object.files.items[0], {preferBlob: true});
            })
            .then(function(file) {
              return helpers.assertIsSameFile(file, fixtures.sampleImageSmallOnePng);
            });
        });

        // Only need to verify that an objectURL can be returned in the browser environment.
        skipInNode(it)('downloads an decrypts an encrypted file identified by a file item and returns an objectURL', function() {
          return party.uhura.spark.conversation.share(conversation, {
            files: [fixtures.sampleImageSmallOnePng]
          })
            .then(function(activity) {
              return party.uhura.spark.conversation.download(activity.object.files.items[0], {preferBlob: false});
            })
            .then(function(objectURL) {
              assert.isDefined(objectURL);
              return assert.match(objectURL, /^blob\:.*/);
            });
        });

        it('downloads a non-encrypted file identified by a file item', function() {
          var url;
          if (inNode()) {
            url = 'http://127.0.0.1:' + process.env.FIXTURE_PORT + '/sample-image-large.jpg';
          }
          else {
            url = '/fixtures/sample-image-large.jpg';
          }

          return party.uhura.spark.conversation.download({
            displayName: 'sample-image-large.jpg',
            fileSize: 612295,
            mimeType: 'image/jpeg',
            objectType: 'file',
            url: url
          }, {preferBlob: true})
            .then(function(file) {
              return helpers.assertIsSameFile(file, fixtures.sampleImageLargeJpg);
            });
        });

        it('emits download progress events for encrypted files', function() {
          var progressSpy = sinon.spy();

          return party.uhura.spark.conversation.share(conversation, {
            files: [fixtures.sampleImageSmallOnePng]
          })
            .then(function(activity) {
              return party.uhura.spark.conversation.download(activity.object.files.items[0], {preferBlob: true})
                .on('progress', progressSpy);
            })
            .then(function(file) {
              assert.called(progressSpy);
              return helpers.assertIsSameFile(file, fixtures.sampleImageSmallOnePng);
            });
        });

        it('emits download progress events for non-encrypted files', function() {
          var progressSpy = sinon.spy();
          var url;
          if (inNode()) {
            url = 'http://127.0.0.1:' + process.env.FIXTURE_PORT + '/sample-image-small-one.png';
          }
          else {
            url = '/fixtures/sample-image-small-one.png';
          }

          return party.uhura.spark.conversation.download({
            displayName: 'sample-image-small-one.png',
            fileSize: 295,
            mimeType: 'image/png',
            objectType: 'file',
            url: url
          }, {preferBlob: true})
            .on('progress', progressSpy)
            .then(function(file) {
              assert.called(progressSpy);
              return helpers.assertIsSameFile(file, fixtures.sampleImageSmallOnePng);
            });
        });
      });
    });
  });
});

/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var uuid = require('uuid');
var pluck = require('lodash.pluck');
var map = require('lodash.map');
var landingparty = require('../../../lib/landingparty');

describe('Services', function() {
  describe('Board', function() {
    this.timeout(120000);

    // added a third member in order to be able to create another room.
    var party = {
      spock: true,
      mccoy: true,
    };

    var board;
    var conversation;
    var uniqueRealtimeData;

    function ensureConversation() {
      if (!conversation) {
        console.log('creating new conversation for board ');
        return party.spock.spark.conversation.create({
          displayName: 'Test Board Mercury',
          participants: pluck(party, 'id')
        })
        .then(function(c) {
          console.log('created new conversation for board with id: ', c.id);
          conversation = c;
          return Promise.resolve(c);
        })
        .catch(function(reason) {
          console.log('Error creating new conversation for board ', reason);
          return Promise.reject(reason);
        });
      }
      else {
        return Promise.resolve(conversation);
      }
    }

    before(function beamDown() {
      return landingparty.beamDown(party)
        .then(function() {
          return party.spock.spark.feature.setFeature('developer', 'web-shared-mercury', true);
        })
        .then(function() {
          return party.mccoy.spark.feature.setFeature('developer', 'web-shared-mercury', true);
        });
    });

    before(function createBoard() {
      return ensureConversation()
        .then(function createBoard() {
          var data = {
            properties: {
              darkTheme: false
            }
          };
          console.log('Creating new board');
          return party.spock.spark.board.persistence.createChannel(conversation, data)
            .then(function(w) {
              board = w;
              console.log('created new board: ', board);
              return board;
            });
        })
        .catch(function(reason) {
          return Promise.reject(reason);
        });
    });

    // so that we can connect with new feature toggles
    before(function disconnectFromNormalMercury() {
      return Promise.all(map(party, function(member) {
        return member.spark.mercury.disconnect();
      }));
    });

    after(function cleanUpFeatureToggles() {
      return party.spock.spark.feature.setFeature('developer', 'web-shared-mercury', false)
        .then(function() {
          return party.mccoy.spark.feature.setFeature('developer', 'web-shared-mercury', false);
        });
    });

    describe('Sharing Mercury', function() {
      describe('Mercury', function() {
        it('connects to mercury and gets registration status', function(done) {
          party.spock.spark.mercury.on('mercury.registration_status', function(event) {
            assert.property(event, 'bufferState');
            assert.property(event, 'localClusterServiceUrls');
            assert.deepEqual(party.spock.spark.mercury.localClusterServiceUrls, event.localClusterServiceUrls);
            done();
          });
          party.spock.spark.mercury.connect();
        });
      });

      describe('Board Realtime', function() {
        describe('connect and reconnect', function() {
          it('registers and connect to the shared mercury connection', function() {
            return party.spock.spark.board.realtime.connectToSharedMercury(board)
              .then(function(res) {
                assert.property(res, 'action');
                assert.property(res, 'binding');
                assert.property(res, 'webSocketUrl');
                assert.property(res, 'sharedWebSocket');
                assert.property(res, 'mercuryConnectionServiceClusterUrl');
                assert.equal(res.action, 'REPLACE');
                assert.deepEqual(res.mercuryConnectionServiceClusterUrl, party.spock.spark.mercury.localClusterServiceUrls.mercuryConnectionServiceClusterUrl);
              });
          });

          it('disconnects from shared mercury connection', function() {
            return party.spock.spark.board.realtime.disconnectFromSharedMercury(board)
              .then(function(res) {
                assert.property(res, 'action');
                assert.property(res, 'binding');
                assert.property(res, 'webSocketUrl');
                assert.property(res, 'sharedWebSocket');
                assert.equal(res.action, 'REMOVE');
              });
          });
        });

        describe('sending messages', function() {
          beforeEach(function() {
            uniqueRealtimeData = uuid.v4();
            return Promise.all(map(party, function(member) {
              return member.spark.mercury.connect()
                .then(function() {
                  return member.spark.board.realtime.connectToSharedMercury(board);
                });
            }));
          });

          afterEach(function() {
            return Promise.all(map(party, function(member) {
              return member.spark.mercury.disconnect()
                .then(function() {
                  return member.spark.board.realtime.disconnectFromSharedMercury(board);
                });
            }));
          });


          it('can send and recieve messages', function(done) {
            var data = {
              envelope: {
                channelId: board,
                roomId: conversation.id
              },
              payload: {
                msg: uniqueRealtimeData
              }
            };

            // mccoy is going to listen for mercury data and confirm that we have the
            // same data that was sent.
            party.mccoy.spark.mercury.once('board.activity', function(boardData) {
              assert.equal(boardData.contentType, 'STRING');
              assert.equal(boardData.payload.msg, uniqueRealtimeData);
              done();
            });

            // confirm that both are listening.
            assert(party.spock.spark.mercury.connected, 'spock is not listening');
            assert(party.mccoy.spark.mercury.connected, 'mccoy is not listening');

            // do not return promise because we want done() to be called on
            // board.activity
            party.spock.spark.board.realtime.publish(board, data);
          });
        });
      });
    });
  });
});

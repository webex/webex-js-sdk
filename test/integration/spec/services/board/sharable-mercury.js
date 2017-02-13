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
          return party.mccoy.spark.feature.setFeature('developer', 'web-shared-mercury', false);
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
          party.spock.spark.mercury.once('mercury.registration_status', function(event) {
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
          it('registers and connects to the shared mercury connection', function() {
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

        describe('when messages are sent between shared and non-shared connections', function() {
          beforeEach(function() {
            uniqueRealtimeData = uuid.v4();
            return Promise.all(map(party, function(member) {
              return member.spark.mercury.connect();
            }))
              .then(function() {
                return Promise.all([
                  party.spock.spark.board.realtime.connectToSharedMercury(board),
                  party.mccoy.spark.board.realtime.connectByOpenNewMercuryConnection(board)
                ]);
              });
          });

          afterEach(function() {
            return Promise.all(map(party, function(member) {
              return member.spark.mercury.disconnect()
                .then(function() {
                  if (!member.spark.board.realtime.isSharingMercury) {
                    return member.spark.board.realtime.disconnect();
                  }
                  return member.spark.board.realtime.disconnectFromSharedMercury(board);
                });
            }));
          });

          describe('when a message is sent from the shared connection', function() {
            it('can be received by another separated connection', function(done) {
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
              party.mccoy.spark.board.realtime.once('board.activity', function(boardData) {
                assert.equal(boardData.contentType, 'STRING');
                assert.equal(boardData.payload.msg, uniqueRealtimeData);
                done();
              });

              // this is to ensure messages come to the realtime one (for non-shared)
              party.mccoy.spark.mercury.once('board.activity', function() {
                assert.fail(0, 1, 'messages should come to realtime, not mercury');
              });

              // confirm that both are listening.
              assert(party.spock.spark.mercury.connected, 'spock is not listening');
              assert(party.spock.spark.board.realtime.isSharingMercury, 'spock is not sharing mercury');
              assert(party.mccoy.spark.mercury.connected, 'mccoy is not listening');
              assert.isFalse(party.mccoy.spark.board.realtime.isSharingMercury, 'mccoy should not be sharing mercury');

              // do not return promise because we want done() to be called on
              // board.activity
              party.spock.spark.board.realtime.publish(board, data);
            });
          });

          describe('when a message is sent from the separated connection', function() {
            it('can be received by the shared connection', function(done) {
              var data = {
                envelope: {
                  channelId: board,
                  roomId: conversation.id
                },
                payload: {
                  msg: uniqueRealtimeData
                }
              };

              // spock is listening for mercury data and confirm that we have the
              // same data that was sent.
              party.spock.spark.mercury.once('board.activity', function(boardData) {
                assert.equal(boardData.contentType, 'STRING');
                assert.equal(boardData.payload.msg, uniqueRealtimeData);
                done();
              });

              // confirm that both are listening.
              assert(party.spock.spark.mercury.connected, 'spock is not listening');
              assert(party.spock.spark.board.realtime.isSharingMercury, 'spock is not sharing mercury');
              assert(party.mccoy.spark.mercury.connected, 'mccoy is not listening');
              assert.isFalse(party.mccoy.spark.board.realtime.isSharingMercury, 'mccoy should not be sharing mercury');

              // do not return promise because we want done() to be called on
              // board.activity
              party.mccoy.spark.board.realtime.publish(board, data);
            });
          });
        });
      });
    });
  });
});

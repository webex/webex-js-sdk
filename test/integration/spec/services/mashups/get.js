/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var landingparty = require('../../../lib/landingparty');
var pluck = require('lodash.pluck');

describe('Client', function() {
  describe('Services', function() {
    describe('Mashups', function() {
      describe('Retrieval', function() {
        this.timeout(30000);

        var party = {
          spock: true,
          mccoy: true,
          checkov: false
        };

        before(function() {
          return landingparty.beamDown(party);
        });

        var conversation;
        var conversation2;
        before(function() {
          return Promise.all([
            party.spock.spark.conversation.create({
                displayName: 'Test Conversation',
                participants: pluck(party, 'id')
              }),
            party.spock.spark.conversation.create({
              displayName: 'Test Conversation2',
              participants: pluck(party, 'id')
            })
          ])
            .then(function(conversations) {
              conversation = conversations[0];
              conversation2 = conversations[1];
            });
        });

        after(function deleteTestIntegrations() {
          return party.spock.spark.mashups.get()
            .then(function(integrations) {
              return Promise.all(
                integrations.test.map(function(integration) {
                  var options = {};
                  options.type = 'test';
                  options.id = integration.id;
                  party.spock.spark.mashups.remove(options);
                })
              );
            });
        });

        describe('#get()', function() {

          before(function() {
            return Promise.all([
              party.spock.spark.mashups.create({type: 'test', roomId: conversation.id}),
              party.spock.spark.mashups.create({type: 'test', roomId: conversation2.id})
            ]);
          });

          it('retrieves all integrations', function() {
            return party.spock.spark.mashups.get()
              .then(function(integrations) {
                assert.isArray(integrations.test);
                assert.equal(integrations.test.length, 2);
              });
          });

          it('retrieves integrations for a single room using roomId', function() {
            var options = {};
            options.roomId = conversation.id;
            return party.spock.spark.mashups.get(options)
              .then(function(integrations) {
                assert.isArray(integrations.test);
                assert.equal(integrations.test.length, 1);
                assert.equal(integrations.test[0].roomId, conversation.id);
              });
          });

          it('retrieves integrations for a single room using a conversation object', function() {
            return party.spock.spark.mashups.get(conversation)
              .then(function(integrations) {
                assert.isArray(integrations.test);
                assert.equal(integrations.test.length, 1);
                assert.equal(integrations.test[0].roomId, conversation.id);
              });
          });
        });
      });
    });
  });
});

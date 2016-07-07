/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var landingparty = require('../../../lib/landingparty');
var pluck = require('lodash.pluck');
var retry = require('../../../lib/retry');

describe('Client', function() {
  describe('Services', function() {
    describe('Mashups', function() {
      describe('Actions', function() {
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
        before(function() {
          return retry(function() {
            return party.spock.spark.conversation.create({
              displayName: 'Test Conversation',
              participants: pluck(party, 'id')
            })
              .then(function(res) {
                conversation = res;
              });
          });
        });

        after(function deleteTestIntegrations() {
          return party.spock.spark.mashups.get()
            .then(function(integrations) {
              return Promise.all(integrations.test.map(function(integration) {
                var options = {};
                options.type = 'test';
                options.id = integration.id;
                return party.spock.spark.mashups.remove(options)
                  .catch(function(reason) {
                    console.warn(reason);
                  });
              }));
            });
        });

        describe('#create()', function() {

          it('creates an integration', function() {
            var options = {};
            options.type = 'test';
            options.roomId = conversation.id;
            options.testData1 = 'testData1';
            options.testData2 = 'testData2';
            return party.spock.spark.mashups.create(options)
              .then(function(createdIntegration) {
                assert.isObject(createdIntegration);
                assert.equal(createdIntegration.roomId, options.roomId);
                assert.equal(createdIntegration.testData1, options.testData1);
                assert.equal(createdIntegration.testData2, options.testData2);
              });
          });
        });

        describe('#delete()', function() {

          it('deletes integration', function() {
            var options = {};
            options.type = 'test';
            options.roomId = conversation.id;
            return party.spock.spark.mashups.create(options)
              .then(function(createdIntegration) {
                assert.isObject(createdIntegration);
                var deleteOptions = {};
                deleteOptions.id = createdIntegration.id;
                deleteOptions.type = 'test';
                return party.spock.spark.mashups.remove(deleteOptions);
              });
          });
        });
      });
    });
  });
});

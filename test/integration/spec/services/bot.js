/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var clone = require('lodash.clone');
var landingparty = require('../../lib/landingparty');
var pluck = require('lodash.pluck');
var retry = require('../../lib/retry');
var Spark = require('../../../../src');

var assert = chai.assert;

describe('Services', function() {
  // Will be moved to separate package for direct interaction with CI
  describe.skip('Bot', function() {
    this.timeout(120000);

    var party = {
      spock: true
    };

    before(function beamDown() {
      return landingparty.beamDown(party);
    });

    var bots = [];

    after(function cleanUp() {
      return Promise.all(bots.map(function(bot) {
        var spark = new Spark({
          config: clone(require('../../fixtures/spark-config'))
        });


        return retry(function() {
          return spark.credentials.authenticate(bot);
        })
          .then(function() {
            return spark.device.register();
          })
          .then(function() {
            return spark.bot.remove();
          });
      }));
    });

    describe('#create()', function() {
      it('creates a machine account', function() {
        return party.spock.spark.bot.create({
          name: 'spark-js-sdk-testbot-' + Date.now(),
          contactEmail: party.spock.email
        })
          .then(function(bot) {
            bots.push(bot);

            assert.isDefined(bot.orgId);
            assert.isDefined(bot.name);
            assert.isDefined(bot.password);
            assert.isDefined(bot.email);
            assert.isDefined(bot.description);
          });
      });
    });

    describe('#get()', function() {
      it('retrieves all of the current user\'s machine accounts', function() {
        var bot;
        return party.spock.spark.bot.create({
          name: 'spark-js-sdk-testbot-' + Date.now(),
          contactEmail: party.spock.email
        })
          .then(function(b) {
            bot = b;
            bots.push(bot);
            return party.spock.spark.bot.get();
          })
          .then(function(bots) {
            assert.isArray(bots);
            assert.include(pluck(bots, 'id'), bot.id);
          });
      });

      it('retrieves a specific bot');
    });

    describe('#remove()', function() {
      it('deletes a machine account (as the account\'s creator)', function() {
        return party.spock.spark.bot.create({
          name: 'spark-js-sdk-testbot-' + Date.now(),
          contactEmail: party.spock.email
        })
          .then(function(bot) {
            return party.spock.spark.bot.remove(bot);
          });
      });

      it('deletes a machine account (as that machine account)', function() {
        return party.spock.spark.bot.create({
          name: 'spark-js-sdk-testbot-' + Date.now(),
          contactEmail: party.spock.email
        })
          .then(function(bot) {
            var spark = new Spark({
              config: clone(require('../../fixtures/spark-config'))
            });

            return retry(function() {
              return spark.authenticate(bot);
            })
              .then(function() {
                return spark.bot.remove();
              });
          });
      });
    });

    describe('#update()', function() {
      it('updates a bot\'s contact email (as the current user)');
      it('updates a bot\'s password (as the current user)');
      it('updates a bot\'s contact email (as that machine account)');
      it('updates a bot\'s password (as that machine account)');
    });

  });
});

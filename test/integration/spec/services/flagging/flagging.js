/**!
*
* Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
*/

'use strict';

var _ = require('lodash');
var assert = require('chai').assert;
var landingparty = require('../../../lib/landingparty');
var pluck = require('lodash.pluck');

describe('Client', function() {
  describe('Services', function() {
    describe.skip('Flag', function() {
      this.timeout(45000);
      var flagConversation;
      var party = {
        spock: true,
        mccoy: true,
        checkov: false
      };

      function populateConversation(flagConversation) {
        var spock = party.spock.spark.conversation;
        var mccoy = party.mccoy.spark.conversation;
        return mccoy.post(flagConversation, {
          displayName: 'Hi Dear, How are you?'
        })
          .then(function spockResponse1() {
            return spock.post(flagConversation, {
              displayName: 'Hey! I am doing well. How are you?'
            });
          })
          .then(function mccoyResponse1() {
            return mccoy.post(flagConversation, {
              displayName: 'I am also doing well. Are you in for the party?'
            });
          })
          .then(function spockResponse2() {
            return spock.post(flagConversation, {
              displayName: 'Yes, I am in.'
            });
          });
      }

      before(function() {
        return landingparty.beamDown(party);
      });

      beforeEach(function() {
        // create a test room to test flagging APIs
        return party.spock.spark.conversation.create({
          displayName: 'Test Flagging Room',
          participants: pluck(party, 'id')
        })
          .then(function(conversation) {
            flagConversation = conversation;
            return populateConversation(flagConversation);
          })
          .then(function() {
            assert.isDefined(flagConversation);
            var params = {
              url: flagConversation.url
            };
            return party.spock.spark.conversation.get(params);
          })
          .then(function printConversation(c) {
            flagConversation = c;
            // Removes the "create" activity.
            flagConversation.activities.items.shift();
            var comments = pluck(flagConversation.activities.items, 'object.displayName');
            assert.lengthOf(comments, 4);
            assert.equal(comments[0], 'Hi Dear, How are you?');
            assert.equal(comments[1], 'Hey! I am doing well. How are you?');
            assert.equal(comments[2], 'I am also doing well. Are you in for the party?');
            assert.equal(comments[3], 'Yes, I am in.');
          });
      });

      afterEach(function() {
        return party.spock.spark.flagging.list()
          .then(function(flags) {
            flags.forEach(function(flag) {
              return party.spock.spark.flagging.remove(flag);
            });
          });
      });

      describe('#flag()', function() {
        it('flags the activity', function() {
          var flaggedActivity1 =  flagConversation.activities.items[1];
          return party.spock.spark.flagging.flag(flaggedActivity1)
            .then(function(flagResponse1) {
              assert.equal(flagResponse1.state, 'flagged');
            });
        });
      });

      describe('#list()', function() {
        it('fetches the flag list', function() {
          return party.spock.spark.flagging.list()
            .then(function(flagList) {
              assert.isArray(flagList);
              assert.lengthOf(flagList, 0);
            });
        });
      });

      describe('#mapToActivities()', function() {
        it('maps flags to activity', function() {
          var flaggedActivity1 =  flagConversation.activities.items[1];
          return party.spock.spark.flagging.flag(flaggedActivity1)
            .then(function(flagResponse1) {
              assert.equal(flagResponse1.state, 'flagged');
              var flags = [];
              flags.push(flagResponse1);
              return party.spock.spark.flagging.mapToActivities(flags)
                .then(function(activities) {
                  var activity = activities[0];
                  assert.equal(activity.object.displayName, 'Hey! I am doing well. How are you?');
                  assert.isDefined(_.find(activities, {url: flagResponse1['flag-item']}));
                });
            });
        });
      });

      describe('#remove()', function() {
        it('removes the flag from activity', function() {
          var flaggedActivity1 =  flagConversation.activities.items[1];
          return party.spock.spark.flagging.flag(flaggedActivity1)
            .then(function(flagResponse1) {
              assert.equal(flagResponse1.state, 'flagged');
              return party.spock.spark.flagging.remove(flagResponse1);
            })
            .then(function() {
              return party.spock.spark.flagging.list();
            })
            .then(function(flagList) {
              assert.isArray(flagList);
              assert.lengthOf(flagList, 0);
            });
        });
      });

      describe('#archive()', function() {
        it('archives the flag for an activity', function() {
          var flaggedActivity1 =  flagConversation.activities.items[1];
          return party.spock.spark.flagging.flag(flaggedActivity1)
            .then(function(flagResponse1) {
              assert.equal(flagResponse1.state, 'flagged');
              return party.spock.spark.flagging.archive(flagResponse1);
            })
            .then(function(response) {
              assert.equal(response.state, 'archived');
            });
        });
      });

      describe('#unflag()', function() {
        it('unflag the flag for an activity', function() {
          var flaggedActivity1 =  flagConversation.activities.items[1];
          return party.spock.spark.flagging.flag(flaggedActivity1)
            .then(function(flagResponse1) {
              assert.equal(flagResponse1.state, 'flagged');
              return party.spock.spark.flagging.unflag(flagResponse1);
            })
            .then(function(response) {
              assert.equal(response.state, 'unflagged');
            });
        });
      });
    });
  });
});

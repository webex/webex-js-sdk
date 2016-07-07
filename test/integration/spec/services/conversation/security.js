/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var landingparty = require('../../../lib/landingparty');
var pluck = require('lodash.pluck');
var skipInNode = require('../../../../lib/mocha-helpers').skipInNode;
var fh2 = require('../../../lib/fixtures-v2');

describe('Services', function() {
  describe('Conversation', function() {
    skipInNode(describe)('Security', function() {
      this.timeout(60000);
      var party = {
        spock: true,
        mccoy: true,
        checkov: false
      };

      before(function beamDown() {
        return landingparty.beamDown(party);
      });

      var conversation;
      before(function createConveration() {
        return party.spock.spark.conversation.create({
          displayName: 'Test Conversation',
          participants: pluck(party, 'id')
        })
          .then(function(c) {
            conversation = c;
          });
      });

      var safeInboundHtmlString;
      var safeOutboundHtmlString;
      var unsafeHtmlString;
      var plaintextString;
      beforeEach(function() {
        unsafeHtmlString = 'Hi <script></script><spark-mention data-object-type="person" data-object-id="' + party.mccoy.spark.device.userId + '">McCoy</spark-mention>';
        safeInboundHtmlString = 'Hi <spark-mention data-object-type="person" data-object-id="' + party.mccoy.spark.device.userId + '">McCoy</spark-mention>';
        safeOutboundHtmlString = 'Hi &lt;script&gt;&lt;/script&gt;<spark-mention data-object-type="person" data-object-id="' + party.mccoy.spark.device.userId + '">McCoy</spark-mention>';
        plaintextString = 'Hi McCoy';
      });

      describe('#post()', function() {
        it('posts only safe html', function() {
          return party.spock.spark.conversation.post(conversation, {
            displayName: plaintextString,
            content: unsafeHtmlString,
            mentions: {
              items: [{
                id: party.mccoy.id,
                objectType: 'person'
              }]
            }
          })
            .then(function(activity) {
              assert.equal(activity.object.displayName, plaintextString);
              assert.equal(activity.object.content, safeOutboundHtmlString);
            });
        });
      });

      describe('#share()', function() {

        var fixtures = {
          sampleTextOne: 'sample-text-one.txt'
        };

        before(function() {
          return fh2.fetchFixtures(fixtures);
        });

        it('posts only safe html', function() {
          return party.spock.spark.conversation.share(conversation, {
            displayName: plaintextString,
            content: unsafeHtmlString,
            files: [fixtures.sampleTextOne]
          })
            .then(function(activity) {
              console.log(activity);
              assert.equal(activity.object.displayName, plaintextString);
              assert.equal(activity.object.content, safeOutboundHtmlString);
            });
        });
      });

      describe('#processActivityEvent()', function() {
        it('exposes only safe html', function() {
          // Set the timeout high enough to detect a mercury disconnect and
          // reconnect
          this.timeout(40000);
          var waitForPost = new Promise(function(resolve) {
            party.spock.spark.mercury.on('conversation.activity', function(message) {
              if (message.activity.verb === 'post') {
                resolve(message.activity);
              }
            });
          });

          return party.spock.spark.request({
            method: 'POST',
            api: 'conversation',
            resource: 'activities',
            body: {
              verb: 'post',
              actor: {
                id: party.spock.spark.device.userId,
                objectType: 'person'
              },
              object: {
                objectType: 'comment',
                displayName: plaintextString,
                content: unsafeHtmlString,
                mentions: {
                  items: [{
                    id: party.mccoy.id,
                    objectType: 'person'
                  }]
                }
              },
              target: {
                objectType: 'conversation',
                id: conversation.id,
                url: conversation.url
              }
            }
          })
            .then(function() {
              return Promise.resolve(waitForPost);
            })
            .then(function(activity) {
              assert.equal(activity.object.displayName, plaintextString);
              assert.equal(activity.object.content, safeInboundHtmlString);
            });
        });
      });
    });
  });
});

'use strict';

var assert = require('chai').assert;
var find = require('lodash.find');
var landingparty = require('../../../lib/landingparty');
var TestUsersInterface = require('spark-js-sdk--test-users');


describe('Client', function() {
  describe('Services', function() {
    describe('Encryption', function() {
      describe('when the KMS is in a different org', function() {
        this.timeout(30000);

        var kang;
        before(function makeKmsFedUser() {
          return TestUsersInterface.create({
            email: 'spark-js-sdk--kang--' + Date.now() + '@wx2.example.com',
            entitlements: [
              'spark',
              'webExSquared'
            ],
            // this is the orgId for the special KMS test org
            orgId: 'kmsFederation',
            scopes: process.env.COMMON_IDENTITY_SCOPE
          })
            .then(function(k) {
              assert.equal(k.orgId, '75dcf6c2-247d-4e3d-a32c-ff3ee28398eb');
              kang = k;
            });
        });

        before(function authKmsFedUser() {
          // using a private function for now because this'll get cleaned up
          // during the move to 0.6.0
          return landingparty._makeSpark(kang);
        });

        before(function connectKmsFedUser() {
          return kang.spark.mercury.connect();
        });

        after(function() {
          if (kang) {
            return landingparty._beamUp('kmsFed', kang);
          }
        });

        var party = {
          spock: true
        };

        before(function beamDown() {
          return landingparty.beamDown(party);
        });

        var redshirt;
        before(function beamDownRedshirt() {
          return landingparty.beamDownRedshirt()
            .then(function(rs) {
              redshirt = rs;
            });
        });

        it('has a url that begins with "kms://"', function() {
          return kang.spark.encryption.kms._getKMSCluster()
            .then(function(clusterUrl) {
              assert.include(clusterUrl, 'kms://');
            });
        });

        it('responds to pings', function() {
          return kang.spark.encryption.kms.ping();
        });

        it('lets federated kms users created conversations', function() {
          return kang.spark.conversation.create({
            displayName: 'Cross Org Conversation',
            participants: [
              kang.id,
              redshirt.id
            ],
            comment: 'First Message'
          })
            .then(function(conversation) {
              assert.include(conversation.encryptionKeyUrl, 'kms://');
              return kang.spark.encryption.keystore.clear()
                .then(function() {
                  return kang.spark.conversation.get(conversation);
                });
            })
            .then(function(conversation) {
              var activity = find(conversation.activities.items, {verb: 'post'});
              assert.equal(activity.object.displayName, 'First Message');
            });
        });

        it('allows users to communicate (primary -> secondary)', function() {
          return party.spock.spark.conversation.create({
            displayName: 'Cross Org Conversation (primary -> secondary)',
            participants: [
              kang.id,
              party.spock.id
            ],
            comment: 'First Message'
          }, {forceGrouped: true})
            .then(function(conversation) {
              assert.lengthOf(conversation.participants.items, 2);
              return kang.spark.conversation.get(conversation);
            })
            .then(function(conversation) {
              var activity = find(conversation.activities.items, {verb: 'post'});
              assert.equal(activity.object.displayName, 'First Message');
            });
        });

        it('allows users to communicate (secondary -> primary)', function() {
          return kang.spark.conversation.create({
            displayName: 'Cross Org Conversation (secondary -> primary)',
            participants: [
              kang.id,
              party.spock.id
            ],
            comment: 'First Message'
          }, {forceGrouped: true})
            .then(function(conversation) {
              assert.lengthOf(conversation.participants.items, 2);
              return party.spock.spark.conversation.get(conversation);
            })
            .then(function(conversation) {
              var activity = find(conversation.activities.items, {verb: 'post'});
              assert.equal(activity.object.displayName, 'First Message');
            });
        });

      });
    });
  });
});

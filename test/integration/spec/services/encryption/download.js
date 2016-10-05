/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var fh2 = require('../../../lib/fixtures-v2');
var landingparty = require('../../../lib/landingparty');
var pluck = require('lodash.pluck');
var sinon = require('sinon');

describe('Services', function() {
  describe('Encryption', function() {
    describe('#download()', function() {
      this.timeout(120000);
      var party = {
        spock: true,
        mccoy: false,
        checkov: false
      };

      var fixtures = {
        sampleTextOne: 'sample-text-one.txt'
      };

      before(function beamDown() {
        return landingparty.beamDown(party);
      });

      before(function fetchFixtures() {
        return fh2.fetchFixtures(fixtures);
      });

      var conversation;
      before(function() {
        return party.spock.spark.conversation.create({
          displayName: 'Test Conversation',
          participants: pluck(party, 'id')
        })
          .then(function(c) {
            conversation = c;
          });
      });

      var activity;
      before(function() {
        return party.spock.spark.conversation.share(conversation, {
          files: [fixtures.sampleTextOne]
        })
        .then(function(a) {
          activity = a;
        });
      });

      it('downloads and decrypts an encrypted file', function() {
        return party.spock.spark.encryption.download(activity.object.files.items[0].scr)
          .then(function(file) {
            return assert.eventually.isTrue(fh2.isMatchingFile(file, fixtures.sampleTextOne));
          });
      });

      it('emits download progress events', function() {
        var spy = sinon.spy();

        return party.spock.spark.encryption.download(activity.object.files.items[0].scr)
          .on('progress', spy)
          .then(function() {
            assert.called(spy);
          });
      });
    });
  });
});

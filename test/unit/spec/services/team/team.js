/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var Conversation = require('../../../../../src/client/services/conversation/');
var MockSpark = require('../../../lib/mock-spark');
var sinon = require('sinon');
var Team = require('../../../../../src/client/services/team');

var assert = chai.assert;

describe('Services', function() {
  describe('Team', function() {
    var spark;

    beforeEach(function() {
      spark = new MockSpark({
        children: {
          team: Team,
          conversation: Conversation
        }
      });
    });

    describe('#archive()', function() {
      it('requires an objectType', function() {
        return assert.isRejected(spark.team.archive({}), /`target.objectType` is required/);
      });
    });

    describe('#create()', function() {
      it('requires a displayName', function() {
        return assert.isRejected(spark.team.create({}), /`team.displayName` is required/);
      });

      it('requires a participants attribute', function() {
        var promise = spark.team.create({
          displayName: 'TeamName'
        });
        return assert.isRejected(promise, /`team.participants` is required/);
      });

      it('requires a non-empty participants list', function() {
        var promise = spark.team.create({
          displayName: 'TeamName',
          participants: []
        });
        return assert.isRejected(promise, /`team.participants` cannot be empty/);
      });
    });

    describe('#update()', function() {
      it('requires a displayName', function() {
        return assert.isRejected(spark.team.update({}), /`team.displayName` is required/);
      });
    });

    describe('#createConversation()', function() {
      it('requires a displayName', function() {
        var promise = spark.team.createConversation({id: 'team-1'}, {id: 'team-room-1'});
        return assert.isRejected(promise, /`conversation.displayName` is required/);
      });
    });

    describe('#prepareTeamConversation()', function() {
      it('returns with a rejected promise if the teamConversation does not have a KRO', function() {
        var promise = spark.team._prepareTeamConversation({id: 'team-1'}, {
          participants: ['user-1'],
          displayName: 'teamRoomName'
        });
        return assert.isRejected(promise, /Team general conversation must have a KRO/);
      });
    });

    describe('#ensureGeneralConversation()', function() {
      it('returns with a rejected promise if the team\'s generalConversationUuid is not present', function() {
        var promise = spark.team._ensureGeneralConversation({});
        return assert.isRejected(promise, /`team.generalConversationUuid` must be present/);
      });

      it('fetches the general conversation if not present', function() {
        var getSpy = sinon.spy(spark.conversation, 'get');
        spark.team._ensureGeneralConversation({
          generalConversationUuid: 'convo-1',
          conversations: {
            items: []
          }
        });
        assert.called(getSpy, 'team general conversation was fetched from server if not present');
      });
    });

    describe('#unarchive()', function() {
      it('requires an objectType', function() {
        return assert.isRejected(spark.team.unarchive({}), /`target.objectType` is required/);
      });
    });
  });
});

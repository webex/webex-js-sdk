/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var Normalizer = require('../../../../../src/client/services/conversation/normalizer');
require('../../../../../src/client/services/team/normalizer');
var sinon = require('sinon');

var assert = chai.assert;
sinon.assert.expose(chai.assert, {prefix: ''});

describe('Services', function() {
  describe('Team', function() {
    describe('Normalizer', function() {
      var normalizer;
      var client;
      var conversationNormalizer;
      var personNormalizer;
      beforeEach(function() {
        client = {
          user: {
            getUUID: sinon.stub().returns(Promise.resolve('88888888-4444-4444-4444-aaaaaaaaaaaa'))
          }
        };
        normalizer = new Normalizer();
        normalizer.parent = client;

        conversationNormalizer = sinon.stub(normalizer, '_normalizeConversation').returns(Promise.resolve());
        personNormalizer = sinon.stub(normalizer, '_normalizePerson').returns(Promise.resolve());
      });

      describe('#_normalizeTeam()', function() {

        it('normalizes conversation and teamMembers entries', function() {
          var input = {};
          var output = {
            conversations: {
              items: []
            },
            teamMembers: {
              items: []
            }
          };

          return assert.becomes(normalizer._normalizeTeam(input), output);
        });

        it('calls normalizers for conversations and people', function() {
          var input = {
            conversations: {
              items: [
                {
                  objectType: 'conversation'
                }
              ]
            },
            teamMembers: {
              items: [
                {
                  objectType: 'person'
                }
              ]
            }
          };
          var output = {
            conversations: {
              items: [
                {
                  objectType: 'conversation'
                }
              ]
            },
            teamMembers: {
              items: [
                {
                  objectType: 'person'
                }
              ]
            }
          };

          assert.becomes(normalizer._normalizeTeam(input), output);
          assert.called(conversationNormalizer);
          assert.called(personNormalizer);
        });
      });
    });
  });
});

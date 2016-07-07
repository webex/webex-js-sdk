/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var Normalizer = require('../../../../../src/client/services/conversation/normalizer');
var sinon = require('sinon');

var assert = chai.assert;
sinon.assert.expose(chai.assert, {prefix: ''});

describe('Services', function() {
  describe('Conversation', function() {
    describe('Normalizer', function() {
      var client;
      var normalizer;

      beforeEach(function() {
        client = {
          user: {
            getUUID: sinon.stub().returns(Promise.resolve('88888888-4444-4444-4444-aaaaaaaaaaaa'))
          }
        };

        normalizer = new Normalizer();
        normalizer.parent = client;
      });

      describe('#_normalizePerson()', function() {
        var io = [
          {
            input: {
              id: 'test@example.com'
            },
            output: {
              emailAddress: 'test@example.com',
              entryUUID: '88888888-4444-4444-4444-aaaaaaaaaaaa',
              entryEmail: 'test@example.com',
              id: '88888888-4444-4444-4444-aaaaaaaaaaaa'
            }
          },
          {
            input: {
              id: '88888888-4444-4444-4444-aaaaaaaaaaaa'
            },
            output: {
              entryUUID: '88888888-4444-4444-4444-aaaaaaaaaaaa',
              id: '88888888-4444-4444-4444-aaaaaaaaaaaa'
            }
          },
          {
            input: {
              emailAddress: 'test@example.com',
              id: '88888888-4444-4444-4444-aaaaaaaaaaaa'
            },
            output: {
              emailAddress: 'test@example.com',
              entryUUID: '88888888-4444-4444-4444-aaaaaaaaaaaa',
              entryEmail: 'test@example.com',
              id: '88888888-4444-4444-4444-aaaaaaaaaaaa'
            }
          },
          {
            input: {
              entryEmail: 'test@example.com'
            },
            output: {
              emailAddress: 'test@example.com',
              entryUUID: '88888888-4444-4444-4444-aaaaaaaaaaaa',
              entryEmail: 'test@example.com',
              id: '88888888-4444-4444-4444-aaaaaaaaaaaa'
            }
          },
          {
            input: {
              entryUUID: '88888888-4444-4444-4444-aaaaaaaaaaaa'
            },
            output: {
              entryUUID: '88888888-4444-4444-4444-aaaaaaaaaaaa',
              id: '88888888-4444-4444-4444-aaaaaaaaaaaa'
            }
          },
          {
            input: {
              entryEmail: 'test@example.com',
              entryUUID: '88888888-4444-4444-4444-aaaaaaaaaaaa'
            },
            output: {
              emailAddress: 'test@example.com',
              entryUUID: '88888888-4444-4444-4444-aaaaaaaaaaaa',
              entryEmail: 'test@example.com',
              id: '88888888-4444-4444-4444-aaaaaaaaaaaa'
            }
          },
          {
            input: {
              entryEmail: 'test@example.com',
              entryUUID: 'test@example.com'
            },
            output: {
              emailAddress: 'test@example.com',
              entryUUID: '88888888-4444-4444-4444-aaaaaaaaaaaa',
              entryEmail: 'test@example.com',
              id: '88888888-4444-4444-4444-aaaaaaaaaaaa'
            }
          }
        ];

        io.forEach(function(item) {
          var input = item.input;
          var output = item.output;

          var inputKeys = Object.keys(input).join(', ');
          var outputKeys = Object.keys(output).join(', ');

          it('normalizes an object with keys ' + inputKeys + ' to an object with keys ' + outputKeys, function() {
            return assert.becomes(normalizer._normalizePerson(input), output);
          });
        });

        it('converts email addresses to lowercase', function() {
          var input = {
            id: 'USER@EXAMPLE.COM'
          };

          var output = {
            emailAddress: 'user@example.com',
            entryUUID: '88888888-4444-4444-4444-aaaaaaaaaaaa',
            entryEmail: 'user@example.com',
            id: '88888888-4444-4444-4444-aaaaaaaaaaaa'
          };

          return assert.becomes(normalizer._normalizePerson(input), output);
        });

        it('converts UUIDs to lowercase', function() {
          var input = {
            id: '88888888-4444-4444-4444-AAAAAAAAAAAA'
          };

          var output = {
            entryUUID: '88888888-4444-4444-4444-aaaaaaaaaaaa',
            id: '88888888-4444-4444-4444-aaaaaaaaaaaa'
          };

          return assert.becomes(normalizer._normalizePerson(input), output);
        });

        it('throws error if neither uuid nor email is provided', function() {
          return assert.isRejected(normalizer._normalizePerson('not-a-valid-email-or-uuid'),
            /cannot determine uuid without an `emailAddress` or `entryUUID` property/);
        });

      });

      describe('#normalize', function() {
        it('returns a rejected promise if `objectType` is not defined', function() {
          return assert.isRejected(normalizer.normalize({}), /Cannot normalize `object` without `objectType`/);
        });

        ['Conversation', 'Activity', 'Person'].forEach(function(type) {
          it('normalizes conversation if objectType is conversation', function() {
            normalizer['_normalize' + type] = sinon.stub().returns(Promise.resolve());
            return normalizer.normalize({
              objectType: type.toLowerCase()
            })
            .then(function() {
              assert.callCount(normalizer['_normalize' + type], 1);
            });
          });
        });

        it('removes blank "content" properties', function() {
          var before = {
            objectType: 'activity',
            object: {
              objectType: 'comment',
              content: ''
            }
          };

          var after = {
            objectType: 'activity',
            object: {
              objectType: 'comment'
            }
          };
          return assert.becomes(normalizer.normalize(before), after);
        });
      });

    });
  });
});

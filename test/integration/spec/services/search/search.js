/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var countBy = require('lodash.countby');
var landingparty = require('../../../lib/landingparty');
var omit = require('lodash.omit');
var pluck = require('lodash.pluck');
var util = require('util');
var uuid = require('uuid');
var retry = require('../../../lib/retry');

describe('Services', function() {
  describe('Search', function() {
    this.timeout(60000);

    describe('#people()', function() {
      var party = {
        spock: true,
        mccoy: false,
        checkov: false
      };

      var bot;

      before(function beamDown() {
        return landingparty.beamDown(party)
          .then(function() {
            return party.spock.spark.request({
              api: 'hydra',
              resource: 'bots',
              method: 'POST',
              body: {
                displayName: 'Personal Assistant',
                email: uuid.v4() + '@sparkbot.io'
              }
            });
          })
          .then(function(res) {
            bot = res.body;
          });
      });

      it('searches for users with the specified string', function() {
        return party.spock.spark.search.people({query: 'abc'})
          .then(function(users) {
            assert.isArray(users);
          });
      });

      it('searches for users with the specified string with `queryString` param', function() {
        return party.spock.spark.search.people({queryString: 'abc'})
          .then(function(users) {
            assert.isArray(users);
          });
      });

      it('retrieves a specific user', function() {
        return party.spock.spark.search.people({query: party.mccoy.email})
          .then(function(users) {
            assert.isAbove(users.length, 0, 'At least one user was found');
            assert.equal(users[0].id, party.mccoy.id);
          });
      });

      it('retrieves a bot', function() {
        return party.spock.spark.search.people({query: bot.email, includeRobots: true})
          .then(function(users) {
            assert.isAbove(users.length, 0, 'At least one user was found');
            assert.equal(users[0].email, bot.email);
          });
      });

      it('retrieves a bot', function() {
        return party.spock.spark.search.people({query: bot.email, includeRobots: false})
          .then(function(users) {
            assert.equal(users.length, 0, 'No bots are returned');
          });
      });

      [undefined, null, {}].forEach(function(query) {
        it('rejects with no query', function() {
          return party.spock.spark.search.people(query)
            .catch(function(err) {
              assert.equal(err.message, '`options.query` is required');
            });
        });
      });
    });

    describe('#search()', function() {
      var party = {
        spock: true,
        mccoy: true,
        checkov: true
      };

      before(function beamDown() {
        return landingparty.beamDown(party);
      });

      var spockConversation;
      var mccoyConversation;

      // Spock, McCoy, Checkov
      before(function ensureSpockConversation() {
        if (!spockConversation) {
          return party.spock.spark.conversation.create({
            displayName: 'Spock Room',
            participants: pluck(party, 'id')
          })
            .then(function(c) {
              spockConversation = c;
              assert.lengthOf(spockConversation.participants.items, 3);
            });
        }
      });

      // Spock and McCoy only, but a group
      before(function ensureMccoyConversation() {
        if (!mccoyConversation) {
          return party.mccoy.spark.conversation.create({
            displayName: 'McCoy Room',
            participants: pluck(omit(party, 'checkov'), 'id')
          },
          {
            forceGrouped: true
          })
            .then(function(c) {
              mccoyConversation = c;
              assert.lengthOf(mccoyConversation.participants.items, 2);
            });
        }
      });

      function populateConversation(conversation) {
        var spock = party.spock.spark.conversation;
        var mccoy = party.mccoy.spark.conversation;
        return mccoy.post(conversation, {
          displayName: 'Hello, Spock.'
        })
        .then(function spockResponse1() {
          return spock.post(conversation, {
            displayName: 'Hello, Doctor.'
          });
        })
        .then(function mccoyResponse1() {
          return mccoy.post(conversation, {
            displayName: 'What did Jim say?'
          });
        })
        .then(function spockResponse2() {
          return spock.post(conversation, {
            displayName: 'The captain wishes to board.'
          });
        });
        // TODO: Populate with content
      }

      before(function populateSpockConversation() {
        return populateConversation(spockConversation)
          .then(function() {
            assert.isDefined(spockConversation);

            var params = {
              url: spockConversation.url
            };
            return party.spock.spark.conversation.get(params);
          })
          .then(function printConversation(c) {
            spockConversation = c;
            // Removes the "create" activity.
            spockConversation.activities.items.shift();
            var comments = pluck(spockConversation.activities.items, 'object.displayName');
            assert.lengthOf(comments, 4);
            assert.equal(comments[0], 'Hello, Spock.');
            assert.equal(comments[1], 'Hello, Doctor.');
            assert.equal(comments[2], 'What did Jim say?');
            assert.equal(comments[3], 'The captain wishes to board.');
          });
      });

      before(function populateMccoyConversation() {
        return populateConversation(mccoyConversation)
          .then(function() {
            assert.isDefined(mccoyConversation);

            var params = {
              url: mccoyConversation.url
            };
            return party.mccoy.spark.conversation.get(params);
          })
          .then(function printConversation(c) {
            mccoyConversation = c;
            // Removes the "create" activity.
            mccoyConversation.activities.items.shift();
            var comments = pluck(mccoyConversation.activities.items, 'object.displayName');
            assert.lengthOf(comments, 4);
            assert.equal(comments[0], 'Hello, Spock.');
            assert.equal(comments[1], 'Hello, Doctor.');
            assert.equal(comments[2], 'What did Jim say?');
            assert.equal(comments[3], 'The captain wishes to board.');
          });
      });

      // TODO
      // searches {all} conversations limiting
      // type to {comment, etc.}
      // shared by {sharedBy}
      // searches {some} conversations limiting (sharedIn)
      // searches {one} conversation limiting (sharedIn)

      var testData = [
        // Single word
        // Asserts comments
        {
          given: {
            user: 'spock',
            query: 'hElLo'
          },
          expected: {
            path: 'object.displayName',
            results: [
              {name: 'Hello, Spock.', count: 2},
              {name: 'Hello, Doctor.', count: 2}
            ],
            resultsCount: 4
          }
        },
        // Single word
        // Single result
        // Asserts comments
        {
          given: {
            user: 'checkov',
            query: 'JiM'
          },
          expected: {
            path: 'object.displayName',
            results: [
              {name: 'What did Jim say?', count: 1}
            ],
            resultsCount: 1
          }
        },
        // Single word
        // Asserts comments
        // Different participant searching
        // belongs to both conversations
        {
          given: {
            user: 'mccoy',
            query: 'hElLo'
          },
          expected: {
            path: 'object.displayName',
            results: [
              {name: 'Hello, Spock.', count: 2},
              {name: 'Hello, Doctor.', count: 2}
            ],
            resultsCount: 4
          }
        },
        // Single word
        // Asserts comments
        // Different participant searching
        // belongs to only one conversation
        {
          given: {
            user: 'checkov',
            query: 'hElLo'
          },
          expected: {
            path: 'object.displayName',
            results: [
              {name: 'Hello, Spock.', count: 1},
              {name: 'Hello, Doctor.', count: 1}
            ],
            resultsCount: 2
          }
        },
        // Single word
        // Asserts result type
        {
          given: {
            user: 'spock',
            query: 'hElLo'
          },
          expected: {
            path: 'object.objectType',
            results: [
              {name: 'comment', count: 4}
            ],
            resultsCount: 4
          }
        },
        // Multiple words
        // Asserts comments
        // Disable for API upgrade
        // {
        //   given: {
        //     user: 'spock',
        //     query: 'hElLo SpOck'
        //   },
        //   expected: {
        //     path: 'object.displayName',
        //     results: [
        //       {name: 'Hello, Spock.', count: 2},
        //       {name: 'Hello, Doctor.', count: 2}
        //     ],
        //     resultsCount: 4
        //   }
        // },
        // Multiple words
        // Asserts result type

        // Disable for API upgrade
        // {
        //   given: {
        //     user: 'spock',
        //     query: 'hElLo SpOck'
        //   },
        //   expected: {
        //     path: 'object.objectType',
        //     results: [
        //       {name: 'comment', count: 4}
        //     ],
        //     resultsCount: 4
        //   }
        // },
        // Multiple words
        // with punctuation
        // Asserts comments

        // Disable for API upgrade
        // {
        //   given: {
        //     user: 'spock',
        //     query: 'hElLo, SpOck.'
        //   },
        //   expected: {
        //     path: 'object.displayName',
        //     results: [
        //       {name: 'Hello, Spock.', count: 2},
        //       {name: 'Hello, Doctor.', count: 2}
        //     ],
        //     resultsCount: 4
        //   }
        // },
        // Multiple words
        // with punctuation
        // Asserts result type

        // Disable for API upgrade
        // {
        //   given: {
        //     user: 'spock',
        //     query: 'hElLo, SpOck.'
        //   },
        //   expected: {
        //     path: 'object.objectType',
        //     results: [
        //       {name: 'comment', count: 4}
        //     ],
        //     resultsCount: 4
        //   }
        // },

        // Limit results back

        // 0
        {
          given: {
            user: 'spock',
            query: 'hElLo',
            size: 0
          },
          expected: {
            path: 'object.displayName',
            results: [],
            resultsCount: 4
          }
        }
      ];

      var testDataWithResultLimit = [
        {
          given: {
            user: 'spock',
            query: 'hElLo',
            size: -1
          },
          expected: {
            path: 'object.displayName',
            results: [
              {name: 'Hello, Spock.', count: 2},
              {name: 'Hello, Doctor.', count: 2}
            ],
            // Server treats negative limit as default limit of 20
            resultsCount: 4
          }
        },
        {
          given: {
            user: 'spock',
            query: 'hElLo',
            size: 0
          },
          expected: {
            path: 'object.displayName',
            results: [
              {name: 'Hello, Spock.', count: 2},
              {name: 'Hello, Doctor.', count: 2}
            ],
            // Server treats 0 limit as default limit of 20
            resultsCount: 4
          }
        },
        {
          given: {
            user: 'spock',
            query: 'hElLo',
            size: 1
          },
          expected: {
            path: 'object.displayName',
            results: [],
            resultsCount: 1
          }
        },
        {
          given: {
            user: 'spock',
            query: 'hElLo',
            size: 2
          },
          expected: {
            path: 'object.displayName',
            results: [],
            resultsCount: 2
          }
        },
        {
          given: {
            user: 'spock',
            query: 'hElLo',
            // Limit equals the number of results
            size: 4
          },
          expected: {
            path: 'object.displayName',
            results: [],
            resultsCount: 4
          }
        },
        {
          given: {
            user: 'spock',
            query: 'hElLo',
            // Limit exceeds number of results
            size: 5
          },
          expected: {
            path: 'object.displayName',
            results: [],
            resultsCount: 4
          }
        }
      ];

      function runTests(testData) {
        testData.forEach(function(data) {
          var given = data.given;
          var expected = data.expected;
          var conversationLimit = given.sharedIn ? given.sharedIn.length : 'all';
          var resultLimit = given.size ? 'a result limit of ' + given.size : 'no result limit';
          var message = util.format('%s searches %s conversation(s) for "%s" with %s. Verifies %s.',
            given.user,
            conversationLimit,
            given.query,
            resultLimit,
            expected.path);

          it(message, function() {
            return retry(function() {
              var params = {query: given.query};
              if (given.size) {
                params.limit = given.size;
              }

              return party[given.user].spark.search.search(params)
                .then(function(r) {
                  assert.isDefined(r);
                  assert.lengthOf(r, data.expected.resultsCount);
                  var plucked = pluck(r, expected.path);
                  var counts = countBy(plucked);
                  expected.results.forEach(function(result) {
                    assert.equal(counts[result.name], result.count);
                  });
                });
            });
          });
        });
      }

      describe('expects results', function() {
        beforeEach(function() {
          party.spock.spark.device.set('searchKeyUrl', undefined);
        });

        runTests(testData);
        runTests(testDataWithResultLimit);

        // A KMS message is only needed on the first call to the search service.
        // Subsequent calls must not attach the KMS message.
        it('spock searches without a KMS message', function() {
          assert.isUndefined(party.spock.spark.device.searchKeyUrl,
            'searchKeyUrl should not be defined. It must be set before searching.');
          return party.spock.spark.search.search({query: 'hello'})
            .then(function(r) {
              assert.isDefined(party.spock.spark.device.searchKeyUrl,
                'searchKeyUrl should be saved from earlier call');
              assert.isDefined(r);
              assert.lengthOf(r, 4);
              return party.spock.spark.search.search({query: 'jim'});
            })
            .then(function(r) {
              assert.isDefined(party.spock.spark.device.searchKeyUrl,
                'searchKeyUrl should be saved from earlier call');
              assert.isDefined(r);
              assert.lengthOf(r, 2);
            });
        });
      });

      describe('expects no results', function() {
        beforeEach(function() {
          party.spock.spark.device.set('searchKeyUrl', undefined);
        });

        it('searches with non-matching word', function() {
          return party.spock.spark.search.search({query: 'fakeQuery'})
          .then(function(r) {
            assert.isDefined(r);
            assert.lengthOf(r, 0);
          });
        });
        it('searches with partially-matching word', function() {
          // NOTE: 'hell' will not find 'hElLo'. Words must fully match.
          return party.spock.spark.search.search({query: 'hell'})
          .then(function(r) {
            assert.isDefined(r);
            assert.lengthOf(r, 0);
          });
        });
        it('searches with no params', function() {
          return party.spock.spark.search.search()
          .then(function(r) {
            assert.isDefined(r);
            assert.lengthOf(r, 0);
          });
        });
        it('searches with no query', function() {
          return party.spock.spark.search.search({})
          .then(function(r) {
            assert.isDefined(r);
            assert.lengthOf(r, 0);
          });
        });
      });

      describe('expects rejections from invalid params', function() {
        it('rejects request when limit is not a number', function() {
          assert.isRejected(party.spock.spark.search.search({query: 'hElLo', size: 'should be an integer'}))
            .then(function(r) {
              assert.include(r, 'not a valid Integer value');
            });
        });
      });
    });
  });
});

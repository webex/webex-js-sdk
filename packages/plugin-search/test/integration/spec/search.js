/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '../..';

import CiscoSpark from '@ciscospark/spark-core';
import {assert} from '@ciscospark/test-helper-chai';
import testUsers from '@ciscospark/test-helper-test-users';
import retry from '@ciscospark/test-helper-retry';

import '@ciscospark/plugin-conversation';
import '@ciscospark/plugin-wdm';

import {map, countBy} from 'lodash';
import uuid from 'uuid';
import util from 'util';

describe(`plugin-search`, () => {
  describe(`#people`, () => {
    let bot, checkov, mccoy, spark;

    before(() => testUsers.create({count: 2})
      .then((users) => {
        [checkov, mccoy] = users;

        spark = new CiscoSpark({
          credentials: {
            authorization: checkov.token
          }
        });

        return spark.mercury.connect();
      })
      .then(() => spark.request({
        api: `hydra`,
        resource: `bots`,
        method: `POST`,
        body: {
          displayName: `Personal Assistant`,
          email: `${uuid.v4()}@sparkbot.io`
        }
      }))
      .then((results) => {
        bot = results.body;
      })
    );

    after(() => {
      spark.mercury.disconnect();
    });

    it(`searches for users with a specific string`, () => {
      return spark.search.people({query: `abc`})
        .then((users) => {
          assert.isArray(users);
        });
    });

    it(`retrieves a specific user`, () => {
      return spark.search.people({query: mccoy.email})
        .then((users) => {
          assert.isAbove(users.length, 0, `At least one user was found`);
          assert.equal(users[0].id, mccoy.id);
        });
    });

    it(`retrieves a bot`, () => {
      return spark.search.people({query: bot.email, includeRobots: true})
        .then((bots) => {
          assert.isAbove(bots.length, 0, `At least one bot was found`);
          assert.equal(bots[0].email, bot.email);
        });
    });

    it(`doesn't retrieve a bot because of parameter`, () => {
      return spark.search.people({query: bot.email, includeRobots: false})
        .then((bots) => {
          assert.equal(bots.length, 0, `No bots are returned`);
        });
    });
  });

  describe(`#search`, () => {
    let checkov, mccoy, spock;
    let party;

    before(() => testUsers.create({count: 3})
      .then((users) => {
        [checkov, mccoy, spock] = users;
        party = {checkov, mccoy, spock};

        checkov.spark = new CiscoSpark({
          credentials: {
            authorization: checkov.token
          }
        });

        mccoy.spark = new CiscoSpark({
          credentials: {
            authorization: mccoy.token
          }
        });

        spock.spark = new CiscoSpark({
          credentials: {
            authorization: spock.token
          }
        });

        return Promise.resolve();
      })
        .then(() => Promise.all([checkov, mccoy, spock].map((user) => user.spark.mercury.connect()))
        )
        .then(() => Promise.all([checkov, mccoy, spock].map((user) => user.spark.device.register()))
        )
    );

    let mccoyConversation, spockConversation;

    before(() => {
      if (!spockConversation) {
        return spock.spark.conversation.create({
          displayName: `Spock Room`,
          participants: map([checkov, mccoy, spock], `id`)
        })
          .then((conversation) => {
            spockConversation = conversation;
            assert.lengthOf(spockConversation.participants.items, 3);
          });
      }
      return Promise.resolve();
    });

    before(() => {
      if (!mccoyConversation) {
        return mccoy.spark.conversation.create({
          displayName: `McCoy Room`,
          participants: map([mccoy, spock], `id`)
        }, {forceGrouped: true})
          .then((conversation) => {
            mccoyConversation = conversation;
            assert.lengthOf(mccoyConversation.participants.items, 2);
          });
      }
      return Promise.resolve();
    });

    after(() => Promise.all([checkov, mccoy, spock].map((user) => user.spark.mercury.disconnect.bind(user))));

    function populateConversation(conversation) {
      const spockConvo = spock.spark.conversation;
      const mccoyConvo = mccoy.spark.conversation;
      return mccoyConvo.post(conversation, {
        displayName: `Hello, Spock.`
      })
      .then(() => {
        return spockConvo.post(conversation, {
          displayName: `Hello, Doctor.`
        });
      })
      .then(() => {
        return mccoyConvo.post(conversation, {
          displayName: `What did Jim say?`
        });
      })
      .then(() => {
        return spockConvo.post(conversation, {
          displayName: `The captain wishes to board.`
        });
      });
    }

    before(() => {
      return populateConversation(spockConversation)
        .then(() => {
          assert.isDefined(spockConversation);
          return spock.spark.conversation.get({url: spockConversation.url}, {activitiesLimit: 10});
        })
        .then((conversation) => {
          spockConversation = conversation;
          // Removes the 'create' activity
          spockConversation.activities.items.shift();
          const comments = map(spockConversation.activities.items, `object.displayName`);
          assert.lengthOf(comments, 4);
          assert.equal(comments[0], `Hello, Spock.`);
          assert.equal(comments[1], `Hello, Doctor.`);
          assert.equal(comments[2], `What did Jim say?`);
          assert.equal(comments[3], `The captain wishes to board.`);
        });
    });

    before(() => {
      return populateConversation(mccoyConversation)
        .then(() => {
          assert.isDefined(mccoyConversation);
          return mccoy.spark.conversation.get({url: mccoyConversation.url}, {activitiesLimit: 10});
        })
        .then((conversation) => {
          mccoyConversation = conversation;

          mccoyConversation.activities.items.shift();
          const comments = map(mccoyConversation.activities.items, `object.displayName`);
          assert.lengthOf(comments, 4);
          assert.equal(comments[0], `Hello, Spock.`);
          assert.equal(comments[1], `Hello, Doctor.`);
          assert.equal(comments[2], `What did Jim say?`);
          assert.equal(comments[3], `The captain wishes to board.`);
        });
    });

    const testData = [
      // Single word
      // Asserts comments
      {
        given: {
          user: `spock`,
          query: `hElLo`
        },
        expected: {
          path: `object.displayName`,
          results: [
            {name: `Hello, Spock.`, count: 2},
            {name: `Hello, Doctor.`, count: 2}
          ],
          resultsCount: 4
        }
      },
      // Single word
      // Single result
      // Asserts comments
      {
        given: {
          user: `checkov`,
          query: `JiM`
        },
        expected: {
          path: `object.displayName`,
          results: [
            {name: `What did Jim say?`, count: 1}
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
          user: `mccoy`,
          query: `hElLo`
        },
        expected: {
          path: `object.displayName`,
          results: [
            {name: `Hello, Spock.`, count: 2},
            {name: `Hello, Doctor.`, count: 2}
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
          user: `checkov`,
          query: `hElLo`
        },
        expected: {
          path: `object.displayName`,
          results: [
            {name: `Hello, Spock.`, count: 1},
            {name: `Hello, Doctor.`, count: 1}
          ],
          resultsCount: 2
        }
      },
      // Single word
      // Asserts result type
      {
        given: {
          user: `spock`,
          query: `hElLo`
        },
        expected: {
          path: `object.objectType`,
          results: [
            {name: `comment`, count: 4}
          ],
          resultsCount: 4
        }
      },
      // Multiple words
      // Asserts comments
      // Disable for API upgrade
      // {
      //   given: {
      //     user: `spock`,
      //     query: `hElLo SpOck`
      //   },
      //   expected: {
      //     path: `object.displayName`,
      //     results: [
      //       {name: `Hello, Spock.`, count: 2},
      //       {name: `Hello, Doctor.`, count: 2}
      //     ],
      //     resultsCount: 4
      //   }
      // },
      // Multiple words
      // Asserts result type

      // Disable for API upgrade
      // {
      //   given: {
      //     user: `spock`,
      //     query: `hElLo SpOck`
      //   },
      //   expected: {
      //     path: `object.objectType`,
      //     results: [
      //       {name: `comment`, count: 4}
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
      //     user: `spock`,
      //     query: `hElLo, SpOck.`
      //   },
      //   expected: {
      //     path: `object.displayName`,
      //     results: [
      //       {name: `Hello, Spock.`, count: 2},
      //       {name: `Hello, Doctor.`, count: 2}
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
      //     user: `spock`,
      //     query: `hElLo, SpOck.`
      //   },
      //   expected: {
      //     path: `object.objectType`,
      //     results: [
      //       {name: `comment`, count: 4}
      //     ],
      //     resultsCount: 4
      //   }
      // },

      // Limit results back

      // 0
      {
        given: {
          user: `spock`,
          query: `hElLo`,
          size: 0
        },
        expected: {
          path: `object.displayName`,
          results: [],
          resultsCount: 4
        }
      }
    ];

    const testDataWithResultLimit = [
      {
        given: {
          user: `spock`,
          query: `hElLo`,
          size: -1
        },
        expected: {
          path: `object.displayName`,
          results: [
            {name: `Hello, Spock.`, count: 2},
            {name: `Hello, Doctor.`, count: 2}
          ],
          // Server treats negative limit as default limit of 20
          resultsCount: 4
        }
      },
      {
        given: {
          user: `spock`,
          query: `hElLo`,
          size: 0
        },
        expected: {
          path: `object.displayName`,
          results: [
            {name: `Hello, Spock.`, count: 2},
            {name: `Hello, Doctor.`, count: 2}
          ],
          // Server treats 0 limit as default limit of 20
          resultsCount: 4
        }
      },
      {
        given: {
          user: `spock`,
          query: `hElLo`,
          size: 1
        },
        expected: {
          path: `object.displayName`,
          results: [],
          resultsCount: 1
        }
      },
      {
        given: {
          user: `spock`,
          query: `hElLo`,
          size: 2
        },
        expected: {
          path: `object.displayName`,
          results: [],
          resultsCount: 2
        }
      },
      {
        given: {
          user: `spock`,
          query: `hElLo`,
          // Limit equals the number of results
          size: 4
        },
        expected: {
          path: `object.displayName`,
          results: [],
          resultsCount: 4
        }
      },
      {
        given: {
          user: `spock`,
          query: `hElLo`,
          // Limit exceeds number of results
          size: 5
        },
        expected: {
          path: `object.displayName`,
          results: [],
          resultsCount: 4
        }
      }
    ];

    function runTests(testData) {
      console.log(`testData size: ${testData.length}`);
      testData.forEach((data) => {
        const {given, expected} = data;
        const conversationLimit = given.sharedIn ? given.sharedIn.length : `all`;
        const resultLimit = given.size ? `a result limit of ${given.size}` : `no result limit`;
        const message = util.format(`${given.user} searches ${conversationLimit} conversation(s) for "${given.query}" with ${resultLimit}. Verifies ${expected.path}.`);

        it(message, () => {
          return retry(() => {
            const params = {
              query: given.query,
              limit: given.size
            };

            return party[given.user].spark.search.search(params)
              .then((results) => {
                assert.isDefined(results);
                assert.lengthOf(results, expected.resultsCount);
                const plucked = map(results, expected.path);
                const counts = countBy(plucked);
                expected.results.forEach((expectedResults) => {
                  assert.equal(counts[expectedResults.name], expectedResults.count);
                });
              });
          });
        });
      });
    }

    describe(`expects results`, () => {
      beforeEach(() => {
        spock.spark.device.set(`searchKeyUrl`, undefined);
      });

      runTests(testData);
      runTests(testDataWithResultLimit);
    });
  });
});

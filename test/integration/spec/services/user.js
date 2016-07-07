/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var landingparty = require('../../lib/landingparty');
var patterns = require('../../../../src/util/patterns');
var sinon = require('sinon');
var skipInBrowser = require('../../../lib/mocha-helpers').skipInBrowser;
var Spark = require('../../../../src');
var uuid = require('uuid');

describe('Services', function() {
  this.timeout(20000);

  describe('User', function() {
    var party = {
      spock: true,
      mccoy: false,
      checkov: false
    };

    before(function beamDown() {
      return landingparty.beamDown(party);
    });

    describe('#find()', function() {
      it('searches for users with the specified string', function() {
        return party.spock.spark.user.find('abc')
          .then(function(users) {
            assert.isArray(users);
          });
      });

      it('retrieves a specific user', function() {
        return party.spock.spark.user.find(party.mccoy.email)
          .then(function(users) {
            assert.equal(users[0].id, party.mccoy.id);
          });
      });
    });

    describe('#get()', function() {
      it('returns the current user', function() {
        return party.spock.spark.user.get()
          .then(function(user) {
            assert.equal(user.id, party.spock.id);
            assert.isDefined(user.entitlements);
            assert.isDefined(user.email);
            assert.isDefined(user.name);
          });
      });
    });

    describe('#getUUID()', function() {
      function makeEmailAddress() {
        return 'spark-js-sdk--test-' + uuid.v4() + '-@example.com';
      }

      it('maps an email address to a uuid', function() {
        return assert.eventually.equal(party.spock.spark.user.getUUID(party.mccoy, {force: true}), party.mccoy.id);
      });

      it('maps an email for a non-existent user to a uuid', function() {
        var email = makeEmailAddress();
        return assert.eventually.match(party.spock.spark.user.getUUID(email), patterns.uuid)
          .then(function() {
            return party.spock.spark.user.userstore.getByEmail(email);
          })
          .then(function(user) {
            assert.isFalse(user.userExists, 'User does not exist');
          });
      });

      describe('with {create: true}', function() {
        var spy;
        beforeEach(function() {
          spy = sinon.spy(party.spock.spark.user, '_getUUID');
        });

        afterEach(function() {
          spy.restore();
        });

        it('creates a new user', function() {
          var email = makeEmailAddress();
          return assert.eventually.match(party.spock.spark.user.getUUID(email, {create: true}), patterns.uuid)
            .then(function() {
              return party.spock.spark.user.userstore.getByEmail(email);
            })
            .then(function(user) {
              assert.isTrue(user.userExists, 'User exists');
            });
        });

        it('does not use a cached value if it was marked as non-existent', function() {
          var email = makeEmailAddress();
          return assert.eventually.match(party.spock.spark.user.getUUID(email), patterns.uuid)
            .then(function() {
              return party.spock.spark.user.userstore.getByEmail(email);
            })
            .then(function(user) {
              assert.isFalse(user.userExists, 'User does not exist');
              return assert.eventually.match(party.spock.spark.user.getUUID(email, {create: true}), patterns.uuid);
            })
            .then(function() {
              assert.calledTwice(spy);
            });
          // TODO should these be the same uuid? https://sqbu-github.cisco.com/WebExSquared/cloud-apps/issues/754
        });

        it('does not use a cached value if its non-existent state is unknown', function() {
          assert.property(party.checkov, 'email');
          var email = party.checkov.email;

          return party.spock.spark.user.recordUUID({
            id: party.checkov.id,
            emailAddress: party.checkov.email
          })
            .then(function() {
              return party.spock.spark.user.userstore.getByEmail(email);
            })
            .then(function(user) {
              assert.isUndefined(user.userExists, 'User\'s existence is not known');
              return assert.eventually.equal(party.spock.spark.user.getUUID(email, {create: true}), party.checkov.id);
            })
            .then(function() {
              assert.called(spy);
              return party.spock.spark.user.userstore.getByEmail(email);
            })
            .then(function(user) {
              assert.isTrue(user.userExists, 'User exists');
            });
        });
      });
    });

    var spark;
    function createUnauthedSpark() {
      /* eslint camelcase: [0] */
      before(function() {
        spark = new Spark({
          config: {
            trackingIdPrefix: 'spark-js-sdk',
            credentials: {
              oauth: {
                client_id: process.env.COMMON_IDENTITY_CLIENT_ID,
                client_secret: process.env.COMMON_IDENTITY_CLIENT_SECRET,
                redirect_uri: process.env.COMMON_IDENTITY_REDIRECT_URI,
                service: process.env.COMMON_IDENTITY_SERVICE
              }
            },
            metrics: {
              enableMetrics: false
            },
            mercury: {
              enablePingPong: false
            }
          }
        });
      });
    }

    skipInBrowser(describe)('#register() @atlas', function() {
      createUnauthedSpark();

      it('registers users with a valid email address @atlas', function() {
        return spark.user.register({email: 'Collabctg+spark-js-sdk-' + Date.now() + '@gmail.com'});
      });

      it('fails to register users with invalid email addresses @atlas', function() {
        return assert.isRejected(spark.user.register({email: 'not-an-email-address'}))
          .then(function(res) {
            assert(res.statusCode === 400);
          });
      });
    });

    skipInBrowser(describe)('#activate() @atlas', function() {
      createUnauthedSpark();

      it('registers mobile user with a valid email address and activates account @atlas', function() {
        return spark.user.register({email: 'Collabctg+spark-js-sdk-' + Date.now() + '@gmail.com'}, {spoofMobile: true})
          .then(function(body) {
            return spark.user.activate({encryptedQueryString: body.eqp});
          });
      });
    });

    describe('#update', function() {
      it('updates a user\'s name', function() {
        return party.spock.spark.user.update({displayName: 'Mr. Spock'})
          .then(function(user) {
            assert.equal(user.id, party.spock.id);
            assert.isDefined(user.entitlements);
            assert.isDefined(user.email);
            assert.isDefined(user.name);
            assert.equal(user.name, 'Mr. Spock');
          });
      });
    });
  });
});

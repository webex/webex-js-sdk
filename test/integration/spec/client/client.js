/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var difference = require('lodash.difference');
var fh2 = require('../../lib/fixtures-v2');
var HttpError = require('../../../../src/lib/exceptions/http-error');
var landingparty = require('../../lib/landingparty');
var map = require('lodash.map');
var pluck = require('lodash.pluck');
var sinon = require('sinon');
var skipInNode = require('../../../lib/mocha-helpers').skipInNode;
var SparkHttpError = require('../../../../src/lib/exceptions/spark-http-error');
var SparkHttpErrors = require('../../../../src/lib/exceptions/spark-http-errors');

var assert = chai.assert;
sinon.assert.expose(chai.assert, {prefix: ''});

describe('Client', function() {
  this.timeout(60000);

  var party = {
    spock: true,
    mccoy: false,
    checkov: false
  };

  before(function beamDown() {
    return landingparty.beamDown(party);
  });

  // Reminder: not a unit test because WebSockets (or at least those provided
  // by WS) cannot be stringified and the test should therefore be run when the
  // client is in the listening state).
  it('can be stringified', function() {
    assert.isDefined(party.spock.spark);
    assert.doesNotThrow(function() {
      JSON.stringify(party.spock.spark);
    });
  });

  describe('#request', function() {
    it('returns a promise that resolves on HTTP success @canary', function() {
      return party.spock.spark.request({
        method: 'GET',
        api: 'conversation',
        resource: 'ping'
      });
    });

    it('generates the correct tracking id with prefix and suffix', function() {
      var prefix = party.spock.spark.config.trackingIdPrefix;
      var newPrefix = 'ITCLIENT';
      var suffix = 'imi:true';
      party.spock.spark.config.trackingIdPrefix = newPrefix;
      party.spock.spark.config.trackingIdSuffix = suffix;
      return party.spock.spark.request({
        method: 'GET',
        api: 'conversation',
        resource: 'ping'
      })
        .then(function(res) {
          assert.property(res, 'headers');
          assert.isTrue(res.headers.trackingid.startsWith(newPrefix));
          assert.isTrue(res.headers.trackingid.endsWith(suffix));
          party.spock.spark.config.trackingIdPrefix = prefix;
          party.spock.spark.config.trackingIdSuffix = undefined;
        });
    });

    it('returns a promise that rejects with a subclassed SparkHttpError on HTTP errors', function() {
      return assert.isRejected(party.spock.spark.request({
        method: 'POST',
        api: 'encryption',
        resource: 'keys',
        qs: {
          count: 5
        }
      }))
        .then(function(res) {
          assert.instanceOf(res, Error);
          assert.instanceOf(res, HttpError);
          assert.instanceOf(res, SparkHttpError);
          assert.instanceOf(res, SparkHttpErrors.BadRequest);
          assert.equal(res.statusCode, 400);

          assert.property(res, 'statusCode');
          assert.property(res, 'options');
          assert.property(res, 'headers');
          assert.property(res, 'method');
          assert.property(res, 'url');
          assert.property(res, 'body');
        });
    });

    it('returns a promise that rejects with an HTTP response object even for CORS and network errors', function() {
      return assert.isRejected(party.spock.spark.request({
        // Hit a port that's not listening because it should look the same as a
        // CORS error.
        uri: 'http://127.0.0.1:10000'
      }))
        .then(function(res) {
          assert.instanceOf(res, Error);
          assert.instanceOf(res, HttpError);
          assert.instanceOf(res, SparkHttpError);
          assert.instanceOf(res, SparkHttpErrors.NetworkOrCORSError);
          assert.equal(res.statusCode, 0);

          assert.property(res, 'statusCode');
          assert.property(res, 'options');
          assert.property(res, 'headers');
          assert.property(res, 'method');
          assert.property(res, 'url');
          assert.property(res, 'body');
        });
    });

    it('recovers from 401 responses', function() {
      /* eslint camelcase: [0] */
      var fakeToken = 'not a real access token';
      var accessToken = party.spock.spark.credentials.authorization.apiToken.access_token;
      party.spock.spark.credentials.authorization.apiToken.access_token = fakeToken;

      return party.spock.spark.request({
        api: 'conversation',
        method: 'GET',
        resource: 'build_info'
      })
        .then(function(res) {
          assert.equal(res.statusCode, 200);
          assert.notEqual(party.spock.spark.credentials.authorization.apiToken.access_token, accessToken);
          assert.notEqual(party.spock.spark.credentials.authorization.apiToken.access_token, fakeToken);
        });
    });

    it('recovers from device 401s while authentication is in flight', function() {
      /* eslint camelcase: [0] */
      var fakeToken = 'not a real access token';
      var accessToken = party.spock.spark.credentials.authorization.apiToken.access_token;
      party.spock.spark.credentials.authorization.apiToken.access_token = fakeToken;

      return party.spock.spark.authenticate()
        .then(function() {
          assert.notEqual(party.spock.spark.credentials.authorization.apiToken.access_token, accessToken);
          assert.notEqual(party.spock.spark.credentials.authorization.apiToken.access_token, fakeToken);
        });
    });

    it('emits download progress events', function() {
      var options = {
        // FIXME generalize karma vs node fixture URLs
        uri: 'http://127.0.0.1:' + (typeof window === 'undefined' ? process.env.FIXTURE_PORT : process.env.KARMA_PORT + '/fixtures') + '/sample-image-large.jpg',
        withCredentials: false
      };

      var optionsSpy = sinon.spy();
      var promiseSpy = sinon.spy();

      var req = party.spock.spark.request(options)
        .on('download-progress', promiseSpy)
        .then(function() {
          assert.called(optionsSpy, 'A progress event was fired by the event-emitter placed in the options hash that was passed to Spark#request()');
          assert.called(promiseSpy, 'A download-progress event was fired by the promise return by Spark#request()');
        });

      options.download.on('progress', optionsSpy);
      return req;
    });

    skipInNode(it)('emits upload progress events', function() {
      var fixtures = {
        fixture: 'sample-image-small-one.png'
      };

      return fh2.fetchFixtures(fixtures)
        .then(function() {
          var fixture = fixtures.fixture;

          var options = {
            // FIXME generalize karma vs node fixture URLs
            method: 'POST',
            uri: 'http://127.0.0.1:' + (typeof window === 'undefined' ? process.env.FIXTURE_PORT : process.env.KARMA_PORT) + '/upload',
            json: false,
            withCredentials: false,
            formData: {
              data: fixture
            }
          };

          var optionsSpy = sinon.spy();
          var promiseSpy = sinon.spy();

          var req = party.spock.spark.request(options)
            .on('upload-progress', promiseSpy)
            .then(function() {
              assert.called(optionsSpy, 'A progress event was fired by the event-emitter placed in the options hash that was passed to Spark#request()');
              assert.called(promiseSpy, 'An upload-progress event was fired by the promise return by Spark#request()');
            });

          options.upload.on('progress', optionsSpy);
          return req;
        });
    });

    describe('App Level Redirects', function() {
      var conversation;
      var locusRedirectUri;
      var maxAppLevelRedirects;

      before(function createConversation() {
        maxAppLevelRedirects = party.spock.spark.config.maxAppLevelRedirects;
        return party.spock.spark.conversation.create({
          participants: pluck(party, 'id')
        })
          .then(function(c) {
            conversation = c;
            locusRedirectUri = conversation.url + '/locus/participant';
          });
      });

      after(function restoreConfig() {
        party.spock.spark.config.maxAppLevelRedirects = maxAppLevelRedirects;
      });

      it('follows app-level redirects', function() {
        return party.spock.spark.request({
          method: 'POST',
          uri: locusRedirectUri,
          body: {
            deviceUrl: party.spock.spark.device.url
          }
        })
        .then(function(res) {
          assert.notEqual(res.options.uri, locusRedirectUri);
          assert.property(res.body, 'locus');
          assert.equal(res.body.locus.conversationUrl, conversation.url);
        });
      });

      it('fails after a maximum number of redirects', function() {
        party.spock.spark.config.maxAppLevelRedirects = 0;
        return assert.isRejected(party.spock.spark.request({
          method: 'POST',
          uri: locusRedirectUri,
          body: {
            deviceUrl: party.spock.spark.device.url
          }
        }), /Maximum redirects exceeded/);
      });
    });

    describe('Ping: ', function() {
      var knownServices = [
        'apheleia',
        'argonaut',
        'atlas',
        'avatar',
        'calendar',
        'conversation',
        'encryption',
        'feature',
        'files',
        'identityLookup',
        'janus',
        'locus',
        'metrics',
        'raindrop',
        'squaredFiles',
        'stickies',
        'wdm'
      ];

      var knownServicesWithoutPingEndpoints = [
        'swupgrade'
      ];

      // disable auth-free ping tests because the rate limit on flags also
      // applies to the ping endpoint
      [true].forEach(function(shouldIncludeAuth) {
        knownServices.forEach(function(serviceName) {
          it('can ping the ' + serviceName + ' service (with' + (shouldIncludeAuth ? '' : 'out') + ' auth)', function() {
            var options = {
              api: serviceName,
              resource: '/ping'
            };

            if (!shouldIncludeAuth) {
              options.headers = {
                Authorization: undefined
              };
            }

            return party.spock.spark.request(options)
              .catch(function(res) {
                if (res && res.statsuCode === 0) {
                  console.log('reattempting to ping ' + serviceName);
                  return party.spock.spark.request(options);
                }

                throw res;
              })
              .catch(function(res) {
                if (res && res.statusCode === 0) {
                  throw new Error('Network failure or CORS misconfigured for the ' + serviceName + ' service');
                }

                throw res;
              });
          });
        });

        // These tests should always be skipped until the corresponding services
        // have ping interfaces
        knownServicesWithoutPingEndpoints.forEach(function(serviceName) {
          it('can ping the ' + serviceName + ' service (with' + (shouldIncludeAuth ? '' : 'out') + ' auth)');
        });

        it('can ping services added to the catalog not known to the test suite (with' + (shouldIncludeAuth ? '' : 'out') + ' auth)', function() {
          // set the timeout fairly high in case a bunch of services get added
          // before the list gets updated.
          this.timeout(60000);
          var services = map(party.spock.spark.device.services, function(value, key) {
            return key.substr(0, key.indexOf('ServiceUrl'));
          });

          var unknownServices = difference(services, knownServices, knownServicesWithoutPingEndpoints);
          return unknownServices.reduce(function(promise, serviceName) {
            return promise.then(function() {
              var options = {
                api: serviceName,
                resource: '/ping'
              };

              if (!shouldIncludeAuth) {
                options.headers = {
                  Authorization: undefined
                };
              }

              console.log('Pinging ' + serviceName);
              return party.spock.spark.request(options)
                .catch(function(res) {
                  if (res && res.statsuCode === 0) {
                    console.log('reattempting to ping unknown service ' + serviceName);
                    return party.spock.spark.request(options);
                  }

                  throw res;
                })
                .catch(function(res) {
                  if (res && res.statusCode === 0) {
                    throw new Error('Network failure or CORS misconfigured for the ' + serviceName + ' service');
                  }
                  console.error(res.body || res);
                  throw new Error('Failed to ping ' + serviceName);
                });
            });
          }, Promise.resolve());
        });

      });
    });

  });

  describe('#authenticate()', function() {
    beforeEach(function() {
      sinon.spy(party.spock.spark.credentials, 'refresh');
      sinon.spy(party.spock.spark.device, 'refresh');
    });

    afterEach(function() {
      party.spock.spark.credentials.refresh.restore();
      party.spock.spark.device.refresh.restore();
    });

    // FIXME skipping because the refresh_token flow can't be tested using test
    // user credentials.
    it.skip('retrieves the access token, registers the device, and (in browser) retrieves access cookies', function() {
      return party.spock.spark.authenticate({force: true})
        .then(function() {
          assert.equal(party.spock.spark.credentials.refresh.callCount, 1);
          assert.equal(party.spock.spark.device.refresh.callCount, 1);
        });
    });
  });

  describe('#upload()', function() {
    var fixtures = {
      text: 'sample-text-one.txt',
      png: 'sample-image-small-one.png'
    };

    before(function() {
      return fh2.fetchFixtures(fixtures);
    });

    it('uploads a file to a conversation', function() {
      return party.spock.spark.conversation.create({
        comment: 'hi',
        participants: pluck(party, 'id')
      })
        .then(function(conversation) {
          return party.spock.spark.request({
            method: 'PUT',
            uri: conversation.url + '/space'
          });
        })
        .then(function(res) {
          assert.property(res.body, 'spaceUrl');

          return party.spock.spark.upload({
            file: fixtures.png,
            uri: res.body.spaceUrl + '/upload_sessions',
            phases: {
              initialize: {
                body: {
                  fileSize: fixtures.png.size || fixtures.png.byteLength || fixtures.png.length
                }
              },
              upload: {
                $uri: function $uri(session) {
                  return session.uploadUrl;
                }
              },
              finalize: {
                $uri: function $uri(session) {
                  return session.finishUploadUrl;
                },
                body: {
                  path: 'sample-image-small-one.png',
                  size: fixtures.png.size || fixtures.png.byteLength || fixtures.png.length
                }
              }
            }
          });
        })
        .then(function(res) {
          assert.property(res, 'downloadUrl');

          return party.spock.spark.request({
            method: 'POST',
            api: 'files',
            resource: 'download/endpoints',
            body: {
              endpoints: [
                res.downloadUrl
              ]
            }
          });
        })
        .then(function(res) {
          var keys = Object.keys(res.body.endpoints);
          assert.lengthOf(keys, 1);
          var downloadUrl = res.body.endpoints[keys[0]];

          return party.spock.spark.request({
            responseType: 'buffer',
            uri: downloadUrl,
            json: false,
            shouldRefreshAccessToken: false
          });
        })
        .then(function(res) {
          assert(fh2.isBufferLike(res.body));
          return assert.eventually.isTrue(fh2.isMatchingFile(res.body, fixtures.png));
        });
    });

    it('uploads a log file @atlas', function() {
      return party.spock.spark.upload({
        file: fixtures.text,
        api: 'atlas',
        resource: 'logs/url',
        phases: {
          initialize: {
            // Must send empty object
            body: {}
          },
          upload: {
            $uri: function $uri(session) {
              return session.tempURL;
            }
          },
          finalize: {
            api: 'atlas',
            resource: 'logs/meta',
            $body: function $body(session) {
              return {
                filename: session.logFilename,
                data: []
              };
            }
          }
        }
      });
    });

    it('uploads an avatar', function() {
      return party.spock.spark.upload({
        api: 'avatar',
        resource: 'profile',
        file: fixtures.png,
        phases: {
          upload: {
            $uri: function $uri(session) {
              return session.url;
            }
          },
          finalize: {
            method: 'PUT',
            api: 'avatar',
            $resource: function $resource(session) {
              return 'profile/' + session.id;
            },
            $body: function $body(session) {
              return session;
            }
          }
        }
      });
    });
  });

});

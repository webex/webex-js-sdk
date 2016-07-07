/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assert = require('chai').assert;
var Device = require('../../../../src/client/device');
var trackingIdProcessor = require('../../../../src/client/client/processors/tracking-id');

describe('Client', function() {
  describe('Processors', function() {
    describe('TrackingID', function() {
      describe('#requiresTrackingID', function() {

        var DEVICE_URL = 'http://device-url.example.com';
        var SERVICE_ONE_URL = 'http://service-one.example.com';
        var SERVICE_TWO_URL = 'http://service-two.example.com';
        var WDM_URL = 'http://wdm.example.com';

        var client;

        before(function() {

          client = {
            spark: {
              device: new Device({
                url: DEVICE_URL,
                services: {
                  oneServiceUrl: SERVICE_ONE_URL
                },
                config: {
                  deviceRegistrationUrl: WDM_URL,
                  preAuthServices: {
                    twoServiceUrl: SERVICE_TWO_URL
                  }
                }
              }),
              config: {
                device: {
                  deviceRegistrationUrl: WDM_URL,
                  preAuthServices: {
                    twoServiceUrl: SERVICE_TWO_URL
                  }
                }
              }
            }
          };
        });

        it('adds a tracking ID to pre-auth service calls', function() {
          assert.isTrue(trackingIdProcessor.requiresTrackingID.call(client, {uri: SERVICE_TWO_URL}));
          assert.isTrue(trackingIdProcessor.requiresTrackingID.call(client, {uri: SERVICE_TWO_URL + '/resource'}));
        });

        it('adds a tracking ID to service calls', function() {
          assert.isTrue(trackingIdProcessor.requiresTrackingID.call(client, {uri: SERVICE_ONE_URL}));
          assert.isTrue(trackingIdProcessor.requiresTrackingID.call(client, {uri: SERVICE_ONE_URL + '/resource'}));
        });

        it('adds a tracking ID to WDM calls', function() {
          assert.isTrue(trackingIdProcessor.requiresTrackingID.call(client, {uri: WDM_URL}));
        });

      });
    });
  });
});

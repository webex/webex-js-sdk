/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import {cloneDeep} from 'lodash';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import sinon from '@ciscospark/test-helper-sinon';
import Device from '@ciscospark/internal-plugin-wdm';
import deviceFixture from '../lib/device-fixture';

describe('plugin-wdm', () => {
  describe('Device', () => {
    let spark;
    let device;

    beforeEach(() => {
      spark = new MockSpark({
        children: {
          device: Device
        }
      });
      spark.internal.metrics.submitClientMetrics = sinon.stub();
    });

    describe('when web-ha-messaging is enabled', () => {
      beforeEach('enable web-ha-messaging', () => {
        const deviceConfig = cloneDeep(deviceFixture);
        deviceConfig.features.developer.push({
          key: 'web-ha-messaging',
          val: 'true',
          value: true,
          mutable: true,
          lastModified: '2015-06-29T20:02:48.033Z'
        });
        spark.internal.device.set(deviceConfig);

        device = spark.internal.device;

        device.config.preDiscoveryServices = {};
      });

      describe('#_updateServiceCatalog', () => {
        it('refreshes the device if serviceHostMap is not defined and ha is enabled', () => {
          device.services = {
            validServiceUrl: 'http://example.com/valid-service',
            anotherServiceUrl: 'http://another.com/another-service'
          };
          sinon.spy(device, 'refresh');
          device.serviceHostMap = undefined;

          assert.calledOnce(device.refresh);
        });

        it('updates the service catalog', () => {
          device.serviceCatalog.reset();
          device.services = {
            validServiceUrl: 'http://example.com/valid-service',
            anotherServiceUrl: 'http://another.com/another-service'
          };
          sinon.spy(device, 'refresh');
          device.serviceHostMap = {
            hostCatalog: {
              'another.com': [
                {
                  host: 'another-low-priority.com',
                  priority: 2
                },
                {
                  host: 'another-high-priority.com',
                  priority: 1
                }
              ]
            }
          };

          assert.notCalled(device.refresh);
          assert.isTrue(device.serviceCatalog.length === 2);
        });
      });

      describe('#getWebSocketUrl()', () => {
        it('returns web socket url based on the availability of mercuryConnection host', () => device.getWebSocketUrl()
          .then((result) => assert.deepEqual(result, 'wss://mercury-connection.a6.ciscospark.com/v1/apps/wx2/registrations/WEBSOCKETID/messages')));

        it('returns updated web socket url when host changes', () => device.markUrlFailedAndGetNew('wss://mercury-connection.a6.ciscospark.com/v1/apps/wx2/registrations/WEBSOCKETID/messages')
          .then(() => device.getWebSocketUrl()
            .then((result) => assert.deepEqual(result, 'wss://mercury-connection-a5.wbx2.com/v1/apps/wx2/registrations/WEBSOCKETID/messages'))));
      });

      describe('#useServiceCatalogUrl', () => {
        it('replaces current url with url from the service catalog', () => device.useServiceCatalogUrl('https://conv-a.wbx2.com/conversation/v1')
          .then((result) => assert.deepEqual(result, 'https://conv-a4.wbx2.com/conversation/v1')));
      });

      describe('#getServiceUrl()', () => {
        it('returns the default service url by default', () => {
          device.services = {
            validServiceUrl: 'http://example.com/valid-service',
            anotherServiceUrl: 'http://another.com/another-service'
          };

          return device.getServiceUrl('another')
            .then((result) => assert.deepEqual(result, 'http://another.com/another-service'));
        });

        it('returns the service url with a different host if available', () => {
          device.services = {
            validServiceUrl: 'http://example.com/valid-service',
            anotherServiceUrl: 'http://another.com/another-service'
          };

          device.serviceHostMap = {
            hostCatalog: {
              'another.com': [
                {
                  host: 'another-1.com',
                  priority: 1
                }
              ]
            }
          };
          return device.getServiceUrl('another')
            .then((result) => assert.deepEqual(result, 'http://another-1.com/another-service'));
        });

        it('returns the service url with a higher priority host', () => {
          device.services = {
            validServiceUrl: 'http://example.com/valid-service',
            anotherServiceUrl: 'http://another.com/another-service'
          };

          device.serviceHostMap = {
            hostCatalog: {
              'another.com': [
                {
                  host: 'another-low-priority.com',
                  priority: 2
                },
                {
                  host: 'another-high-priority.com',
                  priority: 1
                }
              ]
            }
          };
          return device.getServiceUrl('another')
            .then((result) => assert.deepEqual(result, 'http://another-high-priority.com/another-service'));
        });
      });

      describe('#markUrlFailedAndGetNew()', () => {
        it('requires a `url` parameter', () => assert.isRejected(device.markUrlFailedAndGetNew(), /`url` is a required parameter/));

        it('returns service url for the next available host', () => device.markUrlFailedAndGetNew('https://mercury-connection.a6.ciscospark.com/v1')
          .then((result) => assert.deepEqual(result, 'https://mercury-connection-a5.wbx2.com/v1')));

        it('recycles through the hosts after all attempts failed', () => {
          sinon.spy(device, 'refresh');
          sinon.spy(device, '_resetAllAndRetry');
          assert.notCalled(device.refresh);
          device.services = {
            failingServiceUrl: 'http://fail.com/v1'
          };
          device.serviceHostMap = {
            hostCatalog: {
              'fail.com': [
                {
                  host: 'fail-2.com',
                  priority: 2
                },
                {
                  host: 'fail-1.com',
                  priority: 1
                }
              ]
            }
          };

          return device.markUrlFailedAndGetNew('http://fail-1.com/v1')
            .then((result) => assert.deepEqual(result, 'http://fail-2.com/v1'))
            .then(() => device.markUrlFailedAndGetNew('http://fail-2.com/v1'))
            .then(() => {
              assert.notCalled(device.refresh);
              assert.called(device._resetAllAndRetry);
            });
        });
      });
    });

    describe('when web-ha-messaging is disabled', () => {
      beforeEach(() => {
        spark.internal.device.set(deviceFixture);

        device = spark.internal.device;

        device.config.preDiscoveryServices = {};
      });

      describe('#clear()', () => {
        it('does not remove `logger`', () => {
          assert.property(device, 'logger');
          assert.isDefined(device.logger);
          device.clear();
          assert.property(device, 'logger');
          assert.isDefined(device.logger);
        });

        it('clears all features', () => {
          assert.isAbove(device.features.developer.length, 0);
          device.clear();
          assert.lengthOf(device.features.developer, 0);
        });
      });

      describe('#determineService()', () => {
        it('determines the service backing the specified url', () => device.determineService('https://conv-a.wbx2.com/conversation/api/v1/conversations')
          .then((result) => assert.deepEqual(result, 'conversation')));
        it('rejects if no service can be determined', () => assert.isRejected(device.determineService('https://rogue-service.example.com'), /does not reflect a known service/));
      });

      describe('#getPreDiscoveryServiceUrl()', () => {
        it('requires a `service` parameter', () => assert.isRejected(device.getPreDiscoveryServiceUrl(), /`service` is a required parameter/));

        it('returns the specified hardcoded service url', () => {
          device.config.preDiscoveryServices = {
            validServiceUrl: 'http://example.com/pre-discovery-service'
          };

          return Promise.all([
            device.getPreDiscoveryServiceUrl('invalid')
              .then((url) => {
                assert.isUndefined(url);
              }),
            device.getPreDiscoveryServiceUrl('valid')
              .then((result) => assert.deepEqual(result, 'http://example.com/pre-discovery-service'))
          ]);
        });
      });

      describe('#getServiceUrl()', () => {
        it('requires a `service` parameter', () => assert.isRejected(device.getServiceUrl(), /`service` is a required parameter/));

        it('returns the specified service url', () => {
          device.services = {
            validServiceUrl: 'http://example.com/valid-service'
          };

          return Promise.all([
            device.getServiceUrl('invalid')
              .then((url) => {
                assert.isUndefined(url);
              }),
            device.getServiceUrl('valid')
              .then((result) => assert.deepEqual(result, 'http://example.com/valid-service'))
          ]);
        });

        it('disregards the host catalog and returns the normal url', () => {
          device.services = {
            validServiceUrl: 'http://example.com/valid-service',
            anotherServiceUrl: 'http://another.com/another-service'
          };

          device.serviceHostMap = {
            hostCatalog: {
              'another.com': [
                {
                  host: 'another-1.com',
                  priority: 1
                }
              ]
            }
          };

          return device.getServiceUrl('another')
            .then((result) => assert.deepEqual(result, 'http://another.com/another-service'));
        });
      });

      describe('#isPreDiscoveryService()', () => {
        it('requires a `service` parameter', () => assert.isRejected(device.isPreDiscoveryService(), /`service` is a required parameter/));

        it('indicates whether the specified service is one of the hardcoded app services', () => {
          device.config.preDiscoveryServices = {
            validServiceUrl: 'http://example.com/pre-discovery-service'
          };

          return Promise.all([
            device.isPreDiscoveryService('invalid')
              .then((result) => assert.deepEqual(result, false)),
            device.isPreDiscoveryService('valid')
              .then((result) => assert.deepEqual(result, true))
          ]);
        });
      });

      describe('#isPreDiscoveryServiceUrl()', () => {
        it('requires a `url` parameter', () => assert.isRejected(device.isPreDiscoveryServiceUrl(), /`uri` is a required parameter/));

        it('indicates whether the specified url is one of the hardcoded app services', () => {
          device.config.preDiscoveryServices = {
            validServiceUrl: 'http://example.com/pre-discovery-service'
          };

          return Promise.all([
            device.isPreDiscoveryServiceUrl('http://example.com/disovered-service/some-endpoint')
              .then((result) => assert.deepEqual(result, false)),
            device.isPreDiscoveryServiceUrl('http://example.com/pre-discovery-service/some-endpoint')
              .then((result) => assert.deepEqual(result, true))
          ]);
        });
      });

      describe('#isService()', () => {
        it('requires a `service` parameter', () => assert.isRejected(device.isService(), /`service` is a required parameter/));

        it('indicates whether the specified service is known to the device', () => {
          device.services = {
            validServiceUrl: 'http://example.com/valid-service'
          };
          return Promise.all([
            device.isService('invalid')
              .then((result) => assert.deepEqual(result, false)),
            device.isService('valid')
              .then((result) => assert.deepEqual(result, true))
          ]);
        });
      });

      describe('#isSpecificService()', () => {
        it('resolves with true if the service and key match', () => device.isSpecificService('wdm', 'wdm')
          .then((result) => assert.deepEqual(result, true)));
        it('resolves with true if the service is a url that matches the service specified by key', () => device.isSpecificService('conversation', 'https://conv-a.wbx2.com/conversation/api/v1/conversations')
          .then((result) => assert.deepEqual(result, true)));
        it('resolves with false if the service does not match the key', () => device.isSpecificService('wdm', 'https://conv-a.wbx2.com/conversation/api/v1/conversations')
          .then((result) => assert.deepEqual(result, false)));
      });

      describe('#isServiceUrl()', () => {
        it('requires a `url` parameter', () => assert.isRejected(device.isServiceUrl(), /`uri` is a required parameter/));

        it('indicates whether the specified url is for a service known to the device', () => {
          device.services = {
            validServiceUrl: 'http://example.com/service'
          };
          return Promise.all([
            device.isServiceUrl('http://example.com/not-a-service/some-endpoint')
              .then((result) => assert.deepEqual(result, false)),
            device.isServiceUrl('http://example.com/service/some-endpoint')
              .then((result) => assert.deepEqual(result, true))
          ]);
        });
      });

      describe('#register()', () => {
        describe('when the device is already registered', () => {
          it('refreshes the device', () => {
            sinon.spy(device, 'refresh');

            device.url = 'http://example.com/device/1';
            assert.isTrue(device.registered);

            assert.notCalled(device.refresh);
            return device.register()
              .then(() => assert.calledOnce(device.refresh));
          });
        });
      });

      describe('#refresh()', () => {
        describe('when the device is not registered', () => {
          it('registers the device', () => {
            sinon.spy(device, 'register');

            device.unset('url');


            assert.notCalled(device.register);
            return device.refresh()
              .then(() => assert.calledOnce(device.register));
          });
        });

        describe('when the service responds with a 404', () => {
          it('registers the device', () => {
            const newUrl = 'http://example.com/device/2';
            const request = device.spark.request;
            assert.isTrue(device.registered);
            // eslint-disable-next-line prefer-promise-reject-errors
            request.onCall(0).returns(Promise.reject({statusCode: 404}));
            request.onCall(1).returns(Promise.resolve({body: {url: newUrl}}));
            return device.refresh()
              .then(() => {
                assert.equal(device.url, newUrl);
                assert.calledTwice(request);
              });
          });
        });
      });

      describe('#serialize()', () => {
        it('serializes feature toggles in a format compatible with WDM', () => {
          assert.deepEqual(device.serialize().features, deviceFixture.features);
        });
      });
    });
  });
});

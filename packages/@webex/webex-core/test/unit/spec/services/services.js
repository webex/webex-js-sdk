/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import {Services, ServiceRegistry, ServiceState} from '@webex/webex-core';
import {NewMetrics} from '@webex/internal-plugin-metrics';

const waitForAsync = () =>
  new Promise((resolve) =>
    setImmediate(() => {
      return resolve();
    })
  );

/* eslint-disable no-underscore-dangle */
describe('webex-core', () => {
  describe('Services', () => {
    let webex;
    let services;
    let catalog;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          services: Services,
          newMetrics: NewMetrics,
        },
      });
      services = webex.internal.services;
      catalog = services._getCatalog();
    });

    describe('#initialize', () => {
      it('initFailed is false when initialization succeeds and credentials are available', async () => {
        services.listenToOnce = sinon.stub();
        services.initServiceCatalogs = sinon.stub().returns(Promise.resolve());
        services.webex.credentials = {
          supertoken: {
            access_token: 'token',
          },
        };

        services.initialize();

        // call the onReady callback
        services.listenToOnce.getCall(1).args[2]();
        await waitForAsync();

        assert.isFalse(services.initFailed);
      });

      it('initFailed is false when initialization succeeds no credentials are available', async () => {
        services.listenToOnce = sinon.stub();
        services.collectPreauthCatalog = sinon.stub().returns(Promise.resolve());

        services.initialize();

        // call the onReady callback
        services.listenToOnce.getCall(1).args[2]();
        await waitForAsync();

        assert.isFalse(services.initFailed);
      });

      it.each([
        {error: new Error('failed'), expectedMessage: 'failed'},
        {error: undefined, expectedMessage: undefined}
      ])(
        'sets initFailed to true when collectPreauthCatalog errors',
        async ({error, expectedMessage}) => {
          services.collectPreauthCatalog = sinon.stub().callsFake(() => {
            return Promise.reject(error);
          });

          services.listenToOnce = sinon.stub();
          services.logger.error = sinon.stub();

          services.initialize();

          // call the onReady callback
          services.listenToOnce.getCall(1).args[2]();

          await waitForAsync();

          assert.isTrue(services.initFailed);
          sinon.assert.calledWith(
            services.logger.error,
            `services: failed to init initial services when no credentials available, ${expectedMessage}`
          );
        }
      );

      it.each([
        {error: new Error('failed'), expectedMessage: 'failed'},
        {error: undefined, expectedMessage: undefined}
      ])('sets initFailed to true when initServiceCatalogs errors', async ({error, expectedMessage}) => {
        services.initServiceCatalogs = sinon.stub().callsFake(() => {
          return Promise.reject(error);
        });
        services.webex.credentials = {
          supertoken: {
            access_token: 'token'
          }
        }

        services.listenToOnce = sinon.stub();
        services.logger.error = sinon.stub();

        services.initialize();

        // call the onReady callback
        services.listenToOnce.getCall(1).args[2]();

        await waitForAsync();

        assert.isTrue(services.initFailed);
        sinon.assert.calledWith(
          services.logger.error,
          `services: failed to init initial services when credentials available, ${expectedMessage}`
        );
      });
    });

    describe('class members', () => {
      describe('#registries', () => {
        it('should be a weakmap', () => {
          assert.instanceOf(services.registries, WeakMap);
        });
      });

      describe('#states', () => {
        it('should be a weakmap', () => {
          assert.instanceOf(services.states, WeakMap);
        });
      });
    });

    describe('class methods', () => {
      describe('#getRegistry', () => {
        it('should be a service registry', () => {
          assert.instanceOf(services.getRegistry(), ServiceRegistry);
        });
      });

      describe('#getState', () => {
        it('should be a service state', () => {
          assert.instanceOf(services.getState(), ServiceState);
        });
      });
    });

    describe('#namespace', () => {
      it('is accurate to plugin name', () => {
        assert.equal(services.namespace, 'Services');
      });
    });

    describe('#_catalogs', () => {
      it('is a weakmap', () => {
        assert.typeOf(services._catalogs, 'weakmap');
      });
    });

    describe('#validateDomains', () => {
      it('is a boolean', () => {
        assert.isBoolean(services.validateDomains);
      });
    });

    describe('#initFailed', () => {
      it('is a boolean', () => {
        assert.isFalse(services.initFailed);
      });
    });

    describe('#list()', () => {
      let serviceList;

      beforeEach(() => {
        serviceList = services.list();
      });

      it('must return an object', () => {
        assert.typeOf(serviceList, 'object');
      });

      it('returned list must be of shape {Record<string, string>}', () => {
        Object.keys(serviceList).forEach((key) => {
          assert.typeOf(key, 'string');
          assert.typeOf(serviceList[key], 'string');
        });
      });
    });

    describe('#fetchClientRegionInfo', () => {
      it('successfully resolves with undefined if fetch request failed', () => {
        webex.request = sinon.stub().returns(Promise.reject());

        return services.fetchClientRegionInfo().then((r) => {
          assert.isUndefined(r);
        });
      });
    });

    describe('#getMeetingPreferences', () => {
      it('Fetch login users information ', async () => {
        const userPreferences = {userPreferences: 'userPreferences'};

        webex.request = sinon.stub().returns(Promise.resolve({body: userPreferences}));

        const res = await services.getMeetingPreferences();

        assert.calledWith(webex.request, {
          method: 'GET',
          service: 'hydra',
          resource: 'meetingPreferences',
        });
        assert.isDefined(res);
        assert.equal(res, userPreferences);
      });

      it('Resolve getMeetingPreferences if the api request fails ', async () => {
        webex.request = sinon.stub().returns(Promise.reject());

        const res = await services.getMeetingPreferences();

        assert.calledWith(webex.request, {
          method: 'GET',
          service: 'hydra',
          resource: 'meetingPreferences',
        });
        assert.isUndefined(res);
      });
    });

    describe('#_fetchNewServiceHostmap()', () => {

      beforeEach(() => {
        sinon.spy(webex.internal.newMetrics.callDiagnosticLatencies, 'measureLatency');
      });

      afterEach(() => {
        sinon.restore();
      });

      it('checks service request resolves', async () => {
        const mapResponse = 'map response';

        sinon.stub(services, '_formatReceivedHostmap').resolves(mapResponse);
        sinon.stub(services, 'request').resolves({});
        
        const mapResult = await services._fetchNewServiceHostmap({from: 'limited'});

        assert.deepEqual(mapResult, mapResponse);

        assert.calledOnceWithExactly(services.request, {
          method: 'GET',
          service: 'u2c',
          resource: '/limited/catalog',
          qs: {format: 'hostmap'}
        }
        );
        assert.calledOnceWithExactly(webex.internal.newMetrics.callDiagnosticLatencies.measureLatency, sinon.match.func, 'internal.get.u2c.time');
      });

      it('checks service request rejects', async () => {
        const error = new Error('some error');

        sinon.spy(services, '_formatReceivedHostmap');
        sinon.stub(services, 'request').rejects(error);
        
        const promise = services._fetchNewServiceHostmap({from: 'limited'});
        const rejectedValue = await assert.isRejected(promise);

        assert.deepEqual(rejectedValue, error);

        assert.notCalled(services._formatReceivedHostmap);

        assert.calledOnceWithExactly(services.request, {
          method: 'GET',
          service: 'u2c',
          resource: '/limited/catalog',
          qs: {format: 'hostmap'}
        }
        );
        assert.calledOnceWithExactly(webex.internal.newMetrics.callDiagnosticLatencies.measureLatency, sinon.match.func, 'internal.get.u2c.time');
      });
    });

    describe('replaceHostFromHostmap', () => {
      it('returns the same uri if the hostmap is not set', () => {
        services._hostCatalog = null;

        const uri = 'http://example.com';

        assert.equal(services.replaceHostFromHostmap(uri), uri);
      });

      it('returns the same uri if the hostmap does not contain the host', () => {
        services._hostCatalog = {
          'not-example.com': [
            {
              host: 'example-1.com',
              ttl: -1,
              priority: 5,
              id: '0:0:0:example',
            },
          ],
        };

        const uri = 'http://example.com';

        assert.equal(services.replaceHostFromHostmap(uri), uri);
      });

      it('returns the original uri if the hostmap has no hosts for the host', () => {

        services._hostCatalog = {
          'example.com': [],
        };

        const uri = 'http://example.com';

        assert.equal(services.replaceHostFromHostmap(uri), uri);
      });

      it('returns the replaces the host in the uri with the host from the hostmap', () => {
        services._hostCatalog = {
          'example.com': [
            {
              host: 'example-1.com',
              ttl: -1,
              priority: 5,
              id: '0:0:0:example',
            },
          ],
        };

        const uri = 'http://example.com/somepath';

        assert.equal(services.replaceHostFromHostmap(uri), 'http://example-1.com/somepath');
      });
    });

    describe('#_formatReceivedHostmap()', () => {
      let serviceHostmap;
      let formattedHM;

      beforeEach(() => {
        serviceHostmap = {
          serviceLinks: {
            'example-a': 'https://example-a.com/api/v1',
            'example-b': 'https://example-b.com/api/v1',
            'example-c': 'https://example-c.com/api/v1',
            'example-d': 'https://example-d.com/api/v1',
            'example-e': 'https://example-e.com/api/v1',
            'example-f': 'https://example-f.com/api/v1',
            'example-g': 'https://example-g.com/api/v1',
          },
          hostCatalog: {
            'example-a.com': [
              {
                host: 'example-a-1.com',
                ttl: -1,
                priority: 5,
                id: '0:0:0:example-a',
              },
              {
                host: 'example-a-2.com',
                ttl: -1,
                priority: 3,
                id: '0:0:0:example-a',
              },
              {
                host: 'example-a-3.com',
                ttl: -1,
                priority: 1,
                id: '0:0:0:example-a-x',
              },
            ],
            'example-b.com': [
              {
                host: 'example-b-1.com',
                ttl: -1,
                priority: 5,
                id: '0:0:0:example-b',
              },
              {
                host: 'example-b-2.com',
                ttl: -1,
                priority: 3,
                id: '0:0:0:example-b',
              },
              {
                host: 'example-b-3.com',
                ttl: -1,
                priority: 1,
                id: '0:0:0:example-b-x',
              },
            ],
            'example-c.com': [
              {
                host: 'example-c-1.com',
                ttl: -1,
                priority: 5,
                id: '0:0:0:example-c',
              },
              {
                host: 'example-c-2.com',
                ttl: -1,
                priority: 3,
                id: '0:0:0:example-c',
              },
              {
                host: 'example-c-3.com',
                ttl: -1,
                priority: 1,
                id: '0:0:0:example-c-x',
              },
            ],
            'example-d.com': [
              {
                host: 'example-c-1.com',
                ttl: -1,
                priority: 5,
                id: '0:0:0:example-d',
              },
              {
                host: 'example-c-2.com',
                ttl: -1,
                priority: 3,
                id: '0:0:0:example-d',
              },
              {
                host: 'example-c-3.com',
                ttl: -1,
                priority: 1,
                id: '0:0:0:example-d-x',
              },
            ],
            'example-e.com': [
              {
                host: 'example-e-1.com',
                ttl: -1,
                priority: 5,
                id: '0:0:0:different-e',
              },
              {
                host: 'example-e-2.com',
                ttl: -1,
                priority: 3,
                id: '0:0:0:different-e',
              },
              {
                host: 'example-e-3.com',
                ttl: -1,
                priority: 1,
                id: '0:0:0:different-e',
              },
            ],
            'example-e-1.com': [
              {
                host: 'example-e-4.com',
                ttl: -1,
                priority: 5,
                id: '0:0:0:different-e',
              },
              {
                host: 'example-e-5.com',
                ttl: -1,
                priority: 3,
                id: '0:0:0:different-e',
              },
              {
                host: 'example-e-3.com',
                ttl: -1,
                priority: 1,
                id: '0:0:0:different-e-x',
              },
            ],
            'example-f.com': [
            ],
          },
          format: 'hostmap',
        };
      });

      it('creates a formmatted host map that contains the same amount of entries as the original received hostmap', () => {
        formattedHM = services._formatReceivedHostmap(serviceHostmap);

        assert(
          Object.keys(serviceHostmap.serviceLinks).length >= formattedHM.length,
          'length is not equal or less than'
        );
      });

      it('creates an array of equal or less length of hostMap', () => {
        formattedHM = services._formatReceivedHostmap(serviceHostmap);

        assert(
          Object.keys(serviceHostmap.hostCatalog).length >= formattedHM.length,
          'length is not equal or less than'
        );
      });

      it('creates an array with matching url data', () => {
        formattedHM = services._formatReceivedHostmap(serviceHostmap);

        formattedHM.forEach((entry) => {
          assert.equal(serviceHostmap.serviceLinks[entry.name], entry.defaultUrl);
        });
      });

      it('has all keys in host map hosts', () => {
        formattedHM = services._formatReceivedHostmap(serviceHostmap);

        formattedHM.forEach((service) => {
          service.hosts.forEach((host) => {
            assert.hasAllKeys(
              host,
              ['homeCluster', 'host', 'id', 'priority', 'ttl'],
              `${service.name} has an invalid host shape`
            );
          });
        });
      });

      it('creates a formmated host map containing all received host map service entries', () => {
        formattedHM = services._formatReceivedHostmap(serviceHostmap);

        formattedHM.forEach((service) => {
          const foundServiceKey = Object.keys(serviceHostmap.serviceLinks).find(
            (key) => service.name === key
          );

          assert.isDefined(foundServiceKey);
        });
      });

      it('creates an array with matching names', () => {
        formattedHM = services._formatReceivedHostmap(serviceHostmap);

        assert.hasAllKeys(
          serviceHostmap.serviceLinks,
          formattedHM.map((item) => item.name)
        );
      });

      it('creates the expected formatted host map', () => {
        formattedHM = services._formatReceivedHostmap(serviceHostmap);

        assert.deepEqual(formattedHM, [
          {
            defaultHost: 'example-a.com',
            defaultUrl: 'https://example-a.com/api/v1',
            hosts: [
              {
                homeCluster: true,
                host: 'example-a-1.com',
                id: '0:0:0:example-a',
                priority: 5,
                ttl: -1,
              },
              {
                homeCluster: true,
                host: 'example-a-2.com',
                id: '0:0:0:example-a',
                priority: 3,
                ttl: -1,
              },
            ],
            name: 'example-a',
          },
          {
            defaultHost: 'example-b.com',
            defaultUrl: 'https://example-b.com/api/v1',
            hosts: [
              {
                homeCluster: true,
                host: 'example-b-1.com',
                id: '0:0:0:example-b',
                priority: 5,
                ttl: -1,
              },
              {
                homeCluster: true,
                host: 'example-b-2.com',
                id: '0:0:0:example-b',
                priority: 3,
                ttl: -1,
              },
            ],
            name: 'example-b',
          },
          {
            defaultHost: 'example-c.com',
            defaultUrl: 'https://example-c.com/api/v1',
            hosts: [
              {
                homeCluster: true,
                host: 'example-c-1.com',
                id: '0:0:0:example-c',
                priority: 5,
                ttl: -1,
              },
              {
                homeCluster: true,
                host: 'example-c-2.com',
                id: '0:0:0:example-c',
                priority: 3,
                ttl: -1,
              },
            ],
            name: 'example-c',
          },
          {
            defaultHost: 'example-d.com',
            defaultUrl: 'https://example-d.com/api/v1',
            hosts: [
              {
                homeCluster: true,
                host: 'example-c-1.com',
                id: '0:0:0:example-d',
                priority: 5,
                ttl: -1,
              },
              {
                homeCluster: true,
                host: 'example-c-2.com',
                id: '0:0:0:example-d',
                priority: 3,
                ttl: -1,
              },
            ],
            name: 'example-d',
          },
          {
            defaultHost: 'example-e.com',
            defaultUrl: 'https://example-e.com/api/v1',
            hosts: [
              {
                homeCluster: true,
                host: 'example-e-1.com',
                id: '0:0:0:different-e',
                priority: 5,
                ttl: -1,
              },
              {
                homeCluster: true,
                host: 'example-e-2.com',
                id: '0:0:0:different-e',
                priority: 3,
                ttl: -1,
              },
              {
                homeCluster: true,
                host: 'example-e-3.com',
                id: '0:0:0:different-e',
                priority: 1,
                ttl: -1,
              },
              {
                homeCluster: false,
                host: 'example-e-4.com',
                id: '0:0:0:different-e',
                priority: 5,
                ttl: -1,
              },
              {
                homeCluster: false,
                host: 'example-e-5.com',
                id: '0:0:0:different-e',
                priority: 3,
                ttl: -1,
              },
            ],
            name: 'example-e',
          },
          {
            defaultHost: 'example-f.com',
            defaultUrl: 'https://example-f.com/api/v1',
            hosts: [],
            name: 'example-f',
          },
          {
            defaultHost: 'example-g.com',
            defaultUrl: 'https://example-g.com/api/v1',
            hosts: [],
            name: 'example-g',
          }
        ]);
      });

      it('has hostCatalog updated', () => {
        services._formatReceivedHostmap(serviceHostmap);

        assert.deepStrictEqual(services._hostCatalog, serviceHostmap.hostCatalog);
      });
    });

    describe('#updateCredentialsConfig()', () => {
      // updateCredentialsConfig must remove `/` if exist. so expected serviceList must be.
      const expectedServiceList = {
        idbroker: 'https://idbroker.webex.com',
        identity: 'https://identity.webex.com',
      };

      beforeEach(async () => {
        const servicesList = {
          idbroker: 'https://idbroker.webex.com',
          identity: 'https://identity.webex.com/',
        };

        catalog.list = sinon.stub().returns(servicesList);
        await services.updateCredentialsConfig();
      });

      it('sets the idbroker url properly when trailing slash is not present', () => {
        assert.equal(webex.config.credentials.idbroker.url, expectedServiceList.idbroker);
      });

      it('sets the identity url properly when a trailing slash is present', () => {
        assert.equal(webex.config.credentials.identity.url, expectedServiceList.identity);
      });

      it('sets the authorize url properly when authorization string is not provided', () => {
        assert.equal(
          webex.config.credentials.authorizeUrl,
          `${expectedServiceList.idbroker}/idb/oauth2/v1/authorize`
        );
      });

      it('should retain the authorize url property when authorization string is provided', () => {
        const authUrl = 'http://example-auth-url.com/resource';

        webex.config.credentials.authorizationString = authUrl;
        webex.config.credentials.authorizeUrl = authUrl;

        services.updateCredentialsConfig();

        assert.equal(webex.config.credentials.authorizeUrl, authUrl);
      });
    });
  });
});
/* eslint-enable no-underscore-dangle */

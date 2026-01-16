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

    describe('#initServiceCatalogs', () => {
      it('does not set initFailed to true when updateServices succeeds', async () => {
        services.webex.credentials = {
          getOrgId: sinon.stub().returns('orgId'),
          canAuthorize: true,
        };

        services.collectPreauthCatalog = sinon.stub().callsFake(() => {
          return Promise.resolve();
        });

        services.updateServices = sinon.stub().callsFake(() => {
          return Promise.resolve();
        });

        services.logger.error = sinon.stub();

        await services.initServiceCatalogs();

        assert.isFalse(services.initFailed);

        sinon.assert.calledWith(services.collectPreauthCatalog, {orgId: 'orgId'});
        sinon.assert.notCalled(services.logger.warn);
      });

      it('sets initFailed to true when updateServices errors', async () => {
        const error = new Error('failed');

        services.webex.credentials = {
          getOrgId: sinon.stub().returns('orgId'),
          canAuthorize: true,
        };

        services.collectPreauthCatalog = sinon.stub().callsFake(() => {
          return Promise.resolve();
        })

        services.updateServices = sinon.stub().callsFake(() => {
          return Promise.reject(error);
        });

        services.logger.error = sinon.stub();

        await services.initServiceCatalogs();

        assert.isTrue(services.initFailed);

        sinon.assert.calledWith(services.collectPreauthCatalog, {orgId: 'orgId'});
        sinon.assert.calledWith(services.logger.warn, 'services: cannot retrieve postauth catalog');
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
      beforeEach(() => {
        services.webex.config = {
          services: {
            discovery: {
              sqdiscovery: 'https://test.ciscospark.com/v1/region',
            },
          }
        };
      });

      it('successfully resolves with undefined if fetch request failed', () => {
        webex.request = sinon.stub().returns(Promise.reject());

        return services.fetchClientRegionInfo().then((r) => {
          assert.isUndefined(r);
        });
      });

      it('successfully resolves with true if fetch request succeeds', () => {
        webex.request = sinon.stub().returns(Promise.resolve({body: true}));

        return services.fetchClientRegionInfo().then((r) => {
          assert.equal(r, true);
          assert.calledWith(webex.request, {
            uri: 'https://test.ciscospark.com/v1/region',
            addAuthHeader: false,
            headers: { 'spark-user-agent': null },
            timeout: 5000
          });
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

    describe('#updateCatalog', () => {
      it('updates the catalog', async () => {
        const serviceGroup = 'postauth';
        const hostmap = {hostmap: 'hostmap'};

        services._formatReceivedHostmap = sinon.stub().returns({some: 'hostmap'});

        catalog.updateServiceUrls = sinon.stub().returns(Promise.resolve({some: 'value'}));

        const result = await services.updateCatalog(serviceGroup, hostmap);

        assert.calledWith(services._formatReceivedHostmap, hostmap);

        assert.calledWith(catalog.updateServiceUrls, serviceGroup, {some: 'hostmap'});

        assert.deepEqual(result, {some: 'value'});
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
    
    describe('#getMobiusClusters', () => {
      it('returns unique mobius host entries from hostCatalog', () => {
        // Arrange: two hostCatalog keys, with duplicate mobius host across keys
        services._hostCatalog = {
          'mobius-us-east-2.prod.infra.webex.com': [
            {host: 'mobius-us-east-2.prod.infra.webex.com', ttl: -1, priority: 5, id: 'urn:TEAM:xyz:mobius'},
            {host: 'mobius-eu-central-1.prod.infra.webex.com', ttl: -1, priority: 10, id: 'urn:TEAM:xyz:mobius'},
            ],

          'mobius-eu-central-1.prod.infra.webex.com': [
            {host: 'mobius-us-east-2.prod.infra.webex.com', ttl: -1, priority: 7, id: 'urn:TEAM:xyz:mobius'}, // duplicate host
            ],
          'wdm-a.webex.com' : [
            {host: 'wdm-a.webex.com', ttl: -1, priority: 5, id: 'urn:TEAM:xyz:wdm'},
          ]
        };
    
        // Act
        const clusters = services.getMobiusClusters();
    
        // Assert
        // deduped; only mobius entries; keeps first seen mobius-a, then mobius-b
        assert.deepEqual(
          clusters.map(({host, id, ttl, priority}) => ({host, id, ttl, priority})),
          [
            {host: 'mobius-us-east-2.prod.infra.webex.com', id: 'urn:TEAM:xyz:mobius', ttl: -1, priority: 5},
            {host: 'mobius-eu-central-1.prod.infra.webex.com', id: 'urn:TEAM:xyz:mobius', ttl: -1, priority: 10},
          ]
        );
      });
    });

    describe('#isValidHost', () => {
      beforeEach(() => {
        // Setting up a mock host catalog
          services._hostCatalog = {
            "audit-ci-m.wbx2.com": [
              {
                  "host": "audit-ci-m.wbx2.com",
                  "ttl": -1,
                  "priority": 5,
                  "id": "urn:IDENTITY:PA61:adminAudit"
              },
              {
                  "host": "audit-ci-m.wbx2.com",
                  "ttl": -1,
                  "priority": 5,
                  "id": "urn:IDENTITY:PA61:adminAuditV2"
              }
            ],
            "mercury-connection-partition0-r.wbx2.com": [
                {
                    "host": "mercury-connection-partition0-r.wbx2.com",
                    "ttl": -1,
                    "priority": 5,
                    "id": "urn:TEAM:us-west-2_r:mercuryConnectionPartition0"
                }
            ],
            "empty.com": []
          };
      });
      afterAll(() => {
        // Clean up the mock host catalog
        services._hostCatalog = {};
      });
      it('returns true if the host is in the host catalog', () => {
        assert.isTrue(services.isValidHost('mercury-connection-partition0-r.wbx2.com'));
      });

      it('returns false if the host is not in the host catalog or has an empty entry list', () => {
        assert.isFalse(services.isValidHost('test.com'));
        assert.isFalse(services.isValidHost(''));
        assert.isFalse(services.isValidHost(null));
        assert.isFalse(services.isValidHost(undefined));
        assert.isFalse(services.isValidHost('empty.com'));
      });

      it('returns false for non-string inputs', () => {
        assert.isFalse(services.isValidHost(123));
        assert.isFalse(services.isValidHost({}));
        assert.isFalse(services.isValidHost([]));
      });
    });

    describe('U2C catalog cache behavior', () => {
      let webex;
      let services;
      let catalog;
      let localStorageBackup;
      let windowBackup;
  
      const makeLocalStorageShim = () => {
        const store = new Map();
        return {
          getItem: (k) => (store.has(k) ? store.get(k) : null),
          setItem: (k, v) => store.set(k, v),
          removeItem: (k) => store.delete(k),
          _store: store,
        };
      };
  
      beforeEach(() => {
        // Build a fresh webex instance
        webex = new MockWebex({children: {services: Services}, config: {credentials: {federation: true}}});
        services = webex.internal.services;
        catalog = services._getCatalog();
  
        // enable U2C caching feature flag in tests that rely on localStorage writes/reads
        services.webex.config = services.webex.config || {};
        services.webex.config.calling = {...(services.webex.config.calling || {}), cacheU2C: true};

        // stub window.localStorage
        windowBackup = global.window;
        if (!global.window) global.window = {};
        localStorageBackup = global.window.localStorage;
        global.window.localStorage = makeLocalStorageShim();
        // Ensure code under test uses our shim via util method
        sinon.stub(services, '_getLocalStorageSafe').returns(global.window.localStorage);
  
        // Stub the formatter so we don't need a full hostmap payload in tests
        sinon.stub(services, '_formatReceivedHostmap').callsFake(() => [
          {name: 'hydra', defaultUrl: 'https://api.ciscospark.com/v1', hosts: []},
        ]);
      });
  
      afterEach(() => {
        global.window.localStorage = localStorageBackup || undefined;
        if (!windowBackup) {
          delete global.window;
        } else {
          global.window = windowBackup;
        }
        // Restore util stub if present
        if (services._getLocalStorageSafe && services._getLocalStorageSafe.restore) {
          services._getLocalStorageSafe.restore();
        }
      });
  
      it('invokes initServiceCatalogs on ready, caches catalog, and stores in localStorage', async () => {
        // Arrange: authenticated credentials and spies
        services.webex.credentials = {
          getOrgId: sinon.stub().returns('urn:EXAMPLE:org'),
          canAuthorize: true,
          supertoken: {access_token: 'token'},
        };
        const initSpy = sinon.spy(services, 'initServiceCatalogs');
        const cacheSpy = sinon.spy(services, '_cacheCatalog');
        const setItemSpy = sinon.spy(global.window.localStorage, 'setItem');
        // Make fetch return a hostmap object and allow formatter to reduce it
        sinon.stub(services, 'request').resolves({body: {services: [], activeServices: {}, timestamp: Date.now().toString(), orgId: 'urn:EXAMPLE:org', format: 'U2CV2'}});
        // Cause ready callback to run immediately
        services.listenToOnce = sinon.stub().callsFake((ctx, event, cb) => {
          if (event === 'ready') cb();
        });

        // Act
        services.initialize();
        await waitForAsync();

        // Assert: initServiceCatalogs was called because there was no cache
        assert.isTrue(initSpy.called, 'expected initServiceCatalogs to be invoked on ready');
        // _cacheCatalog is called at least once (preauth/postauth flows)
        assert.isTrue(cacheSpy.called, 'expected _cacheCatalog to be called');
        assert.isTrue(setItemSpy.called, 'expected localStorage.setItem to be called');

        // Cleanup spies
        services.request.restore();
        initSpy.restore();
        cacheSpy.restore();
        setItemSpy.restore();
      });

      it('does not invoke initServiceCatalogs on ready when cache exists and uses cached catalog', async () => {
        // Arrange: put a valid cache
        const CATALOG_CACHE_KEY_V1 = 'services.v1.u2cHostMap';
        const cached = {
          orgId: 'urn:EXAMPLE:org',
          cachedAt: Date.now(),
          preauth: {serviceLinks: {}, hostCatalog: {}},
          postauth: {serviceLinks: {}, hostCatalog: {}},
        };
        global.window.localStorage.setItem(CATALOG_CACHE_KEY_V1, JSON.stringify(cached));

        // authenticated credentials
        services.webex.credentials = {
          getOrgId: sinon.stub().returns('urn:EXAMPLE:org'),
          canAuthorize: true,
          supertoken: {access_token: 'token'},
        };

        const initSpy = sinon.spy(services, 'initServiceCatalogs');
        const cacheSpy = sinon.spy(services, '_cacheCatalog');
        // Cause ready callback to run immediately
        services.listenToOnce = sinon.stub().callsFake((ctx, event, cb) => {
          if (event === 'ready') cb();
        });

        // Act
        services.initialize();
        await waitForAsync();

        // Assert: ready path found cache and skipped initServiceCatalogs
        assert.isFalse(initSpy.called, 'expected initServiceCatalogs to be skipped with cache present');
        assert.isTrue(services._getCatalog().status.preauth.ready, 'preauth should be ready from cache');
        assert.isTrue(services._getCatalog().status.postauth.ready, 'postauth should be ready from cache');
        assert.isFalse(cacheSpy.called, 'should not write cache during warm-up-only path');

        // Cleanup
        initSpy.restore();
        cacheSpy.restore();
      });

      it('expires cached catalog after TTL and clears the entry', async () => {
        const CATALOG_CACHE_KEY_V1 = 'services.v1.u2cHostMap';
        const staleCached = {
          orgId: 'urn:EXAMPLE:org',
          cachedAt: Date.now() - (24 * 60 * 60 * 1000 + 1000), // past TTL
          preauth: {serviceLinks: {}, hostCatalog: {}},
          postauth: {serviceLinks: {}, hostCatalog: {}},
        };
  
        window.localStorage.setItem(CATALOG_CACHE_KEY_V1, JSON.stringify(staleCached));
  
        const warmed = await services._loadCatalogFromCache();
  
        assert.isFalse(warmed, 'stale cache must not warm');
        assert.isNull(window.localStorage.getItem(CATALOG_CACHE_KEY_V1), 'expired cache must be cleared');
        assert.isFalse(catalog.status.preauth.ready);
        assert.isFalse(catalog.status.postauth.ready);
      });
  
      it('clearCatalogCache() removes the cached entry', async () => {
        const CATALOG_CACHE_KEY_V1 = 'services.v1.u2cHostMap';
        window.localStorage.setItem(CATALOG_CACHE_KEY_V1, JSON.stringify({cachedAt: Date.now()}));
  
        await services.clearCatalogCache();
  
        assert.isNull(window.localStorage.getItem(CATALOG_CACHE_KEY_V1), 'cache should be cleared');
      });
  
      it('still fetches when forceRefresh=true even if ready', async () => {
        const CATALOG_CACHE_KEY_V1 = 'services.v1.u2cHostMap';
        window.localStorage.setItem(
          CATALOG_CACHE_KEY_V1,
          JSON.stringify({
            orgId: 'urn:EXAMPLE:org',
            cachedAt: Date.now(),
            preauth: {serviceLinks: {}, hostCatalog: {}},
            postauth: {serviceLinks: {}, hostCatalog: {}},
          })
        );
  
        // warm from cache
        const warmed = await services._loadCatalogFromCache();
        assert.isTrue(warmed);
        assert.isTrue(catalog.status.preauth.ready);
        assert.isTrue(catalog.status.postauth.ready);
  
        const fetchSpy = sinon.spy(services, '_fetchNewServiceHostmap');
  
        // with forceRefresh we should fetch despite ready=true
        await services.updateServices({from: 'limited', query: {orgId: 'urn:EXAMPLE:org'}, forceRefresh: true});
        // pass an empty query to avoid spreading undefined in qs construction
        await services.updateServices({forceRefresh: true});
  
        assert.isTrue(fetchSpy.called, 'forceRefresh should bypass cache short-circuit');
        fetchSpy.restore();
      });

      it('stores selection metadata and env on cache write for preauth', async () => {
        const CATALOG_CACHE_KEY_V1 = 'services.v1.u2cHostMap';
        // arrange config for env fingerprint
        services.webex.config = services.webex.config || {};
        services.webex.config.services = services.webex.config.services || {discovery: {}};
        services.webex.config.services.discovery.u2c = 'https://u2c.wbx2.com/u2c/api/v1';
        services.webex.config.fedramp = false;

        // write cache with meta
        await services._cacheCatalog(
          'preauth',
          {serviceLinks: {}, hostCatalog: {}},
          {selectionType: 'orgId', selectionValue: 'urn:EXAMPLE:org'}
        );

        const raw = window.localStorage.getItem(CATALOG_CACHE_KEY_V1);
        assert.isString(raw);
        const parsed = JSON.parse(raw);
        assert.equal(parsed.orgId, undefined, 'orgId not set without credentials');
        assert.deepEqual(parsed.env, {
          fedramp: false,
          u2cDiscoveryUrl: 'https://u2c.wbx2.com/u2c/api/v1',
        });
        assert.isObject(parsed.preauth);
        assert.deepEqual(parsed.preauth.meta, {
          selectionType: 'orgId',
          selectionValue: 'urn:EXAMPLE:org',
        });
      });

      it('warms preauth from cache when selection meta matches intended orgId', async () => {
        const CATALOG_CACHE_KEY_V1 = 'services.v1.u2cHostMap';
        // stub credentials
        services.webex.credentials = {
          canAuthorize: true,
          getOrgId: sinon.stub().returns('urn:EXAMPLE:org'),
        };
        // set current env to match cached env
        services.webex.config = services.webex.config || {};
        services.webex.config.services = services.webex.config.services || {discovery: {}};
        services.webex.config.services.discovery.u2c = 'https://u2c.wbx2.com/u2c/api/v1';
        services.webex.config.fedramp = false;
        // cache with matching orgId selection
        window.localStorage.setItem(
          CATALOG_CACHE_KEY_V1,
          JSON.stringify({
            cachedAt: Date.now(),
            env: {fedramp: false, u2cDiscoveryUrl: 'https://u2c.wbx2.com/u2c/api/v1'},
            preauth: {
              hostMap: {serviceLinks: {}, hostCatalog: {}},
              meta: {selectionType: 'orgId', selectionValue: 'urn:EXAMPLE:org'},
            },
          })
        );
        // formatter returns at least one entry to mark ready
        services._formatReceivedHostmap.restore && services._formatReceivedHostmap.restore();
        sinon.stub(services, '_formatReceivedHostmap').callsFake(() => [
          {name: 'hydra', defaultUrl: 'https://api.ciscospark.com/v1', hosts: []},
        ]);

        const warmed = await services._loadCatalogFromCache();
        assert.isTrue(warmed);
        assert.isTrue(catalog.status.preauth.ready, 'preauth should be warmed on match');
      });

      it('does not warm preauth when selection meta is proximity mode', async () => {
        const CATALOG_CACHE_KEY_V1 = 'services.v1.u2cHostMap';
        // cache with proximity mode selection
        window.localStorage.setItem(
          CATALOG_CACHE_KEY_V1,
          JSON.stringify({
            cachedAt: Date.now(),
            env: {fedramp: false, u2cDiscoveryUrl: 'https://u2c.wbx2.com/u2c/api/v1'},
            preauth: {
              hostMap: {serviceLinks: {}, hostCatalog: {}},
              meta: {selectionType: 'mode', selectionValue: 'DEFAULT_BY_PROXIMITY'},
            },
          })
        );
        services._formatReceivedHostmap.restore && services._formatReceivedHostmap.restore();
        sinon.stub(services, '_formatReceivedHostmap').callsFake(() => [
          {name: 'hydra', defaultUrl: 'https://api.ciscospark.com/v1', hosts: []},
        ]);

        const warmed = await services._loadCatalogFromCache();
        // function returns true if overall cache path succeeded; we only verify group readiness
        assert.isFalse(catalog.status.preauth.ready, 'preauth should not warm for proximity mode');
      });

      it('does not warm preauth when selection meta mismatches intended selection', async () => {
        const CATALOG_CACHE_KEY_V1 = 'services.v1.u2cHostMap';
        // authorized with org X
        services.webex.credentials = {
          canAuthorize: true,
          getOrgId: sinon.stub().returns('urn:EXAMPLE:org'),
        };
        // cache points to a different org
        window.localStorage.setItem(
          CATALOG_CACHE_KEY_V1,
          JSON.stringify({
            cachedAt: Date.now(),
            env: {fedramp: false, u2cDiscoveryUrl: 'https://u2c.wbx2.com/u2c/api/v1'},
            preauth: {
              hostMap: {serviceLinks: {}, hostCatalog: {}},
              meta: {selectionType: 'orgId', selectionValue: 'urn:DIFF:org'},
            },
          })
        );
        services._formatReceivedHostmap.restore && services._formatReceivedHostmap.restore();
        sinon.stub(services, '_formatReceivedHostmap').callsFake(() => [
          {name: 'hydra', defaultUrl: 'https://api.ciscospark.com/v1', hosts: []},
        ]);

        await services._loadCatalogFromCache();
        assert.isFalse(catalog.status.preauth.ready, 'preauth should not warm on selection mismatch');
      });

      it('skips warming when environment fingerprint mismatches', async () => {
        const CATALOG_CACHE_KEY_V1 = 'services.v1.u2cHostMap';
        // cached env differs from current env (different U2C URL)
        window.localStorage.setItem(
          CATALOG_CACHE_KEY_V1,
          JSON.stringify({
            cachedAt: Date.now(),
            env: {fedramp: false, u2cDiscoveryUrl: 'https://u2c.other.com/u2c/api/v1'},
            preauth: {hostMap: {serviceLinks: {}, hostCatalog: {}}, meta: {selectionType: 'mode', selectionValue: 'DEFAULT_BY_PROXIMITY'}},
          })
        );
        // current env
        services.webex.config = services.webex.config || {};
        services.webex.config.services = services.webex.config.services || {discovery: {}};
        services.webex.config.services.discovery.u2c = 'https://u2c.wbx2.com/u2c/api/v1';
        services.webex.config.fedramp = false;

        const warmed = await services._loadCatalogFromCache();
        assert.isFalse(warmed, 'env mismatch should skip warm and return false');
        assert.isFalse(catalog.status.preauth.ready);
        assert.isFalse(catalog.status.postauth.ready);
      });
    });
    
  });
});
/* eslint-enable no-underscore-dangle */

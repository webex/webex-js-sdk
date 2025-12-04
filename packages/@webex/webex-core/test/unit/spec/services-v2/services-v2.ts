/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import {ServicesV2} from '@webex/webex-core';
import {NewMetrics} from '@webex/internal-plugin-metrics';
import {formattedServiceHostmapV2, serviceHostmapV2} from '../../../fixtures/host-catalog-v2';

const waitForAsync = () =>
  new Promise<void>((resolve) =>
    setImmediate(() => {
      return resolve();
    })
  );

describe('webex-core', () => {
  describe('ServicesV2', () => {
    let webex;
    let services;
    let catalog;

    beforeEach(() => {
      webex = MockWebex({
        children: {
          services: ServicesV2,
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
        {error: undefined, expectedMessage: undefined},
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
        {error: undefined, expectedMessage: undefined},
      ])(
        'sets initFailed to true when initServiceCatalogs errors',
        async ({error, expectedMessage}) => {
          services.initServiceCatalogs = sinon.stub().callsFake(() => {
            return Promise.reject(error);
          });
          services.webex.credentials = {
            supertoken: {
              access_token: 'token',
            },
          };

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
        }
      );
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
        });

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

    describe('#fetchClientRegionInfo', () => {
      beforeEach(() => {
        services.webex.config = {
          services: {
            discovery: {
              sqdiscovery: 'https://test.ciscospark.com/v1/region',
            },
          },
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
            headers: {'spark-user-agent': null},
            timeout: 5000,
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

    describe('#switchActiveClusterIds', () => {
      let serviceHostmap;
      let formattedHM;

      beforeEach(() => {
        serviceHostmap = serviceHostmapV2;
        formattedHM = services._formatReceivedHostmap(serviceHostmap);

        services.initServiceCatalogs = sinon.stub().returns(Promise.resolve());
        services.webex.credentials = {
          getOrgId: sinon.stub().returns('')
        };
        catalog.status = {};
      });

      it('switches properly when id exists', async () => {
        services._updateActiveServices = sinon.stub().callsFake((data) => {
          Object.assign(services._activeServices, data);
        });

        await services.switchActiveClusterIds({
          conversation: 'urn:TEAM:me-central-1_d:conversation',
        });

        assert.notCalled(services.initServiceCatalogs);

        assert.calledWith(services._updateActiveServices, {
          conversation: 'urn:TEAM:me-central-1_d:conversation',
        });

        assert.equal(services._activeServices.conversation, 'urn:TEAM:me-central-1_d:conversation');
      });

      it('makes request to fetch when id does not exist', async () => {
        services._updateActiveServices = sinon.stub().callsFake((data) => {
          Object.assign(services._activeServices, data);
        });

        await services.switchActiveClusterIds({
          conversation: 'urn:TEAM:me-central-1_asdf:conversation',
        });

        assert.calledOnce(services.initServiceCatalogs);
      });
    });

    describe('#updateCatalog', () => {
      it('updates the catalog', async () => {
        const serviceGroup = 'postauth';
        const hostmap = {services: [{hostmap: 'hostmap'}]};

        services._formatReceivedHostmap = sinon.stub().returns({services : [{some: 'hostmap'}]});

        catalog.updateServiceGroups = sinon.stub().returns(Promise.resolve([{some: 'value'}]));

        const result = await services.updateCatalog(serviceGroup, hostmap);

        assert.calledWith(services._formatReceivedHostmap, hostmap);

        assert.calledWith(catalog.updateServiceGroups, serviceGroup, [{some: 'hostmap'}]);

        assert.deepEqual(result, [{some: 'value'}]);
      });
      it('updates the catalog with empty hostmap', async () => {
        const serviceGroup = 'postauth';
        const hostmap = {};

        services._formatReceivedHostmap = sinon.stub().returns({services : undefined});

        catalog.updateServiceGroups = sinon.stub().returns(Promise.resolve([{some: 'value'}]));

        const result = await services.updateCatalog(serviceGroup, hostmap);

        assert.calledWith(services._formatReceivedHostmap, hostmap);

        assert.calledWith(catalog.updateServiceGroups, serviceGroup, undefined);
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
          qs: {format: 'U2CV2'},
          headers: {},
        });
        assert.calledOnceWithExactly(
          webex.internal.newMetrics.callDiagnosticLatencies.measureLatency,
          sinon.match.func,
          'internal.get.u2c.time'
        );
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
          qs: {format: 'U2CV2'},
          headers: {},
        });
        assert.calledOnceWithExactly(
          webex.internal.newMetrics.callDiagnosticLatencies.measureLatency,
          sinon.match.func,
          'internal.get.u2c.time'
        );
      });
    });

    describe('replaceHostFromHostmap', () => {
      it('returns the same uri if the hostmap is not set', () => {
        services._hostCatalog = null;

        const uri = 'http://example.com';

        assert.equal(services.replaceHostFromHostmap(uri), uri);
      });

      it('returns the same uri if the hostmap does not contain the host', () => {
        catalog.updateServiceGroups('preauth', [
          {
            id: 'example-1',
            serviceName: 'example-1',
            serviceUrls: [{host: 'example-1.com', baseUrl: 'http://example-1.com', priority: 1}],
          },
        ]);

        const uri = 'http://example.com';

        assert.equal(services.replaceHostFromHostmap(uri), uri);
      });

      it('returns the replaces the host in the uri with the host from the hostmap', () => {
        catalog.updateServiceGroups('preauth', [
          {
            id: 'example-1',
            serviceName: 'example-1',
            serviceUrls: [
              {host: 'example-1.com', baseUrl: 'http://example-1.com', priority: 1},
              {host: 'example.com', baseUrl: 'http://example.com', priority: 2},
            ],
          },
        ]);

        const uri = 'http://example.com/somepath';

        assert.equal(services.replaceHostFromHostmap(uri), 'http://example-1.com/somepath');
      });
    });

    describe('#_formatReceivedHostmap()', () => {
      let serviceHostmap;
      let formattedHM;

      beforeEach(() => {
        serviceHostmap = serviceHostmapV2;
      });

      it('creates a formmatted hostmap that contains the same amount of entries as the original received hostmap', () => {
        formattedHM = services._formatReceivedHostmap(serviceHostmap);

        assert(
          serviceHostmap.services.length >= formattedHM.services.length,
          'length is not equal or less than'
        );
      });

      it('has all keys in host map hosts', () => {
        formattedHM = services._formatReceivedHostmap(serviceHostmap);

        formattedHM.services.forEach((service) => {
          assert.hasAllKeys(
            service,
            ['id', 'serviceName', 'serviceUrls'],
            `${service.serviceName} has an invalid host shape`
          );
          service.serviceUrls.forEach((serviceUrl) => {
            assert.hasAllKeys(
              serviceUrl,
              ['host', 'baseUrl', 'priority'],
              `${service.serviceName} has an invalid host shape`
            );
          });
        });
      });

      it('creates a formmated host map containing all received host map service entries', () => {
        formattedHM = services._formatReceivedHostmap(serviceHostmap);

        formattedHM.services.forEach((service) => {
          const foundServiceKey = Object.keys(serviceHostmap.activeServices).find(
            (key) => service.serviceName === key
          );

          assert.isDefined(foundServiceKey);
        });
      });

      it('creates the expected formatted host map', () => {
        formattedHM = services._formatReceivedHostmap(serviceHostmap);

        assert.deepEqual(formattedHM.services, formattedServiceHostmapV2);
      });

      it('has hostCatalog updated', () => {
        services._services = [
          {id: 'urn:TEAM:us-east-2_a:conversation'},
          {id: 'test-left-over-services'},
        ];
        services._formatReceivedHostmap(serviceHostmap);

        assert.deepStrictEqual(services._services, [
          ...serviceHostmapV2.services,
          {id: 'test-left-over-services'},
        ]);
      });
    });

    describe('#updateCredentialsConfig()', () => {
      // updateCredentialsConfig must remove `/` if exist. so expected serviceList must be.
      const expectedServiceList = {
        idbroker: 'https://idbroker.webex.com',
        identity: 'https://identity.webex.com',
      };

      beforeEach(async () => {
        const servicesList = [
          {
            id: 'idbroker',
            name: 'idbroker',
            serviceUrls: [
              {baseUrl: 'https://idbroker.webex.com/', host: 'idbroker.webex.com', priority: 1},
            ],
          },
          {
            id: 'identity',
            name: 'identity',
            serviceUrls: [
              {baseUrl: 'https://identity.webex.com/', host: 'identity.webex.com', priority: 1},
            ],
          },
        ];

        catalog.updateServiceGroups('preauth', servicesList);
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

    describe('#invalidateCache', () => {
      beforeEach( () => {
        services.initServiceCatalogs = sinon.stub().returns(Promise.resolve());
        services.webex.credentials = {
          getOrgId: sinon.stub().returns('')
        };
        catalog.status = {};
      })
      it('should log the timestamp parameter', async () => {
        const timestamp = '1234567890';
        services.logger.info = sinon.stub();
        services._getCatalog = sinon.stub().returns({timestamp: '1234567880'});

        await services.invalidateCache(timestamp);

        assert.calledWith(services.logger.info, 'services: invalidate cache, timestamp:', timestamp);
      });

      it('should call initServiceCatalogs when invalidate timestamp is newer than catalog timestamp', async () => {
        const newTimestamp = '1234567890';
        const oldTimestamp = '1234567880';
        services.logger.info = sinon.stub();
        services._getCatalog = sinon.stub().returns({timestamp: oldTimestamp});

        await services.invalidateCache(newTimestamp);

        assert.calledOnce(services.initServiceCatalogs);
        assert.calledWith(services.logger.info, 'services: invalidateCache, refresh services');
      });

      it('should not call initServiceCatalogs when invalidate timestamp is older than catalog timestamp', async () => {
        const oldTimestamp = '1234567880';
        const newTimestamp = '1234567890';
        services._getCatalog = sinon.stub().returns({timestamp: newTimestamp});
        await services.invalidateCache(oldTimestamp);

        assert.notCalled(services.initServiceCatalogs);
      });

      it('should not call initServiceCatalogs when invalidate timestamp equals catalog timestamp', async () => {
        const timestamp = '1234567890';
        services._getCatalog = sinon.stub().returns({timestamp: timestamp});

        await services.invalidateCache(timestamp);

        assert.notCalled(services.initServiceCatalogs);
      });

      it('should handle numeric timestamp strings correctly', async () => {
        const newTimestamp = '1700000000';
        const oldTimestamp = '1600000000';
        services._getCatalog = sinon.stub().returns({timestamp: oldTimestamp});

        await services.invalidateCache(newTimestamp);

        assert.calledOnce(services.initServiceCatalogs);
      });

      it('should handle undefined catalog gracefully', async () => {
        const timestamp = '1234567890';
        services._getCatalog = sinon.stub().returns(undefined);

        await services.invalidateCache(timestamp);

        assert.calledOnce(services.initServiceCatalogs);
      });

      it('should handle catalog without timestamp gracefully', async () => {
        const timestamp = '1234567890';
        services._getCatalog = sinon.stub().returns({});

        await services.invalidateCache(timestamp);

        assert.calledOnce(services.initServiceCatalogs);
      });

      it('should handle null catalog timestamp gracefully', async () => {
        const timestamp = '1234567890';
        services._getCatalog = sinon.stub().returns({timestamp: null});

        await services.invalidateCache(timestamp);

        assert.calledOnce(services.initServiceCatalogs);
      });

      it('should handle undefined timestamp parameter gracefully', async () => {
        services._getCatalog = sinon.stub().returns({timestamp: '1234567890'});

        await services.invalidateCache(undefined);

        assert.notCalled(services.initServiceCatalogs);
      });

      it('should handle null timestamp parameter gracefully', async () => {
        services._getCatalog = sinon.stub().returns({timestamp: '1234567890'});

        await services.invalidateCache(null);

        assert.notCalled(services.initServiceCatalogs);
      });

      it('should handle empty string timestamp parameter gracefully', async () => {
        services._getCatalog = sinon.stub().returns({timestamp: '1234567890'});

        await services.invalidateCache('');

        assert.notCalled(services.initServiceCatalogs);
      });

      it('should handle non-numeric timestamp strings gracefully', async () => {
        const invalidTimestamp = 'not-a-number';
        services._getCatalog = sinon.stub().returns({timestamp: '1234567890'});

        await services.invalidateCache(invalidTimestamp);

        assert.notCalled(services.initServiceCatalogs);
      });

      it('should handle non-numeric catalog timestamp gracefully', async () => {
        const timestamp = '1234567890';
        services._getCatalog = sinon.stub().returns({timestamp: 'not-a-number'});

        await services.invalidateCache(timestamp);

        assert.calledOnce(services.initServiceCatalogs);
      });

      it('should return a resolved Promise', async () => {
        const timestamp = '1234567890';
        services._getCatalog = sinon.stub().returns({timestamp: '1234567880'});

        const result = await services.invalidateCache(timestamp);

        assert.isUndefined(result);
      });
    });

    describe('#getMobiusClusters', () => {
      it('returns unique mobius entries derived from serviceUrls baseUrl', () => {
        // Arrange: seed internal _services with mobius (including duplicate baseUrl)
        services._services = [
          {
            "id": "urn:TEAM:us-east-2_a:mobius",
            "serviceName": 'mobius',
            "serviceUrls": [
              {"baseUrl": 'https://mobius-us-east-2.prod.infra.webex.com/api/v1', "priority": 5},
              {"baseUrl": 'https://mobius-eu-central-1.prod.infra.webex.com/api/v1', "priority": 10},
              {"baseUrl": 'https://mobius-ap-southeast-2.prod.infra.webex.com/api/v1', "priority": 15}, // duplicate
            ],
          },
          {
            "id": "urn:TEAM:ap-southeast-2_m:mobius",
            "serviceName": "mobius",
            "serviceUrls": [
                {
                    "baseUrl": "https://mobius-me-central-1.prod.infra.webex.com/api/v1",
                    "priority": 5
                },
                {
                    "baseUrl": "https://mobius-eu-central-1.prod.infra.webex.com/api/v1",
                    "priority": 10
                },
                {
                    "baseUrl": "https://mobius-ap-southeast-2.prod.infra.webex.com/api/v1",
                    "priority": 15
                },
            ],
          },
          // Non-mobius service should be ignored by getMobiusClusters
          {
            id: 'urn:TEAM:us-east-2_a:wdm',
            serviceName: 'wdm',
            serviceUrls: [{baseUrl: 'https://wdm-a.webex.com/api/v1', priority: 5}],
          },
        ];

        // Act
        const clusters = services.getMobiusClusters();

        // Assert (v2 currently pushes baseUrl into host field and dedups by baseUrl)
        assert.deepEqual(
          clusters.map(({host, id, ttl, priority}) => ({host, id, ttl, priority})),
          [
            {host: 'mobius-us-east-2.prod.infra.webex.com', id: 'urn:TEAM:us-east-2_a:mobius', ttl: 0, priority: 5},
            {host: 'mobius-eu-central-1.prod.infra.webex.com', id: 'urn:TEAM:us-east-2_a:mobius', ttl: 0, priority: 10},
            {host: 'mobius-ap-southeast-2.prod.infra.webex.com', id: 'urn:TEAM:us-east-2_a:mobius', ttl: 0, priority: 15},
            {host: 'mobius-me-central-1.prod.infra.webex.com', id: 'urn:TEAM:ap-southeast-2_m:mobius', ttl: 0, priority: 5},
          ]
        );
      });
    });
  });
});

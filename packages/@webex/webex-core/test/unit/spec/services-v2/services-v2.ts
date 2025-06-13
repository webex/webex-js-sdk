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
      webex = new MockWebex({
        children: {
          services: ServicesV2,
          newMetrics: NewMetrics,
        },
      });
      services = webex.internal.services;
      catalog = services._getCatalog();
    });

    // describe('#initialize', () => {
    //   it('initFailed is false when initialization succeeds and credentials are available', async () => {
    //     services.listenToOnce = sinon.stub();
    //     services.initServiceCatalogs = sinon.stub().returns(Promise.resolve());
    //     services.webex.credentials = {
    //       supertoken: {
    //         access_token: 'token',
    //       },
    //     };

    //     services.initialize();

    //     // call the onReady callback
    //     services.listenToOnce.getCall(1).args[2]();
    //     await waitForAsync();

    //     assert.isFalse(services.initFailed);
    //   });

    //   it('initFailed is false when initialization succeeds no credentials are available', async () => {
    //     services.listenToOnce = sinon.stub();
    //     services.collectPreauthCatalog = sinon.stub().returns(Promise.resolve());

    //     services.initialize();

    //     // call the onReady callback
    //     services.listenToOnce.getCall(1).args[2]();
    //     await waitForAsync();

    //     assert.isFalse(services.initFailed);
    //   });

    //   it.each([
    //     {error: new Error('failed'), expectedMessage: 'failed'},
    //     {error: undefined, expectedMessage: undefined},
    //   ])(
    //     'sets initFailed to true when collectPreauthCatalog errors',
    //     async ({error, expectedMessage}) => {
    //       services.collectPreauthCatalog = sinon.stub().callsFake(() => {
    //         return Promise.reject(error);
    //       });

    //       services.listenToOnce = sinon.stub();
    //       services.logger.error = sinon.stub();

    //       services.initialize();

    //       // call the onReady callback
    //       services.listenToOnce.getCall(1).args[2]();

    //       await waitForAsync();

    //       assert.isTrue(services.initFailed);
    //       sinon.assert.calledWith(
    //         services.logger.error,
    //         `services: failed to init initial services when no credentials available, ${expectedMessage}`
    //       );
    //     }
    //   );

    //   it.each([
    //     {error: new Error('failed'), expectedMessage: 'failed'},
    //     {error: undefined, expectedMessage: undefined},
    //   ])(
    //     'sets initFailed to true when initServiceCatalogs errors',
    //     async ({error, expectedMessage}) => {
    //       services.initServiceCatalogs = sinon.stub().callsFake(() => {
    //         return Promise.reject(error);
    //       });
    //       services.webex.credentials = {
    //         supertoken: {
    //           access_token: 'token',
    //         },
    //       };

    //       services.listenToOnce = sinon.stub();
    //       services.logger.error = sinon.stub();

    //       services.initialize();

    //       // call the onReady callback
    //       services.listenToOnce.getCall(1).args[2]();

    //       await waitForAsync();

    //       assert.isTrue(services.initFailed);
    //       sinon.assert.calledWith(
    //         services.logger.error,
    //         `services: failed to init initial services when credentials available, ${expectedMessage}`
    //       );
    //     }
    //   );
    // });

    // describe('#initServiceCatalogs', () => {
    //   it('does not set initFailed to true when updateServices succeeds', async () => {
    //     services.webex.credentials = {
    //       getOrgId: sinon.stub().returns('orgId'),
    //       canAuthorize: true,
    //     };

    //     services.collectPreauthCatalog = sinon.stub().callsFake(() => {
    //       return Promise.resolve();
    //     });

    //     services.updateServices = sinon.stub().callsFake(() => {
    //       return Promise.resolve();
    //     });

    //     services.logger.error = sinon.stub();

    //     await services.initServiceCatalogs();

    //     assert.isFalse(services.initFailed);

    //     sinon.assert.calledWith(services.collectPreauthCatalog, {orgId: 'orgId'});
    //     sinon.assert.notCalled(services.logger.warn);
    //   });

    //   it('sets initFailed to true when updateServices errors', async () => {
    //     const error = new Error('failed');

    //     services.webex.credentials = {
    //       getOrgId: sinon.stub().returns('orgId'),
    //       canAuthorize: true,
    //     };

    //     services.collectPreauthCatalog = sinon.stub().callsFake(() => {
    //       return Promise.resolve();
    //     });

    //     services.updateServices = sinon.stub().callsFake(() => {
    //       return Promise.reject(error);
    //     });

    //     services.logger.error = sinon.stub();

    //     await services.initServiceCatalogs();

    //     assert.isTrue(services.initFailed);

    //     sinon.assert.calledWith(services.collectPreauthCatalog, {orgId: 'orgId'});
    //     sinon.assert.calledWith(services.logger.warn, 'services: cannot retrieve postauth catalog');
    //   });
    // });

    // describe('class members', () => {
    //   describe('#registries', () => {
    //     it('should be a weakmap', () => {
    //       assert.instanceOf(services.registries, WeakMap);
    //     });
    //   });

    //   describe('#states', () => {
    //     it('should be a weakmap', () => {
    //       assert.instanceOf(services.states, WeakMap);
    //     });
    //   });
    // });

    // describe('class methods', () => {
    //   describe('#getRegistry', () => {
    //     it('should be a service registry', () => {
    //       assert.instanceOf(services.getRegistry(), ServiceRegistry);
    //     });
    //   });

    //   describe('#getState', () => {
    //     it('should be a service state', () => {
    //       assert.instanceOf(services.getState(), ServiceState);
    //     });
    //   });
    // });

    // describe('#namespace', () => {
    //   it('is accurate to plugin name', () => {
    //     assert.equal(services.namespace, 'Services');
    //   });
    // });

    // describe('#_catalogs', () => {
    //   it('is a weakmap', () => {
    //     assert.typeOf(services._catalogs, 'weakmap');
    //   });
    // });

    // describe('#validateDomains', () => {
    //   it('is a boolean', () => {
    //     assert.isBoolean(services.validateDomains);
    //   });
    // });

    // describe('#initFailed', () => {
    //   it('is a boolean', () => {
    //     assert.isFalse(services.initFailed);
    //   });
    // });

    // describe('#list()', () => {
    //   let serviceList;

    //   beforeEach(() => {
    //     serviceList = services.list();
    //   });

    //   it('must return an object', () => {
    //     assert.typeOf(serviceList, 'object');
    //   });

    //   it('returned list must be of shape {Record<string, string>}', () => {
    //     Object.keys(serviceList).forEach((key) => {
    //       assert.typeOf(key, 'string');
    //       assert.typeOf(serviceList[key], 'string');
    //     });
    //   });
    // });

    // describe('#fetchClientRegionInfo', () => {
    //   beforeEach(() => {
    //     services.webex.config = {
    //       services: {
    //         discovery: {
    //           sqdiscovery: 'https://test.ciscospark.com/v1/region',
    //         },
    //       },
    //     };
    //   });

    //   it('successfully resolves with undefined if fetch request failed', () => {
    //     webex.request = sinon.stub().returns(Promise.reject());

    //     return services.fetchClientRegionInfo().then((r) => {
    //       assert.isUndefined(r);
    //     });
    //   });

    //   it('successfully resolves with true if fetch request succeeds', () => {
    //     webex.request = sinon.stub().returns(Promise.resolve({body: true}));

    //     return services.fetchClientRegionInfo().then((r) => {
    //       assert.equal(r, true);
    //       assert.calledWith(webex.request, {
    //         uri: 'https://test.ciscospark.com/v1/region',
    //         addAuthHeader: false,
    //         headers: {'spark-user-agent': null},
    //         timeout: 5000,
    //       });
    //     });
    //   });
    // });

    // describe('#getMeetingPreferences', () => {
    //   it('Fetch login users information ', async () => {
    //     const userPreferences = {userPreferences: 'userPreferences'};

    //     webex.request = sinon.stub().returns(Promise.resolve({body: userPreferences}));

    //     const res = await services.getMeetingPreferences();

    //     assert.calledWith(webex.request, {
    //       method: 'GET',
    //       service: 'hydra',
    //       resource: 'meetingPreferences',
    //     });
    //     assert.isDefined(res);
    //     assert.equal(res, userPreferences);
    //   });

    //   it('Resolve getMeetingPreferences if the api request fails ', async () => {
    //     webex.request = sinon.stub().returns(Promise.reject());

    //     const res = await services.getMeetingPreferences();

    //     assert.calledWith(webex.request, {
    //       method: 'GET',
    //       service: 'hydra',
    //       resource: 'meetingPreferences',
    //     });
    //     assert.isUndefined(res);
    //   });
    // });

    describe('#updateCatalog', () => {
      it('updates the catalog', async () => {
        const serviceGroup = 'postauth';
        const hostmap = [{hostmap: 'hostmap'}];

        services._formatReceivedHostmap = sinon.stub().returns([{some: 'hostmap'}]);

        catalog.updateServiceGroups = sinon.stub().returns(Promise.resolve([{some: 'value'}]));

        const result = await services.updateCatalog(serviceGroup, hostmap);

        assert.calledWith(services._formatReceivedHostmap, hostmap);

        assert.calledWith(catalog.updateServiceGroups, serviceGroup, [{some: 'hostmap'}]);

        assert.deepEqual(result, [{some: 'value'}]);
      });
    });

    // describe('#_fetchNewServiceHostmap()', () => {
    //   beforeEach(() => {
    //     sinon.spy(webex.internal.newMetrics.callDiagnosticLatencies, 'measureLatency');
    //   });

    //   afterEach(() => {
    //     sinon.restore();
    //   });

    //   it('checks service request resolves', async () => {
    //     const mapResponse = 'map response';

    //     sinon.stub(services, '_formatReceivedHostmap').resolves(mapResponse);
    //     sinon.stub(services, 'request').resolves({});

    //     const mapResult = await services._fetchNewServiceHostmap({from: 'limited'});

    //     assert.deepEqual(mapResult, mapResponse);

    //     assert.calledOnceWithExactly(services.request, {
    //       method: 'GET',
    //       service: 'u2c',
    //       resource: '/limited/catalog',
    //       qs: {format: 'hostmap'},
    //     });
    //     assert.calledOnceWithExactly(
    //       webex.internal.newMetrics.callDiagnosticLatencies.measureLatency,
    //       sinon.match.func,
    //       'internal.get.u2c.time'
    //     );
    //   });

    //   it('checks service request rejects', async () => {
    //     const error = new Error('some error');

    //     sinon.spy(services, '_formatReceivedHostmap');
    //     sinon.stub(services, 'request').rejects(error);

    //     const promise = services._fetchNewServiceHostmap({from: 'limited'});
    //     const rejectedValue = await assert.isRejected(promise);

    //     assert.deepEqual(rejectedValue, error);

    //     assert.notCalled(services._formatReceivedHostmap);

    //     assert.calledOnceWithExactly(services.request, {
    //       method: 'GET',
    //       service: 'u2c',
    //       resource: '/limited/catalog',
    //       qs: {format: 'hostmap'},
    //     });
    //     assert.calledOnceWithExactly(
    //       webex.internal.newMetrics.callDiagnosticLatencies.measureLatency,
    //       sinon.match.func,
    //       'internal.get.u2c.time'
    //     );
    //   });
    // });

    // describe('replaceHostFromHostmap', () => {
    //   it('returns the same uri if the hostmap is not set', () => {
    //     services._hostCatalog = null;

    //     const uri = 'http://example.com';

    //     assert.equal(services.replaceHostFromHostmap(uri), uri);
    //   });

    //   it('returns the same uri if the hostmap does not contain the host', () => {
    //     services._hostCatalog = {
    //       'not-example.com': [
    //         {
    //           host: 'example-1.com',
    //           ttl: -1,
    //           priority: 5,
    //           id: '0:0:0:example',
    //         },
    //       ],
    //     };

    //     const uri = 'http://example.com';

    //     assert.equal(services.replaceHostFromHostmap(uri), uri);
    //   });

    //   it('returns the original uri if the hostmap has no hosts for the host', () => {
    //     services._hostCatalog = {
    //       'example.com': [],
    //     };

    //     const uri = 'http://example.com';

    //     assert.equal(services.replaceHostFromHostmap(uri), uri);
    //   });

    //   it('returns the replaces the host in the uri with the host from the hostmap', () => {
    //     services._hostCatalog = {
    //       'example.com': [
    //         {
    //           host: 'example-1.com',
    //           ttl: -1,
    //           priority: 5,
    //           id: '0:0:0:example',
    //         },
    //       ],
    //     };

    //     const uri = 'http://example.com/somepath';

    //     assert.equal(services.replaceHostFromHostmap(uri), 'http://example-1.com/somepath');
    //   });
    // });

    describe('#_formatReceivedHostmap()', () => {
      let serviceHostmap;
      let formattedHM;

      beforeEach(() => {
        serviceHostmap = serviceHostmapV2;
      });

      it('creates a formmatted hostmap that contains the same amount of entries as the original received hostmap', () => {
        formattedHM = services._formatReceivedHostmap(serviceHostmap);

        assert(
          serviceHostmap.services.length >= formattedHM.length,
          'length is not equal or less than'
        );
      });

      it('has all keys in host map hosts', () => {
        formattedHM = services._formatReceivedHostmap(serviceHostmap);

        formattedHM.forEach((service) => {
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

        formattedHM.forEach((service) => {
          const foundServiceKey = Object.keys(serviceHostmap.activeServices).find(
            (key) => service.serviceName === key
          );

          assert.isDefined(foundServiceKey);
        });
      });

      it('creates the expected formatted host map', () => {
        formattedHM = services._formatReceivedHostmap(serviceHostmap);

        assert.deepEqual(formattedHM, formattedServiceHostmapV2);
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

    //   describe('#updateCredentialsConfig()', () => {
    //     // updateCredentialsConfig must remove `/` if exist. so expected serviceList must be.
    //     const expectedServiceList = {
    //       idbroker: 'https://idbroker.webex.com',
    //       identity: 'https://identity.webex.com',
    //     };

    //     beforeEach(async () => {
    //       const servicesList = {
    //         idbroker: 'https://idbroker.webex.com',
    //         identity: 'https://identity.webex.com/',
    //       };

    //       catalog.list = sinon.stub().returns(servicesList);
    //       await services.updateCredentialsConfig();
    //     });

    //     it('sets the idbroker url properly when trailing slash is not present', () => {
    //       assert.equal(webex.config.credentials.idbroker.url, expectedServiceList.idbroker);
    //     });

    //     it('sets the identity url properly when a trailing slash is present', () => {
    //       assert.equal(webex.config.credentials.identity.url, expectedServiceList.identity);
    //     });

    //     it('sets the authorize url properly when authorization string is not provided', () => {
    //       assert.equal(
    //         webex.config.credentials.authorizeUrl,
    //         `${expectedServiceList.idbroker}/idb/oauth2/v1/authorize`
    //       );
    //     });

    //     it('should retain the authorize url property when authorization string is provided', () => {
    //       const authUrl = 'http://example-auth-url.com/resource';

    //       webex.config.credentials.authorizationString = authUrl;
    //       webex.config.credentials.authorizeUrl = authUrl;

    //       services.updateCredentialsConfig();

    //       assert.equal(webex.config.credentials.authorizeUrl, authUrl);
    //     });
    //   });
  });
});

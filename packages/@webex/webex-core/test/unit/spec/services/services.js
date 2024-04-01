/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';
import {Services, ServiceRegistry, ServiceState} from '@webex/webex-core';

/* eslint-disable no-underscore-dangle */
describe('webex-core', () => {
  describe('Services', () => {
    let webex;
    let services;
    let catalog;

    beforeAll(() => {
      webex = new MockWebex({
        children: {
          services: Services,
        },
      });
      services = webex.internal.services;
      catalog = services._getCatalog();
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

      it.skip('creates an array of equal or less length of hostMap', () => {
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

      it('creates a formmated host map containing all received host map host entries', () => {
        formattedHM = services._formatReceivedHostmap(serviceHostmap);

        formattedHM.forEach((service) => {
          const foundHosts = serviceHostmap.hostCatalog[service.defaultHost];

          assert.isDefined(foundHosts);
        });
      });

      it('creates an array with matching names', () => {
        formattedHM = services._formatReceivedHostmap(serviceHostmap);

        assert.hasAllKeys(
          serviceHostmap.serviceLinks,
          formattedHM.map((item) => item.name)
        );
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

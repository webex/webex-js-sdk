/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import WebexCore, {ServiceUrl} from '@webex/webex-core';
import testUsers from '@webex/test-helper-test-users';

/* eslint-disable no-underscore-dangle */
describe('webex-core', () => {
  describe('ServiceCatalog', () => {
    let webexUser;
    let webex;
    let services;
    let catalog;

    before('create users', () =>
      testUsers
        .create({count: 1})
        .then(
          ([user]) =>
            new Promise((resolve) => {
              setTimeout(() => {
                webexUser = user;
                webex = new WebexCore({credentials: user.token});
                services = webex.internal.services;
                catalog = services._getCatalog();
                resolve();
              }, 1000);
            })
        )
        .then(() => webex.internal.device.register())
        .then(() => services.waitForCatalog('postauth', 10))
        .then(() =>
          services.updateServices({
            from: 'limited',
            query: {userId: webexUser.id},
          })
        )
    );

    describe('#status()', () => {
      it('updates ready when services ready', () => {
        assert.equal(catalog.status.postauth.ready, true);
      });
    });

    describe('#_getUrl()', () => {
      let testUrlTemplate;
      let testUrl;

      beforeEach('load test url', () => {
        testUrlTemplate = {
          defaultUrl: 'https://www.example.com/api/v1',
          hosts: [],
          name: 'exampleValid',
        };
        testUrl = new ServiceUrl({...testUrlTemplate});
        catalog._loadServiceUrls('preauth', [testUrl]);
      });

      afterEach('unload test url', () => {
        catalog._unloadServiceUrls('preauth', [testUrl]);
      });

      it('returns a ServiceUrl from a specific serviceGroup', () => {
        const serviceUrl = catalog._getUrl(testUrlTemplate.name, 'preauth');

        assert.equal(serviceUrl.defaultUrl, testUrlTemplate.defaultUrl);
        assert.equal(serviceUrl.hosts, testUrlTemplate.hosts);
        assert.equal(serviceUrl.name, testUrlTemplate.name);
      });

      it("returns undefined if url doesn't exist", () => {
        const serviceUrl = catalog._getUrl('invalidUrl');

        assert.typeOf(serviceUrl, 'undefined');
      });

      it("returns undefined if url doesn't exist in serviceGroup", () => {
        const serviceUrl = catalog._getUrl(testUrlTemplate.name, 'Discovery');

        assert.typeOf(serviceUrl, 'undefined');
      });
    });

    describe('#findClusterId()', () => {
      let testUrlTemplate;
      let testUrl;

      beforeEach('load test url', () => {
        testUrlTemplate = {
          defaultUrl: 'https://www.example.com/api/v1',
          hosts: [
            {
              host: 'www.example-p5.com',
              ttl: -1,
              priority: 5,
              homeCluster: false,
              id: '0:0:0:exampleClusterIdFind',
            },
            {
              host: 'www.example-p3.com',
              ttl: -1,
              priority: 3,
              homeCluster: true,
              id: '0:0:0:exampleClusterIdFind',
            },
            {
              host: 'www.example-p6.com',
              ttl: -1,
              priority: 6,
              homeCluster: true,
              id: '0:0:2:exampleClusterIdFind',
            },
          ],
          name: 'exampleClusterIdFind',
        };
        testUrl = new ServiceUrl({...testUrlTemplate});
        catalog._loadServiceUrls('preauth', [testUrl]);
      });

      afterEach('unload test url', () => {
        catalog._unloadServiceUrls('preauth', [testUrl]);
      });

      it('returns a home cluster clusterId when found with default url', () => {
        assert.equal(
          catalog.findClusterId(testUrlTemplate.defaultUrl),
          testUrlTemplate.hosts[1].id
        );
      });

      it('returns a clusterId when found with priority host url', () => {
        assert.equal(catalog.findClusterId(testUrl.get(true)), testUrlTemplate.hosts[0].id);
      });

      it('returns a clusterId when found with resource-appended url', () => {
        assert.equal(
          catalog.findClusterId(`${testUrl.get()}example/resource/value`),
          testUrlTemplate.hosts[0].id
        );
      });

      it("returns undefined when the url doesn't exist in catalog", () => {
        assert.isUndefined(catalog.findClusterId('http://not-a-known-url.com/'));
      });

      it("returns undefined when the string isn't a url", () => {
        assert.isUndefined(catalog.findClusterId('not a url'));
      });
    });

    describe('#findServiceFromClusterId()', () => {
      let testUrlTemplate;
      let testUrl;

      beforeEach('load test url', () => {
        testUrlTemplate = {
          defaultUrl: 'https://www.example.com/api/v1',
          hosts: [
            {
              homeCluster: true,
              host: 'www.example-p5.com',
              ttl: -1,
              priority: 5,
              id: '0:0:clusterA:example-test',
            },
            {
              host: 'www.example-p3.com',
              ttl: -1,
              priority: 3,
              id: '0:0:clusterB:example-test',
            },
          ],
          name: 'example-test',
        };
        testUrl = new ServiceUrl({...testUrlTemplate});
        catalog._loadServiceUrls('preauth', [testUrl]);
      });

      afterEach('unload test url', () => {
        catalog._unloadServiceUrls('preauth', [testUrl]);
      });

      it('finds a valid service url from only a clusterId', () => {
        const serviceFound = catalog.findServiceFromClusterId({
          clusterId: testUrlTemplate.hosts[0].id,
          priorityHost: false,
        });

        assert.equal(serviceFound.name, testUrl.name);
        assert.equal(serviceFound.url, testUrl.defaultUrl);
      });

      it('finds a valid priority service url', () => {
        const serviceFound = catalog.findServiceFromClusterId({
          clusterId: testUrlTemplate.hosts[0].id,
          priorityHost: true,
        });

        assert.equal(serviceFound.name, testUrl.name);
        assert.equal(serviceFound.url, catalog.get(testUrl.name, true));
      });

      it('finds a valid service when a service group is defined', () => {
        const serviceFound = catalog.findServiceFromClusterId({
          clusterId: testUrlTemplate.hosts[0].id,
          priorityHost: false,
          serviceGroup: 'preauth',
        });

        assert.equal(serviceFound.name, testUrl.name);
        assert.equal(serviceFound.url, testUrl.defaultUrl);
      });

      it("fails to find a valid service when it's not in a group", () => {
        assert.isUndefined(
          catalog.findServiceFromClusterId({
            clusterId: testUrlTemplate.hosts[0].id,
            serviceGroup: 'signin',
          })
        );
      });

      it("returns undefined when service doesn't exist", () => {
        assert.isUndefined(catalog.findServiceFromClusterId({clusterId: 'not a clusterId'}));
      });

      it('should return a remote cluster url with a remote clusterId', () => {
        const serviceFound = catalog.findServiceFromClusterId({
          clusterId: testUrlTemplate.hosts[1].id,
        });

        assert.equal(serviceFound.name, testUrl.name);
        assert.isTrue(serviceFound.url.includes(testUrlTemplate.hosts[1].host));
      });
    });

    describe('#findServiceUrlFromUrl()', () => {
      let testUrlTemplate;
      let testUrl;

      beforeEach('load test url', () => {
        testUrlTemplate = {
          defaultUrl: 'https://www.example.com/api/v1',
          hosts: [
            {
              homeCluster: true,
              host: 'www.example-p5.com',
              ttl: -1,
              priority: 5,
              id: 'exampleClusterId',
            },
            {
              host: 'www.example-p3.com',
              ttl: -1,
              priority: 3,
              id: 'exampleClusterId',
            },
          ],
          name: 'exampleValid',
        };
        testUrl = new ServiceUrl({...testUrlTemplate});
        catalog._loadServiceUrls('preauth', [testUrl]);
      });

      afterEach('unload test url', () => {
        catalog._unloadServiceUrls('preauth', [testUrl]);
      });

      it('finds a service if it exists', () => {
        assert.equal(catalog.findServiceUrlFromUrl(testUrlTemplate.defaultUrl), testUrl);
      });

      it('finds a service if its a priority host url', () => {
        assert.equal(catalog.findServiceUrlFromUrl(testUrl.get(true)).name, testUrl.name);
      });

      it("returns undefined if the url doesn't exist", () => {
        assert.isUndefined(catalog.findServiceUrlFromUrl('https://na.com/'));
      });

      it('returns undefined if the param is not a url', () => {
        assert.isUndefined(catalog.findServiceUrlFromUrl('not a url'));
      });
    });

    describe('#list()', () => {
      it('retreives priority host urls base on priorityHost parameter', () => {
        const serviceList = catalog.list(true);

        const foundPriorityValues = catalog.serviceGroups.postauth.some((serviceUrl) =>
          serviceUrl.hosts.some(({host}) =>
            Object.keys(serviceList).some((key) => serviceList[key].includes(host))
          )
        );

        assert.isTrue(foundPriorityValues);
      });

      it('returns an object of based on serviceGroup parameter', () => {
        let serviceList = catalog.list(true, 'discovery');

        assert.equal(Object.keys(serviceList).length, catalog.serviceGroups.discovery.length);

        serviceList = catalog.list(true, 'preauth');

        assert.equal(Object.keys(serviceList).length, catalog.serviceGroups.preauth.length);

        serviceList = catalog.list(true, 'postauth');

        assert.isAtLeast(Object.keys(serviceList).length, catalog.serviceGroups.postauth.length);
      });

      it('matches the values in serviceUrl', () => {
        let serviceList = catalog.list();

        Object.keys(serviceList).forEach((key) => {
          assert.equal(serviceList[key], catalog._getUrl(key).get());
        });

        serviceList = catalog.list(true, 'postauth');

        Object.keys(serviceList).forEach((key) => {
          assert.equal(serviceList[key], catalog._getUrl(key, 'postauth').get(true));
        });
      });
    });

    describe('#get()', () => {
      let testUrlTemplate;
      let testUrl;

      beforeEach('load test url', () => {
        testUrlTemplate = {
          defaultUrl: 'https://www.example.com/api/v1',
          hosts: [],
          name: 'exampleValid',
        };
        testUrl = new ServiceUrl({...testUrlTemplate});
        catalog._loadServiceUrls('preauth', [testUrl]);
      });

      afterEach('unload test url', () => {
        catalog._unloadServiceUrls('preauth', [testUrl]);
      });

      it('returns a valid string when name is specified', () => {
        const url = catalog.get(testUrlTemplate.name);

        assert.typeOf(url, 'string');
        assert.equal(url, testUrlTemplate.defaultUrl);
      });

      it("returns undefined if url doesn't exist", () => {
        const s = catalog.get('invalidUrl');

        assert.typeOf(s, 'undefined');
      });

      it('calls _getUrl', () => {
        sinon.spy(catalog, '_getUrl');

        catalog.get();

        assert.called(catalog._getUrl);
      });

      it('gets a service from a specific serviceGroup', () => {
        assert.isDefined(catalog.get(testUrlTemplate.name, false, 'preauth'));
      });

      it("fails to get a service if serviceGroup isn't accurate", () => {
        assert.isUndefined(catalog.get(testUrlTemplate.name, false, 'discovery'));
      });
    });

    describe('#markFailedUrl()', () => {
      let testUrlTemplate;
      let testUrl;

      beforeEach('load test url', () => {
        testUrlTemplate = {
          defaultUrl: 'https://www.example.com/api/v1',
          hosts: [
            {
              host: 'www.example-p5.com',
              ttl: -1,
              priority: 5,
              id: '0:0:0:exampleValid',
              homeCluster: true,
            },
            {
              host: 'www.example-p3.com',
              ttl: -1,
              priority: 3,
              id: '0:0:0:exampleValid',
              homeCluster: true,
            },
          ],
          name: 'exampleValid',
        };
        testUrl = new ServiceUrl({...testUrlTemplate});
        catalog._loadServiceUrls('preauth', [testUrl]);
      });

      afterEach('unload test url', () => {
        catalog._unloadServiceUrls('preauth', [testUrl]);
      });

      it('marks a host as failed', () => {
        const priorityUrl = catalog.get(testUrlTemplate.name, true);

        catalog.markFailedUrl(priorityUrl);

        const failedHost = testUrl.hosts.find((host) => host.failed);

        assert.isDefined(failedHost);
      });

      it('returns the next priority url', () => {
        const priorityUrl = catalog.get(testUrlTemplate.name, true);
        const nextPriorityUrl = catalog.markFailedUrl(priorityUrl);

        assert.notEqual(priorityUrl, nextPriorityUrl);
      });
    });

    describe('#_loadServiceUrls()', () => {
      let testUrlTemplate;
      let testUrl;

      beforeEach('init test url', () => {
        testUrlTemplate = {
          defaultUrl: 'https://www.example.com/api/v1',
          hosts: [],
          name: 'exampleValid',
        };
        testUrl = new ServiceUrl({...testUrlTemplate});
      });

      it('appends services to different service groups', () => {
        catalog._loadServiceUrls('postauth', [testUrl]);
        catalog._loadServiceUrls('preauth', [testUrl]);
        catalog._loadServiceUrls('discovery', [testUrl]);

        catalog.serviceGroups.postauth.includes(testUrl);
        catalog.serviceGroups.preauth.includes(testUrl);
        catalog.serviceGroups.discovery.includes(testUrl);

        catalog._unloadServiceUrls('postauth', [testUrl]);
        catalog._unloadServiceUrls('preauth', [testUrl]);
        catalog._unloadServiceUrls('discovery', [testUrl]);
      });
    });

    describe('#_unloadServiceUrls()', () => {
      let testUrlTemplate;
      let testUrl;

      beforeEach('init test url', () => {
        testUrlTemplate = {
          defaultUrl: 'https://www.example.com/api/v1',
          hosts: [],
          name: 'exampleValid',
        };
        testUrl = new ServiceUrl({...testUrlTemplate});
      });

      it('appends services to different service groups', () => {
        catalog._loadServiceUrls('postauth', [testUrl]);
        catalog._loadServiceUrls('preauth', [testUrl]);
        catalog._loadServiceUrls('discovery', [testUrl]);

        const oBaseLength = catalog.serviceGroups.postauth.length;
        const oLimitedLength = catalog.serviceGroups.preauth.length;
        const oDiscoveryLength = catalog.serviceGroups.discovery.length;

        catalog._unloadServiceUrls('postauth', [testUrl]);
        catalog._unloadServiceUrls('preauth', [testUrl]);
        catalog._unloadServiceUrls('discovery', [testUrl]);

        assert.isAbove(oBaseLength, catalog.serviceGroups.postauth.length);
        assert.isAbove(oLimitedLength, catalog.serviceGroups.preauth.length);
        assert.isAbove(oDiscoveryLength, catalog.serviceGroups.discovery.length);
      });
    });

    describe('#_fetchNewServiceHostmap()', () => {
      let fullRemoteHM;
      let limitedRemoteHM;

      beforeEach(() =>
        Promise.all([
          services._fetchNewServiceHostmap(),
          services._fetchNewServiceHostmap({
            from: 'limited',
            query: {userId: webexUser.id},
          }),
        ]).then(([fRHM, lRHM]) => {
          fullRemoteHM = fRHM;
          limitedRemoteHM = lRHM;

          return Promise.resolve();
        })
      );

      it('resolves to an authed u2c hostmap when no params specified', () => {
        assert.typeOf(fullRemoteHM, 'array');
        assert.isAbove(fullRemoteHM.length, 0);
      });

      it('resolves to a limited u2c hostmap when params specified', () => {
        assert.typeOf(limitedRemoteHM, 'array');
        assert.isAbove(limitedRemoteHM.length, 0);
      });

      it('rejects if the params provided are invalid', () =>
        services
          ._fetchNewServiceHostmap({
            from: 'limited',
            query: {userId: 'notValid'},
          })
          .then(() => {
            assert.isTrue(false, 'should have rejected');

            return Promise.reject();
          })
          .catch((e) => {
            assert.typeOf(e, 'Error');

            return Promise.resolve();
          }));
    });

    describe('#waitForCatalog()', () => {
      let promise;
      let serviceHostmap;
      let formattedHM;

      beforeEach(() => {
        serviceHostmap = {
          serviceLinks: {
            'example-a': 'https://example-a.com/api/v1',
            'example-b': 'https://example-b.com/api/v1',
            'example-c': 'https://example-c.com/api/v1',
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
                id: '0:0:0:example-a',
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
                id: '0:0:0:example-b',
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
                id: '0:0:0:example-c',
              },
            ],
          },
          format: 'hostmap',
        };
        formattedHM = services._formatReceivedHostmap(serviceHostmap);

        promise = catalog.waitForCatalog('preauth', 1);
      });

      it('returns a promise', () => {
        assert.typeOf(promise, 'promise');
      });

      it('returns a rejected promise if timeout is reached', () =>
        promise.catch(() => {
          assert(true, 'promise rejected');

          return Promise.resolve();
        }));

      it('returns a resolved promise once ready', () => {
        catalog.waitForCatalog('postauth', 1).then(() => {
          assert(true, 'promise resolved');
        });

        catalog.updateServiceUrls('postauth', formattedHM);
      });
    });

    describe('#updateServiceUrls()', () => {
      let serviceHostmap;
      let formattedHM;

      beforeEach(() => {
        serviceHostmap = {
          serviceLinks: {
            'example-a': 'https://example-a.com/api/v1',
            'example-b': 'https://example-b.com/api/v1',
            'example-c': 'https://example-c.com/api/v1',
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
                id: '0:0:0:example-a',
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
                id: '0:0:0:example-b',
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
                id: '0:0:0:example-c',
              },
            ],
          },
          format: 'hostmap',
        };
        formattedHM = services._formatReceivedHostmap(serviceHostmap);
      });

      it('removes any unused urls from current services', () => {
        catalog.updateServiceUrls('preauth', formattedHM);

        const originalLength = catalog.serviceGroups.preauth.length;

        catalog.updateServiceUrls('preauth', []);

        assert.isBelow(catalog.serviceGroups.preauth.length, originalLength);
      });

      it('updates the target catalog to contain the provided hosts', () => {
        catalog.updateServiceUrls('preauth', formattedHM);

        assert.equal(catalog.serviceGroups.preauth.length, formattedHM.length);
      });

      it('updates any existing ServiceUrls', () => {
        const newServiceHM = {
          serviceLinks: {
            'example-a': 'https://e-a.com/api/v1',
            'example-b': 'https://e-b.com/api/v1',
            'example-c': 'https://e-c.com/api/v1',
          },
          hostCatalog: {
            'e-a.com': [],
            'e-b.com': [],
            'e-c.com': [],
          },
        };

        const newFormattedHM = services._formatReceivedHostmap(newServiceHM);

        catalog.updateServiceUrls('preauth', formattedHM);

        const oServicesB = catalog.list(false, 'preauth');
        const oServicesH = catalog.list(true, 'preauth');

        catalog.updateServiceUrls('preauth', newFormattedHM);

        const nServicesB = catalog.list(false, 'preauth');
        const nServicesH = catalog.list(true, 'preauth');

        Object.keys(nServicesB).forEach((key) => {
          assert.notEqual(nServicesB[key], oServicesB[key]);
        });

        Object.keys(nServicesH).forEach((key) => {
          assert.notEqual(nServicesH[key], oServicesH[key]);
        });
      });

      it('creates an array of equal length of serviceLinks', () => {
        assert.equal(Object.keys(serviceHostmap.serviceLinks).length, formattedHM.length);
      });

      it('creates an array of equal length of hostMap', () => {
        assert.equal(Object.keys(serviceHostmap.hostCatalog).length, formattedHM.length);
      });

      it('creates an array with matching url data', () => {
        formattedHM.forEach((entry) => {
          assert.equal(serviceHostmap.serviceLinks[entry.name], entry.defaultUrl);
        });
      });

      it('creates an array with matching host data', () => {
        Object.keys(serviceHostmap.hostCatalog).forEach((key) => {
          const hostGroup = serviceHostmap.hostCatalog[key];

          const foundMatch = hostGroup.every((inboundHost) =>
            formattedHM.find((formattedService) =>
              formattedService.hosts.find(
                (formattedHost) => formattedHost.host === inboundHost.host
              )
            )
          );

          assert.isTrue(
            foundMatch,
            `did not find matching host data for the \`${key}\` host group.`
          );
        });
      });

      it('creates an array with matching names', () => {
        assert.hasAllKeys(
          serviceHostmap.serviceLinks,
          formattedHM.map((item) => item.name)
        );
      });

      it('returns self', () => {
        const returnValue = catalog.updateServiceUrls('preauth', formattedHM);

        assert.equal(returnValue, catalog);
      });

      it('triggers authorization events', (done) => {
        catalog.once('preauth', () => {
          assert(true, 'triggered once');
          done();
        });

        catalog.updateServiceUrls('preauth', formattedHM);
      });

      it('updates the services list', (done) => {
        catalog.serviceGroups.preauth = [];

        catalog.once('preauth', () => {
          assert.isAbove(catalog.serviceGroups.preauth.length, 0);
          done();
        });

        catalog.updateServiceUrls('preauth', formattedHM);
      });
    });
  });
});
/* eslint-enable no-underscore-dangle */

/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';

import {assert} from '@webex/test-helper-chai';
import {flaky} from '@webex/test-helper-mocha';
import WebexCore, {
  ServiceCatalog,
  ServiceRegistry,
  ServiceState,
  ServiceUrl,
} from '@webex/webex-core';
import testUsers from '@webex/test-helper-test-users';
import uuid from 'uuid';
import sinon from 'sinon';

/* eslint-disable no-underscore-dangle */
describe('webex-core', () => {
  describe('Services', () => {
    let webexUser;
    let webexUserEU;
    let webex;
    let webexEU;
    let services;
    let servicesEU;
    let catalog;

    before('create users', () =>
      Promise.all([
        testUsers.create({count: 1}),
        testUsers.create({
          count: 1,
          config: {
            orgId: process.env.EU_PRIMARY_ORG_ID,
          },
        }),
      ]).then(([[user], [userEU]]) => {
        webexUser = user;
        webexUserEU = userEU;
      })
    );

    beforeEach('create webex instance', () => {
      webex = new WebexCore({credentials: {supertoken: webexUser.token}});
      webexEU = new WebexCore({credentials: {supertoken: webexUserEU.token}});
      services = webex.internal.services;
      servicesEU = webexEU.internal.services;
      catalog = services._getCatalog();

      return Promise.all([
        services.waitForCatalog('postauth', 10),
        servicesEU.waitForCatalog('postauth', 10),
      ]).then(() =>
        services.updateServices({
          from: 'limited',
          query: {userId: webexUser.id},
        })
      );
    });

    describe('#_getCatalog()', () => {
      it('returns a catalog', () => {
        const localCatalog = services._getCatalog();

        assert.equal(localCatalog.namespace, 'ServiceCatalog');
      });
    });

    describe('#list()', () => {
      it('matches the values in serviceUrl', () => {
        let serviceList = services.list();

        Object.keys(serviceList).forEach((key) => {
          assert.equal(serviceList[key], catalog._getUrl(key).get());
        });

        serviceList = services.list(true);
        Object.keys(serviceList).forEach((key) => {
          assert.equal(serviceList[key], catalog._getUrl(key).get(true));
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
        testUrl = new ServiceUrl(testUrlTemplate);
        catalog._loadServiceUrls('preauth', [testUrl]);
      });

      afterEach('unload test url', () => {
        catalog._unloadServiceUrls('preauth', [testUrl]);
      });

      it('returns a valid string when name is specified', () => {
        const url = services.get(testUrlTemplate.name);

        assert.typeOf(url, 'string');
        assert.equal(url, testUrlTemplate.defaultUrl);
      });

      it("returns undefined if url doesn't exist", () => {
        const s = services.get('invalidUrl');

        assert.typeOf(s, 'undefined');
      });

      it('gets a service from a specific serviceGroup', () => {
        assert.isDefined(services.get(testUrlTemplate.name, false, 'preauth'));
      });

      it("fails to get a service if serviceGroup isn't accurate", () => {
        assert.isUndefined(services.get(testUrlTemplate.name, false, 'discovery'));
      });
    });

    describe('#getClusterId()', () => {
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
        testUrl = new ServiceUrl(testUrlTemplate);
        catalog._loadServiceUrls('preauth', [testUrl]);
      });

      it('returns a clusterId when found with default url', () => {
        assert.equal(
          services.getClusterId(testUrlTemplate.defaultUrl),
          testUrlTemplate.hosts[0].id
        );
      });

      it('returns a clusterId when found with priority host url', () => {
        assert.equal(services.getClusterId(testUrl.get(true)), testUrlTemplate.hosts[0].id);
      });

      it('returns a clusterId when found with resource-appended url', () => {
        assert.equal(
          services.getClusterId(`${testUrl.get()}example/resource/value`),
          testUrlTemplate.hosts[0].id
        );
      });

      it("returns undefined when the url doesn't exist in catalog", () => {
        assert.isUndefined(services.getClusterId('http://not-a-known-url.com/'));
      });

      it("returns undefined when the string isn't a url", () => {
        assert.isUndefined(services.getClusterId('not a url'));
      });
    });

    describe('#getServiceFromClusterId()', () => {
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
              id: '0:0:cluster-a:exampleValid',
            },
            {
              host: 'www.example-p3.com',
              ttl: -1,
              priority: 3,
              id: '0:0:cluster-b:exampleValid',
            },
          ],
          name: 'exampleValid',
        };
        testUrl = new ServiceUrl(testUrlTemplate);
        catalog._loadServiceUrls('preauth', [testUrl]);
      });

      it('finds a valid service url from only a clusterId', () => {
        const serviceFound = services.getServiceFromClusterId({
          clusterId: testUrlTemplate.hosts[0].id,
          priorityHost: false,
        });

        assert.equal(serviceFound.name, testUrl.name);
        assert.equal(serviceFound.url, testUrl.defaultUrl);
      });

      it('finds a valid priority service url', () => {
        const serviceFound = services.getServiceFromClusterId({
          clusterId: testUrlTemplate.hosts[0].id,
          priorityHost: true,
        });

        assert.equal(serviceFound.name, testUrl.name);
        assert.isTrue(
          serviceFound.url.includes(testUrlTemplate.hosts[0].host),
          `'${serviceFound.url}' is not host '${testUrlTemplate.hosts[0].host}'`
        );
        // assert.equal(serviceFound.url, catalog.get('exampleValid', true));
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
          services.getServiceFromClusterId({
            clusterId: testUrlTemplate.hosts[0].id,
            serviceGroup: 'signin',
          })
        );
      });

      it("returns undefined when service doesn't exist", () => {
        assert.isUndefined(services.getServiceFromClusterId({clusterId: 'not a clusterId'}));
      });
    });

    describe('#getServiceFromUrl()', () => {
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
        testUrl = new ServiceUrl(testUrlTemplate);
        catalog._loadServiceUrls('preauth', [testUrl]);
      });

      afterEach('unload test url', () => {
        catalog._unloadServiceUrls('preauth', [testUrl]);
      });

      it('gets a valid service object from an existing service', () => {
        const serviceObject = services.getServiceFromUrl(testUrlTemplate.defaultUrl);

        assert.isDefined(serviceObject);
        assert.hasAllKeys(serviceObject, ['name', 'defaultUrl', 'priorityUrl']);

        assert.equal(testUrlTemplate.name, serviceObject.name);
        assert.equal(testUrlTemplate.defaultUrl, serviceObject.defaultUrl);
        assert.equal(testUrl.get(true), serviceObject.priorityUrl);
      });

      it("returns undefined when the service url doesn't exist", () => {
        const serviceObject = services.getServiceFromUrl('http://www.not-real.com/');

        assert.isUndefined(serviceObject);
      });
    });

    describe('#hasService()', () => {
      it('returns a boolean', () => {
        assert.isBoolean(services.hasService('some-url'));
      });

      it('validates that a service exists', () => {
        const service = Object.keys(services.list())[0];

        assert.isTrue(services.hasService(service));
      });
    });

    describe('#initConfig()', () => {
      it('should set the discovery catalog based on the provided links', () => {
        const key = 'test';
        const url = 'http://www.test.com/';

        webex.config.services.discovery[key] = url;

        services.initConfig();

        assert.equal(services.get(key), url);
      });

      it('should set the override catalog based on the provided links', () => {
        const key = 'testOverride';
        const url = 'http://www.test-override.com/';

        webex.config.services.override = {};
        webex.config.services.override[key] = url;

        services.initConfig();

        assert.equal(services.get(key), url);
      });

      it('should set validate domains to true when provided true', () => {
        webex.config.services.validateDomains = true;

        services.initConfig();

        assert.isTrue(services.validateDomains);
      });

      it('should set validate domains to false when provided false', () => {
        webex.config.services.validateDomains = false;

        services.initConfig();

        assert.isFalse(services.validateDomains);
      });

      it('should set the allowed domains based on the provided domains', () => {
        const allowedDomains = ['domain'];

        webex.config.services.allowedDomains = allowedDomains;

        services.initConfig();

        assert.deepEqual(allowedDomains, services._getCatalog().allowedDomains);
      });
    });

    describe('#initialize()', () => {
      it('should create a catalog', () =>
        assert.instanceOf(services._getCatalog(), ServiceCatalog));

      it('should create a registry', () =>
        assert.instanceOf(services.getRegistry(), ServiceRegistry));

      it('should create a state', () => assert.instanceOf(services.getState(), ServiceState));

      it('should call services#initConfig() when webex config changes', () => {
        services.initConfig = sinon.spy();
        services.initialize();
        webex.trigger('change:config');
        assert.called(services.initConfig);
        assert.isTrue(catalog.isReady);
      });

      it('should call services#initServiceCatalogs() on webex ready', () => {
        services.initServiceCatalogs = sinon.stub().resolves();
        services.initialize();
        webex.trigger('ready');
        assert.called(services.initServiceCatalogs);
        assert.isTrue(catalog.isReady);
      });

      it('should collect different catalogs based on OrgId region', () =>
        assert.notDeepEqual(services.list(true), servicesEU.list(true)));

      it('should not attempt to collect catalogs without authorization', (done) => {
        const otherWebex = new WebexCore();
        let {initServiceCatalogs} = otherWebex.internal.services;

        initServiceCatalogs = sinon.stub();

        setTimeout(() => {
          assert.notCalled(initServiceCatalogs);
          assert.isFalse(otherWebex.internal.services._getCatalog().isReady);
          done();
        }, 2000);
      });
    });

    describe('#initServiceCatalogs()', () => {
      it('should reject if a OrgId cannot be retrieved', () => {
        webex.credentials.getOrgId = sinon.stub().throws();

        return assert.isRejected(services.initServiceCatalogs());
      });

      it('should call services#collectPreauthCatalog with the OrgId', () => {
        services.collectPreauthCatalog = sinon.stub().resolves();

        return services.initServiceCatalogs().then(() =>
          assert.calledWith(
            services.collectPreauthCatalog,
            sinon.match({
              orgId: webex.credentials.getOrgId(),
            })
          )
        );
      });

      it('should not call services#updateServices() when not authed', () => {
        services.updateServices = sinon.stub().resolves();

        // Since credentials uses AmpState, we have to set the derived
        // properties of the dependent properties to undefined.
        webex.credentials.supertoken.access_token = undefined;
        webex.credentials.supertoken.refresh_token = undefined;

        webex.credentials.getOrgId = sinon.stub().returns(webexUser.orgId);

        return (
          services
            .initServiceCatalogs()
            // services#updateServices() gets called once by the limited catalog
            // retrieval and should not be called again when not authorized.
            .then(() => assert.calledOnce(services.updateServices))
        );
      });

      it('should call services#updateServices() when authed', () => {
        services.updateServices = sinon.stub().resolves();

        return (
          services
            .initServiceCatalogs()
            // services#updateServices() gets called once by the limited catalog
            // retrieval and should get called again when authorized.
            .then(() => assert.calledTwice(services.updateServices))
        );
      });
    });

    describe('#isServiceUrl()', () => {
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
        testUrl = new ServiceUrl(testUrlTemplate);
        catalog._loadServiceUrls('preauth', [testUrl]);
      });

      it('returns true if url is a service url', () => {
        assert.isTrue(services.isServiceUrl(testUrlTemplate.defaultUrl));
      });

      it('returns true for priority host urls', () => {
        assert.isTrue(services.isServiceUrl(testUrl.get(true)));
      });

      it("returns undefined if the url doesn't exist", () => {
        assert.isFalse(services.isServiceUrl('https://na.com/'));
      });

      it('returns undefined if the param is not a url', () => {
        assert.isFalse(services.isServiceUrl('not a url'));
      });
    });

    describe('#isAllowedDomainUrl()', () => {
      let list;

      beforeEach(() => {
        catalog.setAllowedDomains(['some-domain-a', 'some-domain-b']);

        list = catalog.getAllowedDomains();
      });

      it('returns a boolean', () => {
        assert.isBoolean(services.isAllowedDomainUrl(''));
      });

      it('returns true if the url contains an allowed domain', () => {
        assert.isTrue(services.isAllowedDomainUrl(`https://${list[0]}/resource`));
      });

      it('returns false if the url does not contain an allowed domain', () => {
        assert.isFalse(services.isAllowedDomainUrl('https://bad-domain/resource'));
      });
    });

    describe('#convertUrlToPriorityUrl', () => {
      let testUrl;
      let testUrlTemplate;

      beforeEach('load test url', () => {
        testUrlTemplate = {
          defaultUrl: 'https://www.example.com/api/v1',
          hosts: [
            {
              homeCluster: true,
              host: 'www.example-p5.com',
              ttl: -1,
              priority: 5,
              id: '0:0:cluster-a:exampleValid',
            },
            {
              host: 'www.example-p3.com',
              ttl: -1,
              priority: 3,
              id: '0:0:cluster-b:exampleValid',
            },
          ],
          name: 'exampleValid',
        };
        testUrl = new ServiceUrl(testUrlTemplate);
        catalog._loadServiceUrls('preauth', [testUrl]);
      });

      it('converts the url to a priority host url', () => {
        const resource = 'path/to/resource';
        const url = `${testUrlTemplate.defaultUrl}/${resource}`;

        const convertUrl = services.convertUrlToPriorityHostUrl(url);

        assert.isDefined(convertUrl);
        assert.isTrue(convertUrl.includes(testUrlTemplate.hosts[0].host));
      });

      it('throws an exception if not a valid service', () => {
        assert.throws(services.convertUrlToPriorityHostUrl, Error);

        assert.throws(
          services.convertUrlToPriorityHostUrl.bind(services, 'not-a-valid-service'),
          Error
        );
      });

      afterEach('unload test url', () => {
        catalog._unloadServiceUrls('preauth', [testUrl]);
      });
    });

    describe('#markFailedUrl()', () => {
      let testUrlTemplate;
      let testUrl;

      beforeEach('load test url', () => {
        catalog.clean();

        testUrlTemplate = {
          defaultUrl: 'https://www.example-phr.com/api/v1',
          hosts: [
            {
              host: 'www.example-phr-p5.com',
              ttl: -1,
              priority: 5,
              homeCluster: true,
            },
            {
              host: 'www.example-phr-p3.com',
              ttl: -1,
              priority: 3,
              homeCluster: true,
            },
          ],
          name: 'exampleValid-phr',
        };
        testUrl = new ServiceUrl(testUrlTemplate);
        catalog._loadServiceUrls('preauth', [testUrl]);
      });

      afterEach('unload test url', () => {
        catalog._unloadServiceUrls('preauth', [testUrl]);
      });

      it('marks a host as failed', () => {
        const priorityServiceUrl = catalog._getUrl(testUrlTemplate.name);
        const priorityUrl = priorityServiceUrl._getPriorityHostUrl();

        services.markFailedUrl(priorityUrl);

        const failedHost = priorityServiceUrl.hosts.find((host) => host.failed);

        assert.isTrue(priorityUrl.includes(failedHost.host));
      });

      it('returns the next priority url', () => {
        const priorityUrl = services.get(testUrlTemplate.name, true);

        const nextPriorityUrl = services.markFailedUrl(priorityUrl);

        assert.notEqual(priorityUrl, nextPriorityUrl);
      });

      it('should reset hosts once all hosts have been marked failed', () => {
        const priorityServiceUrl = catalog._getUrl(testUrlTemplate.name);
        const firstPriorityUrl = priorityServiceUrl._getPriorityHostUrl();

        priorityServiceUrl.hosts.forEach(() => {
          const priorityUrl = priorityServiceUrl._getPriorityHostUrl();

          services.markFailedUrl(priorityUrl);
        });

        const lastPriorityUrl = priorityServiceUrl._getPriorityHostUrl();

        assert.equal(firstPriorityUrl, lastPriorityUrl);
      });
    });

    describe('#updateServices()', () => {
      it('returns a Promise that and resolves on success', (done) => {
        const servicesPromise = services.updateServices();

        assert.typeOf(servicesPromise, 'Promise');

        servicesPromise.then(() => {
          Object.keys(services.list()).forEach((key) => {
            assert.typeOf(key, 'string');
            assert.typeOf(services.list()[key], 'string');
          });

          done();
        });
      });

      it('updates the services list', (done) => {
        catalog.serviceGroups.postauth = [];

        services.updateServices().then(() => {
          assert.isAbove(catalog.serviceGroups.postauth.length, 0);
          done();
        });

        services.updateServices();
      });

      it('updates query.email to be emailhash-ed using SHA256', (done) => {
        catalog.updateServiceUrls = sinon.stub().returns({}); // returns `this`
        services._fetchNewServiceHostmap = sinon.stub().resolves();

        services
          .updateServices({
            from: 'limited',
            query: {email: webexUser.email},
          })
          .then(() => {
            assert.calledWith(
              services._fetchNewServiceHostmap,
              sinon.match.has('query', {emailhash: sinon.match(/\b[A-Fa-f0-9]{64}\b/)})
            );
            done();
          });
      });

      it('updates the limited catalog when email is provided', (done) => {
        catalog.serviceGroups.preauth = [];

        services
          .updateServices({
            from: 'limited',
            query: {email: webexUser.email},
          })
          .then(() => {
            assert.isAbove(catalog.serviceGroups.preauth.length, 0);
            done();
          });
      });

      it('updates the limited catalog when userId is provided', (done) => {
        catalog.serviceGroups.preauth = [];

        services
          .updateServices({
            from: 'limited',
            query: {userId: webexUser.id},
          })
          .then(() => {
            assert.isAbove(catalog.serviceGroups.preauth.length, 0);
            done();
          });
      });

      it('updates the limited catalog when orgId is provided', (done) => {
        catalog.serviceGroups.preauth = [];

        services
          .updateServices({
            from: 'limited',
            query: {orgId: webexUser.orgId},
          })
          .then(() => {
            assert.isAbove(catalog.serviceGroups.preauth.length, 0);
            done();
          });
      });
      it('updates the limited catalog when query param mode is provided', (done) => {
        catalog.serviceGroups.preauth = [];

        services
          .updateServices({
            from: 'limited',
            query: {mode: 'DEFAULT_BY_PROXIMITY'},
          })
          .then(() => {
            assert.isAbove(catalog.serviceGroups.preauth.length, 0);
            done();
          });
      });
      it('does not update the limited catalog when nothing is provided', () => {
        catalog.serviceGroups.preauth = [];

        return services
          .updateServices({from: 'limited'})
          .then(() => {
            assert(false, 'resolved, should have thrown');
          })
          .catch(() => {
            assert(true);
          });
      });

      it('updates limited catalog and calls _fetchNewServiceHostmap with forceRefresh = true', (done) => {
        const forceRefresh = true;
        const fetchNewServiceHostmapSpy = sinon.spy(services, '_fetchNewServiceHostmap');

        services
          .updateServices({
            from: 'limited',
            query: {email: webexUser.email},
            forceRefresh,
          })
          .then(() => {
            assert.calledOnce(fetchNewServiceHostmapSpy);
            assert.calledWith(
              fetchNewServiceHostmapSpy,
              sinon.match.has(
                'from',
                'limited',
                'query',
                {emailhash: sinon.match(/\b[A-Fa-f0-9]{64}\b/)},
                'forceFresh',
                forceRefresh
              )
            );

            fetchNewServiceHostmapSpy.returnValues[0].then((res) => {
              assert.isAbove(res.length, 0);
            });
            done();
          });
      });
    });

    describe('#fetchClientRegionInfo()', () => {
      it('returns client region info', () =>
        services.fetchClientRegionInfo().then((r) => {
          assert.isDefined(r.countryCode);
          assert.isDefined(r.timezone);
        }));
    });

    describe('#validateUser()', () => {
      const unauthWebex = new WebexCore();
      const unauthServices = unauthWebex.internal.services;
      let sandbox = null;

      const getActivationRequest = (requestStub) => {
        const requests = requestStub.args.filter(
          ([request]) => request.service === 'license' && request.resource === 'users/activations'
        );

        assert.strictEqual(requests.length, 1);

        return requests[0][0];
      };

      beforeEach(() => {
        sandbox = sinon.createSandbox();
      });

      afterEach(() => {
        sandbox.restore();
        sandbox = null;
      });

      it('returns a rejected promise when no email is specified', () =>
        unauthServices
          .validateUser({})
          .then(() => {
            assert(false, 'resolved, should have thrown');
          })
          .catch(() => {
            assert(true);
          }));

      it('validates an authorized user and webex instance', () =>
        services.validateUser({email: webexUser.email}).then((r) => {
          assert.hasAllKeys(r, ['activated', 'exists', 'user', 'details']);
          assert.equal(r.activated, true);
          assert.equal(r.exists, true);
        }));

      it('validates an authorized EU user and webex instance', () =>
        servicesEU.validateUser({email: webexUserEU.email}).then((r) => {
          assert.hasAllKeys(r, ['activated', 'exists', 'user', 'details']);
          assert.equal(r.activated, true);
          assert.equal(r.exists, true);
        }));

      it("returns a rejected promise if the provided email isn't valid", () =>
        unauthServices
          .validateUser({email: 'not an email'})
          .then(() => {
            assert(false, 'resolved, should have thrown');
          })
          .catch(() => {
            assert(true);
          }));

      it('validates a non-existing user', () =>
        unauthServices
          .validateUser({email: `Collabctg+webex-js-sdk-${uuid.v4()}@gmail.com`})
          .then((r) => {
            assert.hasAllKeys(r, ['activated', 'exists', 'user', 'details']);
            assert.equal(r.activated, false);
            assert.equal(r.exists, false);
            assert.isAbove(Object.keys(unauthServices.list(false, 'preauth')).length, 0);
            assert.equal(Object.keys(unauthServices.list(false, 'signin')).length, 0);
            assert.equal(Object.keys(unauthServices.list(false, 'postauth')).length, 0);
          }));

      it('validates new user with activationOptions suppressEmail false', () =>
        unauthServices
          .validateUser({
            email: `Collabctg+webex-js-sdk-${uuid.v4()}@gmail.com`,
            activationOptions: {suppressEmail: false},
          })
          .then((r) => {
            assert.hasAllKeys(r, ['activated', 'exists', 'user', 'details']);
            assert.equal(r.activated, false);
            assert.equal(r.exists, false);
            assert.equal(r.user.verificationEmailTriggered, true);
            assert.isAbove(Object.keys(unauthServices.list(false, 'preauth')).length, 0);
            assert.equal(Object.keys(unauthServices.list(false, 'signin')).length, 0);
            assert.equal(Object.keys(unauthServices.list(false, 'postauth')).length, 0);
          }));

      it('validates new user with activationOptions suppressEmail true', () =>
        unauthServices
          .validateUser({
            email: `Collabctg+webex-js-sdk-${uuid.v4()}@gmail.com`,
            activationOptions: {suppressEmail: true},
          })
          .then((r) => {
            assert.hasAllKeys(r, ['activated', 'exists', 'user', 'details']);
            assert.equal(r.activated, false);
            assert.equal(r.exists, false);
            assert.equal(r.user.verificationEmailTriggered, false);
            assert.isAbove(Object.keys(unauthServices.list(false, 'preauth')).length, 0);
            assert.equal(Object.keys(unauthServices.list(false, 'signin')).length, 0);
            assert.equal(Object.keys(unauthServices.list(false, 'postauth')).length, 0);
          }));

      it('validates an inactive user', () => {
        const inactive = 'webex.web.client+nonactivated@gmail.com';

        return unauthServices
          .validateUser({email: inactive, activationOptions: {suppressEmail: true}})
          .then((r) => {
            assert.hasAllKeys(r, ['activated', 'exists', 'user', 'details']);
            assert.equal(r.activated, false, 'activated');
            assert.equal(r.exists, true, 'exists');
            assert.isAbove(Object.keys(unauthServices.list(false, 'preauth')).length, 0);
            assert.equal(Object.keys(unauthServices.list(false, 'signin')).length, 0);
            assert.equal(Object.keys(unauthServices.list(false, 'postauth')).length, 0);
          })
          .catch(() => {
            assert(true);
          });
      });

      it('validates an existing user', () =>
        unauthServices.validateUser({email: webexUser.email}).then((r) => {
          assert.hasAllKeys(r, ['activated', 'exists', 'user', 'details']);
          assert.equal(r.activated, true);
          assert.equal(r.exists, true);
          assert.isAbove(Object.keys(unauthServices.list(false, 'preauth')).length, 0);
          assert.isAbove(Object.keys(unauthServices.list(false, 'signin')).length, 0);
          assert.equal(Object.keys(unauthServices.list(false, 'postauth')).length, 0);
        }));

      it('validates an existing EU user', () =>
        unauthServices.validateUser({email: webexUserEU.email}).then((r) => {
          assert.hasAllKeys(r, ['activated', 'exists', 'user', 'details']);
          assert.equal(r.activated, true);
          assert.equal(r.exists, true);
          assert.isAbove(Object.keys(unauthServices.list(false, 'preauth')).length, 0);
          assert.isAbove(Object.keys(unauthServices.list(false, 'signin')).length, 0);
          assert.equal(Object.keys(unauthServices.list(false, 'postauth')).length, 0);
        }));

      it('sends the prelogin user id as undefined when not specified', () => {
        const requestStub = sandbox.spy(unauthServices, 'request');

        return unauthServices
          .validateUser({
            email: `Collabctg+webex-js-sdk-${uuid.v4()}@gmail.com`,
            activationOptions: {suppressEmail: true},
          })
          .then(() => {
            assert.isUndefined(getActivationRequest(requestStub).headers['x-prelogin-userid']);
          });
      });

      it('sends the prelogin user id as provided when specified', () => {
        const requestStub = sandbox.spy(unauthServices, 'request');
        const preloginUserId = uuid.v4();

        return unauthServices
          .validateUser({
            email: `Collabctg+webex-js-sdk-${uuid.v4()}@gmail.com`,
            activationOptions: {suppressEmail: true},
            preloginUserId,
          })
          .then(() => {
            assert.strictEqual(
              getActivationRequest(requestStub).headers['x-prelogin-userid'],
              preloginUserId
            );
          });
      });
    });

    describe('#waitForService()', () => {
      let name;
      let url;

      describe('when the service exists', () => {
        beforeEach('collect valid service info', () => {
          name = Object.keys(services.list())[0];
          url = services.list(true)[name];
        });

        describe('when using the name parameter property', () => {
          it('should resolve to the appropriate url', () =>
            services.waitForService({name}).then((foundUrl) => assert.equal(foundUrl, url)));
        });

        describe('when using the url parameter property', () => {
          it('should resolve to the appropriate url', () =>
            services.waitForService({url}).then((foundUrl) => assert.equal(foundUrl, url)));
        });

        describe('when using the url and name parameter properties', () => {
          it('should resolve to the appropriate url', () =>
            services.waitForService({name, url}).then((foundUrl) => assert.equal(foundUrl, url)));
        });
      });

      describe('when the service does not exist', () => {
        let timeout;

        beforeEach('set up the parameters', () => {
          name = 'not a service';
          url = 'http://not-a-service.com/resource';
          timeout = 1;
        });

        describe('when using the url parameter property', () => {
          it('should return a resolve promise', () =>
            // const waitForService = services.waitForService({url, timeout});

            services.waitForService({url, timeout}).then((foundUrl) => {
              assert.equal(foundUrl, url);
              assert.isTrue(catalog.isReady);
            }));
        });

        describe('when using the name parameter property', () => {
          it('should return a rejected promise', () => {
            const submitMetrics = sinon.stub(webex.internal.metrics, 'submitClientMetrics');
            const waitForService = services.waitForService({name, timeout});

            assert.called(submitMetrics);
            assert.isRejected(waitForService);
            assert.isTrue(catalog.isReady);
          });
        });

        describe('when using the name and url parameter properties', () => {
          it('should return a rejected promise', () => {
            const waitForService = services.waitForService({
              name,
              url,
              timeout,
            });

            assert.isRejected(waitForService);
            assert.isTrue(catalog.isReady);
          });
        });

        describe('when the service will exist', () => {
          beforeEach('collect existing service and clear the catalog', () => {
            name = 'metrics';
            url = services.get(name, true);
            catalog.clean();
            catalog.isReady = false;
          });

          describe('when only the preauth (limited) catalog becomes available', () => {
            describe('when using the name parameter property', () => {
              it('should resolve to the appropriate url', () =>
                Promise.all([
                  services.waitForService({name}),
                  services.collectPreauthCatalog(),
                ]).then(([foundUrl]) => assert.equal(foundUrl, url)));
            });

            describe('when using the url parameter property', () => {
              it('should resolve to the appropriate url', () =>
                Promise.all([
                  services.waitForService({url}),
                  services.collectPreauthCatalog(),
                ]).then(([foundUrl]) => assert.equal(foundUrl, url)));
            });

            describe('when using the name and url parameter property', () => {
              it('should resolve to the appropriate url', () =>
                Promise.all([
                  services.waitForService({name, url}),
                  services.collectPreauthCatalog(),
                ]).then(([foundUrl]) => assert.equal(foundUrl, url)));
            });
          });

          describe('when all catalogs become available', () => {
            describe('when using the name parameter property', () => {
              it('should resolve to the appropriate url', () =>
                Promise.all([services.waitForService({name}), services.initServiceCatalogs()]).then(
                  ([foundUrl]) => assert.equal(foundUrl, url)
                ));
            });

            describe('when using the url parameter property', () => {
              it('should resolve to the appropriate url', () =>
                Promise.all([services.waitForService({url}), services.initServiceCatalogs()]).then(
                  ([foundUrl]) => assert.equal(foundUrl, url)
                ));
            });

            describe('when using the name and url parameter property', () => {
              it('should resolve to the appropriate url', () =>
                Promise.all([
                  services.waitForService({name, url}),
                  services.initServiceCatalogs(),
                ]).then(([foundUrl]) => assert.equal(foundUrl, url)));
            });
          });
        });
      });
    });

    describe('#collectPreauthCatalog()', () => {
      const unauthWebex = new WebexCore({config: {credentials: {federation: true}}});
      const unauthServices = unauthWebex.internal.services;
      const forceRefresh = true;

      it('updates the preauth catalog without email', () =>
        unauthServices.collectPreauthCatalog().then(() => {
          assert.isAbove(Object.keys(unauthServices.list()).length, 0);
        }));

      it('updates the preauth catalog with email', () =>
        unauthServices.collectPreauthCatalog({email: webexUser.email}).then(() => {
          assert.isAbove(Object.keys(unauthServices.list()).length, 0);
        }));

      it('updates the preauth catalog with email along with additional timestamp to address cache control', (done) => {
        const updateServiceSpy = sinon.spy(unauthServices, 'updateServices');
        const fetchNewServiceHostmapSpy = sinon.spy(unauthServices, '_fetchNewServiceHostmap');

        unauthServices.collectPreauthCatalog({email: webexUser.email}, forceRefresh).then(() => {
          assert.calledOnce(updateServiceSpy);
          assert.calledWith(
            updateServiceSpy,
            sinon.match.has(
              'from',
              'limited',
              'query',
              {emailhash: sinon.match(/\b[A-Fa-f0-9]{64}\b/)},
              'forceRefresh',
              forceRefresh
            )
          );

          assert.calledOnce(fetchNewServiceHostmapSpy);
          assert.calledWith(
            fetchNewServiceHostmapSpy,
            sinon.match.has(
              'from',
              'limited',
              'query',
              {emailhash: sinon.match(/\b[A-Fa-f0-9]{64}\b/)},
              'forceRefresh',
              forceRefresh
            )
          );

          fetchNewServiceHostmapSpy.returnValues[0].then((res) => {
            assert.isAbove(res.length, 0);
          });
          done();
        });
      });
    });

    describe('#collectSigninCatalog()', () => {
      const unauthWebex = new WebexCore({config: {credentials: {federation: true}}});
      const unauthServices = unauthWebex.internal.services;

      it('requires an email as the parameter', () =>
        unauthServices.collectPreauthCatalog().catch((e) => {
          assert(true, e);
        }));

      it('requires a token as the parameter', () =>
        unauthServices.collectPreauthCatalog({email: 'email@website.com'}).catch((e) => {
          assert(true, e);
        }));

      it('updates the preauth catalog', () =>
        unauthServices.collectPreauthCatalog({email: webexUser.email}).then(() => {
          assert.isAbove(Object.keys(unauthServices.list()).length, 0);
        }));
    });

    flaky(describe, process.env.SKIP_FLAKY_TESTS)('#_fetchNewServiceHostmap()', () => {
      let fullRemoteHM;
      let limitedRemoteHM;

      before('collect remote catalogs', () =>
        Promise.all([
          services._fetchNewServiceHostmap(),
          services._fetchNewServiceHostmap({
            from: 'limited',
            query: {userId: webexUser.id},
          }),
        ]).then(([fRHM, lRHM]) => {
          fullRemoteHM = fRHM;
          limitedRemoteHM = lRHM;
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
          })
          .catch((e) => {
            assert.typeOf(e, 'Error');
          }));
    });
  });
});
/* eslint-enable no-underscore-dangle */

// /*!
//  * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
//  */

import '@webex/internal-plugin-device';

import {assert} from '@webex/test-helper-chai';
import {flaky} from '@webex/test-helper-mocha';
import WebexCore, {
  ServiceCatalogV2,
  ServiceDetail,
  serviceConstants,
  registerInternalPlugin,
  Services,
  ServiceInterceptor,
  ServerErrorInterceptor,
  ServicesV2,
} from '@webex/webex-core';
import testUsers from '@webex/test-helper-test-users';
import uuid from 'uuid';
import sinon from 'sinon';
import {formattedServiceHostmapEntryConv} from '../../../fixtures/host-catalog-v2';

// /* eslint-disable no-underscore-dangle */
describe('webex-core', () => {
  describe('ServicesV2', () => {
    let webexUser;
    let webexUserEU;
    let webex;
    let webexEU;
    let services;
    let servicesEU;
    let catalog;
    let catalogEU;

    before('create users', () =>
      Promise.all([
        testUsers.create({count: 1}),
        testUsers.create({
          count: 1,
          config: {
            orgId: process.env.EU_PRIMARY_ORG_ID,
          },
        }),
      ]).then(
        ([[user], [userEU]]) =>
          new Promise((resolve) => {
            setTimeout(() => {
              webexUser = user;
              webexUserEU = userEU;
              resolve();
            }, 1000);
          })
      )
    );

    beforeEach(() => {
      registerInternalPlugin('services', ServicesV2, {
        interceptors: {
          ServiceInterceptor: ServiceInterceptor.create,
          ServerErrorInterceptor: ServerErrorInterceptor.create,
        },
        replace: true,
      });
      webex = new WebexCore({credentials: {supertoken: webexUser.token}});
      webexEU = new WebexCore({credentials: {supertoken: webexUserEU.token}});
      services = webex.internal.services;
      servicesEU = webexEU.internal.services;
      catalog = services._getCatalog();
      catalogEU = servicesEU._getCatalog();

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

    afterEach(() => {
      registerInternalPlugin('services', Services, {
        interceptors: {
          ServiceInterceptor: ServiceInterceptor.create,
          ServerErrorInterceptor: ServerErrorInterceptor.create,
        },
        replace: true,
      });
      services = webex.internal.services;
      servicesEU = webexEU.internal.services;
      catalog = services._getCatalog();
      catalogEU = servicesEU._getCatalog();
    });

    describe('#_getCatalog()', () => {
      it('returns a catalog', () => {
        const localCatalog = services._getCatalog();

        assert.equal(localCatalog.namespace, 'ServiceCatalog');
      });
    });

    describe('#get()', () => {
      let testDetailTemplate;
      let testDetail;

      beforeEach(() => {
        testDetailTemplate = formattedServiceHostmapEntryConv;
        testDetail = new ServiceDetail(testDetailTemplate);
        catalog._loadServiceDetails('preauth', [testDetail]);
        services._activeServices = {
          [testDetailTemplate.serviceName]: testDetailTemplate.id,
        };
      });

      afterEach(() => {
        catalog._unloadServiceDetails('preauth', [testDetail]);
      });

      it('returns a valid string when name is specified', () => {
        const url = services.get(testDetailTemplate.serviceName);

        assert.typeOf(url, 'string');
        assert.equal(url, testDetail.get());
      });

      it("returns undefined if url doesn't exist", () => {
        const s = services.get('invalidUrl');

        assert.typeOf(s, 'undefined');
      });

      it('gets a service from a specific serviceGroup', () => {
        assert.isDefined(services.get(testDetailTemplate.serviceName, 'preauth'));
      });

      it("fails to get a service if serviceGroup isn't accurate", () => {
        assert.isUndefined(services.get(testDetailTemplate.serviceName, 'discovery'));
      });
    });

    describe('#getClusterId()', () => {
      let testDetailTemplate;
      let testDetail;

      beforeEach(() => {
        testDetailTemplate = formattedServiceHostmapEntryConv;
        testDetail = new ServiceDetail(testDetailTemplate);
        catalog._loadServiceDetails('preauth', [testDetail]);
      });

      it('returns a clusterId when found with url', () => {
        assert.equal(services.getClusterId(testDetail.get()), testDetail.id);
      });

      it('returns a clusterId when found with resource-appended url', () => {
        assert.equal(
          services.getClusterId(`${testDetail.get()}example/resource/value`),
          testDetail.id
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
      let testDetailTemplate;
      let testDetail;

      beforeEach(() => {
        testDetailTemplate = formattedServiceHostmapEntryConv;
        testDetail = new ServiceDetail(testDetailTemplate);
        catalog._loadServiceDetails('preauth', [testDetail]);
      });

      it('finds a valid service url from only a clusterId', () => {
        const serviceFound = services.getServiceFromClusterId({
          clusterId: testDetailTemplate.id,
        });

        assert.equal(serviceFound.name, testDetail.serviceName);
        assert.equal(serviceFound.url, testDetail.get());
      });

      it('finds a valid service when a service group is defined', () => {
        const serviceFound = catalog.findServiceFromClusterId({
          clusterId: testDetailTemplate.id,
          serviceGroup: 'preauth',
        });

        assert.equal(serviceFound.name, testDetail.serviceName);
        assert.equal(serviceFound.url, testDetail.get());
      });

      it("fails to find a valid service when it's not in a group", () => {
        assert.isUndefined(
          services.getServiceFromClusterId({
            clusterId: testDetailTemplate.id,
            serviceGroup: 'signin',
          })
        );
      });

      it("returns undefined when service doesn't exist", () => {
        assert.isUndefined(services.getServiceFromClusterId({clusterId: 'not a clusterId'}));
      });
    });

    describe('#getServiceFromUrl()', () => {
      let testDetailTemplate;
      let testDetail;

      beforeEach(() => {
        testDetailTemplate = formattedServiceHostmapEntryConv;
        testDetail = new ServiceDetail(testDetailTemplate);
        catalog._loadServiceDetails('preauth', [testDetail]);
      });

      afterEach(() => {
        catalog._unloadServiceDetails('preauth', [testDetail]);
      });

      it('gets a valid service object from an existing service', () => {
        const serviceObject = services.getServiceFromUrl(testDetail.get());

        assert.isDefined(serviceObject);
        assert.hasAllKeys(serviceObject, ['name', 'defaultUrl', 'priorityUrl']);

        assert.equal(testDetailTemplate.serviceName, serviceObject.name);
        assert.equal(testDetail.get(true), serviceObject.defaultUrl);
        assert.equal(testDetail.get(true), serviceObject.priorityUrl);
      });

      it("returns undefined when the service url doesn't exist", () => {
        const serviceObject = services.getServiceFromUrl('http://www.not-real.com/');

        assert.isUndefined(serviceObject);
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

        const expectedResult = [...allowedDomains, ...serviceConstants.COMMERCIAL_ALLOWED_DOMAINS];

        assert.deepEqual(expectedResult, services._getCatalog().allowedDomains);
      });
    });

    describe('#initialize()', () => {
      it('should create a catalog', () =>
        assert.instanceOf(services._getCatalog(), ServiceCatalogV2));

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
        assert.notDeepEqual(catalog._getAllServiceDetails(), catalogEU._getAllServiceDetails()));

      it('should not attempt to collect catalogs without authorization', (done) => {
        const otherWebex = new WebexCore();
        const initServiceCatalogs = sinon.stub(otherWebex.internal.services, 'initServiceCatalogs');

        setTimeout(() => {
          assert.notCalled(initServiceCatalogs);
          assert.isFalse(otherWebex.internal.services._getCatalog().isReady);
          otherWebex.internal.services.initServiceCatalogs.restore();
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

    describe('#isAllowedDomainUrl()', () => {
      let list;

      beforeEach(() => {
        catalog.setAllowedDomains(['some-domain-a', 'some-domain-b']);

        list = catalog.getAllowedDomains();
      });

      it('returns a boolean', () => {
        assert.isBoolean(services.isAllowedDomainUrl('https://not-a-domain/resource'));
      });

      it('returns true if the url contains an allowed domain', () => {
        assert.isTrue(services.isAllowedDomainUrl(`https://${list[0]}/resource`));
      });

      it('returns false if the url does not contain an allowed domain', () => {
        assert.isFalse(services.isAllowedDomainUrl('https://bad-domain/resource'));
      });
    });

    describe('#convertUrlToPriorityUrl', () => {
      let testDetail;
      let testDetailTemplate;

      beforeEach(() => {
        testDetailTemplate = formattedServiceHostmapEntryConv;
        testDetail = new ServiceDetail(testDetailTemplate);
        catalog._loadServiceDetails('preauth', [testDetail]);
      });

      it('converts the url to a priority host url', () => {
        const resource = 'path/to/resource';
        const url = `${testDetailTemplate.serviceUrls[1].baseUrl}/${resource}`;

        const convertUrl = services.convertUrlToPriorityHostUrl(url);

        assert.isDefined(convertUrl);
        assert.isTrue(convertUrl.includes(testDetail.get()));
      });

      it('throws an exception if not a valid service', () => {
        assert.throws(services.convertUrlToPriorityHostUrl, Error);

        assert.throws(
          services.convertUrlToPriorityHostUrl.bind(services, 'not-a-valid-service'),
          Error
        );
      });

      afterEach(() => {
        catalog._unloadServiceDetails('preauth', [testDetail]);
      });
    });

    describe('#markFailedUrl()', () => {
      let testDetailTemplate;
      let testDetail;

      beforeEach(() => {
        catalog.clean();

        testDetailTemplate = formattedServiceHostmapEntryConv;
        testDetail = new ServiceDetail(testDetailTemplate);
        catalog._loadServiceDetails('preauth', [testDetail]);
      });

      afterEach(() => {
        catalog._unloadServiceDetails('preauth', [testDetail]);
      });

      it('marks a host as failed', () => {
        const priorityServiceUrl = catalog._getServiceDetail(testDetailTemplate.id);
        const priorityUrl = priorityServiceUrl._getPriorityHostUrl();

        services.markFailedUrl(priorityUrl);

        const failedHost = priorityServiceUrl.serviceUrls.find((host) => host.failed);

        assert.isTrue(priorityUrl.includes(failedHost.host));
      });

      it('returns the next priority url', () => {
        const priorityUrl = services.get(testDetailTemplate.id);

        const nextPriorityUrl = services.markFailedUrl(priorityUrl);

        assert.notEqual(priorityUrl, nextPriorityUrl);
      });

      it('should reset hosts once all hosts have been marked failed', () => {
        const priorityServiceUrl = catalog._getServiceDetail(testDetailTemplate.id);
        const firstPriorityUrl = priorityServiceUrl._getPriorityHostUrl();

        priorityServiceUrl.serviceUrls.forEach(() => {
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
          services._services.forEach((service) => {
            assert.typeOf(service.serviceName, 'string');
            assert.typeOf(service.id, 'string');
            assert.typeOf(service.serviceUrls, 'array');
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
      });

      it('updates query.email to be emailhash-ed using SHA256', (done) => {
        const updateStub = sinon.stub(catalog, 'updateServiceGroups').returnsThis();
        const fetchStub = sinon.stub(services, '_fetchNewServiceHostmap').resolves();

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
          })
          .finally(() => {
            updateStub.restore();
            fetchStub.restore();
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
          assert.isDefined(r.regionCode);
          assert.isDefined(r.clientAddress);
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
          }));

      it.skip('validates new user with activationOptions suppressEmail true', () =>
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
          }));

      it('validates an inactive user', () => {
        const inactive = 'webex.web.client+nonactivated@gmail.com';

        return unauthServices
          .validateUser({email: inactive, activationOptions: {suppressEmail: true}})
          .then((r) => {
            assert.hasAllKeys(r, ['activated', 'exists', 'user', 'details']);
            assert.equal(r.activated, false, 'activated');
            assert.equal(r.exists, true, 'exists');
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
        }));

      it('validates an existing EU user', () =>
        unauthServices.validateUser({email: webexUserEU.email}).then((r) => {
          assert.hasAllKeys(r, ['activated', 'exists', 'user', 'details']);
          assert.equal(r.activated, true);
          assert.equal(r.exists, true);
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
        beforeEach(() => {
          name = Object.keys(services._activeServices)[0];
          const clusterId = services._activeServices[name];
          url = catalog.get(clusterId);
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

        beforeEach(() => {
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
          afterEach(() => {
            webex.internal.metrics.submitClientMetrics.restore();
          });

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
          beforeEach(() => {
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
        unauthServices.collectSigninCatalog().catch((e) => {
          assert(true, e);
        }));

      it('requires a token as the parameter', () =>
        unauthServices.collectSigninCatalog({email: 'email@website.com'}).catch((e) => {
          assert(true, e);
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
// /* eslint-enable no-underscore-dangle */

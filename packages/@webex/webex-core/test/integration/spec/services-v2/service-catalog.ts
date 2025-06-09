/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';

import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import WebexCore, {ServiceDetail} from '@webex/webex-core';
import testUsers from '@webex/test-helper-test-users';
import {
  formattedServiceHostmapEntryConv,
  formattedServiceHostmapV2,
  serviceHostmapV2,
} from '../../../fixtures/host-catalog-v2';

describe('webex-core', () => {
  describe('ServiceCatalogV2', () => {
    let webexUser;
    let webex;
    let services;
    let catalog;

    before('create users', () =>
      testUsers
        .create({count: 1})
        .then(
          ([user]) =>
            new Promise<void>((resolve) => {
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

      it('returns a ServiceUrl from a specific serviceGroup', () => {
        const serviceDetail = catalog._getUrl(testDetailTemplate.id, 'preauth');

        assert.equal(serviceDetail.serviceUrls, testDetailTemplate.serviceUrls);
        assert.equal(serviceDetail.id, testDetailTemplate.id);
        assert.equal(serviceDetail.serviceName, testDetailTemplate.serviceName);
      });

      it("returns undefined if url doesn't exist", () => {
        const serviceDetail = catalog._getUrl('invalidUrl');

        assert.typeOf(serviceDetail, 'undefined');
      });

      it("returns undefined if url doesn't exist in serviceGroup", () => {
        const serviceDetail = catalog._getUrl(testDetailTemplate.id, 'Discovery');

        assert.typeOf(serviceDetail, 'undefined');
      });
    });

    describe('#findClusterId()', () => {
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

      it('returns a home cluster clusterId when found with default url', () => {
        assert.equal(
          catalog.findClusterId(testDetailTemplate.serviceUrls[0].baseUrl),
          testDetailTemplate.id
        );
      });

      it('returns a clusterId when found with priority host url', () => {
        assert.equal(catalog.findClusterId(testDetail.get()), testDetailTemplate.id);
      });

      it('returns a clusterId when found with resource-appended url', () => {
        assert.equal(
          catalog.findClusterId(`${testDetail.get()}example/resource/value`),
          testDetailTemplate.id
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

      it('finds a valid service url from only a clusterId', () => {
        const serviceFound = catalog.findServiceFromClusterId({
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
          catalog.findServiceFromClusterId({
            clusterId: testDetailTemplate.id,
            serviceGroup: 'signin',
          })
        );
      });

      it("returns undefined when service doesn't exist", () => {
        assert.isUndefined(catalog.findServiceFromClusterId({clusterId: 'not a clusterId'}));
      });

      describe('#findServiceDetailFromUrl()', () => {
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

        it('finds a service if it exists', () => {
          assert.equal(
            catalog.findServiceDetailFromUrl(testDetailTemplate.serviceUrls[1].baseUrl),
            testDetail
          );
        });

        it('finds a service if its a priority host url', () => {
          assert.equal(catalog.findServiceDetailFromUrl(testDetail.get()), testDetail);
        });

        it("returns undefined if the url doesn't exist", () => {
          assert.isUndefined(catalog.findServiceDetailFromUrl('https://na.com/'));
        });

        it('returns undefined if the param is not a url', () => {
          assert.isUndefined(catalog.findServiceDetailFromUrl('not a url'));
        });
      });

      describe('#get()', () => {
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

        it('returns a valid string when name is specified', () => {
          const url = catalog.get(testDetailTemplate.id);

          assert.typeOf(url, 'string');
          assert.equal(url, testDetailTemplate.serviceUrls[0].baseUrl);
        });

        it("returns undefined if url doesn't exist", () => {
          const s = catalog.get('invalidUrl');

          assert.typeOf(s, 'undefined');
        });

        it('calls _getServiceDetail', () => {
          sinon.spy(catalog, '_getServiceDetail');

          catalog.get();

          assert.called(catalog._getServiceDetail);
        });

        it('gets a service from a specific serviceGroup', () => {
          assert.isDefined(catalog.get(testDetailTemplate.id, 'preauth'));
        });

        it("fails to get a service if serviceGroup isn't accurate", () => {
          assert.isUndefined(catalog.get(testDetailTemplate.id, 'discovery'));
        });
      });

      describe('#markFailedServiceUrl()', () => {
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

        it('marks a host as failed', () => {
          const priorityUrl = catalog.get(testDetailTemplate.id, true);

          catalog.markFailedUrl(priorityUrl);

          const failedHost = testDetail.hosts.find((host) => host.failed);

          assert.isDefined(failedHost);
        });

        it('returns the next priority url', () => {
          const priorityUrl = catalog.get(testDetailTemplate.id, true);
          const nextPriorityUrl = catalog.markFailedUrl(priorityUrl);

          assert.notEqual(priorityUrl, nextPriorityUrl);
        });
      });

      describe('#_loadServiceDetails()', () => {
        let testDetailTemplate;
        let testDetail;

        beforeEach(() => {
          testDetailTemplate = formattedServiceHostmapEntryConv;
          testDetail = new ServiceDetail(testDetailTemplate);
        });

        it('appends services to different service groups', () => {
          catalog._loadServiceDetails('postauth', [testDetail]);
          catalog._loadServiceDetails('preauth', [testDetail]);
          catalog._loadServiceDetails('discovery', [testDetail]);

          catalog.serviceGroups.postauth.includes(testDetail);
          catalog.serviceGroups.preauth.includes(testDetail);
          catalog.serviceGroups.discovery.includes(testDetail);

          catalog._unloadServiceDetails('postauth', [testDetail]);
          catalog._unloadServiceDetails('preauth', [testDetail]);
          catalog._unloadServiceDetails('discovery', [testDetail]);
        });
      });

      describe('#_unloadServiceDetails()', () => {
        let testDetailTemplate;
        let testDetail;

        beforeEach(() => {
          testDetailTemplate = formattedServiceHostmapEntryConv;
          testDetail = new ServiceDetail(testDetailTemplate);
        });

        it('appends services to different service groups', () => {
          catalog._loadServiceDetails('postauth', [testDetail]);
          catalog._loadServiceDetails('preauth', [testDetail]);
          catalog._loadServiceDetails('discovery', [testDetail]);

          const oBaseLength = catalog.serviceGroups.postauth.length;
          const oLimitedLength = catalog.serviceGroups.preauth.length;
          const oDiscoveryLength = catalog.serviceGroups.discovery.length;

          catalog._unloadServiceDetails('postauth', [testDetail]);
          catalog._unloadServiceDetails('preauth', [testDetail]);
          catalog._unloadServiceDetails('discovery', [testDetail]);

          assert.isAbove(oBaseLength, catalog.serviceGroups.postauth.length);
          assert.isAbove(oLimitedLength, catalog.serviceGroups.preauth.length);
          assert.isAbove(oDiscoveryLength, catalog.serviceGroups.discovery.length);
        });
      });

      // describe('#_fetchNewServiceHostmap()', () => {
      //   let fullRemoteHM;
      //   let limitedRemoteHM;

      //   beforeEach(() =>
      //     Promise.all([
      //       services._fetchNewServiceHostmap(),
      //       services._fetchNewServiceHostmap({
      //         from: 'limited',
      //         query: {userId: webexUser.id},
      //       }),
      //     ]).then(([fRHM, lRHM]) => {
      //       fullRemoteHM = fRHM;
      //       limitedRemoteHM = lRHM;

      //       return Promise.resolve();
      //     })
      //   );

      //   it('resolves to an authed u2c hostmap when no params specified', () => {
      //     assert.typeOf(fullRemoteHM, 'array');
      //     assert.isAbove(fullRemoteHM.length, 0);
      //   });

      //   it('resolves to a limited u2c hostmap when params specified', () => {
      //     assert.typeOf(limitedRemoteHM, 'array');
      //     assert.isAbove(limitedRemoteHM.length, 0);
      //   });

      //   it('rejects if the params provided are invalid', () =>
      //     services
      //       ._fetchNewServiceHostmap({
      //         from: 'limited',
      //         query: {userId: 'notValid'},
      //       })
      //       .then(() => {
      //         assert.isTrue(false, 'should have rejected');

      //         return Promise.reject();
      //       })
      //       .catch((e) => {
      //         assert.typeOf(e, 'Error');

      //         return Promise.resolve();
      //       }));
      // });
    });

    describe('#waitForCatalog()', () => {
      let promise;
      let serviceHostmap;
      let formattedHM;

      beforeEach(() => {
        serviceHostmap = formattedServiceHostmapV2;
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

        catalog.updateServiceGroups('postauth', formattedHM);
      });
    });

    describe('#updateServiceGroups()', () => {
      let serviceHostmap;
      let formattedHM;

      beforeEach(() => {
        serviceHostmap = serviceHostmapV2;
        formattedHM = services._formatReceivedHostmap(serviceHostmap);
      });

      it('removes any unused urls from current services', () => {
        catalog.updateServiceGroups('preauth', formattedHM);

        const originalLength = catalog.serviceGroups.preauth.length;

        catalog.updateServiceGroups('preauth', []);

        assert.isBelow(catalog.serviceGroups.preauth.length, originalLength);
      });

      it('updates the target catalog to contain the provided hosts', () => {
        catalog.updateServiceGroups('preauth', formattedHM);

        assert.equal(catalog.serviceGroups.preauth.length, formattedHM.length);
      });

      it('updates any existing ServiceUrls', () => {
        const newServiceHM = {
          activeServices: {
            'example-a': 'urn:TEAM:us-east-2_a:a',
            'example-b': 'urn:TEAM:us-east-2_a:b',
            'example-c': 'urn:TEAM:us-east-2_a:c',
          },
          services: [
            {
              id: 'urn:TEAM:us-east-2_a:a',
              serviceName: 'example-a',
              serviceUrls: [],
            },
            {
              id: 'urn:TEAM:us-east-2_a:b',
              serviceName: 'example-b',
              serviceUrls: [],
            },
            {
              id: 'urn:TEAM:us-east-2_a:c',
              serviceName: 'example-c',
              serviceUrls: [],
            },
          ],
        };

        const newFormattedHM = services._formatReceivedHostmap(newServiceHM);

        catalog.updateServiceGroups('preauth', formattedHM);

        const oldServiceDetails = catalog._getAllServiceDetails('preauth');

        catalog.updateServiceGroups('preauth', newFormattedHM);

        oldServiceDetails.forEach((serviceDetail) =>
          assert.isTrue(!!formattedHM.find((service) => service.id === serviceDetail.id))
        );

        const newServiceDetails = catalog._getAllServiceDetails('preauth');

        oldServiceDetails.forEach((serviceDetail) =>
          assert.isUndefined(formattedHM.find((service) => service.id === serviceDetail.id))
        );
        newServiceDetails.forEach((serviceDetail) =>
          assert.isTrue(!!newFormattedHM.find((service) => service.id === serviceDetail.id))
        );
      });

      it('creates an array of equal length of services', () => {
        assert.equal(Object.keys(serviceHostmap.activeServices).length, formattedHM.length);
      });

      it('creates an array of equal length of active services', () => {
        assert.equal(serviceHostmap.services.length, formattedHM.length);
      });

      it('creates an array with matching host data', () => {
        Object.values(serviceHostmap.activeServices).forEach((activeServiceVal) => {
          const hostGroup = serviceHostmap.services.find(
            (service) => service.serviceName === activeServiceVal
          );

          assert.isTrue(
            hostGroup,
            `did not find matching host data for the \`${activeServiceVal}\` active service.`
          );
        });
      });

      it('returns self', () => {
        const returnValue = catalog.updateServiceGroups('preauth', formattedHM);

        assert.equal(returnValue, catalog);
      });

      it('triggers authorization events', (done) => {
        catalog.once('preauth', () => {
          assert(true, 'triggered once');
          done();
        });

        catalog.updateServiceGroups('preauth', formattedHM);
      });

      it('updates the services list', (done) => {
        catalog.serviceGroups.preauth = [];

        catalog.once('preauth', () => {
          assert.isAbove(catalog.serviceGroups.preauth.length, 0);
          done();
        });

        catalog.updateServiceGroups('preauth', formattedHM);
      });
    });
  });
});

/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import {ServicesV2, ServiceDetail} from '@webex/webex-core';
import {formattedServiceHostmapEntryConv} from '../../../fixtures/host-catalog-v2';

describe('webex-core', () => {
  describe('ServiceDetail', () => {
    let webex;
    let serviceDetail;
    let template;

    beforeEach(() => {
      webex = new MockWebex();
      new ServicesV2(undefined, {parent: webex});

      template = formattedServiceHostmapEntryConv;

      serviceDetail = new ServiceDetail({...template});
    });

    describe('#namespace', () => {
      it('is accurate to plugin name', () => {
        assert.equal(serviceDetail.namespace, 'ServiceDetail');
      });
    });

    describe('#serviceName', () => {
      it('is valid value', () => {
        assert.typeOf(serviceDetail.serviceName, 'string');
        assert.equal(serviceDetail.serviceName, 'conversation');
      });
    });

    describe('#serviceUrls', () => {
      it('is valid value', () => {
        assert.typeOf(serviceDetail.serviceUrls, 'array');
      });

      it('contains all appended hosts on construction', () => {
        template.serviceUrls.forEach((serviceUrl) => {
          assert.include([...serviceDetail.serviceUrls], serviceUrl);
        });
      });
    });

    describe('#id', () => {
      it('is valid value', () => {
        assert.typeOf(serviceDetail.id, 'string');
        assert.equal(serviceDetail.id, 'urn:TEAM:us-east-2_a:conversation');
      });
    });

    describe('#_generateHostUrl()', () => {
      it('returns a string', () => {
        serviceDetail.serviceUrls.forEach((serviceUrl) => {
          assert.typeOf(serviceDetail._generateHostUrl(serviceUrl), 'string');
        });
      });

      it('replaces the host of a pass in url', () => {
        serviceDetail.serviceUrls.forEach((serviceUrl) => {
          assert.equal(
            serviceDetail._generateHostUrl(serviceUrl),
            `https://${serviceUrl.host}/conversation/api/v1`
          );
        });
      });
    });

    describe('#_getPriorityHostUrl()', () => {
      it('validates that the retrieved high priority host matches the manually retrieved high priority host', () => {
        assert.equal(
          serviceDetail._getPriorityHostUrl(),
          serviceDetail._generateHostUrl(template.serviceUrls[0])
        );
      });

      it('should pick most priority non failed host', () => {
        serviceDetail.serviceUrls[0].failed = true;

        assert.isTrue(serviceDetail.serviceUrls[0].failed);

        const priorityHost = serviceDetail._getPriorityHostUrl();
        assert.equal(priorityHost, serviceDetail.serviceUrls[1].baseUrl);
      });

      it('should reset the hosts when all have failed', () => {
        serviceDetail.serviceUrls.forEach((serviceUrl) => {
          /* eslint-disable-next-line no-param-reassign */
          serviceUrl.failed = true;
        });

        assert.isTrue(serviceDetail.serviceUrls.every((serviceUrl) => serviceUrl.failed));

        const priorityHost = serviceDetail._getPriorityHostUrl();

        assert.equal(priorityHost, serviceDetail.serviceUrls[0].baseUrl);
        assert.isTrue(serviceDetail.serviceUrls.every((serviceUrl) => !serviceUrl.failed));
      });
      it('should return empty string if no available hosts', () => {
        serviceDetail.serviceUrls = [{priority: -1}];

        const priorityHost = serviceDetail.get();

        assert.equal(priorityHost, '');
      });
    });

    describe('#get', () => {
      it('should return empty string if no hosts are available', () => {
        serviceDetail.serviceUrls = [];

        const priorityHost = serviceDetail.get();

        assert.equal(priorityHost, '');
      });
    });

    describe('#failHost()', () => {
      it('marks a host as failed', () => {
        serviceDetail.failHost(serviceDetail.serviceUrls[0].baseUrl);

        const removedHost = serviceDetail.serviceUrls.find(
          (currentHost) => currentHost.host === serviceDetail.serviceUrls[0].host
        );

        assert.isTrue(removedHost.failed);
      });

      it('returns true if hostUrl was found', () => {
        const removedHostResult = serviceDetail.failHost(serviceDetail.serviceUrls[0].baseUrl);

        assert.isTrue(removedHostResult);
      });

      it('returns false if hostUrl was not found', () => {
        const removedHostResult = serviceDetail.failHost('https://someurl.com/api/vq');

        assert.isFalse(removedHostResult);
      });
    });
  });
});

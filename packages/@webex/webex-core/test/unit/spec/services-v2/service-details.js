/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import {ServicesV2, ServiceDetails} from '@webex/webex-core';
import {formattedServiceHostmapEntryConv} from '../../../fixtures/host-catalog-v2';

describe('webex-core', () => {
  describe('ServiceDetails', () => {
    let webex;
    let serviceDetails;
    let template;

    beforeEach(() => {
      webex = new MockWebex();
      new ServicesV2(undefined, {parent: webex});

      template = formattedServiceHostmapEntryConv;

      serviceDetails = new ServiceDetails({...template});
    });

    describe('#namespace', () => {
      it('is accurate to plugin name', () => {
        assert.equal(serviceDetails.namespace, 'ServiceDetails');
      });
    });

    describe('#serviceName', () => {
      it('is valid value', () => {
        assert.typeOf(serviceDetails.serviceName, 'string');
        assert.equal(serviceDetails.serviceName, 'conversation');
      });
    });

    describe('#serviceUrls', () => {
      it('is valid value', () => {
        assert.typeOf(serviceDetails.serviceUrls, 'array');
      });

      it('contains all appended hosts on construction', () => {
        template.serviceUrls.forEach((serviceUrl) => {
          assert.include([...serviceDetails.serviceUrls], serviceUrl);
        });
      });
    });

    describe('#id', () => {
      it('is valid value', () => {
        assert.typeOf(serviceDetails.id, 'string');
        assert.equal(serviceDetails.id, 'urn:TEAM:us-east-2_a:conversation');
      });
    });

    describe('#_generateHostUrl()', () => {
      it('returns a string', () => {
        serviceDetails.serviceUrls.forEach((serviceUrl) => {
          assert.typeOf(serviceDetails._generateHostUrl(serviceUrl), 'string');
        });
      });

      it('replaces the host of a pass in url', () => {
        serviceDetails.serviceUrls.forEach((serviceUrl) => {
          assert.equal(
            serviceDetails._generateHostUrl(serviceUrl),
            `https://${serviceUrl.host}/conversation/api/v1`
          );
        });
      });
    });

    describe('#_getPriorityHostUrl()', () => {
      it('validates that the retrieved high priority host matches the manually retrieved high priority host', () => {
        assert.equal(
          serviceDetails._getPriorityHostUrl(),
          serviceDetails._generateHostUrl(template.serviceUrls[0])
        );
      });

      it('should pick most priority non failed host', () => {
        serviceDetails.serviceUrls[0].failed = true;

        assert.isTrue(serviceDetails.serviceUrls[0].failed);

        const priorityHost = serviceDetails._getPriorityHostUrl();
        assert.equal(priorityHost, serviceDetails.serviceUrls[1].baseUrl);
      });

      it('should reset the hosts when all have failed', () => {
        serviceDetails.serviceUrls.forEach((serviceUrl) => {
          /* eslint-disable-next-line no-param-reassign */
          serviceUrl.failed = true;
        });

        assert.isTrue(serviceDetails.serviceUrls.every((serviceUrl) => serviceUrl.failed));

        const priorityHost = serviceDetails._getPriorityHostUrl();

        assert.equal(priorityHost, serviceDetails.serviceUrls[0].baseUrl);
        assert.isTrue(serviceDetails.serviceUrls.every((serviceUrl) => !serviceUrl.failed));
      });
    });

    describe('#failHost()', () => {
      it('marks a host as failed', () => {
        serviceDetails.failHost(serviceDetails.serviceUrls[0].baseUrl);

        const removedHost = serviceDetails.serviceUrls.find(
          (currentHost) => currentHost.host === serviceDetails.serviceUrls[0].host
        );

        assert.isTrue(removedHost.failed);
      });

      it('returns true if hostUrl was found', () => {
        const removedHostResult = serviceDetails.failHost(serviceDetails.serviceUrls[0].baseUrl);

        assert.isTrue(removedHostResult);
      });

      it('returns false if hostUrl was not found', () => {
        const removedHostResult = serviceDetails.failHost('https://someurl.com/api/vq');

        assert.isFalse(removedHostResult);
      });
    });
  });
});

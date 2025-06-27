/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import {ServicesV2} from '@webex/webex-core';
import {formattedServiceHostmapV2} from '../../../fixtures/host-catalog-v2';

describe('webex-core', () => {
  describe('ServiceCatalogV2', () => {
    let webex;
    let services;
    let catalog;

    beforeEach(() => {
      webex = new MockWebex();
      services = new ServicesV2(undefined, {parent: webex});
      catalog = services._getCatalog();
    });

    describe('#namespace', () => {
      it('is accurate to plugin name', () => {
        assert.equal(catalog.namespace, 'ServiceCatalog');
      });
    });

    describe('#serviceGroups', () => {
      it('has all the required keys', () => {
        assert.hasAllKeys(catalog.serviceGroups, [
          'discovery',
          'override',
          'preauth',
          'signin',
          'postauth',
        ]);
      });

      it('contains values that are arrays', () => {
        Object.keys(catalog.serviceGroups).forEach((key) => {
          assert.typeOf(catalog.serviceGroups[key], 'array');
        });
      });
    });

    describe('#status', () => {
      it('has all the required keys', () => {
        assert.hasAllKeys(catalog.status, [
          'discovery',
          'override',
          'preauth',
          'postauth',
          'signin',
        ]);
      });

      it('has valid key value types', () => {
        assert.typeOf(catalog.status.preauth.ready, 'boolean');
        assert.typeOf(catalog.status.preauth.collecting, 'boolean');
        assert.typeOf(catalog.status.postauth.ready, 'boolean');
        assert.typeOf(catalog.status.postauth.collecting, 'boolean');
        assert.typeOf(catalog.status.signin.ready, 'boolean');
        assert.typeOf(catalog.status.signin.collecting, 'boolean');
      });
    });

    describe('#allowedDomains', () => {
      it('is an array', () => {
        assert.isArray(catalog.allowedDomains);
      });
    });

    describe('#clean()', () => {
      beforeEach(() => {
        catalog.serviceGroups.preauth = [1, 2, 3];
        catalog.serviceGroups.signin = [1, 2, 3];
        catalog.serviceGroups.postauth = [1, 2, 3];
        catalog.status.preauth = {ready: true};
        catalog.status.signin = {ready: true};
        catalog.status.postauth = {ready: true};
      });

      it('should reset service group ready status', () => {
        catalog.clean();

        assert.isFalse(catalog.status.preauth.ready);
        assert.isFalse(catalog.status.signin.ready);
        assert.isFalse(catalog.status.postauth.ready);
      });

      it('should clear all collected service groups', () => {
        catalog.clean();

        assert.equal(catalog.serviceGroups.preauth.length, 0);
        assert.equal(catalog.serviceGroups.signin.length, 0);
        assert.equal(catalog.serviceGroups.postauth.length, 0);
      });
    });

    describe('#findAllowedDomain()', () => {
      const domains = [];

      beforeEach(() => {
        domains.push('example-a', 'example-b', 'example-c');

        catalog.setAllowedDomains(domains);
      });

      afterEach(() => {
        domains.length = 0;
      });

      it('finds an allowed domain that matches a specific url', () => {
        const domain = catalog.findAllowedDomain('http://example-a.com/resource/id');

        assert.include(domains, domain);
      });
    });

    describe('#getAllowedDomains()', () => {
      const domains = [];

      beforeEach(() => {
        domains.push('example-a', 'example-b', 'example-c');

        catalog.setAllowedDomains(domains);
      });

      afterEach(() => {
        domains.length = 0;
      });

      it('returns a an array of allowed hosts', () => {
        const list = catalog.getAllowedDomains();

        assert.match(domains, list);
      });
    });

    describe('#setAllowedDomains()', () => {
      const domains = [];

      beforeEach(() => {
        domains.push('example-a', 'example-b', 'example-c');

        catalog.setAllowedDomains(domains);
      });

      afterEach(() => {
        domains.length = 0;
      });

      it('sets the allowed domain entries to new values', () => {
        const newValues = ['example-d', 'example-e', 'example-f'];

        catalog.setAllowedDomains(newValues);

        assert.notDeepInclude(domains, newValues);
      });
    });

    describe('#addAllowedDomains()', () => {
      const domains = [];

      beforeEach(() => {
        domains.push('example-a', 'example-b', 'example-c');

        catalog.setAllowedDomains(domains);
      });

      afterEach(() => {
        domains.length = 0;
      });

      it('merge the allowed domain entries with new values', () => {
        const newValues = ['example-c', 'example-e', 'example-f'];

        catalog.addAllowedDomains(newValues);

        const list = catalog.getAllowedDomains();

        assert.match(['example-a', 'example-b', 'example-c', 'example-e', 'example-f'], list);
      });
    });

    describe('#markFailedServiceUrl()', () => {
      afterEach(() => {
        catalog._getServiceDetail('urn:TEAM:us-east-2_a:conversation').serviceUrls[0].failed =
          false;
      });

      it('marks service url failed, and retrieves next highest priority', () => {
        catalog.updateServiceGroups('postauth', formattedServiceHostmapV2);

        const currentHighest = catalog._getServiceDetail('urn:TEAM:us-east-2_a:conversation').get();

        assert.equal(currentHighest, 'https://prod-achm-message.svc.webex.com/conversation/api/v1');

        const nextHighest = catalog.markFailedServiceUrl(
          'https://prod-achm-message.svc.webex.com/conversation/api/v1'
        );

        assert.equal(nextHighest, 'https://conv-a.wbx2.com/conversation/api/v1');
      });

      it('returns undefined if url does not exist', () => {
        catalog.updateServiceGroups('postauth', formattedServiceHostmapV2);

        const currentHighest = catalog._getServiceDetail('urn:TEAM:us-east-2_a:conversation').get();

        assert.equal(currentHighest, 'https://prod-achm-message.svc.webex.com/conversation/api/v1');

        const nextHighest = catalog.markFailedServiceUrl(
          'https://doesnotexist.com/conversation/api/v1'
        );

        assert.equal(nextHighest, undefined);
      });

      it('returns original highest priority url if all urls in service were already marked as failure', () => {
        catalog.updateServiceGroups('postauth', formattedServiceHostmapV2);

        const currentHighest = catalog._getServiceDetail('urn:TEAM:us-east-2_a:conversation').get();

        assert.equal(currentHighest, 'https://prod-achm-message.svc.webex.com/conversation/api/v1');

        catalog
          ._getServiceDetail('urn:TEAM:us-east-2_a:conversation')
          .serviceUrls.forEach((url) => (url.failed = true));

        const nextHighest = catalog.markFailedServiceUrl(
          'https://prod-achm-message.svc.webex.com/conversation/api/v1'
        );

        assert.equal(nextHighest, 'https://prod-achm-message.svc.webex.com/conversation/api/v1');
      });
    });

    describe('findServiceDetailFromUrl()', () => {
      const otherService = {
        serviceUrls: [
          {baseUrl: 'https://example.com/differentresource'},
          {baseUrl: 'https://example.com/differentresource'},
        ],
      };

      it.each(['discovery', 'preauth', 'signin', 'postauth', 'override'])(
        'matches a default url correctly',
        (serviceGroup) => {
          const url = 'https://example.com/resource/id';

          const exampleService = {
            serviceUrls: [
              {baseUrl: 'https://example.com/resource'},
              {baseUrl: 'https://example2.com/resource'},
            ],
          };

          catalog.serviceGroups[serviceGroup].push(otherService, exampleService);

          const service = catalog.findServiceDetailFromUrl(url);

          assert.equal(service, exampleService);
        }
      );

      it.each(['discovery', 'preauth', 'signin', 'postauth', 'override'])(
        'matches an alternate host url',
        (serviceGroup) => {
          const url = 'https://example2.com/resource/id';

          const exampleService = {
            serviceUrls: [
              {baseUrl: 'https://example.com/resource'},
              {baseUrl: 'https://example2.com/resource'},
            ],
          };

          catalog.serviceGroups[serviceGroup].push(otherService, exampleService);

          const service = catalog.findServiceDetailFromUrl(url);

          assert.equal(service, exampleService);
        }
      );
    });
  });
});

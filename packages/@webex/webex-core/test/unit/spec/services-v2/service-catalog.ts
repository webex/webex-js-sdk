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
        // Shaped like a real catalog rather than a tidy list: the commercial
        // domains the sdk ships with, a multi-part suffix, sites added at
        // runtime from meeting preferences, an entry that overlaps another,
        // and an unset entry, which callers can add and which must match
        // nothing.
        domains.push(
          'wbx2.com',
          'ciscospark.com',
          'webex.com',
          'webexapis.com',
          'broadcloud.com.au',
          'webexgov.us',
          'example-a.com',
          'example-b.com',
          'example-c.com',
          'go.example-a.com',
          ''
        );

        catalog.setAllowedDomains(domains);
      });

      afterEach(() => {
        domains.length = 0;
      });

      [
        // real service hosts resolve to the entry that covers them
        ['https://u2c-a.wbx2.com/u2c/api/v1/limited/catalog', 'wbx2.com'],
        ['https://conv-a.wbx2.com/conversation/api/v1/conversations', 'wbx2.com'],
        ['https://foobar.ciscospark.com/resource/id', 'ciscospark.com'],
        ['https://idbroker.webex.com/idb/token', 'webex.com'],
        ['https://webexapis.com/v1/people/me', 'webexapis.com'],
        // an entry is not required to be a bare registrable domain
        ['https://foo.broadcloud.com.au/resource/id', 'broadcloud.com.au'],
        ['https://a.b.webexgov.us/resource/id', 'webexgov.us'],
        // the domain itself and its subdomains match
        ['https://example-a.com/resource/id', 'example-a.com'],
        ['https://sub.example-b.com/resource/id', 'example-b.com'],
        ['https://deep.sub.example-c.com/resource/id', 'example-c.com'],
        // overlapping entries resolve to the first covering entry in the list
        ['https://go.example-a.com/resource/id', 'example-a.com'],
        // an explicit port must not defeat the match
        ['https://example-a.com:8443/resource/id', 'example-a.com'],
        ['https://u2c-a.wbx2.com:8000/resource/id', 'wbx2.com'],
        // hostname comparison is case insensitive
        ['https://U2C-A.WBX2.COM/resource/id', 'wbx2.com'],
        // a trailing dot is the same name
        ['https://u2c-a.wbx2.com./resource/id', 'wbx2.com'],
        // a sibling registrable domain must not match
        ['https://notwebex.com/resource/id', undefined],
        ['https://mywebexgov.us/resource/id', undefined],
        ['https://webex.company/resource/id', undefined],
        ['https://webex.com-unrelated.example/resource/id', undefined],
        ['https://example-a.community/resource/id', undefined],
        // a partial label must not match, even against a multi-part entry
        ['https://broadcloud.com/resource/id', undefined],
        // the domain matches only as a suffix, on a label boundary
        ['https://webex.com.unrelated.example/resource/id', undefined],
        ['https://unrelated.example/webex.com/resource/id', undefined],
        ['https://unrelated.example/?next=https://webex.com', undefined],
        // userinfo is not the host
        ['https://webex.com@unrelated.example/resource/id', undefined],
        // an encoded or unusual separator is not a label boundary, and the url
        // parsers used by the transports do not agree on where these end the
        // host, so they must not resolve to an allowed domain
        ['https://webex.com%2eunrelated.example/resource/id', undefined],
        ['https://webex.com%2Eunrelated.example/resource/id', undefined],
        ['https://unrelated.example%2ewebex.com/resource/id', undefined],
        ['https://unrelated.example%2Ewebex.com/resource/id', undefined],
        ['https://unrelated.example;.webex.com/resource/id', undefined],
        // an empty allowed domain entry matches nothing
        ['https://unrelated.example/resource/id', undefined],
        // unparseable urls
        ['', undefined],
        ['not a url', undefined],
      ].forEach(([url, expected]) => {
        it(`returns ${expected} for ${url || '<empty>'}`, () => {
          assert.equal(catalog.findAllowedDomain(url), expected);
        });
      });
    });

    describe('#getAllowedDomains()', () => {
      const domains = [];

      beforeEach(() => {
        domains.push('example-a.com', 'example-b.com', 'example-c.com');

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
        domains.push('example-a.com', 'example-b.com', 'example-c.com');

        catalog.setAllowedDomains(domains);
      });

      afterEach(() => {
        domains.length = 0;
      });

      it('sets the allowed domain entries to new values', () => {
        const newValues = ['example-d.com', 'example-e.com', 'example-f.com'];

        catalog.setAllowedDomains(newValues);

        assert.notDeepInclude(domains, newValues);
      });

      it('canonicalizes entries and discards those that are not usable', () => {
        catalog.setAllowedDomains([
          'Example-D.COM',
          'example-d.com',
          'example-e.com.',
          '',
          undefined,
        ]);

        assert.deepEqual(catalog.getAllowedDomains(), ['example-d.com', 'example-e.com']);
      });
    });

    describe('#addAllowedDomains()', () => {
      const domains = [];

      beforeEach(() => {
        domains.push('example-a.com', 'example-b.com', 'example-c.com');

        catalog.setAllowedDomains(domains);
      });

      afterEach(() => {
        domains.length = 0;
      });

      it('merge the allowed domain entries with new values', () => {
        const newValues = ['example-c.com', 'example-e.com', 'example-f.com'];

        catalog.addAllowedDomains(newValues);

        const list = catalog.getAllowedDomains();

        assert.match(
          ['example-a.com', 'example-b.com', 'example-c.com', 'example-e.com', 'example-f.com'],
          list
        );
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

      it('rejects URLs with similar-looking hostnames (SECURITY)', () => {
        // Attacker URL that looks like a catalog URL but has a different origin
        const maliciousUrl = 'https://example.com.attacker.com/resource/id';

        const exampleService = {
          serviceUrls: [{baseUrl: 'https://example.com/resource'}],
        };

        catalog.serviceGroups.postauth.push(exampleService);

        const service = catalog.findServiceDetailFromUrl(maliciousUrl);

        // Should NOT match - origins are different
        assert.isUndefined(service);
      });

      it('rejects URLs where catalog URL is a prefix but not at path boundary', () => {
        // e.g., /api/v1 should not match /api/v1extra
        const url = 'https://example.com/resourceextra/id';

        const exampleService = {
          serviceUrls: [{baseUrl: 'https://example.com/resource'}],
        };

        catalog.serviceGroups.postauth.push(exampleService);

        const service = catalog.findServiceDetailFromUrl(url);

        assert.isUndefined(service);
      });
    });
  });
});

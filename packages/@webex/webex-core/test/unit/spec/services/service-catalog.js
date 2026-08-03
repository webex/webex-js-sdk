/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import {Services} from '@webex/webex-core';

/* eslint-disable no-underscore-dangle */
describe('webex-core', () => {
  describe('ServiceCatalog', () => {
    let webex;
    let services;
    let catalog;

    beforeEach(() => {
      webex = new MockWebex();
      services = new Services(undefined, {parent: webex});
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
        // the empty entry mirrors plugin-meetings calling
        // `addAllowedDomains([preferredWebexSite])` with an unset site
        domains.push('webex.com', 'webexgov.us', 'webex.umi.ai', '');

        catalog.setAllowedDomains(domains);
      });

      afterEach(() => {
        domains.length = 0;
      });

      [
        // matches on label boundaries
        ['https://webex.com/resource/id', 'webex.com'],
        ['https://api.webex.com/resource/id', 'webex.com'],
        ['https://a.b.webexgov.us/resource/id', 'webexgov.us'],
        // an explicit port must not defeat the match
        ['https://localhost.webex.umi.ai:8000/resource/id', 'webex.umi.ai'],
        ['https://webex.com:8443/resource/id', 'webex.com'],
        // hostnames are case insensitive
        ['https://API.Webex.COM/resource/id', 'webex.com'],
        // partial labels must not match
        ['https://notwebex.com/resource/id', undefined],
        ['https://mywebexgov.us/resource/id', undefined],
        // the allowed domain must not appear as a prefix or middle label
        ['https://webex.com.attacker.net/resource/id', undefined],
        ['https://attacker.net/webex.com/resource/id', undefined],
        ['https://attacker.net/?next=https://webex.com', undefined],
        // userinfo must not be treated as the host
        ['https://webex.com@attacker.net/resource/id', undefined],
        // percent-encoding must not hide the real host: `new URL` decodes
        // `%2e` to `.`, so the request would go to webex.com.attacker.net
        ['https://webex.com%2eattacker.net/resource/id', undefined],
        ['https://webex.com%2Eattacker.net/resource/id', undefined],
        // an empty allowed domain entry must not match everything
        ['https://attacker.net/resource/id', undefined],
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

    describe('#list()', () => {
      let serviceList;

      beforeEach(() => {
        serviceList = catalog.list();
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

    describe('findServiceUrlFromUrl()', () => {
      const otherService = {
        defaultUrl: 'https://example.com/differentresource',
        hosts: [{host: 'example1.com'}, {host: 'example2.com'}],
      };

      it.each([
        'discovery',
        'preauth',
        'signin',
        'postauth',
        'override'
      ])('matches a default url correctly', (serviceGroup) => {
        const url = 'https://example.com/resource/id';


        const exampleService = {
          defaultUrl: 'https://example.com/resource',
          hosts: [{host: 'example1.com'}, {host: 'example2.com'}],
        };

        catalog.serviceGroups[serviceGroup].push(otherService, exampleService);

        const service = catalog.findServiceUrlFromUrl(url);

        assert.equal(service, exampleService);
      });

      it.each([
        'discovery',
        'preauth',
        'signin',
        'postauth',
        'override'
      ])('matches an alternate host url', (serviceGroup) => {
        const url = 'https://example2.com/resource/id';

        const exampleService = {
          defaultUrl: 'https://example.com/resource',
          hosts: [{host: 'example1.com'}, {host: 'example2.com'}],
        };

        catalog.serviceGroups[serviceGroup].push(otherService, exampleService);

        const service = catalog.findServiceUrlFromUrl(url);

        assert.equal(service, exampleService);
      });
    });
  });
});
/* eslint-enable no-underscore-dangle */

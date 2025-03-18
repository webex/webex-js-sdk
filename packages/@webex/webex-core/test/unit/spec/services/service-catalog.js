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

      it('should return false if the URL is invalid', () => {
        const result = catalog.findServiceUrlFromUrl('invalid-url');
        assert.isFalse(result);
      });

      it('should return the service URL object if found in the service groups', () => {
        catalog.serviceGroups = {
          discovery: [{defaultUrl: 'https://discovery.example.com', hosts: []}],
          preauth: [{defaultUrl: 'https://preauth.example.com', hosts: []}],
          signin: [{defaultUrl: 'https://signin.example.com', hosts: []}],
          postauth: [{defaultUrl: 'https://postauth.example.com', hosts: []}],
          override: [{defaultUrl: 'https://override.example.com', hosts: []}],
        };

        const result = catalog.findServiceUrlFromUrl('https://signin.example.com/resource');
        assert.deepEqual(result, {defaultUrl: 'https://signin.example.com', hosts: []});
      });

      it('should return false if the service URL is not found in the service groups', () => {
        catalog.serviceGroups = {
          discovery: [{defaultUrl: 'https://discovery.example.com', hosts: []}],
          preauth: [{defaultUrl: 'https://preauth.example.com', hosts: []}],
          signin: [{defaultUrl: 'https://signin.example.com', hosts: []}],
          postauth: [{defaultUrl: 'https://postauth.example.com', hosts: []}],
          override: [{defaultUrl: 'https://override.example.com', hosts: []}],
        };

        const result = catalog.findServiceUrlFromUrl('https://unknown.example.com/resource');
        assert.isFalse(result);
      });

      it('should handle alternate hostnames correctly', () => {
        catalog.serviceGroups = {
          discovery: [{defaultUrl: 'https://discovery.example.com', hosts: [{host: 'alt.discovery.example.com'}]}],
          preauth: [{defaultUrl: 'https://preauth.example.com', hosts: [{host: 'alt.preauth.example.com'}]}],
          signin: [{defaultUrl: 'https://signin.example.com', hosts: [{host: 'alt.signin.example.com'}]}],
          postauth: [{defaultUrl: 'https://postauth.example.com', hosts: [{host: 'alt.postauth.example.com'}]}],
          override: [{defaultUrl: 'https://override.example.com', hosts: [{host: 'alt.override.example.com'}]}],
        };

        const result = catalog.findServiceUrlFromUrl('https://alt.signin.example.com/resource');
        assert.deepEqual(result, {defaultUrl: 'https://signin.example.com', hosts: [{host: 'alt.signin.example.com'}]});
      });

      it('should skip service URLs with invalid default URLs', () => {
        catalog.serviceGroups = {
          discovery: [{defaultUrl: 'invalid-url', hosts: []}],
          preauth: [{defaultUrl: 'https://preauth.example.com', hosts: []}],
          signin: [{defaultUrl: 'https://signin.example.com', hosts: []}],
          postauth: [{defaultUrl: 'https://postauth.example.com', hosts: []}],
          override: [{defaultUrl: 'https://override.example.com', hosts: []}],
        };

        const result = catalog.findServiceUrlFromUrl('https://signin.example.com/resource');
        assert.deepEqual(result, {defaultUrl: 'https://signin.example.com', hosts: []});
      });

      it('should skip alternate hostnames with invalid URLs', () => {
        catalog.serviceGroups = {
          discovery: [{defaultUrl: 'https://discovery.example.com', hosts: [{host: 'invalid-url'}]}],
          preauth: [{defaultUrl: 'https://preauth.example.com', hosts: []}],
          signin: [{defaultUrl: 'https://signin.example.com', hosts: []}],
          postauth: [{defaultUrl: 'https://postauth.example.com', hosts: []}],
          override: [{defaultUrl: 'https://override.example.com', hosts: []}],
        };

        const result = catalog.findServiceUrlFromUrl('https://signin.example.com/resource');
        assert.deepEqual(result, {defaultUrl: 'https://signin.example.com', hosts: []});
      });

      it('should return the service URL object if found with a different protocol', () => {
        catalog.serviceGroups = {
          discovery: [{defaultUrl: 'https://discovery.example.com', hosts: []}],
          preauth: [{defaultUrl: 'https://preauth.example.com', hosts: []}],
          signin: [{defaultUrl: 'https://signin.example.com', hosts: []}],
          postauth: [{defaultUrl: 'https://postauth.example.com', hosts: []}],
          override: [{defaultUrl: 'https://override.example.com', hosts: []}],
        };

        const result = catalog.findServiceUrlFromUrl('wss://signin.example.com/resource');
        assert.deepEqual(result, {defaultUrl: 'https://signin.example.com', hosts: []});
      });
      
      it('should return the exact protocol service URL object if both protocols are present', () => {
        catalog.serviceGroups = {
          discovery: [{defaultUrl: 'https://discovery.example.com', hosts: []}],
          preauth: [{defaultUrl: 'https://preauth.example.com', hosts: []}],
          signin: [
            {defaultUrl: 'https://signin.example.com', hosts: []},
            {defaultUrl: 'wss://signin.example.com', hosts: []},
          ],
          postauth: [{defaultUrl: 'https://postauth.example.com', hosts: []}],
          override: [{defaultUrl: 'https://override.example.com', hosts: []}],
        };

        const resultHttps = catalog.findServiceUrlFromUrl('https://signin.example.com/resource');
        const resultWss = catalog.findServiceUrlFromUrl('wss://signin.example.com/resource');

        assert.deepEqual(resultHttps, {defaultUrl: 'https://signin.example.com', hosts: []});
        assert.deepEqual(resultWss, {defaultUrl: 'wss://signin.example.com', hosts: []});
      });
      
    });
  });
});
/* eslint-enable no-underscore-dangle */

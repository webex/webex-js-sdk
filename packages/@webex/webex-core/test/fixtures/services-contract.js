/*!
 * Copyright (c) 2026 Cisco Systems, Inc. See LICENSE file.
 */
/* eslint-env mocha */

import {assert} from '@webex/test-helper-chai';

// The public contract shared by v1 and v2. Keep implementation-specific catalog
// setup and v1-only APIs in their respective suites, rather than skipping them.
/**
 * Register public service assertions against the current implementation fixture.
 * @param {Function} getServices - Return the services plugin for the current test.
 * @returns {void}
 */
export default function describeServicesContract(getServices) {
  describe('shared services contract', () => {
    it('resolves an authenticated service by name', () => {
      assert.isString(getServices().get('conversation'));
    });

    it('returns undefined for an unknown service name', () => {
      assert.isUndefined(getServices().get('unknown-contract-service'));
    });

    it('identifies a service from its URL', () => {
      const services = getServices();
      const result = services.getServiceFromUrl(services.get('conversation'));

      assert.strictEqual(result.name, 'conversation');
      assert.isString(result.priorityUrl);
      assert.isString(result.defaultUrl);
    });

    it('returns undefined for an unknown service URL', () => {
      assert.isUndefined(getServices().getServiceFromUrl('https://unknown-contract.example.com'));
    });

    it('waits for a service by name', async () => {
      const services = getServices();

      assert.strictEqual(
        await services.waitForService({name: 'conversation'}),
        services.get('conversation', true)
      );
    });

    it('waits for a service by URL', async () => {
      const services = getServices();
      const url = services.get('conversation');

      assert.strictEqual(
        await services.waitForService({url}),
        services.getServiceFromUrl(url).priorityUrl
      );
    });

    it('honors a configured override after the authenticated catalog loads', async () => {
      const services = getServices();
      const override = 'https://override.example.com/conversation/api/v1';

      services.config.override = {...services.config.override, conversation: override};
      services.initConfig();

      assert.strictEqual(services.get('conversation'), override);
      assert.strictEqual(await services.waitForService({name: 'conversation'}), override);
    });
  });
}

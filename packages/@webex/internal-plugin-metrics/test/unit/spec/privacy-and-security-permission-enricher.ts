import {assert} from '@webex/test-helper-chai';

import {PERMISSION_ENRICHMENT_RULES} from '../../../src/privacy-and-security-permission-enricher';

describe('PrivacyAndSecurityPermissionEnricher', () => {
  describe('permission enrichment rules', () => {
    it('registers each production event in only one rule', () => {
      const registeredEvents = PERMISSION_ENRICHMENT_RULES.flatMap(({events}) => [...events]);

      assert.lengthOf(new Set(registeredEvents), registeredEvents.length);
    });
  });
});

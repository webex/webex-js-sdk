/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import {ServiceCollection} from '@ciscospark/internal-plugin-wdm';

describe('plugin-wdm', () => {
  describe('ServiceCollections', () => {
    const https = 'https://';
    const mercuryPriority0 = 'mercury-connection.a6.ciscospark.com';
    const mercuryPriority1 = 'mercury-connection-a5.wbx2.com';
    const mercuryPriority2 = 'mercury-connection-a4.wbx2.com';
    let serviceCatalog;

    beforeEach('add services', () => {
      serviceCatalog = new ServiceCollection();
      serviceCatalog.add([
        {
          service: 'mercuryConnectionServiceUrl',
          defaultUrl: 'https://mercury-connection-a.wbx2.com/v1',
          availableHosts: [
            {
              host: mercuryPriority0,
              priority: 0
            },
            {
              host: mercuryPriority2,
              priority: 2
            },
            {
              host: mercuryPriority1,
              priority: 1
            }]
        },
        {
          service: 'conversationServiceUrl',
          defaultUrl: 'https://conv-a.wbx2.com/conversation/api/v1',
          availableHosts: [
            {
              host: 'conv-a.wbx2.com',
              priority: 5
            }]
        },
        {
          service: 'atlasServiceUrl',
          defaultUrl: 'https://atlas-a-wbx2.com/admin/api/v1'
        }
      ]);
    });

    describe('#markFailedAndCycleUrl()', () => {
      it('marks current url as failed and returns another url', () => serviceCatalog.markFailedAndCycleUrl(`${https}${mercuryPriority0}`)
        .then((result) => assert.deepEqual(result, `${https}${mercuryPriority1}/v1`))
        .then(() => {
          assert.isTrue(serviceCatalog.get('mercuryConnectionServiceUrl').availableHosts[0].failed);
        }));

      it('requires uri', () => assert.isRejected(serviceCatalog.markFailedAndCycleUrl(), /`uri` is a required parameter/));
    });

    describe('#inferServiceNameFromUrl()', () => {
      it('infers service from url', () => serviceCatalog.inferServiceNameFromUrl('https://mercury-connection.a6.ciscospark.com/v1')
        .then((result) => assert.deepEqual(result, 'mercuryConnectionServiceUrl'))
        .then(() => serviceCatalog.inferServiceNameFromUrl('https://conv-a.wbx2.com/conversation/v1'))
        .then((result) => assert.deepEqual(result, 'conversationServiceUrl')));

      it('rejects when cannot infer service from url', () => assert.isRejected(serviceCatalog.inferServiceNameFromUrl('https://example-404.com')));
    });
  });
});

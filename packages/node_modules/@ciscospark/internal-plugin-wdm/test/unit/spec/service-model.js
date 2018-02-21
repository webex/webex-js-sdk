/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import {ServiceModel} from '@ciscospark/internal-plugin-wdm';

describe('plugin-wdm', () => {
  describe('ServiceModel', () => {
    const https = 'https://';
    const mercuryPriority0 = 'mercury-connection.a6.ciscospark.com';
    const mercuryPriority1 = 'mercury-connection-a5.wbx2.com';
    const mercuryPriority2 = 'mercury-connection-a4.wbx2.com';
    let mercuryService;
    let atlasService;

    beforeEach('create services', () => {
      mercuryService = new ServiceModel({
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
      });

      atlasService = new ServiceModel({
        service: 'atlasServiceUrl',
        defaultUrl: 'https://atlas-a-wbx2.com/admin/api/v1'
      });
    });

    it('allows create new service', () => {
      const newService = new ServiceModel();
      assert.isObject(newService);
    });

    it('sorts availableHosts by highest priority first', () => {
      assert.equal(mercuryService.availableHosts[0].priority, 0);
      assert.equal(mercuryService.availableHosts[1].priority, 1);
      assert.equal(mercuryService.availableHosts[2].priority, 2);
    });

    it('returns default service url', () => {
      assert.equal(atlasService.url, 'https://atlas-a-wbx2.com/admin/api/v1');
    });

    it('returns the last service url if index out of range', () => {
      mercuryService.currentHostIndex = 10;
      assert.equal(mercuryService.url, `${https}${mercuryPriority2}/v1`);
    });

    it('returns translated service url by the highest priority host', () => {
      assert.equal(mercuryService.url, `${https}${mercuryPriority0}/v1`);
    });

    describe('#markHostFailed', () => {
      it('marks current host as failed', () => {
        assert.isNotOk(mercuryService.getCurrentHost().failed);
        mercuryService.markHostFailed();
        assert.isTrue(mercuryService.getCurrentHost().failed);
      });

      it('marks a host as failed', () => {
        assert.isNotOk(mercuryService.availableHosts[1].failed);
        mercuryService.markHostFailed(`${https}${mercuryPriority1}/v1`);
        assert.isTrue(mercuryService.availableHosts[1].failed);
      });

      it('does not mark a host as failed if host not found', () => {
        const service = new ServiceModel({
          service: 'serviceUrl',
          defaultUrl: 'https://example.com',
          availableHosts: [
            {
              host: 'https://example-2.com',
              priority: 0
            }
          ]
        });
        assert.isNotOk(service.availableHosts[0].failed);
        service.markHostFailed('https://unknown-host.com');
        assert.isNotOk(service.availableHosts[0].failed);
      });
    });

    describe('#cycleNextHost()', () => {
      it('returns next priority host that has not yet failed', () => {
        assert.equal(mercuryService.url, `${https}${mercuryPriority0}/v1`);
        mercuryService.markHostFailed();
        return mercuryService.cycleNextHost()
          .then(() => {
            assert.equal(mercuryService.url, `${https}${mercuryPriority1}/v1`);
          });
      });

      it('rejects when all hosts have failed', () => {
        for (let i = 0; i < mercuryService.availableHosts.length; i += 1) {
          mercuryService.availableHosts[i].failed = true;
        }
        return assert.isRejected(mercuryService.cycleNextHost());
      });
    });

    describe('#doesUrlBelongToService()', () => {
      it('returns true when url belongs to this service', () => {
        assert.isTrue(mercuryService.doesUrlBelongToService(`${https}${mercuryPriority0}/stuff`));
        assert.isTrue(atlasService.doesUrlBelongToService('https://atlas-a-wbx2.com/admin/api/v1'));
      });
    });

    describe('#getCurrentHost()', () => {
      it('returns the current host', () => {
        assert.equal(mercuryService.getCurrentHost().host, mercuryPriority0);
      });
    });

    describe('#replaceUrlWithCurrentHost()', () => {
      it('replaces the url with the current host', () => {
        mercuryService.cycleNextHost();
        assert.equal(mercuryService.getCurrentHost().host, mercuryPriority1);
        assert.equal(mercuryService.replaceUrlWithCurrentHost('https://example.com/v1'), `${https}${mercuryPriority1}/v1`);
      });
    });
  });
});

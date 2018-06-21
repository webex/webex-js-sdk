/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import '@ciscospark/internal-plugin-wdm';

import CiscoSpark from '@ciscospark/spark-core';
import testUsers from '@ciscospark/test-helper-test-users';

describe('plugin-wdm', function () {
  describe('Device', () => {
    this.timeout(30000);
    describe('.services', () => {
      let spark;

      before('create user', () => testUsers.create({count: 1})
        .then((users) => {
          spark = new CiscoSpark({
            credentials: {
              supertoken: users[0].token
            }
          });
        }));

      before('register device', () => spark.internal.device.register());

      const knownServices = [
        'acl',
        'apheleia',
        'argonaut',
        'assistant',
        'atlas',
        'avatar',
        'board',
        'calendar',
        'calliopeDiscovery',
        'conversation',
        'deviceManagement',
        'encryption',
        'feature',
        'files',
        'hecate',
        'hydra',
        'identityLookup',
        'janus',
        'locus',
        'lyra',
        'mercuryConnection',
        'metrics',
        'proximity',
        'raindrop',
        'remoteDispatcher',
        'retention',
        'room',
        'squaredFiles',
        'swupgrade',
        'userApps',
        'voicemail',
        'wdm'
      ];

      /**
       * This list contains services that may be in the service with an improper
       * key or have been/will soon be decommissioned but are still in the
       * catalog.
       */
      const ignoredServices = [
        'mercuryAlternateDC',
        'speechServicesManager',
        'stickies',
        'xapi'
      ];

      const serviceStatus = {};

      knownServices.forEach((service) => {
        describe(`.${service}`, () => {
          it('responds to pings', () => ping(service));
        });
      });

      describe('each service written after the test suite was created', () => {
        it('responds to pings', () => Object.keys(spark.internal.device.services)
          .map((service) => service.replace('ServiceUrl', ''))
          .filter((service) => !knownServices.includes(service))
          .filter((service) => !knownServices.includes(service) && !ignoredServices.includes(service))
          .reduce((p, service) => p.then(() => pingUnknown(service)), Promise.resolve()));
      });

      function ping(service, prefix = '') {
        return spark.request({
          service,
          resource: `${prefix}/ping`
        })
          .catch((res) => {
            // In case the service uses versions, but version is not appended to the serviceUrl
            if (!prefix) {
              return ping(service, '/v1');
            }
            throw res;
          });
      }

      function pingUnknown(service) {
        return ping(service)
          .catch((res) => {
            serviceStatus[service] = res;
            return res;
          });
      }

      after('output failed pings', () => {
        if (Object.keys(serviceStatus).length > 0) {
          console.info('failed service pings', JSON.stringify(serviceStatus, null, 2));
        }
      });
    });
  });
});

/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import {Services, ServiceUrl} from '@webex/webex-core';

/* eslint-disable no-underscore-dangle */
describe('webex-core', () => {
  describe('ServiceUrl', () => {
    let webex;
    let serviceUrl;
    let template;

    beforeEach(() => {
      webex = new MockWebex();
      /* eslint-disable-next-line no-unused-vars */
      const services = new Services(undefined, {parent: webex});

      template = {
        defaultUrl: 'https://example.com/api/v1',
        hosts: [
          {
            host: 'example-host-p1.com',
            priority: 1,
            ttl: -1,
            id: '1',
            homeCluster: false,
          },
          {
            host: 'example-host-p2.com',
            priority: 2,
            ttl: -1,
            id: '2',
            homeCluster: false,
          },
          {
            host: 'example-host-p3.com',
            priority: 3,
            ttl: -1,
            id: '3',
            homeCluster: true,
          },
          {
            host: 'example-host-p4.com',
            priority: 4,
            ttl: -1,
            id: '4',
            homeCluster: true,
          },
          {
            host: 'example-host-p5.com',
            priority: 5,
            ttl: -1,
            id: '5',
            homeCluster: true,
          },
        ],
        name: 'example',
      };
      serviceUrl = new ServiceUrl({...template});
    });

    describe('#namespace', () => {
      it('is accurate to plugin name', () => {
        assert.equal(serviceUrl.namespace, 'ServiceUrl');
      });
    });

    describe('#defautUrl', () => {
      it('is valid value', () => {
        assert.typeOf(serviceUrl.defaultUrl, 'string');
        assert.equal(serviceUrl.defaultUrl, 'https://example.com/api/v1');
      });
    });

    describe('#hosts', () => {
      it('is valid value', () => {
        assert.typeOf(serviceUrl.hosts, 'array');
      });

      it('contains all appended hosts on construction', () => {
        template.hosts.forEach((host) => {
          assert.include([...serviceUrl.hosts], host);
        });
      });
    });

    describe('#name', () => {
      it('is valid value', () => {
        assert.typeOf(serviceUrl.name, 'string');
        assert.equal(serviceUrl.name, 'example');
      });
    });

    describe('#_generateHostUrl()', () => {
      it('returns a string', () => {
        serviceUrl.hosts.forEach(({host}) => {
          assert.typeOf(serviceUrl._generateHostUrl(host), 'string');
        });
      });

      it('replaces the host of a pass in url', () => {
        serviceUrl.hosts.forEach(({host}) => {
          assert.include(serviceUrl._generateHostUrl(host), `https://${host}/api/v1`);
        });
      });
    });

    describe('#_getHostUrls()', () => {
      it('returns an array of objects with an updated url and priority', () => {
        serviceUrl._getHostUrls().forEach((hu) => {
          assert.hasAllKeys(hu, ['url', 'priority']);
        });
      });

      it('generates an array objects from current hosts', () => {
        const hostUrls = serviceUrl._getHostUrls();

        hostUrls.forEach((hu, i) => {
          assert.equal(hu.url, serviceUrl._generateHostUrl(serviceUrl.hosts[i].host));
          assert.equal(hu.priority, serviceUrl.hosts[i].priority);
        });
      });
    });

    describe('#_getPriorityHostUrl()', () => {
      let highPriorityHost;

      beforeEach(() => {
        highPriorityHost = serviceUrl._generateHostUrl(
          serviceUrl.hosts.reduce((o, c) => (o.priority > c.priority || !o.homeCluster ? c : o))
            .host
        );
      });

      it('validates that the retrieved high priority host matches the manually retrieved high priority host', () => {
        assert.equal(serviceUrl._getPriorityHostUrl(), highPriorityHost);
      });

      it('should reset the hosts when all have failed', () => {
        serviceUrl.hosts.forEach((host) => {
          /* eslint-disable-next-line no-param-reassign */
          host.failed = true;
        });

        serviceUrl._getPriorityHostUrl();

        const homeClusterUrls = serviceUrl.hosts.filter((host) => host.homeCluster);

        assert.isTrue(homeClusterUrls.every((host) => !host.failed));
      });
    });

    describe('#failHost()', () => {
      let host;
      let hostUrl;

      beforeEach(() => {
        host = 'example-host-px.com';
        hostUrl = 'https://example-host-px.com/api/v1';
        serviceUrl.hosts.push({host, priority: 10, ttl: -1});
      });

      it('marks a host as failed', () => {
        serviceUrl.failHost(hostUrl);

        const removedHost = serviceUrl.hosts.find((currentHost) => currentHost.host === host);

        assert.isTrue(removedHost.failed);
      });

      it('does not mark failed a host if the hostUrl is defaultUrl', () => {
        // Remove here as countermeasure to beforeEach
        serviceUrl.failHost(hostUrl);

        const hostLength = serviceUrl.hosts.length;
        const foundHost = serviceUrl.failHost(serviceUrl.defaultUrl);

        assert.isTrue(foundHost);
        assert.equal(hostLength, serviceUrl.hosts.length);
        assert.isDefined(serviceUrl.defaultUrl);
        assert.equal(serviceUrl.defaultUrl, template.defaultUrl);
      });

      it('returns true if hostUrl was found', () => {
        const removedHostResult = serviceUrl.failHost(hostUrl);

        assert.isTrue(removedHostResult);
      });

      it('returns false if hostUrl was not found', () => {
        const removedHostResult = serviceUrl.failHost('https://someurl.com/api/vq');

        assert.isFalse(removedHostResult);
      });
    });

    describe('#get()', () => {
      it('returns a string', () => {
        assert.typeOf(serviceUrl.get(), 'string');
      });

      // This may be updated in a later PR if
      // changes to federation before release occur.
      it('returns the defaultUrl value', () => {
        assert.equal(serviceUrl.get(), serviceUrl.defaultUrl);
      });

      it('returns the highest priority host as url', () => {
        const hpUrl = serviceUrl.get(true);

        assert.equal(hpUrl, serviceUrl._getPriorityHostUrl());
        assert.isDefined(serviceUrl.hosts.find((hostObj) => hpUrl.includes(hostObj.host)));
      });

      describe('when a clusterId is provided', () => {
        let highPriorityHost;
        let hosts;
        let url;

        describe('when the clusterId is a home cluster', () => {
          beforeEach(() => {
            hosts = serviceUrl.hosts.filter((host) => host.homeCluster);

            highPriorityHost = hosts.reduce((current, next) =>
              current.priority <= next.priority ? current : next
            ).host;

            url = serviceUrl.get(true, hosts[0].id);
          });

          it('should return a url from the correct cluster', () => {
            assert.isTrue(url.includes(highPriorityHost));
          });
        });

        describe('when the clusterId is not a home cluster', () => {
          beforeEach(() => {
            hosts = serviceUrl.hosts.filter((host) => !host.homeCluster);

            highPriorityHost = hosts.reduce((current, next) =>
              current.priority <= next.priority ? current : next
            ).host;

            url = serviceUrl.get(true, hosts[0].id);
          });

          it('should return a url from the correct cluster', () => {
            assert.isTrue(url.includes(highPriorityHost));
          });
        });
      });
    });
  });
});
/* eslint-enable no-underscore-dangle */

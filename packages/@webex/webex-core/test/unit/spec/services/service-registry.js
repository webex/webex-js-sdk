import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import {ServiceRegistry, serviceConstants} from '@webex/webex-core';

const {SERVICE_CATALOGS, SERVICE_CATALOGS_ENUM_TYPES: SCET} = serviceConstants;

describe('webex-core', () => {
  describe('ServiceRegistry', () => {
    let fixture;
    let fixtureHosts;
    let serviceRegistry;

    before('generate fixture', () => {
      fixture = {
        serviceLinks: {
          'example-service-a-name': 'http://example-service-a.com/',
          'example-service-b-name': 'http://example-service-b.com/'
        },
        hostCatalog: {
          'example-service-a': [
            {
              host: 'example-service-a-h1.com',
              id: 'head:group:cluster-a-h1:example-service-a-name',
              priority: 5
            },
            {
              host: 'example-service-a-h2.com',
              id: 'head:group:cluster-a-h2:example-service-a-name',
              priority: 3
            }
          ],
          'example-service-b': [
            {
              host: 'example-service-b-h1.com',
              id: 'head:group:cluster-b-h1:example-service-b-name',
              priority: 5
            },
            {
              host: 'example-service-b-h2.com',
              id: 'head:group:cluster-b-h2:example-service-b-name',
              priority: 3
            }
          ],
          'example-service-c': [
            {
              host: 'example-service-c-h1.com',
              id: 'head:group:cluster-c-h1:example-service-a-name',
              priority: 5
            },
            {
              host: 'example-service-c-h2.com',
              id: 'head:group:cluster-c-h2:example-service-a-name',
              priority: 3
            }
          ]
        }
      };

      fixtureHosts = Object.keys(fixture.hostCatalog)
        .reduce((output, key) => {
          output.push(...fixture.hostCatalog[key]);

          return output;
        }, []);
    });

    beforeEach('initialize a service catalog', () => {
      serviceRegistry = new ServiceRegistry();
    });

    describe('class members', () => {
      describe('#hosts', () => {
        it('should be an array', () => {
          assert.isArray(serviceRegistry.hosts);
        });
      });

      describe('#map', () => {
        let priorityLocalHosts;

        beforeEach('setup hosts', () => {
          serviceRegistry.load(
            ServiceRegistry.mapRemoteCatalog({
              catalog: SERVICE_CATALOGS[0],
              ...fixture
            })
          );

          const {hostCatalog} = fixture;

          priorityLocalHosts = {
            'example-service-a-name': hostCatalog['example-service-a'][0].host,
            'example-service-b-name': hostCatalog['example-service-b'][0].host
          };
        });

        it('should only return hosts that are active/local/priority', () => {
          const {map} = serviceRegistry;
          const priorityLocalHostsKeys = Object.keys(priorityLocalHosts);

          assert.isTrue(priorityLocalHostsKeys.every(
            (key) => map[key].includes(priorityLocalHosts[key])
          ));
        });
      });
    });

    describe('#clear()', () => {
      let filter;
      let host;

      beforeEach('generate the service host class objects', () => {
        serviceRegistry.load(ServiceRegistry.mapRemoteCatalog({
          catalog: SERVICE_CATALOGS[0],
          ...fixture
        }));

        host = serviceRegistry.hosts[0];

        filter = {
          active: true,
          catalog: host.catalog,
          cluster: host.id,
          local: true,
          priority: true,
          service: host.service,
          url: host.url
        };
      });

      it('should remove all hosts when called without a filter', () => {
        serviceRegistry.clear();

        assert.equal(serviceRegistry.hosts.length, 0);
      });

      it('should remove only filtered hosts when called with a filter', () => {
        serviceRegistry.clear(filter);

        assert.notInclude(serviceRegistry.hosts, host);
      });

      it('should remove multiple hosts based on the provided filter', () => {
        host.setStatus({failed: true});
        serviceRegistry.clear({active: true});
        assert.deepEqual(serviceRegistry.hosts, [host]);
      });

      it('should return the removed hosts', () => {
        const [removedHost] = serviceRegistry.clear(filter);

        assert.equal(removedHost, host);
      });
    });

    describe('#failed()', () => {
      let filter;
      let filteredHost;

      beforeEach('generate the service host class objects', () => {
        serviceRegistry.load(ServiceRegistry.mapRemoteCatalog({
          catalog: SERVICE_CATALOGS[0],
          ...fixture
        }));

        filteredHost = serviceRegistry.hosts[0];

        filter = {
          active: true,
          catalog: filteredHost.catalog,
          cluster: filteredHost.id,
          local: true,
          priority: true,
          service: filteredHost.service,
          url: filteredHost.url
        };
      });

      it('should mark all hosts as failed when called without a filter', () => {
        serviceRegistry.failed();
        assert.isTrue(serviceRegistry.hosts.every(
          (failedHost) => failedHost.failed
        ));
      });

      it('should mark the target hosts as failed', () => {
        serviceRegistry.failed(filter);
        assert.isTrue(filteredHost.failed);
      });

      it('should return the marked host', () => {
        const [failedHost] = serviceRegistry.failed(filter);

        assert.equal(failedHost, filteredHost);
      });
    });

    describe('#filterActive()', () => {
      let hostList;
      let failedHost;
      let filteredHosts;

      beforeEach('generate the service host class objects', () => {
        hostList = ServiceRegistry.mapRemoteCatalog({
          catalog: SERVICE_CATALOGS[0],
          ...fixture
        });

        serviceRegistry.load(hostList);
        failedHost = serviceRegistry.hosts[0];
        failedHost.setStatus({failed: true, replaced: true});
      });

      it('should return all hosts when called without params', () => {
        filteredHosts = serviceRegistry.filterActive();

        assert.equal(filteredHosts.length, hostList.length);
      });

      it('should return only active hosts when called with true', () => {
        filteredHosts = serviceRegistry.filterActive(true);

        assert.isBelow(filteredHosts.length, hostList.length);
        assert.notInclude(filteredHosts, failedHost);
      });

      it('should return only inactive hosts when active is false', () => {
        filteredHosts = serviceRegistry.filterActive(false);

        assert.equal(filteredHosts.length, 1);
        assert.include(filteredHosts[0], failedHost);
      });
    });

    describe('#filterCatalog()', () => {
      let filteredHosts;
      let hostsCustomA;
      let hostsCustomB;

      beforeEach('generate the service host class objects', () => {
        hostsCustomA = ServiceRegistry.mapRemoteCatalog({
          catalog: SERVICE_CATALOGS[0],
          ...fixture
        });

        hostsCustomB = ServiceRegistry.mapRemoteCatalog({
          catalog: SERVICE_CATALOGS[1],
          ...fixture
        });

        serviceRegistry.load(hostsCustomA);
        serviceRegistry.load(hostsCustomB);
      });

      it('should return all hosts when called without params', () => {
        filteredHosts = serviceRegistry.filterCatalog();

        assert.deepEqual(filteredHosts, serviceRegistry.hosts);
      });

      it('should return only service hosts in the specific catalog', () => {
        filteredHosts = serviceRegistry.filterCatalog(SERVICE_CATALOGS[0]);

        assert.equal(filteredHosts.length, hostsCustomA.length);
        assert.isTrue(filteredHosts.every(
          (host) => host.catalog === SERVICE_CATALOGS[0]
        ));
      });

      it('should return service hosts for an array of catalogs', () => {
        filteredHosts = serviceRegistry.filterCatalog(
          [SERVICE_CATALOGS[0], SERVICE_CATALOGS[1]]
        );

        assert.equal(
          filteredHosts.length,
          (hostsCustomA.length + hostsCustomB.length)
        );

        assert.isTrue(filteredHosts.every(
          (host) => [SERVICE_CATALOGS[0], SERVICE_CATALOGS[1]].includes(
            host.catalog
          )
        ));
      });

      it('should return only service hosts from valid catalogs', () => {
        filteredHosts = serviceRegistry.filterCatalog(
          [SERVICE_CATALOGS[0], 'invalid', -1]
        );

        assert.equal(filteredHosts.length, hostsCustomA.length);
        assert.isTrue(filteredHosts.every(
          (host) => host.catalog === SERVICE_CATALOGS[0]
        ));
      });
    });

    describe('#filterLocal()', () => {
      let filteredHosts;
      let remoteHosts;
      let localHosts;

      beforeEach('generate the service host class objects', () => {
        serviceRegistry.load(
          ServiceRegistry.mapRemoteCatalog({
            catalog: SERVICE_CATALOGS[0],
            ...fixture
          })
        );

        remoteHosts = fixture.hostCatalog['example-service-c'];
        localHosts = [
          ...fixture.hostCatalog['example-service-a'],
          ...fixture.hostCatalog['example-service-b']
        ];
      });

      it('should return all hosts when called without params', () => {
        filteredHosts = serviceRegistry.filterLocal();

        assert.deepEqual(filteredHosts, serviceRegistry.hosts);
      });

      it('should return only local hosts when called with true', () => {
        filteredHosts = serviceRegistry.filterLocal(true);

        assert.equal(filteredHosts.length, localHosts.length);
        assert.isTrue(filteredHosts.every(
          (host) => host.local === true
        ));
      });

      it('should return only hosts remote hosts when called with false', () => {
        filteredHosts = serviceRegistry.filterLocal(false);

        assert.equal(filteredHosts.length, remoteHosts.length);
        assert.isTrue(filteredHosts.every(
          (host) => host.local === false
        ));
      });
    });

    describe('#filterPriority()', () => {
      let filteredHosts;
      let priorityHosts;

      beforeEach('generate the service host class objects', () => {
        serviceRegistry.load(
          ServiceRegistry.mapRemoteCatalog({
            catalog: SERVICE_CATALOGS[0],
            ...fixture
          })
        );

        priorityHosts = [
          fixture.hostCatalog['example-service-a'][0],
          fixture.hostCatalog['example-service-b'][0],
          fixture.hostCatalog['example-service-c'][0]
        ];
      });

      it('should return all hosts when called without params', () => {
        filteredHosts = serviceRegistry.filterPriority();

        assert.deepEqual(filteredHosts, serviceRegistry.hosts);
      });

      it('should return only priority hosts when called with true', () => {
        filteredHosts = serviceRegistry.filterPriority(true);

        assert.equal(filteredHosts.length, priorityHosts.length);
      });

      it('should not return inactive hosts when called with true', () => {
        filteredHosts = serviceRegistry.filterPriority(true);
        filteredHosts[0].setStatus({failed: true});

        const failedHost = filteredHosts[0];

        filteredHosts = serviceRegistry.filterPriority(true);

        assert.notInclude(filteredHosts, failedHost);
      });

      it('should return all hosts when called with false', () => {
        filteredHosts = serviceRegistry.filterPriority(false);

        assert.deepEqual(filteredHosts, serviceRegistry.hosts);
      });
    });

    describe('#filterService()', () => {
      let filteredHosts;
      let otherHosts;
      let otherServiceName;
      let serviceHosts;
      let serviceName;

      beforeEach('generate the service host class objects', () => {
        serviceRegistry.load(
          ServiceRegistry.mapRemoteCatalog({
            catalog: SERVICE_CATALOGS[0],
            ...fixture
          })
        );

        otherHosts = [
          ...fixture.hostCatalog['example-service-b']
        ];

        serviceHosts = [
          ...fixture.hostCatalog['example-service-a'],
          ...fixture.hostCatalog['example-service-c']
        ];

        otherServiceName = 'example-service-b-name';
        serviceName = 'example-service-a-name';
      });

      it('should return all hosts when called without params', () => {
        filteredHosts = serviceRegistry.filterService();

        assert.equal(filteredHosts.length, serviceRegistry.hosts.length);
      });

      it('should return hosts that belong to a service', () => {
        filteredHosts = serviceRegistry.filterService(serviceName);

        assert.equal(filteredHosts.length, serviceHosts.length);
        assert.isTrue(filteredHosts.every(
          (host) => host.service === serviceName
        ));
      });

      it('should return all hosts that belong to an array of services', () => {
        filteredHosts = serviceRegistry.filterService([
          otherServiceName,
          serviceName
        ]);

        assert.equal(
          filteredHosts.length,
          [...otherHosts, ...serviceHosts].length
        );

        assert.isTrue(filteredHosts.every(
          (host) => [otherServiceName, serviceName].includes(host.service)
        ));
      });

      it('should return an empty array when given an invalid service', () => {
        filteredHosts = serviceRegistry.filterService('invalid');

        assert.equal(filteredHosts.length, 0);
      });
    });

    describe('#filterUrl()', () => {
      let filteredHosts;
      let filteredHostA;
      let filteredHostB;

      beforeEach('generate the service host class objects', () => {
        serviceRegistry.load(
          ServiceRegistry.mapRemoteCatalog({
            catalog: SERVICE_CATALOGS[0],
            ...fixture
          })
        );

        filteredHostA = serviceRegistry.hosts[0];
        filteredHostB = serviceRegistry.hosts[1];
      });

      it('should return all hosts when called without params', () => {
        filteredHosts = serviceRegistry.filterUrl();

        assert.deepEqual(filteredHosts, serviceRegistry.hosts);
      });

      it('should return only service hosts with a specific url', () => {
        [filteredHosts] = serviceRegistry.filterUrl(filteredHostA.url);

        assert.equal(filteredHosts, filteredHostA);
      });

      it('should return service hosts for an array of urls', () => {
        filteredHosts = serviceRegistry.filterUrl([
          filteredHostA.url,
          filteredHostB.url
        ]);

        assert.equal(filteredHosts.length, 2);
        assert.isTrue(filteredHosts.every(
          (foundHost) => [filteredHostA, filteredHostB].includes(foundHost)
        ));
      });

      it('should return an empty array when given an invalid url', () => {
        filteredHosts = serviceRegistry.filterUrl('invalid');
        assert.equal(filteredHosts.length, 0);
      });
    });

    describe('#find()', () => {
      let filter;
      let host;

      beforeEach('generate the service host class objects', () => {
        serviceRegistry.load(ServiceRegistry.mapRemoteCatalog({
          catalog: SERVICE_CATALOGS[0],
          ...fixture
        }));

        host = serviceRegistry.hosts[0];

        filter = {
          active: true,
          catalog: host.catalog,
          cluster: host.id,
          local: true,
          priority: true,
          service: host.service,
          url: host.url
        };
      });

      it('should call the \'filterActive()\' method with params', () => {
        sinon.spy(serviceRegistry, 'filterActive');
        serviceRegistry.find(filter);
        assert.calledWith(serviceRegistry.filterActive, filter.active);
      });

      it('should call the \'filterCatalog()\' method with params', () => {
        sinon.spy(serviceRegistry, 'filterCatalog');
        serviceRegistry.find(filter);
        assert.calledWith(serviceRegistry.filterCatalog, filter.catalog);
      });

      it('should call the \'filterCluster()\' method with params', () => {
        sinon.spy(serviceRegistry, 'filterCluster');
        serviceRegistry.find(filter);
        assert.calledWith(serviceRegistry.filterCluster, filter.cluster);
      });

      it('should call the \'filterLocal()\' method with params', () => {
        sinon.spy(serviceRegistry, 'filterLocal');
        serviceRegistry.find(filter);
        assert.calledWith(serviceRegistry.filterLocal, filter.local);
      });

      it('should call the \'filterPriority()\' method with params', () => {
        sinon.spy(serviceRegistry, 'filterPriority');
        serviceRegistry.find(filter);
        assert.calledWith(serviceRegistry.filterPriority, filter.priority);
      });

      it('should call the \'filterService()\' method with params', () => {
        sinon.spy(serviceRegistry, 'filterService');
        serviceRegistry.find(filter);
        assert.calledWith(serviceRegistry.filterService, filter.service);
      });

      it('should call the \'filterUrl()\' method with params', () => {
        sinon.spy(serviceRegistry, 'filterUrl');
        serviceRegistry.find(filter);
        assert.calledWith(serviceRegistry.filterUrl, filter.url);
      });

      it('should return an array of filtered hosts', () => {
        const foundHosts = serviceRegistry.find(filter);

        assert.equal(foundHosts[0], host);
        assert.equal(foundHosts.length, 1);
      });

      it('should return all of the hosts when called without params', () => {
        const foundHosts = serviceRegistry.find();

        assert.deepEqual(foundHosts, serviceRegistry.hosts);
      });
    });

    describe('#load()', () => {
      it('should amend all provided hosts to the hosts array', () => {
        serviceRegistry.load(ServiceRegistry.mapRemoteCatalog({
          catalog: SERVICE_CATALOGS[0],
          ...fixture
        }));

        assert.equal(serviceRegistry.hosts.length, fixtureHosts.length);
      });

      it('should ignore unloadable hosts', () => {
        const unloadables = ServiceRegistry.mapRemoteCatalog({
          catalog: SERVICE_CATALOGS[0],
          ...fixture
        }).map((unloadable) => ({...unloadable, catalog: 'invalid'}));

        serviceRegistry.load(unloadables);

        assert.equal(serviceRegistry.hosts.length, 0);
      });

      it('should return itself', () => {
        assert.equal(serviceRegistry.load([]), serviceRegistry);
      });
    });

    describe('#replaced()', () => {
      let filter;
      let filteredHost;

      beforeEach('generate the service host class objects', () => {
        serviceRegistry.load(ServiceRegistry.mapRemoteCatalog({
          catalog: SERVICE_CATALOGS[0],
          ...fixture
        }));

        filteredHost = serviceRegistry.hosts[0];

        filter = {
          active: true,
          catalog: filteredHost.catalog,
          cluster: filteredHost.id,
          local: true,
          priority: true,
          service: filteredHost.service,
          url: filteredHost.url
        };
      });

      it('should mark all hosts as replaced when called without params', () => {
        serviceRegistry.replaced();
        assert.isTrue(serviceRegistry.hosts.every(
          (replacedHost) => replacedHost.replaced
        ));
      });

      it('should mark the target hosts as replaced', () => {
        serviceRegistry.replaced(filter);
        assert.isTrue(filteredHost.replaced);
      });

      it('should return the marked host', () => {
        const [replacedHost] = serviceRegistry.replaced(filter);

        assert.equal(replacedHost, filteredHost);
      });
    });

    describe('#reset()', () => {
      let filter;
      let filteredHost;

      beforeEach('generate the service host class objects', () => {
        serviceRegistry.load(ServiceRegistry.mapRemoteCatalog({
          catalog: SERVICE_CATALOGS[0],
          ...fixture
        }));

        filteredHost = serviceRegistry.hosts[0];

        filter = {
          url: filteredHost.url
        };

        serviceRegistry.failed();
      });

      it('should reset all hosts when called withour a filter', () => {
        serviceRegistry.reset();
        assert.isTrue(serviceRegistry.hosts.every(
          (resetHost) => resetHost.failed === false
        ));
      });

      it('should reset the failed status of the target host', () => {
        serviceRegistry.reset(filter);
        assert.isFalse(filteredHost.failed);
      });

      it('should not reset the failed status of non-targetted hosts', () => {
        serviceRegistry.reset(filter);
        assert.isTrue(serviceRegistry.hosts.every(
          (foundHost) => foundHost.failed || foundHost === filteredHost
        ));
      });

      it('should not reset the replaced status of hosts', () => {
        serviceRegistry.replaced();
        serviceRegistry.reset();
        assert.isTrue(serviceRegistry.hosts.every(
          (foundHost) => foundHost.replaced
        ));
      });

      it('should return the reset host', () => {
        const [resetHost] = serviceRegistry.reset(filter);

        assert.equal(resetHost, filteredHost);
      });
    });

    describe('static methods', () => {
      describe('#mapCatalogName()', () => {
        let index;
        let name;

        beforeEach(() => {
          index = 0;
          name = SERVICE_CATALOGS[index];
        });

        it('should map an index to the matching name', () => {
          assert.equal(
            ServiceRegistry.mapCatalogName({id: index, type: SCET.STRING}),
            name
          );
        });

        it('should map an index to the matching index', () => {
          assert.equal(
            ServiceRegistry.mapCatalogName({id: index, type: SCET.NUMBER}),
            index
          );
        });

        it('should map a name to the matching index', () => {
          assert.equal(
            ServiceRegistry.mapCatalogName({id: name, type: SCET.NUMBER}),
            index
          );
        });

        it('should map a name to the matching name', () => {
          assert.equal(
            ServiceRegistry.mapCatalogName({id: name, type: SCET.STRING}),
            name
          );
        });

        it('should return undefined if an index doesn\'t exist', () => {
          assert.isUndefined(
            ServiceRegistry.mapCatalogName({id: -1, type: SCET.NUMBER})
          );
        });

        it('should return undefined if a name doesn\'t exist', () => {
          assert.isUndefined(
            ServiceRegistry.mapCatalogName({id: 'invalid', type: SCET.NUMBER})
          );
        });
      });

      describe('#mapRemoteCatalog()', () => {
        it('should return an array', () => {
          const mappedHosts = ServiceRegistry.mapRemoteCatalog({
            catalog: SERVICE_CATALOGS[0],
            ...fixture
          });

          assert.isArray(mappedHosts);
        });

        it('should include all provided hosts', () => {
          const mappedHosts = ServiceRegistry.mapRemoteCatalog({
            catalog: SERVICE_CATALOGS[0],
            ...fixture
          });

          assert.equal(mappedHosts.length, fixtureHosts.length);
        });

        it('should not map using an invalid catalog name', () => {
          assert.throws(() => ServiceRegistry.mapRemoteCatalog({
            catalog: 'invalid',
            ...fixture
          }));
        });

        it('should map catalog indexes to catalog names', () => {
          const catalogIndex = 4;

          const mappedHosts = ServiceRegistry.mapRemoteCatalog({
            catalog: catalogIndex,
            ...fixture
          });

          assert.equal(
            mappedHosts[0].catalog,
            SERVICE_CATALOGS[catalogIndex]
          );
        });
      });
    });
  });
});

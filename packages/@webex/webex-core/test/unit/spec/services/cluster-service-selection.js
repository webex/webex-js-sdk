import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import {Services, ServicesV2, ServiceUrl, ServiceDetail} from '@webex/webex-core';

const clusterId = 'urn:TEAM:remote:board';
const boardUrl = 'https://board-remote.example.com/board/api/v1';
const webappUrl = 'https://board-remote.example.com/webapp';

[
  {
    name: 'Services',
    Plugin: Services,
    makeService(name, url) {
      return new ServiceUrl({
        name,
        defaultUrl: `https://board-home.example.com${new URL(url).pathname}`,
        hosts: [
          {
            id: 'urn:TEAM:home:board',
            host: 'board-home.example.com',
            priority: 1,
            homeCluster: true,
          },
          {id: clusterId, host: new URL(url).host, priority: 1},
        ],
      });
    },
    loadServices(services, group, entries) {
      services._getCatalog().updateServiceUrls(
        group,
        entries.map((entry) => entry.serialize())
      );
    },
  },
  {
    name: 'ServicesV2',
    Plugin: ServicesV2,
    makeService(name, url) {
      return new ServiceDetail({
        id: clusterId,
        serviceName: name,
        serviceUrls: [{baseUrl: url, host: new URL(url).host, priority: 1}],
      });
    },
    loadServices(services, group, entries) {
      services.updateCatalog(group, {
        activeServices: Object.fromEntries(entries.map((entry) => [entry.serviceName, entry.id])),
        services: entries.map((entry) => entry.serialize()),
      });
    },
  },
].forEach(({name, Plugin, makeService, loadServices}) => {
  describe(`${name} cluster service selection`, () => {
    let services;

    beforeEach(() => {
      services = new Plugin(undefined, {parent: new MockWebex()});
      // WDM advertises the web UI before the REST API, with the same cluster ID.
      loadServices(services, 'postauth', [
        makeService('whiteboardWebappUrl', webappUrl),
        makeService('board', boardUrl),
      ]);
    });

    [
      {
        label: 'keeps first-match behavior when no name is requested',
        params: {},
        expected: {name: 'whiteboardWebappUrl', url: webappUrl},
      },
      {
        label: 'selects the requested API despite the preceding UI entry',
        params: {serviceName: 'board'},
        expected: {name: 'board', url: boardUrl},
      },
      {
        label: 'does not substitute another name for a missing service',
        params: {serviceName: 'missing'},
        expected: undefined,
      },
      {
        label: 'requires the requested cluster as well as the service name',
        params: {clusterId: 'urn:TEAM:unknown:board', serviceName: 'board'},
        expected: undefined,
      },
      {
        label: 'respects the requested service group',
        params: {serviceName: 'board', serviceGroup: 'preauth'},
        expected: undefined,
      },
      {
        label: 'finds the requested service in an explicit matching group',
        params: {serviceName: 'board', serviceGroup: 'postauth'},
        expected: {name: 'board', url: boardUrl},
      },
    ].forEach(({label, params, expected}) => {
      it(label, () => {
        assert.deepEqual(services.getServiceFromClusterId({clusterId, ...params}), expected);
      });
    });

    it('skips differently named services in a higher-precedence group', () => {
      loadServices(services, 'override', [makeService('whiteboardWebappUrl', webappUrl)]);

      assert.deepEqual(services.getServiceFromClusterId({clusterId, serviceName: 'board'}), {
        name: 'board',
        url: boardUrl,
      });
    });

    it('preserves group precedence for the requested service name', () => {
      const overrideUrl = 'https://board-override.example.com/board/api/v1';

      loadServices(services, 'override', [makeService('board', overrideUrl)]);

      assert.deepEqual(services.getServiceFromClusterId({clusterId, serviceName: 'board'}), {
        name: 'board',
        url: overrideUrl,
      });
    });

    it('returns no match when only the UI entry exists', () => {
      loadServices(services, 'postauth', [makeService('whiteboardWebappUrl', webappUrl)]);

      assert.isUndefined(services.getServiceFromClusterId({clusterId, serviceName: 'board'}));
    });

    if (Plugin === Services) {
      it('preserves the explicit non-priority URL option for a named service', () => {
        assert.deepEqual(
          services.getServiceFromClusterId({clusterId, serviceName: 'board', priorityHost: false}),
          {name: 'board', url: 'https://board-home.example.com/board/api/v1'}
        );
      });
    }
  });
});

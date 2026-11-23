import {assert} from '@webex/test-helper-chai';
import MockWebex from '@webex/test-helper-mock-webex';
import {ServiceInterceptor, Services, ServicesV2} from '@webex/webex-core';

const clusterId = 'urn:TEAM:remote:board';
const boardUrl = 'https://board-remote.example.com/board/api/v1';
const webappUrl = 'https://board-remote.example.com/webapp';

[
  {
    name: 'Services',
    Plugin: Services,
    loadServices(services, serviceGroup, entries) {
      services._getCatalog().updateServiceUrls(
        serviceGroup,
        entries.map(({name, url}) => ({
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
        }))
      );
    },
  },
  {
    name: 'ServicesV2',
    Plugin: ServicesV2,
    loadServices(services, serviceGroup, entries) {
      services.updateCatalog(serviceGroup, {
        activeServices: Object.fromEntries(entries.map(({name}) => [name, clusterId])),
        services: entries.map(({name, url}) => ({
          id: clusterId,
          serviceName: name,
          serviceUrls: [{baseUrl: url, priority: 1}],
        })),
      });
    },
  },
].forEach(({name, Plugin, loadServices}) => {
  describe(`${name} cluster service selection`, () => {
    let services;

    beforeEach(() => {
      services = new Plugin(undefined, {
        parent: new MockWebex({config: {services: {servicesNotNeedValidation: []}}}),
      });
      // WDM advertises the web UI before the REST API, with the same cluster ID.
      loadServices(services, 'postauth', [
        {name: 'whiteboardWebappUrl', url: webappUrl},
        {name: 'board', url: boardUrl},
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
      loadServices(services, 'override', [{name: 'whiteboardWebappUrl', url: webappUrl}]);

      assert.deepEqual(services.getServiceFromClusterId({clusterId, serviceName: 'board'}), {
        name: 'board',
        url: boardUrl,
      });
    });

    it('preserves group precedence for the requested service name', () => {
      const overrideUrl = 'https://board-override.example.com/board/api/v1';

      loadServices(services, 'override', [{name: 'board', url: overrideUrl}]);

      assert.deepEqual(services.getServiceFromClusterId({clusterId, serviceName: 'board'}), {
        name: 'board',
        url: overrideUrl,
      });
    });

    it('returns no match when only the UI entry exists', () => {
      loadServices(services, 'postauth', [{name: 'whiteboardWebappUrl', url: webappUrl}]);

      assert.isUndefined(services.getServiceFromClusterId({clusterId, serviceName: 'board'}));
    });

    if (Plugin === ServicesV2) {
      it('routes Board registration requests to the active API service', async () => {
        const interceptor = new ServiceInterceptor({webex: {internal: {services}}});
        const request = await interceptor.onRequest({api: 'board', resource: '/registrations'});

        assert.deepEqual(request, {
          resource: '/registrations',
          service: 'board',
          uri: `${boardUrl}/registrations`,
        });
      });

      it('falls back to the cluster ID for an active service alias', () => {
        services.updateCatalog('postauth', {
          activeServices: {boardAlias: clusterId},
          services: [
            {
              id: clusterId,
              serviceName: 'board',
              serviceUrls: [{baseUrl: boardUrl, priority: 1}],
            },
          ],
        });

        assert.strictEqual(services.get('boardAlias'), boardUrl);
      });

      [
        [
          {name: 'whiteboardWebappUrl', url: webappUrl},
          {name: 'board', url: boardUrl},
        ],
        [
          {name: 'board', url: boardUrl},
          {name: 'whiteboardWebappUrl', url: webappUrl},
        ],
      ].forEach(([first, second]) => {
        it(`keeps both services in a shared cluster when ${first.name} loads first`, () => {
          const updatedFirst = {...first, url: `${first.url}/updated`};
          const updatedSecond = {...second, url: `${second.url}/updated`};

          loadServices(services, 'postauth', []);
          loadServices(services, 'postauth', [first, second]);

          assert.deepEqual(services.getServiceFromClusterId({clusterId}), first);
          assert.deepEqual(
            services.getServiceFromClusterId({clusterId, serviceName: first.name}),
            first
          );
          assert.deepEqual(
            services.getServiceFromClusterId({clusterId, serviceName: second.name}),
            second
          );

          loadServices(services, 'postauth', [updatedSecond, updatedFirst]);

          assert.deepEqual(services.getServiceFromClusterId({clusterId}), updatedFirst);
          assert.deepEqual(
            services.getServiceFromClusterId({clusterId, serviceName: second.name}),
            updatedSecond
          );

          loadServices(services, 'postauth', [updatedFirst]);

          assert.deepEqual(
            services.getServiceFromClusterId({clusterId, serviceName: first.name}),
            updatedFirst
          );
          assert.isUndefined(
            services.getServiceFromClusterId({clusterId, serviceName: second.name})
          );
        });
      });
    }

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

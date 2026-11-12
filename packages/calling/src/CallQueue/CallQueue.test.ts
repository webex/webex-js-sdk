import {LOGGER} from '../Logger/types';
import {getTestUtilsWebex} from '../common/testUtil';
import {CALLING_BACKEND, HTTP_METHODS, WebexRequestPayload} from '../common/types';
import {COMMON_EVENT_KEYS, MOBIUS_EVENT_KEYS} from '../Events/types';
import * as utils from '../common/Utils';
import {createCallQueueClient} from './CallQueue';
import {ACD_STATE} from './types';

const webex = getTestUtilsWebex();
const WEBEX_API_INT = 'https://integration.webexapis.com/v1/';
const WEBEX_API_PROD = 'https://webexapis.com/v1/';
const client = createCallQueueClient(webex, {level: LOGGER.INFO});
const mercuryHandlers = new Map<string, (event?: unknown) => void>(
  (webex.internal.mercury.on as jest.Mock).mock.calls.map((call) => [call[0], call[1]])
);

function deferredResponse() {
  let resolve!: (value: WebexRequestPayload) => void;
  const promise = new Promise<WebexRequestPayload>((done) => {
    resolve = done;
  });

  return {promise, resolve};
}

describe('CallQueue client', () => {
  beforeEach(() => {
    jest.spyOn(utils, 'uploadLogs').mockResolvedValue();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('registers Mercury listeners for telephony agent sync, state, and join', () => {
    expect(Array.from(mercuryHandlers.keys())).toEqual(
      expect.arrayContaining([
        'event:telephony_agents.sync',
        'event:telephony_agents.state',
        'event:telephony_agents.join',
        'event:telephony_agent.sync',
      ])
    );
  });

  it('loads primary-line queue settings', async () => {
    webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      headers: {trackingid: 'tracking-1'},
      body: {
        agentACDState: 'SIGN_OUT',
        queues: [{id: 'queue-1', name: 'Sales', available: false, allowLogOffEnabled: true}],
      },
    }));

    const response = await client.getCallQueueSettings();

    expect(webex.request).toHaveBeenCalledWith({
      uri: `${WEBEX_API_INT}telephony/config/people/me/settings/queues`,
      method: HTTP_METHODS.GET,
    });
    expect(response.statusCode).toBe(200);
    expect(response.data.callQueue?.acdState).toBe(ACD_STATE.SIGN_OUT);
    expect(response.data.callQueue?.queues[0].id).toBe('queue-1');
  });

  it('uses the production public API for a production device', async () => {
    const originalDeviceUrl = webex.internal.device.url;
    const originalDeveloperApi = webex.internal.services._serviceUrls.hydraDeveloperApi;

    try {
      webex.internal.services._serviceUrls.hydraDeveloperApi = WEBEX_API_PROD;
      webex.internal.device.url =
        'https://wdm-a.wbx2.com/wdm/api/v1/devices/c5ae3b86-1bb7-40f1-a6a9-c296ee7e61d5';
      const productionClient = createCallQueueClient(webex, {level: LOGGER.INFO});
      webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: {agentACDState: 'AVAILABLE', queues: []},
      }));

      await productionClient.getCallQueueSettings();

      expect(webex.request).toHaveBeenCalledWith({
        uri: `${WEBEX_API_PROD}telephony/config/people/me/settings/queues`,
        method: HTTP_METHODS.GET,
      });
    } finally {
      webex.internal.device.url = originalDeviceUrl;
      webex.internal.services._serviceUrls.hydraDeveloperApi = originalDeveloperApi;
    }
  });

  it('uses the Integration API when U2C discovery identifies Integration', async () => {
    const originalDeviceUrl = webex.internal.device.url;
    const originalServices = webex.config.services;

    try {
      // Some Integration registrations return a device URL without `-int`.
      webex.internal.device.url =
        'https://wdm-a.wbx2.com/wdm/api/v1/devices/c5ae3b86-1bb7-40f1-a6a9-c296ee7e61d5';
      webex.config.services = {
        discovery: {u2c: 'https://u2c-intb.ciscospark.com/u2c/api/v1'},
      };
      const integrationClient = createCallQueueClient(webex, {level: LOGGER.INFO});
      webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: {agentACDState: 'SIGN_OUT', queues: []},
      }));

      await integrationClient.getCallQueueSettings();

      expect(webex.request).toHaveBeenCalledWith({
        uri: `${WEBEX_API_INT}telephony/config/people/me/settings/queues`,
        method: HTTP_METHODS.GET,
      });
    } finally {
      webex.internal.device.url = originalDeviceUrl;
      webex.config.services = originalServices;
    }
  });

  it('detects Integration from an int-first device when discovery is unavailable', async () => {
    const originalDeviceUrl = webex.internal.device.url;
    const originalServices = webex.config.services;
    const originalDeveloperApi = webex.internal.services._serviceUrls.hydraDeveloperApi;
    try {
      webex.internal.device.url =
        'https://int-first-registration.svc.webex.com/wdm/api/v1/devices/device-1';
      webex.config.services = undefined;
      webex.internal.services._serviceUrls.hydraDeveloperApi = undefined;
      const integrationClient = createCallQueueClient(webex, {level: LOGGER.INFO});
      webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: {agentACDState: 'SIGN_OUT', queues: []},
      }));

      await integrationClient.getCallQueueSettings();

      expect(webex.request).toHaveBeenCalledWith({
        uri: `${WEBEX_API_INT}telephony/config/people/me/settings/queues`,
        method: HTTP_METHODS.GET,
      });
    } finally {
      webex.internal.device.url = originalDeviceUrl;
      webex.config.services = originalServices;
      webex.internal.services._serviceUrls.hydraDeveloperApi = originalDeveloperApi;
    }
  });

  it('uses active service discovery when the developer API URL is not cached', async () => {
    const services = webex.internal.services;
    const originalDeviceUrl = webex.internal.device.url;
    const originalServices = webex.config.services;
    const originalDeveloperApi = services._serviceUrls.hydraDeveloperApi;
    const originalActive = services._activeServices;
    const originalGet = services.get;
    try {
      webex.internal.device.url = 'https://wdm-a.wbx2.com/wdm/api/v1/devices/device-1';
      webex.config.services = undefined;
      services._serviceUrls.hydraDeveloperApi = undefined;
      services._activeServices = {
        broadworksIdpProxy: '',
        contactsService: '',
        hydra: '',
        janus: '',
        mercuryApi: '',
        mobius: '',
        hydraDeveloperApi: 'active-developer-api',
      };
      services.get = jest.fn().mockReturnValue(WEBEX_API_PROD);
      const productionClient = createCallQueueClient(webex, {level: LOGGER.INFO});
      webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: {agentACDState: 'AVAILABLE', queues: []},
      }));

      await productionClient.getCallQueueSettings();

      expect(services.get).toHaveBeenCalledWith('active-developer-api');
      expect(webex.request).toHaveBeenCalledWith({
        uri: `${WEBEX_API_PROD}telephony/config/people/me/settings/queues`,
        method: HTTP_METHODS.GET,
      });
    } finally {
      webex.internal.device.url = originalDeviceUrl;
      webex.config.services = originalServices;
      services._serviceUrls.hydraDeveloperApi = originalDeveloperApi;
      services._activeServices = originalActive;
      services.get = originalGet;
    }
  });

  it('uses the SDK default Production U2C when developer discovery is unavailable', async () => {
    const originalDeviceUrl = webex.internal.device.url;
    const originalServices = webex.config.services;
    const originalDeveloperApi = webex.internal.services._serviceUrls.hydraDeveloperApi;
    try {
      webex.internal.device.url = 'https://wdm-a.wbx2.com/wdm/api/v1/devices/device-1';
      webex.config.services = {discovery: {u2c: 'https://u2c.svc.webex.com/u2c/api/v1'}};
      webex.internal.services._serviceUrls.hydraDeveloperApi = undefined;
      const productionClient = createCallQueueClient(webex, {level: LOGGER.INFO});
      webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: {agentACDState: 'AVAILABLE', queues: []},
      }));

      await productionClient.getCallQueueSettings();

      expect(webex.request).toHaveBeenCalledWith({
        uri: `${WEBEX_API_PROD}telephony/config/people/me/settings/queues`,
        method: HTTP_METHODS.GET,
      });
    } finally {
      webex.internal.device.url = originalDeviceUrl;
      webex.config.services = originalServices;
      webex.internal.services._serviceUrls.hydraDeveloperApi = originalDeveloperApi;
    }
  });

  it('resolves the environment after a client is created before discovery is ready', async () => {
    const originalDeviceUrl = webex.internal.device.url;
    const originalServices = webex.config.services;
    const originalDeveloperApi = webex.internal.services._serviceUrls.hydraDeveloperApi;
    try {
      webex.internal.device.url = 'https://wdm-a.wbx2.com/wdm/api/v1/devices/device-1';
      webex.config.services = undefined;
      webex.internal.services._serviceUrls.hydraDeveloperApi = undefined;
      const earlyClient = createCallQueueClient(webex, {level: LOGGER.INFO});
      expect((await earlyClient.getCallQueueSettings()).statusCode).toBe(400);
      expect(webex.request).not.toHaveBeenCalled();

      webex.config.services = {discovery: {u2c: 'https://u2c-intb.ciscospark.com/u2c/api/v1'}};
      webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: {agentACDState: 'AVAILABLE', queues: []},
      }));
      expect((await earlyClient.getCallQueueSettings()).statusCode).toBe(200);
      expect(webex.request).toHaveBeenCalledWith({
        uri: `${WEBEX_API_INT}telephony/config/people/me/settings/queues`,
        method: HTTP_METHODS.GET,
      });
    } finally {
      webex.internal.device.url = originalDeviceUrl;
      webex.config.services = originalServices;
      webex.internal.services._serviceUrls.hydraDeveloperApi = originalDeveloperApi;
    }
  });

  it('starts accepting requests after delayed device registration', async () => {
    const lateWebex = getTestUtilsWebex();
    const features = lateWebex.internal.device.features;
    (lateWebex.internal.device as any).features = undefined;
    const earlyClient = createCallQueueClient(lateWebex, {level: LOGGER.INFO});
    expect((await earlyClient.getCallQueueSettings()).statusCode).toBe(501);
    expect(lateWebex.request).not.toHaveBeenCalled();

    lateWebex.internal.device.features = features;
    lateWebex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: []},
    }));
    expect((await earlyClient.getCallQueueSettings()).statusCode).toBe(200);
    expect(lateWebex.internal.mercury.on).toHaveBeenCalledWith(
      MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_SYNC,
      expect.any(Function)
    );
    earlyClient.dispose();
  });

  it('does not change clouds after an environment has been selected', async () => {
    const otherWebex = getTestUtilsWebex();
    const stableClient = createCallQueueClient(otherWebex, {level: LOGGER.INFO});
    otherWebex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: []},
    }));
    expect((await stableClient.getCallQueueSettings()).statusCode).toBe(200);

    otherWebex.internal.device.url = 'https://wdm-a.wbx2.com/wdm/api/v1/devices/device-1';
    otherWebex.config.services = {discovery: {u2c: 'https://u2c.wbx2.com/u2c/api/v1'}};
    otherWebex.internal.services._serviceUrls.hydraDeveloperApi = WEBEX_API_PROD;
    expect((await stableClient.getCallQueueSettings()).statusCode).toBe(400);
    expect(otherWebex.request).toHaveBeenCalledTimes(1);
    stableClient.dispose();
  });

  it('does not send a token when the environment cannot be determined', async () => {
    const originalDeviceUrl = webex.internal.device.url;
    const originalServices = webex.config.services;
    const originalDeveloperApi = webex.internal.services._serviceUrls.hydraDeveloperApi;
    try {
      webex.internal.device.url = 'https://wdm-a.wbx2.com/wdm/api/v1/devices/device-1';
      webex.config.services = undefined;
      webex.internal.services._serviceUrls.hydraDeveloperApi = undefined;
      const unknownClient = createCallQueueClient(webex, {level: LOGGER.INFO});

      const response = await unknownClient.getCallQueueSettings();

      expect(response.statusCode).toBe(400);
      expect(webex.request).not.toHaveBeenCalled();
    } finally {
      webex.internal.device.url = originalDeviceUrl;
      webex.config.services = originalServices;
      webex.internal.services._serviceUrls.hydraDeveloperApi = originalDeveloperApi;
    }
  });

  it('does not send a token when Integration and Production evidence conflicts', async () => {
    const originalDeviceUrl = webex.internal.device.url;
    const originalServices = webex.config.services;
    try {
      webex.internal.device.url = 'https://wdm-a.wbx2.com/wdm/api/v1/devices/device-1';
      webex.config.services = {discovery: {u2c: 'https://u2c.wbx2.com/u2c/api/v1'}};
      const conflictingClient = createCallQueueClient(webex, {level: LOGGER.INFO});

      const response = await conflictingClient.getCallQueueSettings();

      expect(response.statusCode).toBe(400);
      expect(webex.request).not.toHaveBeenCalled();
    } finally {
      webex.internal.device.url = originalDeviceUrl;
      webex.config.services = originalServices;
    }
  });

  it('uses the FedRAMP API for government configurations', async () => {
    const originalFedramp = webex.config.fedramp;
    try {
      webex.config.fedramp = true;
      const governmentClient = createCallQueueClient(webex, {level: LOGGER.INFO});
      webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: {agentACDState: 'AVAILABLE', queues: []},
      }));
      await governmentClient.getCallQueueSettings();
      expect(webex.request).toHaveBeenCalledWith({
        uri: 'https://api-usgov.webex.com/v1/telephony/config/people/me/settings/queues',
        method: HTTP_METHODS.GET,
      });
    } finally {
      webex.config.fedramp = originalFedramp;
    }
  });

  it('fills a missing display name from the queue catalog', async () => {
    const queueId =
      'Y2lzY29zcGFyazovL3VzL0NBTExfUVVFVUUvNGFiNmJkZGEtYzY4NC00OGYzLTkyMTctNjBmZGJiODA0OWIz';
    const gatewayQueueId = '4ab6bdda-c684-48f3-9217-60fdbb8049b3';
    webex.request.mockImplementation(async (options: {uri: string}) => {
      if (options.uri.endsWith('telephony/config/queues')) {
        return {
          statusCode: 200,
          body: {
            queues: [{id: queueId, name: 'TestQueue', extension: '4000', enabled: true}],
          },
        };
      }

      return {
        statusCode: 200,
        body: {
          agentACDState: 'SIGN_OUT',
          queues: [
            {id: gatewayQueueId, available: true, extension: '4000', allowLogOffEnabled: false},
          ],
        },
      };
    });

    const response = await client.getCallQueueSettings();

    expect(webex.request).toHaveBeenCalledWith({
      uri: `${WEBEX_API_INT}telephony/config/queues`,
      method: HTTP_METHODS.GET,
    });
    expect(response.data.callQueue?.queues[0].name).toBe('TestQueue');
    expect(response.data.callQueue?.queues[0].id).toBe(gatewayQueueId);
    expect(response.data.callQueue?.queues[0].allowLogOffEnabled).toBe(false);
  });

  it('follows same-catalog Link headers to find queue names', async () => {
    const catalogClient = createCallQueueClient(webex, {level: LOGGER.INFO});
    const next = `${WEBEX_API_INT}telephony/config/queues?start=1`;
    webex.request.mockImplementation(async (options: {uri: string}) => {
      if (options.uri === next) {
        return {statusCode: 200, body: {queues: [{id: 'queue-next', name: 'Next queue'}]}};
      }
      if (options.uri.endsWith('/telephony/config/queues')) {
        return {statusCode: 200, body: {queues: []}, headers: {link: `<${next}>; rel="next"`}};
      }

      return {statusCode: 200, body: {agentACDState: 'AVAILABLE', queues: [{id: 'queue-next'}]}};
    });

    const response = await catalogClient.getCallQueueSettings();

    expect(response.data.callQueue?.queues[0].name).toBe('Next queue');
    expect(webex.request).toHaveBeenCalledWith({uri: next, method: HTTP_METHODS.GET});
  });

  it('does not follow a catalog Link to another origin', async () => {
    const catalogClient = createCallQueueClient(webex, {level: LOGGER.INFO});
    webex.request
      .mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: {agentACDState: 'AVAILABLE', queues: [{id: 'queue-next'}]},
      }))
      .mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: {queues: []},
        headers: {link: '<https://example.com/v1/telephony/config/queues?start=1>; rel="next"'},
      }));

    await catalogClient.getCallQueueSettings();

    expect(webex.request).toHaveBeenCalledTimes(2);
  });

  it('loads a secondary line when the line id is safe', async () => {
    webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: []},
    }));

    await client.getCallQueueSettings('line-owner-1');

    expect(webex.request).toHaveBeenCalledWith({
      uri: `${WEBEX_API_INT}telephony/config/people/me/settings/secondaryLines/line-owner-1/queues`,
      method: HTTP_METHODS.GET,
    });
  });

  it('encodes a raw virtual-line UUID in public API requests', async () => {
    const lineId = '36d87d6c-7531-4b2f-a4ef-d71e6aacb86f';
    const encodedLine = btoa(`ciscospark://us/VIRTUAL_LINE/${lineId}`).replace(/=+$/, '');
    webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: []},
    }));

    await client.getCallQueueSettings(lineId);

    expect(webex.request).toHaveBeenCalledWith({
      uri: `${WEBEX_API_INT}telephony/config/people/me/settings/secondaryLines/${encodedLine}/queues`,
      method: HTTP_METHODS.GET,
    });
  });

  it('encodes a raw queue UUID in a public membership update', async () => {
    const queueId = '4ab6bdda-c684-48f3-9217-60fdbb8049b3';
    const encodedQueue = btoa(`ciscospark://us/CALL_QUEUE/${queueId}`).replace(/=+$/, '');
    webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: [{id: encodedQueue, available: true}]},
    }));

    await client.updateCallQueueSettings({queues: [{id: queueId, available: true}]});

    expect(webex.request).toHaveBeenCalledWith({
      uri: `${WEBEX_API_INT}telephony/config/people/me/settings/queues`,
      method: HTTP_METHODS.PUT,
      body: {queues: [{id: encodedQueue, available: true}]},
    });
  });

  it('does not request settings for a line id that could change the path', async () => {
    const response = await client.getCallQueueSettings('../other');

    expect(webex.request).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(400);
  });

  it('patches ACD state and queue join', async () => {
    webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {
        agentACDState: 'AVAILABLE',
        queues: [{id: 'queue-1', available: true, allowLogOffEnabled: true}],
      },
    }));

    const response = await client.updateCallQueueSettings({
      agentACDState: ACD_STATE.AVAILABLE,
      queues: [{id: 'queue-1', available: true}],
    });

    expect(webex.request).toHaveBeenCalledWith({
      uri: `${WEBEX_API_INT}telephony/config/people/me/settings/queues`,
      method: HTTP_METHODS.PUT,
      body: {
        agentACDState: ACD_STATE.AVAILABLE,
        queues: [{id: 'queue-1', available: true}],
      },
    });
    expect(response.data.callQueue?.acdState).toBe(ACD_STATE.AVAILABLE);
  });

  it('keeps a queue joined when the agent is not allowed to log off', async () => {
    webex.request.mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {
        agentACDState: 'AVAILABLE',
        queues: [{id: 'locked', name: 'Overnight', available: true, allowLogOffEnabled: false}],
      },
    }));
    await client.getCallQueueSettings();
    webex.request.mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{statusCode: 204}));

    await client.updateCallQueueSettings({
      queues: [{id: 'locked', available: false}],
    });

    expect(webex.request).toHaveBeenLastCalledWith({
      uri: `${WEBEX_API_INT}telephony/config/people/me/settings/queues`,
      method: HTTP_METHODS.PUT,
      body: {
        queues: [{id: 'locked', available: true}],
      },
    });
  });

  it('uses the target line settings when a queue is updated', async () => {
    const lineAwareClient = createCallQueueClient(webex, {level: LOGGER.INFO});
    webex.request.mockImplementation(async (options: {uri: string; method?: string}) => {
      if (options.method === HTTP_METHODS.PUT) {
        return <WebexRequestPayload>(<unknown>{statusCode: 204});
      }

      const isSecondaryLine = options.uri.includes('/secondaryLines/line-owner-2/');

      return <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: {
          agentACDState: 'AVAILABLE',
          queues: [
            {
              id: 'shared-queue',
              name: 'Shared queue',
              available: true,
              allowLogOffEnabled: !isSecondaryLine,
            },
          ],
        },
      });
    });

    await lineAwareClient.getCallQueueSettings();
    await lineAwareClient.updateCallQueueSettings(
      {queues: [{id: 'shared-queue', available: false}]},
      'line-owner-2'
    );

    expect(webex.request).toHaveBeenNthCalledWith(1, {
      uri: `${WEBEX_API_INT}telephony/config/people/me/settings/queues`,
      method: HTTP_METHODS.GET,
    });
    expect(webex.request).toHaveBeenNthCalledWith(2, {
      uri: `${WEBEX_API_INT}telephony/config/people/me/settings/secondaryLines/line-owner-2/queues`,
      method: HTTP_METHODS.GET,
    });
    expect(webex.request).toHaveBeenNthCalledWith(3, {
      uri: `${WEBEX_API_INT}telephony/config/people/me/settings/secondaryLines/line-owner-2/queues`,
      method: HTTP_METHODS.PUT,
      body: {queues: [{id: 'shared-queue', available: true}]},
    });
  });

  it('rejects an update that sets nothing', async () => {
    const response = await client.updateCallQueueSettings({});

    expect(webex.request).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(400);
  });

  it('rejects an empty queue update', async () => {
    const response = await client.updateCallQueueSettings({queues: []});

    expect(webex.request).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(400);
    expect(response.data.error).toBe('queues must include at least one queue update');
  });

  it('rejects an unsupported ACD state', async () => {
    const response = await client.updateCallQueueSettings({
      agentACDState: 'LUNCH' as ACD_STATE,
    });

    expect(webex.request).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(400);
  });

  it('does not call the network when the user is not on Webex Calling cloud', async () => {
    const backend = jest.spyOn(utils, 'getCallingBackEnd').mockReturnValue(CALLING_BACKEND.UCM);
    const other = createCallQueueClient(webex, {level: LOGGER.INFO});

    const response = await other.getCallQueueSettings();
    backend.mockRestore();

    expect(webex.request).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(501);
  });

  it('posts telephony sync', async () => {
    webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{statusCode: 204}));

    const response = await client.syncTelephonyCalls();

    expect(webex.request).toHaveBeenCalledWith({
      uri: `${WEBEX_API_INT}telephony/calls/sync/invoke`,
      method: HTTP_METHODS.POST,
      body: {
        wdmUrl: webex.internal.device.url,
        resources: [{resource: 'telephony_agents'}],
      },
    });
    expect(response.statusCode).toBe(204);
    expect(response.message).toBe('SUCCESS');
  });

  it('rejects sync without a registered device URL', async () => {
    const original = webex.internal.device.url;
    try {
      webex.internal.device.url = '';
      const response = await client.syncTelephonyCalls();
      expect(response.statusCode).toBe(400);
      expect(webex.request).not.toHaveBeenCalled();
    } finally {
      webex.internal.device.url = original;
    }
  });

  it('scopes virtual-line events and ignores events for another person', async () => {
    const lineId = '36d87d6c-7531-4b2f-a4ef-d71e6aacb86f';
    const scoped = createCallQueueClient(webex, {level: LOGGER.INFO});
    const listener = jest.fn();
    scoped.on(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
    webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: [{id: 'queue-1', name: 'Sales', available: true}]},
    }));
    await scoped.getCallQueueSettings(lineId);
    const handlers = new Map<string, (event?: unknown) => void>(
      (webex.internal.mercury.on as jest.Mock).mock.calls.map((call) => [call[0], call[1]])
    );
    const join = handlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_JOIN);
    join?.({
      data: {
        actorType: 'PERSON',
        actorId: 'a-different-person',
        joinInfo: [{queueId: 'queue-1', status: 'unjoined'}],
      },
    });
    join?.({
      data: {
        actorType: 'PLACE',
        actorId: lineId,
        joinInfo: [{queueId: 'queue-1', status: 'unjoined'}],
      },
    });
    expect(listener).not.toHaveBeenCalled();
    join?.({
      data: {
        actorType: 'VIRTUAL_LINE',
        actorId: btoa(`ciscospark://us/VIRTUAL_LINE/${lineId}`),
        joinInfo: [{queueId: 'queue-1', status: 'unjoined'}],
      },
    });
    expect(listener).toHaveBeenCalledWith({
      acdState: ACD_STATE.AVAILABLE,
      queues: [{id: 'queue-1', name: 'Sales', available: false}],
      lineOwnerId: lineId,
    });
    scoped.dispose();
  });

  it('refreshes the actual state when a join event arrives before settings have loaded', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO});
    const listener = jest.fn();
    other.on(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
    otherWebex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: [{id: 'queue-1', name: 'Sales', available: true}]},
    }));
    const handlers = new Map<string, (event?: unknown) => void>(
      (otherWebex.internal.mercury.on as jest.Mock).mock.calls.map((call) => [call[0], call[1]])
    );
    handlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_JOIN)?.({
      data: {
        actorType: 'PERSON',
        actorId: btoa(`ciscospark://us/PEOPLE/${otherWebex.internal.device.userId}`),
        joinInfo: [{queueId: 'queue-1', status: 'joined'}],
      },
    });
    expect(listener).not.toHaveBeenCalled();
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(otherWebex.request).toHaveBeenCalledWith({
      uri: `${WEBEX_API_INT}telephony/config/people/me/settings/queues`,
      method: HTTP_METHODS.GET,
    });
    expect(listener).toHaveBeenCalledWith({
      acdState: ACD_STATE.AVAILABLE,
      queues: [{id: 'queue-1', name: 'Sales', available: true}],
    });
    other.dispose();
  });

  it('refreshes again when an uncached join event is followed by a state event', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO});
    const listener = jest.fn();
    other.on(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
    const first = deferredResponse();
    const second = deferredResponse();
    otherWebex.request.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const handlers = new Map<string, (event?: unknown) => void>(
      (otherWebex.internal.mercury.on as jest.Mock).mock.calls.map((call) => [call[0], call[1]])
    );
    const actorId = otherWebex.internal.device.userId;
    handlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_JOIN)?.({
      data: {actorType: 'PERSON', actorId, joinInfo: [{queueId: 'queue-1', status: 'joined'}]},
    });
    handlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_STATE)?.({
      data: {actorType: 'PERSON', actorId, acdStateInfo: {state: 'unavailable'}},
    });
    first.resolve(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: [{id: 'queue-1', name: 'Sales', available: true}]},
    }));
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(listener).not.toHaveBeenCalled();
    second.resolve(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {
        agentACDState: 'UNAVAILABLE',
        queues: [{id: 'queue-1', name: 'Sales', available: true}],
      },
    }));
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(listener).toHaveBeenCalledWith({
      acdState: ACD_STATE.UNAVAILABLE,
      queues: [{id: 'queue-1', name: 'Sales', available: true}],
    });
    other.dispose();
  });

  it('does not overwrite a newer Mercury state with an older in-flight GET', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO});
    const body = {
      agentACDState: 'AVAILABLE',
      queues: [{id: 'queue-1', name: 'Sales', available: true}],
    };
    otherWebex.request.mockResolvedValueOnce(<WebexRequestPayload>(
      (<unknown>{statusCode: 200, body})
    ));
    await other.getCallQueueSettings();
    const oldGet = deferredResponse();
    otherWebex.request.mockReturnValueOnce(oldGet.promise);
    const read = other.getCallQueueSettings();
    const handlers = new Map<string, (event?: unknown) => void>(
      (otherWebex.internal.mercury.on as jest.Mock).mock.calls.map((call) => [call[0], call[1]])
    );
    handlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_STATE)?.({
      data: {actorType: 'PERSON', actorId: otherWebex.internal.device.userId, state: 'unavailable'},
    });
    oldGet.resolve(<WebexRequestPayload>(<unknown>{statusCode: 200, body}));
    const response = await read;
    expect(response.data.callQueue?.acdState).toBe(ACD_STATE.UNAVAILABLE);
    expect(response.data.callQueue?.queues).toEqual(body.queues);
    other.dispose();
  });

  it('waits for the latest replacement event refresh while a GET is pending', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO});
    const original = deferredResponse();
    const first = deferredResponse();
    const second = deferredResponse();
    otherWebex.request
      .mockReturnValueOnce(original.promise)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    let settled = false;
    const read = other.getCallQueueSettings().then((result) => {
      settled = true;

      return result;
    });
    const handlers = new Map<string, (event?: unknown) => void>(
      (otherWebex.internal.mercury.on as jest.Mock).mock.calls.map((call) => [call[0], call[1]])
    );
    const actorId = otherWebex.internal.device.userId;
    handlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_JOIN)?.({
      data: {actorType: 'PERSON', actorId, joinInfo: [{queueId: 'q1', status: 'joined'}]},
    });
    original.resolve(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {
        agentACDState: 'AVAILABLE',
        queues: [],
      },
    }));
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    handlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_STATE)?.({
      data: {actorType: 'PERSON', actorId, state: 'unavailable'},
    });
    first.resolve(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {
        agentACDState: 'AVAILABLE',
        queues: [],
      },
    }));
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(settled).toBe(false);
    second.resolve(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {
        agentACDState: 'UNAVAILABLE',
        queues: [],
      },
    }));
    const response = await read;
    expect(response.data.callQueue?.acdState).toBe(ACD_STATE.UNAVAILABLE);
    other.dispose();
  });

  it('does not let an older event refresh overwrite a later GET', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO});
    const listener = jest.fn();
    other.on(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
    const oldGet = deferredResponse();
    otherWebex.request
      .mockReturnValueOnce(oldGet.promise)
      .mockResolvedValueOnce(<WebexRequestPayload>(
        (<unknown>{statusCode: 200, body: {agentACDState: 'UNAVAILABLE', queues: []}})
      ));
    const handlers = new Map<string, (event?: unknown) => void>(
      (otherWebex.internal.mercury.on as jest.Mock).mock.calls.map((call) => [call[0], call[1]])
    );
    handlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_STATE)?.({
      data: {actorType: 'PERSON', actorId: otherWebex.internal.device.userId, state: 'available'},
    });
    await other.getCallQueueSettings();
    oldGet.resolve(<WebexRequestPayload>(
      (<unknown>{statusCode: 200, body: {agentACDState: 'AVAILABLE', queues: []}})
    ));
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(listener).not.toHaveBeenCalled();
    otherWebex.request.mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{statusCode: 204}));
    const updated = await other.updateCallQueueSettings({queues: [{id: 'q1', available: true}]});
    expect(updated.data.callQueue?.acdState).toBe(ACD_STATE.UNAVAILABLE);
    other.dispose();
  });

  it('does not let an older GET overwrite a successful PATCH', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO});
    const initial = {agentACDState: 'AVAILABLE', queues: []};
    otherWebex.request.mockResolvedValueOnce(<WebexRequestPayload>(
      (<unknown>{statusCode: 200, body: initial})
    ));
    await other.getCallQueueSettings();
    const oldGet = deferredResponse();
    otherWebex.request
      .mockReturnValueOnce(oldGet.promise)
      .mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{statusCode: 204}));
    const read = other.getCallQueueSettings();
    await other.updateCallQueueSettings({agentACDState: ACD_STATE.UNAVAILABLE});
    oldGet.resolve(<WebexRequestPayload>(<unknown>{statusCode: 200, body: initial}));
    expect((await read).data.callQueue?.acdState).toBe(ACD_STATE.UNAVAILABLE);
    other.dispose();
  });

  it('does not let an older GET overwrite a later completed GET', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO});
    const oldGet = deferredResponse();
    otherWebex.request
      .mockReturnValueOnce(oldGet.promise)
      .mockResolvedValueOnce(<WebexRequestPayload>(
        (<unknown>{statusCode: 200, body: {agentACDState: 'UNAVAILABLE', queues: []}})
      ));
    const read = other.getCallQueueSettings();
    await other.getCallQueueSettings();
    oldGet.resolve(<WebexRequestPayload>(
      (<unknown>{statusCode: 200, body: {agentACDState: 'AVAILABLE', queues: []}})
    ));
    expect((await read).data.callQueue?.acdState).toBe(ACD_STATE.UNAVAILABLE);
    other.dispose();
  });

  it('refreshes after a PATCH overlaps a Mercury event', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO});
    otherWebex.request.mockResolvedValueOnce(<WebexRequestPayload>(
      (<unknown>{statusCode: 200, body: {agentACDState: 'AVAILABLE', queues: []}})
    ));
    await other.getCallQueueSettings();
    const patch = deferredResponse();
    otherWebex.request
      .mockReturnValueOnce(patch.promise)
      .mockResolvedValueOnce(<WebexRequestPayload>(
        (<unknown>{statusCode: 200, body: {agentACDState: 'WRAP_UP', queues: []}})
      ));
    const update = other.updateCallQueueSettings({agentACDState: ACD_STATE.WRAP_UP});
    const handlers = new Map<string, (event?: unknown) => void>(
      (otherWebex.internal.mercury.on as jest.Mock).mock.calls.map((call) => [call[0], call[1]])
    );
    handlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_STATE)?.({
      data: {actorType: 'PERSON', actorId: otherWebex.internal.device.userId, state: 'unavailable'},
    });
    patch.resolve(<WebexRequestPayload>(<unknown>{statusCode: 204}));
    const response = await update;
    expect(response.statusCode).toBe(204);
    expect(response.data.callQueue?.acdState).toBe(ACD_STATE.WRAP_UP);
    expect(otherWebex.request).toHaveBeenCalledTimes(3);
    other.dispose();
  });

  it('fails safely when the first GET has no agent state', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO});
    otherWebex.request.mockResolvedValueOnce(<WebexRequestPayload>(
      (<unknown>{statusCode: 200, body: {queues: [{id: 'q1', name: 'Sales', available: true}]}})
    ));
    const response = await other.getCallQueueSettings();
    expect(response.statusCode).toBe(502);
    expect(response.data.callQueue).toBeUndefined();
    other.dispose();
  });

  it('loads settings after a queue-only PATCH with no cached state', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO});
    otherWebex.request
      .mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{statusCode: 204}))
      .mockResolvedValueOnce(<WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: {
          agentACDState: 'UNAVAILABLE',
          queues: [{id: 'q1', name: 'Sales', available: true}],
        },
      }));
    const response = await other.updateCallQueueSettings({queues: [{id: 'q1', available: true}]});
    expect(response.statusCode).toBe(204);
    expect(response.data.callQueue?.acdState).toBe(ACD_STATE.UNAVAILABLE);
    expect(otherWebex.request).toHaveBeenCalledTimes(2);
    other.dispose();
  });

  it('uses the supplied Webex instance and disposes only its own Mercury listeners', async () => {
    const otherWebex = getTestUtilsWebex();
    const other = createCallQueueClient(otherWebex, {level: LOGGER.INFO});
    const registered = (otherWebex.internal.mercury.on as jest.Mock).mock.calls.slice();
    otherWebex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: []},
    }));
    await other.getCallQueueSettings();
    expect(otherWebex.request).toHaveBeenCalledTimes(1);
    expect(webex.request).not.toHaveBeenCalled();
    other.dispose();
    registered.forEach(([event, callback]) => {
      expect(otherWebex.internal.mercury.off).toHaveBeenCalledWith(event, callback);
    });
    expect(otherWebex.internal.mercury.off).toHaveBeenCalledTimes(registered.length);
  });

  it('emits the merged status when a Mercury state event arrives', () => {
    const listener = jest.fn();
    client.on(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
    const stateHandler = mercuryHandlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_STATE);

    stateHandler?.({data: {acdStateInfo: {state: 'unavailable'}}});

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({acdState: ACD_STATE.UNAVAILABLE})
    );
    client.off(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
  });

  it('emits the full queue snapshot when a Mercury sync event arrives', () => {
    const listener = jest.fn();
    client.on(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
    const syncHandler = mercuryHandlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_SYNC);

    syncHandler?.({
      data: {
        agentACDState: 'available',
        queues: [{id: 'sync-queue', name: 'Sync queue', available: true}],
      },
    });

    expect(listener).toHaveBeenCalledWith({
      acdState: ACD_STATE.AVAILABLE,
      queues: [{id: 'sync-queue', name: 'Sync queue', available: true}],
    });
    client.off(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
  });

  it('emits the queue membership change when a Mercury join event arrives', () => {
    const listener = jest.fn();
    client.on(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
    const joinHandler = mercuryHandlers.get(MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_JOIN);

    joinHandler?.({data: {queues: [{id: 'joined-queue', name: 'Joined queue', available: true}]}});

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        queues: expect.arrayContaining([
          expect.objectContaining({id: 'joined-queue', name: 'Joined queue', available: true}),
        ]),
      })
    );
    client.off(COMMON_EVENT_KEYS.CALL_QUEUE_UPDATED, listener);
  });

  it('returns the service error when the settings request fails', async () => {
    webex.request.mockRejectedValue({statusCode: 401});

    const response = await client.getCallQueueSettings();

    expect(response.statusCode).toBe(401);
    expect(response.message).toBe('FAILURE');
  });
});

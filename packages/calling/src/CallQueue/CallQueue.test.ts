import {LOGGER} from '../Logger/types';
import {getTestUtilsWebex} from '../common/testUtil';
import {CALLING_BACKEND, HTTP_METHODS, WebexRequestPayload} from '../common/types';
import {COMMON_EVENT_KEYS, MOBIUS_EVENT_KEYS} from '../Events/types';
import * as utils from '../common/Utils';
import {createCallQueueClient} from './CallQueue';
import {ACD_STATE} from './types';

const webex = getTestUtilsWebex();
const HYDRA = 'https://hydra-a.wbx2.com/v1/';
const WEBEX_CALLING_GATEWAY_INT = 'https://integration.webexapis.com/v1/';
const WEBEX_CALLING_GATEWAY_PROD = 'https://webexapis.com/v1/';
const client = createCallQueueClient(webex, {level: LOGGER.INFO});
const mercuryHandlers = new Map<string, (event?: unknown) => void>(
  (webex.internal.mercury.on as jest.Mock).mock.calls.map((call) => [call[0], call[1]])
);

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
        MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_SYNC,
        MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_STATE,
        MOBIUS_EVENT_KEYS.TELEPHONY_AGENT_JOIN,
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
      uri: `${WEBEX_CALLING_GATEWAY_INT}telephony/config/people/me/settings/queues`,
      method: HTTP_METHODS.GET,
    });
    expect(response.statusCode).toBe(200);
    expect(response.data.callQueue?.acdState).toBe(ACD_STATE.SIGN_OUT);
    expect(response.data.callQueue?.queues[0].id).toBe('queue-1');
  });

  it('uses the production Webex API base for a production device', async () => {
    const originalDeviceUrl = webex.internal.device.url;

    try {
      webex.internal.device.url =
        'https://wdm-a.wbx2.com/wdm/api/v1/devices/c5ae3b86-1bb7-40f1-a6a9-c296ee7e61d5';
      const productionClient = createCallQueueClient(webex, {level: LOGGER.INFO});
      webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: {agentACDState: 'AVAILABLE', queues: []},
      }));

      await productionClient.getCallQueueSettings();

      expect(webex.request).toHaveBeenCalledWith({
        uri: `${WEBEX_CALLING_GATEWAY_PROD}telephony/config/people/me/settings/queues`,
        method: HTTP_METHODS.GET,
      });
    } finally {
      webex.internal.device.url = originalDeviceUrl;
    }
  });

  it('fills a missing display name from the queue catalog', async () => {
    const queueId =
      'Y2lzY29zcGFyazovL3VzL0NBTExfUVVFVUUvNGFiNmJkZGEtYzY4NC00OGYzLTkyMTctNjBmZGJiODA0OWIz';
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
          queues: [{id: queueId, available: true, extension: '4000', allowLogOffEnabled: false}],
        },
      };
    });

    const response = await client.getCallQueueSettings();

    expect(webex.request).toHaveBeenCalledWith({
      uri: `${HYDRA}telephony/config/queues`,
      method: HTTP_METHODS.GET,
    });
    expect(response.data.callQueue?.queues[0].name).toBe('TestQueue');
    expect(response.data.callQueue?.queues[0].allowLogOffEnabled).toBe(false);
  });

  it('loads a secondary line when the line id is safe', async () => {
    webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: {agentACDState: 'AVAILABLE', queues: []},
    }));

    await client.getCallQueueSettings('line-owner-1');

    expect(webex.request).toHaveBeenCalledWith({
      uri: `${WEBEX_CALLING_GATEWAY_INT}telephony/config/people/me/settings/secondarylines/line-owner-1/queues`,
      method: HTTP_METHODS.GET,
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
      uri: `${WEBEX_CALLING_GATEWAY_INT}telephony/config/people/me/settings/queues`,
      method: HTTP_METHODS.PATCH,
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
      uri: `${WEBEX_CALLING_GATEWAY_INT}telephony/config/people/me/settings/queues`,
      method: HTTP_METHODS.PATCH,
      body: {
        queues: [{id: 'locked', available: true}],
      },
    });
  });

  it('uses the target line settings when a queue is updated', async () => {
    const lineAwareClient = createCallQueueClient(webex, {level: LOGGER.INFO});
    webex.request.mockImplementation(async (options: {uri: string; method?: string}) => {
      if (options.method === HTTP_METHODS.PATCH) {
        return <WebexRequestPayload>(<unknown>{statusCode: 204});
      }

      const isSecondaryLine = options.uri.includes('/secondarylines/line-owner-2/');

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
      uri: `${WEBEX_CALLING_GATEWAY_INT}telephony/config/people/me/settings/queues`,
      method: HTTP_METHODS.GET,
    });
    expect(webex.request).toHaveBeenNthCalledWith(2, {
      uri: `${WEBEX_CALLING_GATEWAY_INT}telephony/config/people/me/settings/secondarylines/line-owner-2/queues`,
      method: HTTP_METHODS.GET,
    });
    expect(webex.request).toHaveBeenNthCalledWith(3, {
      uri: `${WEBEX_CALLING_GATEWAY_INT}telephony/config/people/me/settings/secondarylines/line-owner-2/queues`,
      method: HTTP_METHODS.PATCH,
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
      uri: `${HYDRA}telephony/calls/sync/invoke`,
      method: HTTP_METHODS.POST,
      body: {wdmDeviceId: 'c5ae3b86-1bb7-40f1-a6a9-c296ee7e61d5'},
    });
    expect(response.statusCode).toBe(204);
    expect(response.message).toBe('SUCCESS');
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

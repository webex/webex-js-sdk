/* eslint-disable dot-notation */
import {LOGGER} from '../Logger/types';
import {getTestUtilsWebex} from '../common/testUtil';
import {HTTP_METHODS, WebexRequestPayload} from '../common/types';
import {WxcCallRecordingConnector} from './WxcCallRecordingConnector';
import {RecordingRequestType, RecordingStatus} from './types';
import {
  CALL_SESSION_ID,
  ERROR_DETAILS_400,
  ERROR_DETAILS_401,
  ERROR_DETAILS_404,
  MOCK_EMPTY_RECORDING_LIST_BODY,
  MOCK_RECORDING_BODY,
  MOCK_RECORDING_CREATED_EVENT,
  MOCK_RECORDING_DELETED_EVENT,
  MOCK_RECORDING_LIST_BODY,
  MOCK_RECORDING_METADATA_BODY,
  MOCK_RECORDING_PURGE_EVENT,
  MOCK_RECORDING_RESTORE_EVENT,
  MOCK_RECORDING_TRASH_EVENT,
  MOCK_RECORDING_UPDATED_EVENT,
  RECORDING_MERCURY_KEYS,
  RECORDING_ONE,
} from './callRecordingFixtures';
import {COMMON_EVENT_KEYS, RecordingEvent} from '../Events/types';
import {CALL_RECORDING_FILE, METHODS} from './constants';
import * as utils from '../common/Utils';
import log from '../Logger';
import {METHOD_START_MESSAGE} from '../common/constants';

const webex = getTestUtilsWebex();
let uploadLogsSpy: jest.SpyInstance;
let serviceErrorCodeHandlerSpy: jest.SpyInstance;

describe('WxcCallRecordingConnector tests', () => {
  let connector: WxcCallRecordingConnector;
  const infoSpy = jest.spyOn(log, 'info').mockImplementation();
  const errorSpy = jest.spyOn(log, 'error').mockImplementation();

  beforeAll(() => {
    connector = new WxcCallRecordingConnector(webex, {level: LOGGER.INFO});
  });

  beforeEach(() => {
    uploadLogsSpy = jest.spyOn(utils, 'uploadLogs').mockResolvedValue();
    serviceErrorCodeHandlerSpy = jest.spyOn(utils, 'serviceErrorCodeHandler');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRecordings', () => {
    const loggerContext = {file: CALL_RECORDING_FILE, method: METHODS.GET_RECORDINGS};

    it('successfully fetches the list of recordings', async () => {
      const payload = <WebexRequestPayload>(<unknown>MOCK_RECORDING_LIST_BODY);
      webex.request.mockResolvedValue(payload);

      const response = await connector.getCallRecording({type: RecordingRequestType.LIST});

      expect(response.statusCode).toBe(200);
      expect(response.message).toBe('SUCCESS');
      expect(response.data.recordings).toHaveLength(2);
      expect(response.data.recordings?.[0].id).toBe(RECORDING_ONE.id);
      expect(
        response.data.recordings?.[0].recordingPlaybackLinks?.transcriptPlaybackLink
      ).toContain('transcript.txt');
      expect(response.data.recordings?.[0].aiAssistantData?.suggestedNoteUrl).toContain('aibridge');
      expect(response.data.recordings?.[0].serviceData?.personality).toBe('originator');
      expect(response.data.recordings?.[1].serviceData?.personality).toBeUndefined();
      expect(response.data.recordings?.[0].ownerType).toBeUndefined();
      expect(response.data.recordings?.[0].storageRegion).toBeUndefined();
      expect(response.data.recordings?.[0].temporaryDirectDownloadLinks).toBeUndefined();
      expect(errorSpy).not.toHaveBeenCalled();
      expect(uploadLogsSpy).not.toHaveBeenCalled();
    });

    it('builds the request URL with the provided filter/pagination query params', async () => {
      const payload = <WebexRequestPayload>(<unknown>MOCK_RECORDING_LIST_BODY);
      webex.request.mockResolvedValue(payload);

      await connector.getCallRecording({
        type: RecordingRequestType.LIST,
        options: {
          status: RecordingStatus.DELETED,
          max: 25,
          from: '2024-01-01T00:00:00.000Z',
          to: '2024-02-01T00:00:00.000Z',
          days: 7,
          serviceType: 'meeting',
          format: 'MP4',
          ownerType: 'user',
          storageRegion: 'US',
          locationId: 'loc-9',
          topic: 'standup',
          webexUserRequest: false,
        },
      });

      const callArgs = webex.request.mock.calls[webex.request.mock.calls.length - 1][0];
      expect(callArgs.method).toBe(HTTP_METHODS.GET);
      expect(callArgs.uri).toContain('/webappng/api/v1/hub/convergedRecordings?');
      expect(callArgs.uri).toContain('orderType=DESC');
      expect(callArgs.uri).toContain('orderBy=appCreateTime');
      expect(callArgs.uri).toContain('status=deleted');
      expect(callArgs.uri).toContain('category=calling');
      expect(callArgs.uri).toContain('limit=25');
      expect(callArgs.uri).toContain('offset=0');
      expect(callArgs.uri).not.toContain('from=');
      expect(callArgs.uri).not.toContain('to=');
      expect(callArgs.uri).not.toContain('serviceType=');
      expect(callArgs.uri).not.toContain('format=');
      expect(callArgs.uri).not.toContain('ownerType=');
      expect(callArgs.uri).not.toContain('storageRegion=');
      expect(callArgs.uri).not.toContain('locationId=');
      expect(callArgs.uri).not.toContain('topic=');
      expect(callArgs.uri).not.toContain('siteurl=');
      expect(callArgs.headers).toEqual({
        Accept: 'application/json',
        WebexUserRequest: 'true',
      });
    });

    it('applies the default userhub list query when no options are provided', async () => {
      const payload = <WebexRequestPayload>(<unknown>MOCK_RECORDING_LIST_BODY);
      webex.request.mockResolvedValue(payload);

      await connector.getCallRecording({type: RecordingRequestType.LIST});

      const callArgs = webex.request.mock.calls[webex.request.mock.calls.length - 1][0];
      expect(callArgs.uri).toContain('orderType=DESC');
      expect(callArgs.uri).toContain('orderBy=appCreateTime');
      expect(callArgs.uri).toContain('status=available');
      expect(callArgs.uri).toContain('category=calling');
      expect(callArgs.uri).toContain('limit=30');
      expect(callArgs.uri).toContain('offset=0');
      expect(callArgs.uri).not.toContain('from=');
      expect(callArgs.uri).not.toContain('max=');
      expect(callArgs.uri).not.toContain('siteurl=');
    });

    it('lists recordings with the original user token and does not call webex.request', async () => {
      (webex.credentials as {supertoken?: {toString: () => string}}).supertoken = {
        toString: () => 'Bearer original-user-token',
      };
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(MOCK_RECORDING_LIST_BODY.body),
      });
      const originalFetch = global.fetch;
      global.fetch = fetchMock as unknown as typeof fetch;

      try {
        const response = await connector.getCallRecording({type: RecordingRequestType.LIST});

        expect(response.statusCode).toBe(200);
        expect(webex.request).not.toHaveBeenCalled();
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer original-user-token');
        expect(fetchMock.mock.calls[0][0]).toContain('category=calling');
      } finally {
        global.fetch = originalFetch;
        delete (webex.credentials as {supertoken?: {toString: () => string}}).supertoken;
      }
    });

    it('retries a 500 with the user token and without sdk request headers', async () => {
      webex.request.mockRejectedValue(<WebexRequestPayload>(<unknown>{statusCode: 500}));
      webex.credentials.getUserToken.mockResolvedValue({
        toString: () => 'Bearer user-token',
      });
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(MOCK_RECORDING_LIST_BODY.body),
      });
      const originalFetch = global.fetch;
      global.fetch = fetchMock as unknown as typeof fetch;

      try {
        const response = await connector.getCallRecording({type: RecordingRequestType.LIST});

        expect(response.statusCode).toBe(200);
        expect(response.data.recordings?.length).toBeGreaterThan(0);
        const fetchArgs = fetchMock.mock.calls[0];
        expect(fetchArgs[0]).toContain('category=calling');
        expect(fetchArgs[1].headers.Authorization).toBe('Bearer user-token');
        expect(fetchArgs[1].headers.WebexUserRequest).toBe('true');
        expect(fetchArgs[1].headers['cisco-device-url']).toBeUndefined();
        expect(fetchArgs[1].headers['spark-user-agent']).toBeUndefined();
        expect(infoSpy).toHaveBeenCalledWith(
          expect.stringContaining('retrying with the user token'),
          expect.objectContaining({method: METHODS.GET_RECORDINGS})
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('returns 503 and does not call User Hub when the catalog host is missing', async () => {
      const serviceUrls = webex.internal.services._serviceUrls as Record<string, string>;
      const saved = serviceUrls['webex-user-hub-service'];
      delete serviceUrls['webex-user-hub-service'];
      webex.request.mockClear();

      try {
        const response = await connector.getCallRecording({type: RecordingRequestType.LIST});

        expect(response.statusCode).toBe(503);
        expect(webex.request).not.toHaveBeenCalled();
      } finally {
        serviceUrls['webex-user-hub-service'] = saved;
      }
    });

    it('returns an empty list when there are no recordings', async () => {
      const payload = <WebexRequestPayload>(<unknown>MOCK_EMPTY_RECORDING_LIST_BODY);
      webex.request.mockResolvedValue(payload);

      const response = await connector.getCallRecording({type: RecordingRequestType.LIST});

      expect(response.statusCode).toBe(200);
      expect(response.data.recordings).toEqual([]);
    });

    it.each([
      {statusCode: 400, expected: ERROR_DETAILS_400},
      {statusCode: 401, expected: ERROR_DETAILS_401},
      {statusCode: 404, expected: ERROR_DETAILS_404},
    ])('handles a $statusCode error', async ({statusCode, expected}) => {
      const failurePayload = {statusCode};
      webex.request.mockRejectedValue(<WebexRequestPayload>(<unknown>failurePayload));

      const response = await connector.getCallRecording({type: RecordingRequestType.LIST});

      expect(response).toStrictEqual(expected);
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith({statusCode}, loggerContext);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get recordings'),
        loggerContext
      );
      expect(uploadLogsSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRecording', () => {
    const loggerContext = {file: CALL_RECORDING_FILE, method: METHODS.GET_RECORDING};

    it('successfully fetches a single recording', async () => {
      const payload = <WebexRequestPayload>(<unknown>MOCK_RECORDING_BODY);
      webex.request.mockResolvedValue(payload);

      const response = await connector.getCallRecording({
        type: RecordingRequestType.DETAIL,
        recordingId: RECORDING_ONE.id,
      });

      expect(response.statusCode).toBe(200);
      expect(response.message).toBe('SUCCESS');
      expect(response.data.recording?.id).toBe(RECORDING_ONE.id);

      const callArgs = webex.request.mock.calls[webex.request.mock.calls.length - 1][0];
      expect(callArgs.uri).toContain(
        `/webappng/api/v1/hub/convergedRecordings/${RECORDING_ONE.id}`
      );
      expect(callArgs.uri).not.toContain('siteurl=');
      expect(callArgs.method).toBe(HTTP_METHODS.GET);
      expect(callArgs.service).toBeUndefined();
      expect(callArgs.headers).toEqual({
        Accept: 'application/json',
        WebexUserRequest: 'true',
      });
      expect(infoSpy).toHaveBeenCalledWith(
        `${METHOD_START_MESSAGE} with recordingId=${RECORDING_ONE.id}`,
        loggerContext
      );
    });

    it('handles a 404 error when the recording does not exist', async () => {
      webex.request.mockRejectedValue(<WebexRequestPayload>(<unknown>{statusCode: 404}));

      const response = await connector.getCallRecording({
        type: RecordingRequestType.DETAIL,
        recordingId: 'missing-id',
      });

      expect(response).toStrictEqual(ERROR_DETAILS_404);
      expect(uploadLogsSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRecordingsByCallSessionId', () => {
    it('returns only the recordings matching the call session id', async () => {
      const payload = <WebexRequestPayload>(<unknown>MOCK_RECORDING_LIST_BODY);
      webex.request.mockResolvedValue(payload);

      const response = await connector.getCallRecording({
        type: RecordingRequestType.BY_CALL_SESSION,
        callSessionId: CALL_SESSION_ID,
      });

      expect(response.statusCode).toBe(200);
      expect(response.data.recordings).toHaveLength(1);
      expect(response.data.recordings?.[0].id).toBe(RECORDING_ONE.id);
    });

    it('returns an empty list when no recording matches', async () => {
      const payload = <WebexRequestPayload>(<unknown>MOCK_RECORDING_LIST_BODY);
      webex.request.mockResolvedValue(payload);

      const response = await connector.getCallRecording({
        type: RecordingRequestType.BY_CALL_SESSION,
        callSessionId: 'non-existent-session',
      });

      expect(response.statusCode).toBe(200);
      expect(response.data.recordings).toEqual([]);
    });

    it('propagates the error response from the underlying list call', async () => {
      webex.request.mockRejectedValue(<WebexRequestPayload>(<unknown>{statusCode: 401}));

      const response = await connector.getCallRecording({
        type: RecordingRequestType.BY_CALL_SESSION,
        callSessionId: CALL_SESSION_ID,
      });

      expect(response).toStrictEqual(ERROR_DETAILS_401);
    });

    it('forwards list options to the underlying list query to widen the scan', async () => {
      const payload = <WebexRequestPayload>(<unknown>MOCK_RECORDING_LIST_BODY);
      webex.request.mockResolvedValue(payload);

      await connector.getCallRecording({
        type: RecordingRequestType.BY_CALL_SESSION,
        callSessionId: CALL_SESSION_ID,
        options: {
          status: RecordingStatus.DELETED,
          max: 100,
        },
      });

      const callArgs = webex.request.mock.calls[webex.request.mock.calls.length - 1][0];
      expect(callArgs.uri).toContain('orderType=DESC');
      expect(callArgs.uri).toContain('orderBy=appCreateTime');
      expect(callArgs.uri).toContain('status=deleted');
      expect(callArgs.uri).toContain('limit=100');
      expect(callArgs.uri).toContain('offset=0');
      expect(callArgs.uri).toContain('category=calling');
      expect(callArgs.uri).not.toContain('siteurl=');
    });
  });

  describe('getRecordingMetadata', () => {
    const loggerContext = {file: CALL_RECORDING_FILE, method: METHODS.GET_RECORDING_METADATA};

    it('successfully fetches the recording metadata', async () => {
      const payload = <WebexRequestPayload>(<unknown>MOCK_RECORDING_METADATA_BODY);
      webex.request.mockResolvedValue(payload);

      const response = await connector.getCallRecording({
        type: RecordingRequestType.METADATA,
        recordingId: RECORDING_ONE.id,
      });

      expect(response.statusCode).toBe(200);
      expect(response.message).toBe('SUCCESS');
      expect(response.data.metadata?.callSessionId).toBe(CALL_SESSION_ID);
      expect(response.data.metadata?.serviceData?.callingParty).toBeDefined();
      expect(response.data.metadata?.session).toBeUndefined();
      expect(response.data.metadata?.participants).toBeUndefined();
      expect(response.data.metadata?.mediaStreams).toBeUndefined();

      const callArgs = webex.request.mock.calls[webex.request.mock.calls.length - 1][0];
      expect(callArgs.uri).toContain(
        `/webappng/api/v1/hub/convergedRecordings/${RECORDING_ONE.id}`
      );
      expect(callArgs.uri).not.toContain('/metadata');
      expect(callArgs.uri).not.toContain('siteurl=');
      expect(callArgs.method).toBe(HTTP_METHODS.GET);
      expect(callArgs.service).toBeUndefined();
    });

    it('handles a 400 error', async () => {
      webex.request.mockRejectedValue(<WebexRequestPayload>(<unknown>{statusCode: 400}));

      const response = await connector.getCallRecording({
        type: RecordingRequestType.METADATA,
        recordingId: 'bad-id',
      });

      expect(response).toStrictEqual(ERROR_DETAILS_400);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get recording metadata'),
        loggerContext
      );
      expect(uploadLogsSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteRecording', () => {
    const loggerContext = {file: CALL_RECORDING_FILE, method: METHODS.DELETE_RECORDING};

    it('successfully soft-deletes a recording via POST /convergedRecordings/softDelete', async () => {
      webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{statusCode: 204}));

      const response = await connector.deleteRecording(RECORDING_ONE.id);

      expect(response.statusCode).toBe(204);
      expect(response.message).toBe('SUCCESS');

      const callArgs = webex.request.mock.calls[webex.request.mock.calls.length - 1][0];
      expect(callArgs.uri).toContain('/webappng/api/v1/hub/convergedRecordings/softDelete');
      expect(callArgs.uri).not.toContain(`/convergedRecordings/${RECORDING_ONE.id}`);
      expect(callArgs.method).toBe(HTTP_METHODS.POST);
      expect(callArgs.service).toBeUndefined();
      expect(callArgs.body).toStrictEqual({recordUUIDs: [RECORDING_ONE.id]});
    });

    it('ignores deprecated reason/comment options (compliance DELETE is not exposed)', async () => {
      webex.request.mockResolvedValue(<WebexRequestPayload>(<unknown>{statusCode: 204}));

      await connector.deleteRecording(RECORDING_ONE.id, {
        reason: 'audit',
        comment: 'Maintain data privacy',
      });

      const callArgs = webex.request.mock.calls[webex.request.mock.calls.length - 1][0];
      expect(callArgs.method).toBe(HTTP_METHODS.POST);
      expect(callArgs.body).toStrictEqual({recordUUIDs: [RECORDING_ONE.id]});
    });

    it('logs a 500 retry under deleteRecording', async () => {
      webex.request.mockRejectedValue(<WebexRequestPayload>(<unknown>{statusCode: 500}));
      webex.credentials.getUserToken.mockResolvedValue({
        toString: () => 'Bearer user-token',
      });
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 204,
        text: async () => '',
      });
      const originalFetch = global.fetch;
      global.fetch = fetchMock as unknown as typeof fetch;

      try {
        const response = await connector.deleteRecording(RECORDING_ONE.id);

        expect(response.statusCode).toBe(204);
        expect(infoSpy).toHaveBeenCalledWith(
          expect.stringContaining('retrying with the user token'),
          expect.objectContaining({method: METHODS.DELETE_RECORDING})
        );
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('handles a 400 error', async () => {
      webex.request.mockRejectedValue(<WebexRequestPayload>(<unknown>{statusCode: 400}));

      const response = await connector.deleteRecording('bad-id');

      expect(response).toStrictEqual(ERROR_DETAILS_400);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to delete recording'),
        loggerContext
      );
      expect(uploadLogsSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('URL resolution', () => {
    it('resolves the recording base URL from the services catalog (webex-user-hub-service)', () => {
      const localConnector = new WxcCallRecordingConnector(getTestUtilsWebex(), {
        level: LOGGER.INFO,
      });

      expect(localConnector['resolveUserhubBaseUrl']()).toBe(
        'https://userhub-sq1.dmz.webex.com/webappng/api/v1/hub/convergedRecordings'
      );
    });
  });

  describe('Recording Mercury events', () => {
    let mockOn: jest.Mock;

    const findHandler = (eventKey: string) => {
      const calls = mockOn.mock.calls.filter((call) => call[0] === eventKey);

      return calls[calls.length - 1][1];
    };

    beforeEach(() => {
      mockOn = webex.internal.mercury.on as unknown as jest.Mock;
      mockOn.mockClear();
      connector = new WxcCallRecordingConnector(webex, {level: LOGGER.INFO});
    });

    it('registers listeners for all three recording mercury events', () => {
      const registeredKeys = mockOn.mock.calls.map((call) => call[0]);

      expect(registeredKeys).toContain(RECORDING_MERCURY_KEYS.CREATED);
      expect(registeredKeys).toContain(RECORDING_MERCURY_KEYS.UPDATED);
      expect(registeredKeys).toContain(RECORDING_MERCURY_KEYS.DELETED);
    });

    it('emits the recording created event', (done) => {
      connector.on(COMMON_EVENT_KEYS.CALL_RECORDING_CREATED, (event: RecordingEvent) => {
        expect(event).toEqual(MOCK_RECORDING_CREATED_EVENT);
        done();
      });

      findHandler(RECORDING_MERCURY_KEYS.CREATED)(MOCK_RECORDING_CREATED_EVENT);
    });

    /**
     * The backend delivers the recording lifecycle through `convergedRecordings.updated` events
     * qualified by `eventSubType`. The connector routes them to the intuitive typed event:
     * name: TestCase name
     * event: the raw `updated` Mercury event (with its eventSubType)
     * expectedKey: the typed event the connector should emit
     */
    const updatedRoutingData: {
      name: string;
      event: RecordingEvent;
      expectedKey: COMMON_EVENT_KEYS;
    }[] = [
      {
        name: 'TRASH (soft delete) -> callRecording:deleted',
        event: MOCK_RECORDING_TRASH_EVENT,
        expectedKey: COMMON_EVENT_KEYS.CALL_RECORDING_DELETED,
      },
      {
        name: 'PURGE (permanent delete) -> callRecording:deleted',
        event: MOCK_RECORDING_PURGE_EVENT,
        expectedKey: COMMON_EVENT_KEYS.CALL_RECORDING_DELETED,
      },
      {
        name: 'RESTORE (restored from trash) -> callRecording:created',
        event: MOCK_RECORDING_RESTORE_EVENT,
        expectedKey: COMMON_EVENT_KEYS.CALL_RECORDING_CREATED,
      },
      {
        name: 'SUMMARY_CREATE (summary/transcript ready) -> callRecording:updated',
        event: MOCK_RECORDING_UPDATED_EVENT,
        expectedKey: COMMON_EVENT_KEYS.CALL_RECORDING_UPDATED,
      },
    ];

    it.each(updatedRoutingData)(
      'routes a convergedRecordings.updated event by eventSubType: $name',
      ({event, expectedKey}) => {
        const spy = jest.fn();
        connector.on(expectedKey, spy);

        findHandler(RECORDING_MERCURY_KEYS.UPDATED)(event);

        expect(spy).toHaveBeenCalledWith(event);
      }
    );

    it('emits the recording deleted event', (done) => {
      connector.on(COMMON_EVENT_KEYS.CALL_RECORDING_DELETED, (event: RecordingEvent) => {
        expect(event).toEqual(MOCK_RECORDING_DELETED_EVENT);
        done();
      });

      findHandler(RECORDING_MERCURY_KEYS.DELETED)(MOCK_RECORDING_DELETED_EVENT);
    });

    it('ignores malformed events without an activity payload', () => {
      const spy = jest.fn();
      connector.on(COMMON_EVENT_KEYS.CALL_RECORDING_CREATED, spy);

      findHandler(RECORDING_MERCURY_KEYS.CREATED)({} as RecordingEvent);

      expect(spy).not.toHaveBeenCalled();
    });
  });
});

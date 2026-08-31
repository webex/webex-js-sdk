/* eslint-disable dot-notation */
import {LOGGER} from '../Logger/types';
import {getTestUtilsWebex} from '../common/testUtil';
import {CALLING_BACKEND} from '../common/types';
import {CallRecording, createCallRecordingClient} from './CallRecording';
import {WxcCallRecordingConnector} from './WxcCallRecordingConnector';
import {ICallRecording, RecordingRequestType} from './types';
import {
  MOCK_RECORDING_CREATED_EVENT,
  MOCK_RECORDING_DELETED_EVENT,
  MOCK_RECORDING_LIST_BODY,
  MOCK_RECORDING_UPDATED_EVENT,
  RECORDING_MERCURY_KEYS,
  RECORDING_ONE,
} from './callRecordingFixtures';
import {COMMON_EVENT_KEYS, RecordingEvent} from '../Events/types';
import * as utils from '../common/Utils';
import log from '../Logger';

const webex = getTestUtilsWebex();

describe('CallRecording facade tests', () => {
  let callRecording: ICallRecording;

  beforeAll(() => {
    jest.spyOn(log, 'info').mockImplementation();
    jest.spyOn(log, 'log').mockImplementation();
    jest.spyOn(log, 'error').mockImplementation();
  });

  beforeEach(() => {
    callRecording = createCallRecordingClient(webex, {level: LOGGER.INFO});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calling backend gating', () => {
    let getCallingBackEndSpy: jest.SpyInstance;

    afterEach(() => {
      getCallingBackEndSpy?.mockRestore();
    });

    /**
     * TestCase inputs
     * name: TestCase name
     * backend: Calling backend resolved for the user
     * valid: whether the recording client is expected to be created (WXC only)
     */
    const testData: {
      name: string;
      backend: CALLING_BACKEND;
      valid: boolean;
    }[] = [
      {
        name: 'creates the WXC recording connector for the webex calling (WXC) backend',
        backend: CALLING_BACKEND.WXC,
        valid: true,
      },
      {
        name: 'rejects the broadworks (BWRKS) backend',
        backend: CALLING_BACKEND.BWRKS,
        valid: false,
      },
      {
        name: 'rejects the ucm (UCM) backend',
        backend: CALLING_BACKEND.UCM,
        valid: false,
      },
      {
        name: 'rejects an unidentified (INVALID) backend',
        backend: CALLING_BACKEND.INVALID,
        valid: false,
      },
    ];

    it.each(testData)('$name', (data) => {
      getCallingBackEndSpy = jest.spyOn(utils, 'getCallingBackEnd').mockReturnValue(data.backend);

      if (data.valid) {
        const client = new CallRecording(webex, {level: LOGGER.INFO});

        expect(client['callingBackend']).toStrictEqual(CALLING_BACKEND.WXC);
        expect(client['backendConnector']).toBeInstanceOf(WxcCallRecordingConnector);
      } else {
        expect(() => new CallRecording(webex, {level: LOGGER.INFO})).toThrow(
          'Calling backend is not identified, exiting....'
        );
      }
    });
  });

  describe('delegation to the backend connector', () => {
    /**
     * TestCase inputs for getCallRecording delegation
     * name: TestCase name
     * request: the discriminated read request passed to the facade
     * expected: the response the connector is mocked to return
     */
    const getCallRecordingData = [
      {
        name: 'LIST request',
        request: {type: RecordingRequestType.LIST, options: {max: 10}},
        expected: {statusCode: 200, data: {recordings: []}, message: 'SUCCESS'},
      },
      {
        name: 'DETAIL request',
        request: {type: RecordingRequestType.DETAIL, recordingId: RECORDING_ONE.id},
        expected: {statusCode: 200, data: {recording: RECORDING_ONE}, message: 'SUCCESS'},
      },
      {
        name: 'METADATA request',
        request: {type: RecordingRequestType.METADATA, recordingId: RECORDING_ONE.id},
        expected: {statusCode: 200, data: {metadata: {} as never}, message: 'SUCCESS'},
      },
      {
        name: 'BY_CALL_SESSION request',
        request: {
          type: RecordingRequestType.BY_CALL_SESSION,
          callSessionId: 'session-id',
          options: {days: 30, max: 100},
        },
        expected: {statusCode: 200, data: {recordings: [RECORDING_ONE]}, message: 'SUCCESS'},
      },
    ] as const;

    it.each(getCallRecordingData)(
      'delegates getCallRecording ($name) to the connector and returns its result',
      async ({request, expected}) => {
        const connector = callRecording['backendConnector'] as WxcCallRecordingConnector;
        const spy = jest.spyOn(connector, 'getCallRecording').mockResolvedValue(expected as never);

        const response = await callRecording.getCallRecording(request);

        expect(spy).toBeCalledOnceWith(request);
        expect(response).toStrictEqual(expected);
      }
    );

    it('delegates deleteRecording (with options) to the connector and returns its result', async () => {
      const connector = callRecording['backendConnector'] as WxcCallRecordingConnector;
      const expected = {statusCode: 200, data: {}, message: 'SUCCESS'};
      const spy = jest.spyOn(connector, 'deleteRecording').mockResolvedValue(expected);

      const options = {reason: 'audit', comment: 'Maintain data privacy'};
      const response = await callRecording.deleteRecording(RECORDING_ONE.id, options);

      expect(spy).toBeCalledOnceWith(RECORDING_ONE.id, options);
      expect(response).toStrictEqual(expected);
    });
  });

  describe('recording event forwarding', () => {
    it('forwards a connector created event to facade listeners', (done) => {
      const connector = callRecording['backendConnector'] as WxcCallRecordingConnector;

      callRecording.on(COMMON_EVENT_KEYS.CALL_RECORDING_CREATED, (event: RecordingEvent) => {
        expect(event).toEqual(MOCK_RECORDING_CREATED_EVENT);
        done();
      });

      connector.emit(COMMON_EVENT_KEYS.CALL_RECORDING_CREATED, MOCK_RECORDING_CREATED_EVENT);
    });

    it('forwards a connector updated event to facade listeners', (done) => {
      const connector = callRecording['backendConnector'] as WxcCallRecordingConnector;

      callRecording.on(COMMON_EVENT_KEYS.CALL_RECORDING_UPDATED, (event: RecordingEvent) => {
        expect(event).toEqual(MOCK_RECORDING_UPDATED_EVENT);
        done();
      });

      connector.emit(COMMON_EVENT_KEYS.CALL_RECORDING_UPDATED, MOCK_RECORDING_UPDATED_EVENT);
    });

    it('forwards a connector deleted event to facade listeners', (done) => {
      const connector = callRecording['backendConnector'] as WxcCallRecordingConnector;

      callRecording.on(COMMON_EVENT_KEYS.CALL_RECORDING_DELETED, (event: RecordingEvent) => {
        expect(event).toEqual(MOCK_RECORDING_DELETED_EVENT);
        done();
      });

      connector.emit(COMMON_EVENT_KEYS.CALL_RECORDING_DELETED, MOCK_RECORDING_DELETED_EVENT);
    });

    it('forwards a recording event end-to-end from Mercury through the facade', (done) => {
      const mockOn = webex.internal.mercury.on as unknown as jest.Mock;
      mockOn.mockClear();

      const client = createCallRecordingClient(webex, {level: LOGGER.INFO});

      const findHandler = (eventKey: string) => {
        const calls = mockOn.mock.calls.filter((call) => call[0] === eventKey);

        return calls[calls.length - 1][1];
      };

      client.on(COMMON_EVENT_KEYS.CALL_RECORDING_CREATED, (event: RecordingEvent) => {
        expect(event).toEqual(MOCK_RECORDING_CREATED_EVENT);
        done();
      });

      findHandler(RECORDING_MERCURY_KEYS.CREATED)(MOCK_RECORDING_CREATED_EVENT);
    });
  });

  describe('createCallRecordingClient', () => {
    it('returns a CallRecording facade instance', () => {
      webex.request.mockResolvedValue(<never>(<unknown>MOCK_RECORDING_LIST_BODY));

      expect(callRecording).toBeInstanceOf(CallRecording);
    });
  });
});

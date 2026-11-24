import {expect} from '@jest/globals';
import AnswerCallOnWebexService from '../../../../src/services/AnswerCallOnWebexService';
import {WebexSDK} from '../../../../src/types';
import LoggerProxy from '../../../../src/logger-proxy';

jest.mock('../../../../src/logger-proxy');
jest.mock('../../../../src/services/core/WebexRequest', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({uploadLogs: jest.fn()}),
  },
}));

const TELEPHONY_BASE = 'https://api.ciscospark.com';
const CALLS_URL = `${TELEPHONY_BASE}/telephony/calls`;

function makeMockWebex(overrides: Partial<{_serviceUrls: Record<string, string>}> = {}): WebexSDK {
  return {
    request: jest.fn().mockResolvedValue({statusCode: 200, body: {}}),
    internal: {
      services: {
        _serviceUrls: {hydra: TELEPHONY_BASE, ...overrides._serviceUrls},
        get: jest.fn(),
      },
    },
  } as unknown as WebexSDK;
}

describe('AnswerCallOnWebexService', () => {
  let webex: WebexSDK;
  let service: AnswerCallOnWebexService;

  beforeEach(() => {
    jest.clearAllMocks();
    webex = makeMockWebex();
    service = new AnswerCallOnWebexService(webex);
  });

  describe('getTelephonyBaseUrl resolution', () => {
    it('uses hydra URL from _serviceUrls when available', async () => {
      await service.answerCall({callId: 'c1', endpointId: 'e1'});

      expect(webex.request).toHaveBeenCalledWith(
        expect.objectContaining({uri: `${CALLS_URL}/answer`})
      );
    });

    it('falls back to services.get("hydra") when _serviceUrls.hydra is missing', async () => {
      const hydraBase = 'https://api.ciscospark.com/v1';
      const get = jest.fn().mockReturnValue(hydraBase);
      webex = {
        request: jest.fn().mockResolvedValue({statusCode: 200, body: {}}),
        internal: {
          services: {
            _serviceUrls: {},
            get,
          },
        },
      } as unknown as WebexSDK;
      service = new AnswerCallOnWebexService(webex);

      await service.answerCall({callId: 'c1', endpointId: 'e1'});

      expect(get).toHaveBeenCalledWith('hydra');
      expect(webex.request).toHaveBeenCalledWith(
        expect.objectContaining({uri: `${hydraBase}/telephony/calls/answer`})
      );
    });

    it('throws when hydra URL is unavailable', async () => {
      webex = {
        request: jest.fn(),
        internal: {
          services: {
            _serviceUrls: {},
            get: jest.fn().mockReturnValue(''),
          },
        },
      } as unknown as WebexSDK;
      service = new AnswerCallOnWebexService(webex);

      await expect(service.answerCall({callId: 'c1', endpointId: 'e1'})).rejects.toBeDefined();
    });
  });

  describe('answerCall', () => {
    it('POST /answer with callId and endpointId', async () => {
      await service.answerCall({callId: 'call-123', endpointId: 'ep-456'});

      expect(webex.request).toHaveBeenCalledWith({
        uri: `${CALLS_URL}/answer`,
        method: 'POST',
        body: {callId: 'call-123', endpointId: 'ep-456'},
        addAuthHeader: true,
      });
    });

    it('includes lineOwnerId when provided', async () => {
      await service.answerCall({callId: 'c1', endpointId: 'e1', lineOwnerId: 'lo-1'});

      expect(webex.request).toHaveBeenCalledWith(
        expect.objectContaining({body: {callId: 'c1', endpointId: 'e1', lineOwnerId: 'lo-1'}})
      );
    });

    it('omits lineOwnerId when not provided', async () => {
      await service.answerCall({callId: 'c1', endpointId: 'e1'});

      const call = (webex.request as jest.Mock).mock.calls[0][0];
      expect(call.body).not.toHaveProperty('lineOwnerId');
    });

    it('rejects and logs on request failure', async () => {
      const err = {
        statusCode: 400,
        details: {
          trackingId: 'track-wxapp-1',
          data: {reason: 'TELEPHONY_ERROR'},
        },
      };
      (webex.request as jest.Mock).mockRejectedValue(err);

      await expect(service.answerCall({callId: 'c1', endpointId: 'e1'})).rejects.toMatchObject({
        isWxAppTelephonyError: true,
        message: 'TELEPHONY_ERROR',
        trackingId: 'track-wxapp-1',
        status: 400,
      });
      expect(LoggerProxy.error).toHaveBeenCalled();
    });

    it('preserves top-level trackingId on request failure', async () => {
      const err = {
        statusCode: 503,
        trackingId: 'track-top-level-1',
        message: 'Service unavailable',
      };
      (webex.request as jest.Mock).mockRejectedValue(err);

      await expect(service.answerCall({callId: 'c1', endpointId: 'e1'})).rejects.toMatchObject({
        isWxAppTelephonyError: true,
        trackingId: 'track-top-level-1',
        status: 503,
      });
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        expect.stringContaining('failed'),
        expect.objectContaining({
          data: expect.objectContaining({trackingId: 'track-top-level-1'}),
        })
      );
    });
  });

  describe('rejectCall', () => {
    it('POST /reject with callId', async () => {
      await service.rejectCall({callId: 'call-123'});

      expect(webex.request).toHaveBeenCalledWith({
        uri: `${CALLS_URL}/reject`,
        method: 'POST',
        body: {callId: 'call-123'},
        addAuthHeader: true,
      });
    });
  });

  describe('muteCall', () => {
    it('POST /mute with callId', async () => {
      await service.muteCall({callId: 'call-123'});

      expect(webex.request).toHaveBeenCalledWith(
        expect.objectContaining({uri: `${CALLS_URL}/mute`, body: {callId: 'call-123'}})
      );
    });
  });

  describe('unmuteCall', () => {
    it('POST /unmute with callId', async () => {
      await service.unmuteCall({callId: 'call-123'});

      expect(webex.request).toHaveBeenCalledWith(
        expect.objectContaining({uri: `${CALLS_URL}/unmute`, body: {callId: 'call-123'}})
      );
    });
  });

  describe('transmitDtmf', () => {
    it('POST /transmitDtmf with callId and dtmf', async () => {
      await service.transmitDtmf({callId: 'call-123', dtmf: '5'});

      expect(webex.request).toHaveBeenCalledWith({
        uri: `${CALLS_URL}/transmitDtmf`,
        method: 'POST',
        body: {callId: 'call-123', dtmf: '5'},
        addAuthHeader: true,
      });
    });

    it('includes lineOwnerId in DTMF request when provided', async () => {
      await service.transmitDtmf({callId: 'c1', dtmf: '9', lineOwnerId: 'lo-1'});

      expect(webex.request).toHaveBeenCalledWith(
        expect.objectContaining({body: {callId: 'c1', dtmf: '9', lineOwnerId: 'lo-1'}})
      );
    });
  });

  describe('getCallDetails', () => {
    it('GET /telephony/calls/{callId}', async () => {
      (webex.request as jest.Mock).mockResolvedValue({body: {muted: true}});

      const result = await service.getCallDetails({callId: 'call-123'});

      expect(webex.request).toHaveBeenCalledWith({
        uri: `${CALLS_URL}/call-123`,
        method: 'GET',
        addAuthHeader: true,
      });
      expect(result).toEqual({muted: true});
    });

    it('includes lineOwnerId query param when provided', async () => {
      await service.getCallDetails({callId: 'call-123', lineOwnerId: 'lo-1'});

      expect(webex.request).toHaveBeenCalledWith(
        expect.objectContaining({uri: `${CALLS_URL}/call-123?lineOwnerId=lo-1`})
      );
    });

    it('rejects and logs on request failure', async () => {
      (webex.request as jest.Mock).mockRejectedValue(new Error('network fail'));

      await expect(service.getCallDetails({callId: 'c1'})).rejects.toBeDefined();
      expect(LoggerProxy.error).toHaveBeenCalled();
    });

    it('logs HTTP status on non-404 getCallDetails failure', async () => {
      const err = {
        statusCode: 503,
        trackingId: 'track-top-level-1',
        message: 'Service unavailable',
      };
      (webex.request as jest.Mock).mockRejectedValue(err);

      await expect(service.getCallDetails({callId: 'c1'})).rejects.toBeDefined();
      expect(LoggerProxy.error).toHaveBeenCalledWith(
        expect.stringContaining('getCallDetails failed'),
        expect.objectContaining({
          data: expect.objectContaining({
            trackingId: 'track-top-level-1',
            status: 503,
          }),
        })
      );
    });

    it('rejects without error log for expected call-not-found during mute backfill race', async () => {
      (webex.request as jest.Mock).mockRejectedValue({status: 400, message: 'Call not found'});

      await expect(service.getCallDetails({callId: 'c1'})).rejects.toBeDefined();
      expect(LoggerProxy.error).not.toHaveBeenCalled();
    });
  });
});

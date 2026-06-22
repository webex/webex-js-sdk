import {HTTP_METHODS} from '../../common/types';
import log from '../../Logger';
import {
  deriveMobiusSocketMessageType,
  isSupplementaryServiceMessageType,
} from './mobiusSocketMapper';
import {MOBIUS_SOCKET_MESSAGE_TYPE} from './constants';

describe('mobiusSocketMapper', () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(log, 'warn');
  });

  describe('deriveMobiusSocketMessageType', () => {
    describe('Supplementary services', () => {
      it('should return CALL_HOLD for hold service URI', () => {
        const uri = '/api/v1/calling/web/devices/device-123/services/callhold/hold';
        const result = deriveMobiusSocketMessageType(uri, HTTP_METHODS.POST);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.CALL_HOLD);
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('should return CALL_RESUME for resume service URI', () => {
        const uri = '/api/v1/calling/web/devices/device-123/services/callhold/resume';
        const result = deriveMobiusSocketMessageType(uri, HTTP_METHODS.POST);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.CALL_RESUME);
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('should return CALL_TRANSFER for transfer commit service URI', () => {
        const uri = '/api/v1/calling/web/devices/device-123/services/calltransfer/commit';
        const result = deriveMobiusSocketMessageType(uri, HTTP_METHODS.POST);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.CALL_TRANSFER);
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('should return UNKNOWN and log warning for unrecognized supplementary service', () => {
        const uri = '/api/v1/calling/web/devices/device-123/services/unknown/action';
        const result = deriveMobiusSocketMessageType(uri, HTTP_METHODS.POST);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.UNKNOWN);
        expect(warnSpy).toHaveBeenCalledWith(
          `Unrecognized supplementary service uri - uri: ${uri}, httpMethod: ${HTTP_METHODS.POST}`,
          {
            file: 'mobiusSocketMapper',
            method: 'deriveMobiusSocketMessageType',
          }
        );
      });
    });

    describe('Call operations', () => {
      it('should return CALL_SETUP for call setup URI', () => {
        const uri = '/api/v1/calling/web/devices/device-123/call';
        const result = deriveMobiusSocketMessageType(uri, HTTP_METHODS.POST);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.CALL_SETUP);
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('should return CALL_MEDIA for call media URI', () => {
        const uri = '/api/v1/calling/web/devices/device-123/calls/call-456/media';
        const result = deriveMobiusSocketMessageType(uri, HTTP_METHODS.PATCH);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.CALL_MEDIA);
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('should return CALL_STATUS for call status URI', () => {
        const uri = '/api/v1/calling/web/devices/device-123/calls/call-456/status';
        const result = deriveMobiusSocketMessageType(uri, HTTP_METHODS.PATCH);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.CALL_STATUS);
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('should return CALL_STATE for calls/{callId} with PATCH method', () => {
        const uri = '/api/v1/calling/web/devices/device-123/calls/call-456';
        const result = deriveMobiusSocketMessageType(uri, HTTP_METHODS.PATCH);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.CALL_STATE);
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('should return CALL_DELETE for calls/{callId} with DELETE method', () => {
        const uri = '/api/v1/calling/web/devices/device-123/calls/call-456';
        const result = deriveMobiusSocketMessageType(uri, HTTP_METHODS.DELETE);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.CALL_DELETE);
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('should return UNKNOWN and log warning for calls/{callId} with unrecognized HTTP method', () => {
        const uri = '/api/v1/calling/web/devices/device-123/calls/call-456';
        const result = deriveMobiusSocketMessageType(uri, HTTP_METHODS.GET);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.UNKNOWN);
        expect(warnSpy).toHaveBeenCalledWith(
          `Unrecognized httpMethod for calls/{callId} - uri: ${uri}, httpMethod: ${HTTP_METHODS.GET}`,
          {
            file: 'mobiusSocketMapper',
            method: 'deriveMobiusSocketMessageType',
          }
        );
      });
    });

    describe('Device operations', () => {
      it('should return REGISTER for device registration URI', () => {
        const uri = '/api/v1/calling/web/device';
        const result = deriveMobiusSocketMessageType(uri, HTTP_METHODS.POST);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.REGISTER);
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('should return UNREGISTER for devices/{deviceId} with DELETE method', () => {
        const uri = '/api/v1/calling/web/devices/device-123';
        const result = deriveMobiusSocketMessageType(uri, HTTP_METHODS.DELETE);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.UNREGISTER);
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('should return DEVICE_GET for devices/{deviceId} with GET method', () => {
        const uri = '/api/v1/calling/web/devices/device-123';
        const result = deriveMobiusSocketMessageType(uri, HTTP_METHODS.GET);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.DEVICE_GET);
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('should return UNKNOWN and log warning for devices/{deviceId} with unrecognized HTTP method', () => {
        const uri = '/api/v1/calling/web/devices/device-123';
        const result = deriveMobiusSocketMessageType(uri, HTTP_METHODS.PATCH);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.UNKNOWN);
        expect(warnSpy).toHaveBeenCalledWith(
          `Unrecognized httpMethod for devices/{deviceId} - uri: ${uri}, httpMethod: ${HTTP_METHODS.PATCH}`,
          {
            file: 'mobiusSocketMapper',
            method: 'deriveMobiusSocketMessageType',
          }
        );
      });

      it('should return DEVICE_STATUS for devices/{deviceId}/status URI', () => {
        const uri = '/api/v1/calling/web/devices/device-123/status';
        const result = deriveMobiusSocketMessageType(uri, HTTP_METHODS.PATCH);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.DEVICE_STATUS);
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('should return DEVICE_STATUS for /status URI without /devices/ segment in path', () => {
        const uri = '/api/v1/calling/web/status';
        const result = deriveMobiusSocketMessageType(uri, HTTP_METHODS.POST);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.DEVICE_STATUS);
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('should return DEVICE_LIST for devices list URI without trailing ID', () => {
        const uri = '/api/v1/calling/web/devices';
        const result = deriveMobiusSocketMessageType(uri, HTTP_METHODS.GET);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.DEVICE_LIST);
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('should return DEVICE_LIST for devices list URI with query parameters', () => {
        const uri = '/api/v1/calling/web/devices?userid=user-789';
        const result = deriveMobiusSocketMessageType(uri, HTTP_METHODS.GET);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.DEVICE_LIST);
        expect(warnSpy).not.toHaveBeenCalled();
      });
    });

    describe('Edge cases', () => {
      it('should return UNKNOWN and log warning when uri is undefined', () => {
        const result = deriveMobiusSocketMessageType(undefined, HTTP_METHODS.GET);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.UNKNOWN);
        expect(warnSpy).toHaveBeenCalledWith(
          'Cannot derive Mobius socket message type: uri is empty',
          {
            file: 'mobiusSocketMapper',
            method: 'deriveMobiusSocketMessageType',
          }
        );
      });

      it('should return UNKNOWN and log warning when uri is empty string', () => {
        const result = deriveMobiusSocketMessageType('', HTTP_METHODS.GET);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.UNKNOWN);
        expect(warnSpy).toHaveBeenCalledWith(
          'Cannot derive Mobius socket message type: uri is empty',
          {
            file: 'mobiusSocketMapper',
            method: 'deriveMobiusSocketMessageType',
          }
        );
      });

      it('should return UNKNOWN and log warning for completely unrecognized URI pattern', () => {
        const uri = '/api/v1/completely/unrecognized/path';
        const result = deriveMobiusSocketMessageType(uri, HTTP_METHODS.POST);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.UNKNOWN);
        expect(warnSpy).toHaveBeenCalledWith(
          `Unrecognized uri pattern for Mobius socket - uri: ${uri}, httpMethod: ${HTTP_METHODS.POST}`,
          {
            file: 'mobiusSocketMapper',
            method: 'deriveMobiusSocketMessageType',
          }
        );
      });

      it('should never return DEVICE_STATUS when /calls/ is present in path ending with /status', () => {
        // The DEVICE_STATUS check explicitly excludes URIs containing /calls/. Any
        // call-scoped /status URI must resolve to CALL_STATUS via the earlier branch,
        // and must never fall through to DEVICE_STATUS even if check ordering changes.
        const uri = '/api/v1/calling/web/devices/device-123/calls/call-456/status';
        const result = deriveMobiusSocketMessageType(uri, HTTP_METHODS.PATCH);

        expect(result).toBe(MOBIUS_SOCKET_MESSAGE_TYPE.CALL_STATUS);
        expect(result).not.toBe(MOBIUS_SOCKET_MESSAGE_TYPE.DEVICE_STATUS);
        expect(warnSpy).not.toHaveBeenCalled();
      });

      it('should prioritize call sub-resources over bare call patterns', () => {
        const mediaUri = '/api/v1/calling/web/devices/device-123/calls/call-456/media';
        const statusUri = '/api/v1/calling/web/devices/device-123/calls/call-456/status';

        expect(deriveMobiusSocketMessageType(mediaUri, HTTP_METHODS.PATCH)).toBe(
          MOBIUS_SOCKET_MESSAGE_TYPE.CALL_MEDIA
        );
        expect(deriveMobiusSocketMessageType(statusUri, HTTP_METHODS.PATCH)).toBe(
          MOBIUS_SOCKET_MESSAGE_TYPE.CALL_STATUS
        );
      });
    });
  });

  describe('isSupplementaryServiceMessageType', () => {
    it('should return true for CALL_HOLD message type', () => {
      const result = isSupplementaryServiceMessageType(MOBIUS_SOCKET_MESSAGE_TYPE.CALL_HOLD);

      expect(result).toBe(true);
    });

    it('should return true for CALL_RESUME message type', () => {
      const result = isSupplementaryServiceMessageType(MOBIUS_SOCKET_MESSAGE_TYPE.CALL_RESUME);

      expect(result).toBe(true);
    });

    it('should return true for CALL_TRANSFER message type', () => {
      const result = isSupplementaryServiceMessageType(MOBIUS_SOCKET_MESSAGE_TYPE.CALL_TRANSFER);

      expect(result).toBe(true);
    });

    it('should return false for REGISTER message type', () => {
      const result = isSupplementaryServiceMessageType(MOBIUS_SOCKET_MESSAGE_TYPE.REGISTER);

      expect(result).toBe(false);
    });

    it('should return false for CALL_SETUP message type', () => {
      const result = isSupplementaryServiceMessageType(MOBIUS_SOCKET_MESSAGE_TYPE.CALL_SETUP);

      expect(result).toBe(false);
    });

    it('should return false for CALL_STATE message type', () => {
      const result = isSupplementaryServiceMessageType(MOBIUS_SOCKET_MESSAGE_TYPE.CALL_STATE);

      expect(result).toBe(false);
    });

    it('should return false for CALL_DELETE message type', () => {
      const result = isSupplementaryServiceMessageType(MOBIUS_SOCKET_MESSAGE_TYPE.CALL_DELETE);

      expect(result).toBe(false);
    });

    it('should return false for DEVICE_STATUS message type', () => {
      const result = isSupplementaryServiceMessageType(MOBIUS_SOCKET_MESSAGE_TYPE.DEVICE_STATUS);

      expect(result).toBe(false);
    });

    it('should return false for UNKNOWN message type', () => {
      const result = isSupplementaryServiceMessageType(MOBIUS_SOCKET_MESSAGE_TYPE.UNKNOWN);

      expect(result).toBe(false);
    });
  });
});

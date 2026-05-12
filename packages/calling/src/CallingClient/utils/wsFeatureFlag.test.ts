import {getTestUtilsWebex} from '../../common/testUtil';
import log from '../../Logger';
import {isMobiusWssEnabled, WEBRTC_CALLING_OVER_WS_FEATURE_KEY} from './wsFeatureFlag';

describe('wsFeatureFlag', () => {
  let webex: ReturnType<typeof getTestUtilsWebex>;

  beforeEach(() => {
    webex = getTestUtilsWebex();
    jest.clearAllMocks();
  });

  describe('WEBRTC_CALLING_OVER_WS_FEATURE_KEY', () => {
    it('should export the correct feature key constant', () => {
      expect(WEBRTC_CALLING_OVER_WS_FEATURE_KEY).toBe('webrtc-calling-over-ws-CALL-219562');
    });
  });

  describe('isMobiusWssEnabled', () => {
    let traceSpy: jest.SpyInstance;

    beforeEach(() => {
      traceSpy = jest.spyOn(log, 'trace');
    });

    it('should return true when feature flag is enabled with boolean true', () => {
      webex.internal.device.features.developer.get = jest.fn().mockReturnValue({value: true});

      const result = isMobiusWssEnabled(webex);

      expect(result).toBe(true);
      expect(webex.internal.device.features.developer.get).toHaveBeenCalledWith(
        WEBRTC_CALLING_OVER_WS_FEATURE_KEY
      );
      expect(traceSpy).toHaveBeenCalledWith(
        `Mobius WSS feature flag '${WEBRTC_CALLING_OVER_WS_FEATURE_KEY}' resolved to: true (backend: true, localStorage: null)`,
        {
          file: 'wsFeatureFlag',
          method: 'isMobiusWssEnabled',
        }
      );
    });

    it('should return false when feature flag is disabled with boolean false', () => {
      webex.internal.device.features.developer.get = jest.fn().mockReturnValue({value: false});

      const result = isMobiusWssEnabled(webex);

      expect(result).toBe(false);
      expect(traceSpy).toHaveBeenCalledWith(
        `Mobius WSS feature flag '${WEBRTC_CALLING_OVER_WS_FEATURE_KEY}' resolved to: false (backend: false, localStorage: null)`,
        {
          file: 'wsFeatureFlag',
          method: 'isMobiusWssEnabled',
        }
      );
    });

    it('should return false when feature flag value is undefined', () => {
      webex.internal.device.features.developer.get = jest.fn().mockReturnValue({value: undefined});

      const result = isMobiusWssEnabled(webex);

      expect(result).toBe(false);
      expect(traceSpy).toHaveBeenCalledWith(
        `Mobius WSS feature flag '${WEBRTC_CALLING_OVER_WS_FEATURE_KEY}' resolved to: false (backend: false, localStorage: null)`,
        {
          file: 'wsFeatureFlag',
          method: 'isMobiusWssEnabled',
        }
      );
    });

    it('should return false when feature flag returns null', () => {
      webex.internal.device.features.developer.get = jest.fn().mockReturnValue(null);

      const result = isMobiusWssEnabled(webex);

      expect(result).toBe(false);
    });

    it('should return false when feature flag value is truthy but not boolean true (number)', () => {
      webex.internal.device.features.developer.get = jest.fn().mockReturnValue({value: 1});

      const result = isMobiusWssEnabled(webex);

      expect(result).toBe(false);
      expect(traceSpy).toHaveBeenCalledWith(
        `Mobius WSS feature flag '${WEBRTC_CALLING_OVER_WS_FEATURE_KEY}' resolved to: false (backend: false, localStorage: null)`,
        {
          file: 'wsFeatureFlag',
          method: 'isMobiusWssEnabled',
        }
      );
    });

    it('should return false when feature flag value is truthy but not boolean true (string)', () => {
      webex.internal.device.features.developer.get = jest.fn().mockReturnValue({value: 'true'});

      const result = isMobiusWssEnabled(webex);

      expect(result).toBe(false);
    });

    it('should return false when feature flag value is truthy but not boolean true (object)', () => {
      webex.internal.device.features.developer.get = jest.fn().mockReturnValue({value: {}});

      const result = isMobiusWssEnabled(webex);

      expect(result).toBe(false);
    });

    it('should return false when webex.internal.device.features is missing', () => {
      const webexWithoutFeatures = {
        ...webex,
        internal: {
          ...webex.internal,
          device: {
            ...webex.internal.device,
            features: undefined,
          },
        },
      };

      const result = isMobiusWssEnabled(webexWithoutFeatures as any);

      expect(result).toBe(false);
    });

    it('should return false when webex.internal.device.features.developer is missing', () => {
      const webexWithoutDeveloper = {
        ...webex,
        internal: {
          ...webex.internal,
          device: {
            ...webex.internal.device,
            features: {
              entitlement: webex.internal.device.features.entitlement,
              developer: undefined,
            },
          },
        },
      };

      const result = isMobiusWssEnabled(webexWithoutDeveloper as any);

      expect(result).toBe(false);
    });

    it('should return false when webex.internal.device is missing', () => {
      const webexWithoutDevice = {
        ...webex,
        internal: {
          ...webex.internal,
          device: undefined,
        },
      };

      const result = isMobiusWssEnabled(webexWithoutDevice as any);

      expect(result).toBe(false);
    });

    it('should return false when webex.internal is missing', () => {
      const webexWithoutInternal = {
        ...webex,
        internal: undefined,
      };

      const result = isMobiusWssEnabled(webexWithoutInternal as any);

      expect(result).toBe(false);
    });
  });
});

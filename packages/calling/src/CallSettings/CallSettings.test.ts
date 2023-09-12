import {getTestUtilsWebex} from '../common/testUtil';
import {LOGGER} from '../Logger/types';
import {
  ENTITLEMENT_BASIC,
  ENTITLEMENT_BROADWORKS_CONN,
  ENTITLEMENT_STANDARD,
  NATIVE_SIP_CALL_TO_UCM,
  NATIVE_WEBEX_TEAMS_CALLING,
} from '../common/constants';

import {CALLING_BACKEND} from '../common/types';

import {WxCallBackendConnector} from './WxCallBackendConnector';
import {createCallSettingsClient} from './CallSettings';
import {UcmBackendConnector} from './UcmBackendConnector';

describe('CallSettings Client tests', () => {
  const webex = getTestUtilsWebex();

  describe('createCallSettingsClient tests', () => {
    /**
     * TestCase inputs
     * name: TestCase name
     * callingBehavior: Calling profile
     * entitlement: Entitlement
     * valid: expected result for vm client creation with given inputs.
     */
    const testData: {
      name: string;
      callingBehavior: string;
      entitlement: string;
      valid: boolean;
    }[] = [
      {
        name: 'verify valid ucm CallSettings client',
        callingBehavior: NATIVE_SIP_CALL_TO_UCM,
        entitlement: 'none',
        valid: true,
      },
      {
        name: 'verify valid wxc CallSettings client with basic entitlement',
        callingBehavior: NATIVE_WEBEX_TEAMS_CALLING,
        entitlement: ENTITLEMENT_BASIC,
        valid: true,
      },
      {
        name: 'verify valid wxc CallSettings client with standard entitlement',
        callingBehavior: NATIVE_WEBEX_TEAMS_CALLING,
        entitlement: ENTITLEMENT_STANDARD,
        valid: true,
      },
      {
        name: 'verify valid wxc CallSettings client with broadworks entitlement',
        callingBehavior: NATIVE_WEBEX_TEAMS_CALLING,
        entitlement: ENTITLEMENT_BROADWORKS_CONN,
        valid: true,
      },
      {
        name: 'verify invalid callingBehavior',
        callingBehavior: 'INVALID',
        entitlement: ENTITLEMENT_BASIC,
        valid: false,
      },
      {
        name: 'verify invalid entitlement for wxc CallSettings client',
        callingBehavior: NATIVE_WEBEX_TEAMS_CALLING,
        entitlement: 'invalid',
        valid: false,
      },
    ].map((stat) =>
      Object.assign(stat, {
        toString() {
          /* eslint-disable dot-notation */
          return this['name'];
        },
      })
    );

    it.each(testData)('%s', async (data) => {
      webex.internal.device.callingBehavior = data.callingBehavior;
      webex.internal.device.features.entitlement.models = [{_values: {key: data.entitlement}}];
      if (data.valid) {
        const callSettingsClient = createCallSettingsClient(webex, {level: LOGGER.INFO});

        expect(callSettingsClient).toBeTruthy();

        switch (data.callingBehavior) {
          case NATIVE_SIP_CALL_TO_UCM:
            expect(callSettingsClient['callingBackend']).toStrictEqual(CALLING_BACKEND.UCM);
            expect(callSettingsClient['backendConnector']).toBeInstanceOf(UcmBackendConnector);
            break;
          case NATIVE_WEBEX_TEAMS_CALLING:
            if (data.entitlement === ENTITLEMENT_BROADWORKS_CONN) {
              expect(callSettingsClient['callingBackend']).toStrictEqual(CALLING_BACKEND.BWRKS);
              expect(callSettingsClient['backendConnector']).toBeInstanceOf(WxCallBackendConnector);
            } else {
              /* entitlement basic and standard */
              expect(callSettingsClient['callingBackend']).toStrictEqual(CALLING_BACKEND.WXC);
              expect(callSettingsClient['backendConnector']).toBeInstanceOf(WxCallBackendConnector);
            }
            break;
          default:
            fail('Unknown calling backend type.');
        }
      } else {
        expect(() => {
          createCallSettingsClient(webex, {level: LOGGER.INFO});
        }).toThrowError('Calling backend is not identified, exiting....');
      }
    });
  });
});

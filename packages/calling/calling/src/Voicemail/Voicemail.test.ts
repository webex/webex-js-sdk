import {getTestUtilsWebex} from '../common/testUtil';
import {createVoicemailClient} from './Voicemail';
import {LOGGER} from '../Logger/types';
import {
  ENTITLEMENT_BASIC,
  ENTITLEMENT_BROADWORKS_CONN,
  ENTITLEMENT_STANDARD,
  NATIVE_SIP_CALL_TO_UCM,
  NATIVE_WEBEX_TEAMS_CALLING,
} from './constants';
import {CALLING_BACKEND} from './types';
import {UcmBackendConnector} from './UcmBackendConnector';
import {BroadworksBackendConnector} from './BroadworksBackendConnector';
import {WxCallBackendConnector} from './WxCallBackendConnector';

describe('Voicemail Client tests', () => {
  const webex = getTestUtilsWebex();

  describe('createVoicemailClient tests', () => {
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
        name: 'verify valid ucm voicemail client',
        callingBehavior: NATIVE_SIP_CALL_TO_UCM,
        entitlement: 'none',
        valid: true,
      },
      {
        name: 'verify valid wxc voicemail client with basic entitlement',
        callingBehavior: NATIVE_WEBEX_TEAMS_CALLING,
        entitlement: ENTITLEMENT_BASIC,
        valid: true,
      },
      {
        name: 'verify valid wxc voicemail client with standard entitlement',
        callingBehavior: NATIVE_WEBEX_TEAMS_CALLING,
        entitlement: ENTITLEMENT_STANDARD,
        valid: true,
      },
      {
        name: 'verify valid wxc voicemail client with broadworks entitlement',
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
        name: 'verify invalid entitlement for wxc voicemail client',
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
        const voiceMailClient = createVoicemailClient(webex, {level: LOGGER.INFO});

        expect(voiceMailClient).toBeTruthy();
        expect(voiceMailClient.getSDKConnector().getWebex()).toBeTruthy();

        switch (data.callingBehavior) {
          case NATIVE_SIP_CALL_TO_UCM:
            expect(voiceMailClient['callingBackend']).toStrictEqual(CALLING_BACKEND.UCM);
            expect(voiceMailClient['backendConnector']).toBeInstanceOf(UcmBackendConnector);
            break;
          case NATIVE_WEBEX_TEAMS_CALLING:
            if (data.entitlement === ENTITLEMENT_BROADWORKS_CONN) {
              expect(voiceMailClient['callingBackend']).toStrictEqual(CALLING_BACKEND.BWRKS);
              expect(voiceMailClient['backendConnector']).toBeInstanceOf(
                BroadworksBackendConnector
              );
            } else {
              /* entitlement basic and standard */
              expect(voiceMailClient['callingBackend']).toStrictEqual(CALLING_BACKEND.WXC);
              expect(voiceMailClient['backendConnector']).toBeInstanceOf(WxCallBackendConnector);
            }
            break;
          default:
            fail('Unknown calling backend type.');
        }
      } else {
        expect(() => {
          createVoicemailClient(webex, {level: LOGGER.INFO});
        }).toThrowError('Calling backend is not identified, exiting....');
      }
    });
  });
});

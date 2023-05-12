import {LOGGER} from '../Logger/types';
import {getTestUtilsWebex} from '../common/testUtil';

import {IUcmBackendConnector} from './types';
import {UcmBackendConnector} from './UcmBackendConnector';

describe('Voicemail UCM Backend Connector Test case', () => {
  let ucmBackendConnector: IUcmBackendConnector;

  const webex = getTestUtilsWebex();

  beforeAll(() => {
    webex.version = '2.31.1';
    webex.internal.device.version = '2.31.1';
    webex.internal.device.features.entitlement.models = [{_values: {key: 'ucm-calling'}}];
    webex.internal.device.callingBehavior = 'NATIVE_SIP_CALL_TO_UCM';
    ucmBackendConnector = new UcmBackendConnector(webex, {level: LOGGER.INFO});
    ucmBackendConnector.init();
  });

  it('verify fetching transcript returned null', async () => {
    const response = await ucmBackendConnector.getVMTranscript(
      '98099432-9d81-4224-bd04-00def73cd262'
    );

    expect(response).toBeNull();
  });
});

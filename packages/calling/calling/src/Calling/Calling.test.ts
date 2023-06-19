import {LOGGER} from '../Logger/types';
import {getTestUtilsWebex} from '../common/testUtil';
import {createCalling} from './Calling';
import * as CallingClient from '../CallingClient/CallingClient';
import * as ContactsClient from '../Contacts/ContactsClient';
import * as CallHistoryClient from '../CallHistory/CallHistory';
import * as CallSettingsClient from '../CallSettings/CallSettings';
import * as VoicemailClient from '../Voicemail/Voicemail';
import {Webex} from '../init';
import {EVENT_KEYS} from '../../dist/module/Events/types';
import {CALLING_FILE} from '../CallingClient/constants';
import log from '../Logger';
import {ICalling} from './types';

describe('Calling tests', () => {
  let calling: ICalling;
  const webex = getTestUtilsWebex();
  const initSpy = jest.spyOn(Webex, 'init').mockReturnValue(webex);
  const warnSpy = jest.spyOn(log, 'warn');
  const callingClientSpy = jest.spyOn(CallingClient, 'createClient');
  const contactClientSpy = jest.spyOn(ContactsClient, 'createContactsClient');
  const callHistoryClientSpy = jest.spyOn(CallHistoryClient, 'createCallHistoryClient');
  const callSettingsClientSpy = jest.spyOn(CallSettingsClient, 'createCallSettingsClient');
  const voicemailClientSpy = jest.spyOn(VoicemailClient, 'createVoicemailClient');

  const logContext = {
    file: CALLING_FILE,
    method: 'register',
  };

  const loggerConfig = {level: LOGGER.INFO};
  const mockToken = 'Bearer 1234';
  const cred = {access_token: mockToken};

  const callingConfig = {
    clientConfig: {calling: true, contact: true, history: true, settings: true, voicemail: true},
    callingClientConfig: {logger: loggerConfig},
    logger: loggerConfig,
  };

  afterEach(() => {
    calling = undefined;
  });

  function intializedClientChecks(clientCreated: boolean) {
    if (clientCreated) {
      expect(callingClientSpy).toBeCalledOnceWith({logger: loggerConfig});
      expect(contactClientSpy).toBeCalledOnceWith(loggerConfig);
      expect(callHistoryClientSpy).toBeCalledOnceWith(loggerConfig);
      expect(callSettingsClientSpy).toBeCalledOnceWith(loggerConfig);
      expect(voicemailClientSpy).toBeCalledOnceWith(loggerConfig);

      expect(calling.callingClient).toBeTruthy();
      expect(calling.contactClient).toBeTruthy();
      expect(calling.callHistoryClient).toBeTruthy();
      expect(calling.callSettingsClient).toBeTruthy();
      expect(calling.voicemailClient).toBeTruthy();
    } else {
      expect(callingClientSpy).not.toBeCalledOnceWith({logger: loggerConfig});
      expect(contactClientSpy).not.toBeCalledOnceWith(loggerConfig);
      expect(callHistoryClientSpy).not.toBeCalledOnceWith(loggerConfig);
      expect(callSettingsClientSpy).not.toBeCalledOnceWith(loggerConfig);
      expect(voicemailClientSpy).not.toBeCalledOnceWith(loggerConfig);

      expect(calling.callingClient).toBeFalsy();
      expect(calling.contactClient).toBeFalsy();
      expect(calling.callHistoryClient).toBeFalsy();
      expect(calling.callSettingsClient).toBeFalsy();
      expect(calling.voicemailClient).toBeFalsy();
    }
  }

  it('creates Calling object, other client objects based on config received and webex object not initilaized', () => {
    calling = createCalling(callingConfig, webex);
    const registerSpy = jest.spyOn(calling, 'register');

    expect(initSpy).not.toBeCalledOnceWith();
    expect(registerSpy).not.toBeCalledOnceWith();

    expect(calling).toBeTruthy();
    expect(calling.getSDKConnector().getWebex()).toEqual(webex);
    intializedClientChecks(true);
  });

  it('creates Calling object, client objects are not created as per config received', () => {
    const callingConfig2 = {
      clientConfig: {
        calling: false,
        contact: false,
        history: false,
        settings: false,
        voicemail: false,
      },
      callingClientConfig: {logger: loggerConfig},
      logger: loggerConfig,
    };

    calling = createCalling(callingConfig2, webex);
    const registerSpy = jest.spyOn(calling, 'register');

    expect(initSpy).not.toBeCalledOnceWith();
    expect(registerSpy).not.toBeCalledOnceWith();

    expect(calling).toBeTruthy();
    expect(calling.getSDKConnector().getWebex()).toEqual(webex);

    intializedClientChecks(false);
  });

  it('creates Calling object, initializes webex using token received, creates client objects based on calling config', () => {
    webex.internal.device.register.mockImplementation(async () => {
      await Promise.resolve();
    });

    webex.internal.mercury.connect.mockImplementation(async () => {
      await Promise.resolve();
    });

    calling = createCalling(callingConfig, undefined, cred);
    const registerSpy = jest.spyOn(calling, 'register');

    expect(initSpy).toBeCalledOnceWith({credentials: cred});
    expect(calling).toBeTruthy();

    calling.on(EVENT_KEYS.READY, () => {
      calling.register().then(() => {
        expect(registerSpy).toBeCalledOnceWith();
        expect(webex.internal.device.register).toBeCalledOnceWith();
        expect(webex.internal.mercury.connect).toBeCalledOnceWith();

        expect(calling.getSDKConnector().getWebex()).toEqual(webex);
        intializedClientChecks(true);
      });
    });
  });

  it('creates Calling object, initialization of webex fails due to wdm registration failure', () => {
    webex.internal.device.register.mockImplementation(async () => {
      await Promise.reject();
    });

    webex.internal.mercury.connect.mockImplementation(async () => {
      await Promise.resolve();
    });

    calling = createCalling(callingConfig, undefined, cred);
    const registerSpy = jest.spyOn(calling, 'register');

    expect(initSpy).toBeCalledOnceWith({credentials: cred});
    expect(calling).toBeTruthy();

    calling.on(EVENT_KEYS.READY, () => {
      calling.register().then(() => {
        expect(registerSpy).toBeCalledOnceWith();
        expect(webex.internal.device.register).toBeCalledOnceWith();
        expect(webex.internal.mercury.connect).not.toBeCalledOnceWith();

        expect(calling.getSDKConnector().getWebex()).toBeUndefined();
        intializedClientChecks(false);

        expect(warnSpy).toBeCalledOnceWith(
          `Error occurred during mercury.register(): `,
          logContext
        );
      });
    });
  });

  it('creates Calling object, initialization of webex fails due to mercury connect failure', () => {
    webex.internal.device.register.mockImplementation(async () => {
      await Promise.resolve();
    });

    webex.internal.mercury.connect.mockImplementation(async () => {
      await Promise.reject();
    });

    calling = createCalling(callingConfig, undefined, cred);
    const registerSpy = jest.spyOn(calling, 'register');

    expect(initSpy).toBeCalledOnceWith({credentials: cred});
    expect(calling).toBeTruthy();

    calling.on(EVENT_KEYS.READY, () => {
      calling.register().then(() => {
        expect(registerSpy).toBeCalledOnceWith();
        expect(webex.internal.device.register).toBeCalledOnceWith();
        expect(webex.internal.mercury.connect).toBeCalledOnceWith();

        expect(calling.getSDKConnector().getWebex()).toBeUndefined();
        intializedClientChecks(false);

        expect(warnSpy).toBeCalledOnceWith(`Error occurred during mercury.connect(): `, logContext);
      });
    });
  });
});

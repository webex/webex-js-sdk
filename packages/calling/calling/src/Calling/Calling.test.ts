import { LOGGER } from "../Logger/types";
import {getTestUtilsWebex} from "../common/testUtil";
import {createCalling} from "./Calling";
import * as CallingClient from "../CallingClient/CallingClient";
import * as ContactsClient from "../Contacts/ContactsClient";
import * as CallHistoryClient from "../CallHistory/CallHistory";
import * as CallSettingsClient from "../CallSettings/CallSettings";
import * as VoicemailClient from "../Voicemail/Voicemail";
import * as InitAction from "../init";

const webex = getTestUtilsWebex();

describe('Calling tests', () => {
  const webexInitSpy = jest.spyOn(InitAction, 'initializeWebex').mockReturnValue(webex);
  const callingClientSpy = jest.spyOn(CallingClient, 'createClient');
  const contactClientSpy = jest.spyOn(ContactsClient, 'createContactsClient');
  const callHistoryClientSpy = jest.spyOn(CallHistoryClient, 'createCallHistoryClient');
  const callSettingsClientSpy = jest.spyOn(CallSettingsClient, 'createCallSettingsClient');
  const voicemailClientSpy = jest.spyOn(VoicemailClient, 'createVoicemailClient');
  const loggerConfig = {level: LOGGER.INFO};
  const mockToken = 'Bearer 1234';

  it('creates Calling object, other client objects based on config received and webex object not initilaized', async () => {
    const callingConfig = {
      clientConfig: {calling: true, contact: true, history: true, settings: true,  voicemail: true,},
      callingClientConfig: {logger: loggerConfig},
      logger: loggerConfig,
      webexConfig: {token: mockToken},
    }

    const Calling = createCalling(callingConfig, webex);

    expect(webexInitSpy).not.toBeCalledOnceWith();

    expect(callingClientSpy).toBeCalledOnceWith({logger: loggerConfig});
    expect(contactClientSpy).toBeCalledOnceWith(loggerConfig);
    expect(callHistoryClientSpy).toBeCalledOnceWith(loggerConfig);
    expect(callSettingsClientSpy).toBeCalledOnceWith(loggerConfig);
    expect(voicemailClientSpy).toBeCalledOnceWith(loggerConfig);

    expect(Calling).toBeTruthy();
    expect(Calling.getSDKConnector().getWebex()).toEqual(webex);

    expect(Calling.getCallingClient()).toBeTruthy();
    expect(Calling.getContactClient()).toBeTruthy();
    expect(Calling.getCallHistoryClient()).toBeTruthy();
    expect(Calling.getCallSettingsClient()).toBeTruthy();
    expect(Calling.getVoicemailClient()).toBeTruthy();

  });

  it('creates Calling object, initializes webex using token received but no client objects are created', async () => {
    const callingConfig = {
      clientConfig: {calling: false, contact: false, history: false, settings: false,  voicemail: false,},
      callingClientConfig: {logger: {level: LOGGER.INFO},},
      logger: {level: LOGGER.INFO},
      webexConfig: {token: mockToken},
    }

    const Calling = createCalling(callingConfig);

    expect(webexInitSpy).toBeCalledOnceWith(mockToken);


    expect(callingClientSpy).not.toBeCalledOnceWith({logger: loggerConfig});
    expect(contactClientSpy).not.toBeCalledOnceWith(loggerConfig);
    expect(callHistoryClientSpy).not.toBeCalledOnceWith(loggerConfig);
    expect(callSettingsClientSpy).not.toBeCalledOnceWith(loggerConfig);
    expect(voicemailClientSpy).not.toBeCalledOnceWith(loggerConfig);

    expect(Calling).toBeTruthy();
    expect(Calling.getSDKConnector().getWebex()).toEqual(webex);

    expect(Calling.getCallingClient()).toBeFalsy();
    expect(Calling.getContactClient()).toBeFalsy();
    expect(Calling.getCallHistoryClient()).toBeFalsy();
    expect(Calling.getCallSettingsClient()).toBeFalsy();
    expect(Calling.getVoicemailClient()).toBeFalsy();
  });
});

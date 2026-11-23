import 'jsdom-global/register';
import TaskFactory from '../../../../../src/services/task/TaskFactory';
import {
  CONSULT_TRANSFER_DESTINATION_TYPE,
  MEDIA_CHANNEL,
  TaskData,
} from '../../../../../src/services/task/types';
import {LoginOption} from '../../../../../src/types';
import WebCallingService from '../../../../../src/services/WebCallingService';
import {ConfigFlags} from '../../../../../src/types';
import register from '@babel/register';

describe('TaskFactory', () => {
  const guard = {generation: 1, signal: new AbortController().signal, assertCommandAllowed: jest.fn()};
  const dummyContact = {} as any;
  const baseData: Partial<TaskData> = {
    interactionId: 'id',
    interaction: {mediaType: MEDIA_CHANNEL.TELEPHONY},
  };

  const makeSvc = (loginOption: LoginOption) =>
    ({
      loginOption,
      on: jest.fn(),
      off: jest.fn?.(),
    } as unknown as WebCallingService);

  const configFlags: ConfigFlags = {
    isEndTaskEnabled: true,
    isEndConsultEnabled: true,
    webRtcEnabled: true,
    autoWrapup: false,
  };

  it('creates WebRTC for TELEPHONY + BROWSER', () => {
    const svc = makeSvc(LoginOption.BROWSER);
    const task = TaskFactory.createTask(dummyContact, svc, baseData as TaskData, configFlags, guard);
    expect(task.constructor.name).toBe('WebRTC');
  });

  it('creates Voice for TELEPHONY + EXTENSION', () => {
    const svc = makeSvc(LoginOption.EXTENSION);
    const task = TaskFactory.createTask(dummyContact, svc, baseData as TaskData, configFlags, guard);
    expect(task.constructor.name).toBe('Voice');
  });

  it('creates Digital for CHAT, EMAIL, SOCIAL', () => {
    const svc = makeSvc(LoginOption.BROWSER);
    for (const type of [MEDIA_CHANNEL.CHAT, MEDIA_CHANNEL.EMAIL, MEDIA_CHANNEL.SOCIAL]) {
      const data = {...baseData, interaction: {mediaType: type}} as TaskData;
      const task = TaskFactory.createTask(dummyContact, svc, data, configFlags, guard);
      expect(task.constructor.name).toBe('Digital');
    }
  });

  it('forwards agent name to Digital tasks', () => {
    const svc = makeSvc(LoginOption.BROWSER);
    const data = {...baseData, interaction: {mediaType: MEDIA_CHANNEL.CHAT}} as TaskData;

    const task = TaskFactory.createTask(
      dummyContact,
      svc,
      data,
      configFlags, guard,
      undefined,
      'agent-id',
      'Agent Name'
    );

    expect((task as any).agentName).toBe('Agent Name');
  });

  it('defaults undefined mediaType to TELEPHONY', () => {
    const svcBrowser = makeSvc(LoginOption.BROWSER);
    const svcExt = makeSvc(LoginOption.EXTENSION);
    const data = {interactionId: 'id', interaction: {}} as TaskData;

    const t1 = TaskFactory.createTask(dummyContact, svcBrowser, data, configFlags, guard);
    expect(t1.constructor.name).toBe('WebRTC');

    const t2 = TaskFactory.createTask(dummyContact, svcExt, data, configFlags, guard);
    expect(t2.constructor.name).toBe('Voice');
  });

  it('passes consult/transfer destination policy into created tasks', () => {
    const svc = makeSvc(LoginOption.EXTENSION);
    const data = {
      ...baseData,
      interaction: {
        mediaType: MEDIA_CHANNEL.TELEPHONY,
        contactDirection: {type: 'INBOUND'},
      },
    } as TaskData;
    const task = TaskFactory.createTask(dummyContact, svc, data, {
      ...configFlags,
      consultTransfer: {
        allowConsultToQueue: true,
        accessQueue: 'ALL',
        accessEntryPoint: 'NONE',
        accessBuddyTeam: 'ALL',
      },
    }, guard);

    expect(task.uiControls.consultTransferDestinations).toEqual({
      consult: [
        CONSULT_TRANSFER_DESTINATION_TYPE.AGENT,
        CONSULT_TRANSFER_DESTINATION_TYPE.QUEUE,
        CONSULT_TRANSFER_DESTINATION_TYPE.DIALNUMBER,
      ],
      transfer: [
        CONSULT_TRANSFER_DESTINATION_TYPE.AGENT,
        CONSULT_TRANSFER_DESTINATION_TYPE.QUEUE,
        CONSULT_TRANSFER_DESTINATION_TYPE.DIALNUMBER,
      ],
    });
  });
  it.each([
    [MEDIA_CHANNEL.TELEPHONY, LoginOption.BROWSER],
    [MEDIA_CHANNEL.TELEPHONY, LoginOption.EXTENSION],
    [MEDIA_CHANNEL.CHAT, LoginOption.BROWSER],
    [MEDIA_CHANNEL.EMAIL, LoginOption.BROWSER],
    [MEDIA_CHANNEL.SOCIAL, LoginOption.BROWSER],
  ])('binds the required guard before returning %s/%s', async (mediaType, loginOption) => {
    const rejected = new Error('closed command gate');
    const guard = {generation: 3, signal: new AbortController().signal, assertCommandAllowed: jest.fn(() => {throw rejected;})};
    const task = TaskFactory.createTask(dummyContact, makeSvc(loginOption), {...baseData, interaction: {mediaType}} as TaskData, configFlags, guard);
    await expect(task.accept()).rejects.toBe(rejected);
    expect(guard.assertCommandAllowed).toHaveBeenCalledTimes(1);
    task.invalidateForRegionRecovery();
  });

});

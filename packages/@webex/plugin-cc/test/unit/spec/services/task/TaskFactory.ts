import 'jsdom-global/register';
import TaskFactory from '../../../../../src/services/task/TaskFactory';
import {MEDIA_CHANNEL, TaskData} from '../../../../../src/services/task/types';
import {LoginOption} from '../../../../../src/types';
import WebCallingService from '../../../../../src/services/WebCallingService';
import {Profile} from '../../../../../src/config/types';

describe('TaskFactory', () => {
  const dummyContact = {} as any;
  const baseData: Partial<TaskData> = {
    interactionId: 'id',
    interaction: {mediaType: MEDIA_CHANNEL.TELEPHONY},
  };

  const makeSvc = (loginOption: LoginOption) =>
    ({loginOption} as unknown) as WebCallingService;

  const agentProfile: Profile = {
    isEndCallEnabled: true,
    isEndConsultEnabled: true,
  };

  it('creates WebRTC for TELEPHONY + BROWSER', () => {
    const svc = makeSvc(LoginOption.BROWSER);
    const task = TaskFactory.create(dummyContact, svc, baseData as TaskData, agentProfile);
    expect(task.constructor.name).toBe('WebRTC');
  });

  it('creates Voice for TELEPHONY + EXTENSION', () => {
    const svc = makeSvc(LoginOption.EXTENSION);
    const task = TaskFactory.create(dummyContact, svc, baseData as TaskData, agentProfile);
    expect(task.constructor.name).toBe('Voice');
  });

  it('creates Digital for CHAT, EMAIL, SOCIAL', () => {
    const svc = makeSvc(LoginOption.BROWSER);
    for (const type of [MEDIA_CHANNEL.CHAT, MEDIA_CHANNEL.EMAIL, MEDIA_CHANNEL.SOCIAL]) {
      const data = {...baseData, interaction: {mediaType: type}} as TaskData;
      const task = TaskFactory.create(dummyContact, svc, data, agentProfile);
      expect(task.constructor.name).toBe('Digital');
    }
  });

  it('defaults undefined mediaType to TELEPHONY', () => {
    const svcBrowser = makeSvc(LoginOption.BROWSER);
    const svcExt = makeSvc(LoginOption.EXTENSION);
    const data = {interactionId: 'id', interaction: {}} as TaskData;

    const t1 = TaskFactory.create(dummyContact, svcBrowser, data, agentProfile);
    expect(t1.constructor.name).toBe('WebRTC');

    const t2 = TaskFactory.create(dummyContact, svcExt, data, agentProfile);
    expect(t2.constructor.name).toBe('Voice');
  });
});

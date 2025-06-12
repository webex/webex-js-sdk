import Voice from '../../../../../../src/services/task/voice/Voice';
import { TaskData } from '../../../../../../src/services/task/types';
import { CC_EVENTS } from '../../../../../../src/services/config/types';
import { CONSULT_TRANSFER_DESTINATION_TYPE } from '../../../../../../src/services/task/types';

jest.mock('../../../../../../src/services/core/WebexRequest', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({ uploadLogs: jest.fn() }),
  },
}));

jest.mock('../../../../../../src/services/core/Utils', () => ({
  __esModule: true,
  getErrorDetails: (err: any) => ({ error: err }),
}));

describe('Voice Task', () => {
  const dummyContact = {
    hold: jest.fn().mockResolvedValue('held'),
    unHold: jest.fn().mockResolvedValue('resumed'),
    pauseRecording: jest.fn().mockResolvedValue('paused'),
    resumeRecording: jest.fn().mockResolvedValue('resumedRecording'),
    consult: jest.fn().mockResolvedValue('consulted'),
  } as any;

  const baseData = {
    interactionId: 'int1',
    mediaResourceId: 'media1',
    interaction: {
      mainInteractionId: 'main1',
      media: { main1: { mediaResourceId: 'media1' } },
    },
  } as unknown as TaskData;

  it('hides end and endConsult when disabled', () => {
    const voice = new Voice(dummyContact, baseData, {
      isEndCallEnabled: false,
      isEndConsultEnabled: false,
    });
    voice.updateTaskData(baseData);
    expect(voice.taskUiControls.end.visible).toBe(false);
    expect(voice.taskUiControls.endConsult.visible).toBe(false);
  });

  it('hold() calls contact.hold with correct params', async () => {
    const voice = new Voice(dummyContact, baseData, {
      isEndCallEnabled: true,
      isEndConsultEnabled: true,
    });
    const res = await voice.hold();
    expect(dummyContact.hold).toHaveBeenCalledWith({
      interactionId: 'int1',
      data: { mediaResourceId: 'media1' },
    });
  });

  it('resume() calls contact.unHold with correct mediaResourceId', async () => {
    const voice = new Voice(dummyContact, baseData, {
      isEndCallEnabled: true,
      isEndConsultEnabled: true,
    });
    const res = await voice.resume();
    expect(dummyContact.unHold).toHaveBeenCalledWith({
      interactionId: 'int1',
      data: { mediaResourceId: 'media1' },
    });
  });

  it('pauseRecording() calls contact.pauseRecording', async () => {
    const voice = new Voice(dummyContact, baseData, {
      isEndCallEnabled: true,
      isEndConsultEnabled: true,
    });
    const res = await voice.pauseRecording();
    expect(dummyContact.pauseRecording).toHaveBeenCalledWith({ interactionId: 'int1' });
  });

  it('resumeRecording() with no payload defaults to autoResumed false', async () => {
    const voice = new Voice(dummyContact, baseData, {
      isEndCallEnabled: true,
      isEndConsultEnabled: true,
    });
    const res = await voice.resumeRecording();
    expect(dummyContact.resumeRecording).toHaveBeenCalledWith({
      interactionId: 'int1',
      data: { autoResumed: false },
    });
  });

  it('consult() calls contact.consult with payload', async () => {
    const voice = new Voice(dummyContact, baseData, {
      isEndCallEnabled: true,
      isEndConsultEnabled: true,
    });
    const payload = { destination: 'agent1', destinationType: 'agent' } as any;
    const res = await voice.consult(payload);
    expect(dummyContact.consult).toHaveBeenCalledWith({
      interactionId: 'int1',
      data: payload,
    });
  });

  describe('transfer()', () => {
    it('calls contact.consultTransfer for consult transfer to agent', async () => {
      const consultTransferMock = jest.fn().mockResolvedValue('consultedA');
      const dataWithState = {
        ...baseData,
        interaction: { ...baseData.interaction, state: 'consulting' },
      };
      const voice = new Voice(
        { ...dummyContact, consultTransfer: consultTransferMock },
        dataWithState as any,
        { isEndCallEnabled: true, isEndConsultEnabled: true }
      );

      const result = await voice.transfer({
        to: 'destB',
        destinationType: 'agent',
      });

      expect(consultTransferMock).toHaveBeenCalledWith({
        interactionId: 'int1',
        data: { to: 'destB', destinationType: 'agent' },
      });
    });

    it('throws if consult transfer to QUEUE but no destAgentId set', async () => {
      const dataWithState = {
        ...baseData,
        interaction: { ...baseData.interaction, state: 'consulting' },
      };
      const voice = new Voice(dummyContact, dataWithState as any, {
        isEndCallEnabled: true,
        isEndConsultEnabled: true,
      });

      await expect(
        voice.transfer({
          to: 'queue1',
          destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.QUEUE,
        })
      ).rejects.toThrow('No agent has accepted this queue consult yet');
    });

    it('uses data.destAgentId for queue consult transfer', async () => {
      const consultTransferMock = jest.fn().mockResolvedValue('consultedQ');
      const dataWithDest = {
        ...baseData,
        destAgentId: 'agentD',
        interaction: { ...baseData.interaction, state: 'consulting' },
      };
      const voice = new Voice(
        { ...dummyContact, consultTransfer: consultTransferMock },
        dataWithDest as any,
        { isEndCallEnabled: true, isEndConsultEnabled: true }
      );

      const result = await voice.transfer({
        to: 'queueX',
        destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.QUEUE,
      });

      expect(consultTransferMock).toHaveBeenCalledWith({
        interactionId: 'int1',
        data: {
          to: 'agentD',
          destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.AGENT,
        },
      });
      expect(result).toBe('consultedQ');
    });
  });

  describe('endConsult()', () => {
    it('calls contact.consultEnd with correct payload', async () => {
      const consultEndMock = jest.fn().mockResolvedValue('endedC');
      const voice = new Voice(
        { ...dummyContact, consultEnd: consultEndMock },
        baseData,
        { isEndCallEnabled: true, isEndConsultEnabled: true }
      );
      const payload = { isConsult: true, queueId: 'q1', taskId: 't1' };
      const result = await voice.endConsult(payload);

      expect(consultEndMock).toHaveBeenCalledWith({
        interactionId: 'int1',
        data: payload,
      });
      expect(result).toBe('endedC');
    });
  });

  describe('UI controls for AGENT_CONTACT_ASSIGNED', () => {
    it('shows main controls and hides accept/decline on AGENT_CONTACT_ASSIGNED', () => {
      const data: any = { ...baseData, type: CC_EVENTS.AGENT_CONTACT_ASSIGNED };
      const voice = new Voice(dummyContact, data, {
        isEndCallEnabled: true,
        isEndConsultEnabled: false,
      });

      voice.updateTaskData(data);

      expect(voice.taskUiControls.accept.visible).toBe(false);
      expect(voice.taskUiControls.decline.visible).toBe(false);
      expect(voice.taskUiControls.hold.visible).toBe(true);
      expect(voice.taskUiControls.transfer.visible).toBe(true);
      expect(voice.taskUiControls.consult.visible).toBe(true);
      expect(voice.taskUiControls.recording.visible).toBe(true);
      expect(voice.taskUiControls.end.visible).toBe(true);
      expect(voice.taskUiControls.endConsult.visible).toBe(false);
    });
  });

  describe('UI controls for various CC_EVENTS', () => {
    const make = (evt: any, opts: any = {}) => {
      const data: any = {
        ...baseData,
        type: evt,
        interaction: { ...baseData.interaction, state: opts.state || 'active' },
        isConsulted: opts.isConsulted,
        destAgentId: opts.destAgentId,
      };
      const voice = new Voice(dummyContact, data, {
        isEndCallEnabled: opts.endCall ?? true,
        isEndConsultEnabled: opts.endConsult ?? true,
      });
      voice.updateTaskData(data);
      return voice.taskUiControls;
    };

    it('AGENT_CONTACT_UNASSIGNED hides consultTransfer/recording/end and shows wrapup', () => {
      const ctrl = make(CC_EVENTS.AGENT_CONTACT_UNASSIGNED);
      expect(ctrl.consultTransfer.visible).toBe(false);
      expect(ctrl.recording.visible).toBe(false);
      expect(ctrl.end.visible).toBe(false);
      expect(ctrl.wrapup.visible).toBe(true);
      expect(ctrl.wrapup.enabled).toBe(true);
    });

    it('CONTACT_ENDED with state new hides all and no wrapup', () => {
      const ctrl = make(CC_EVENTS.CONTACT_ENDED, { state: 'new' });
      ['hold','transfer','consult','consultTransfer','recording','end','endConsult','wrapup']
        .forEach(k => expect((ctrl as any)[k].visible).toBe(false));
    });

    it('CONTACT_ENDED with state active hides all except wrapup', () => {
      const ctrl = make(CC_EVENTS.CONTACT_ENDED, { state: 'ended' });
      ['hold','transfer','consult','consultTransfer','recording','end','endConsult']
        .forEach(k => expect((ctrl as any)[k].visible).toBe(false));
      expect(ctrl.wrapup.visible).toBe(true);
      expect(ctrl.wrapup.enabled).toBe(true);
    });

    it('AGENT_CONTACT_HELD shows main controls and end disabled', () => {
      const ctrl = make(CC_EVENTS.AGENT_CONTACT_HELD);
      ['hold','transfer','consult','recording'].forEach(k =>
        expect((ctrl as any)[k].visible).toBe(true)
      );
      expect(ctrl.end.visible).toBe(true);
      expect(ctrl.end.enabled).toBe(false);
    });

    it('AGENT_CONTACT_UNHELD shows main controls and end enabled', () => {
      const ctrl = make(CC_EVENTS.AGENT_CONTACT_UNHELD);
      ['hold','transfer','consult','recording'].forEach(k =>
        expect((ctrl as any)[k].visible).toBe(true)
      );
      expect(ctrl.end.visible).toBe(true);
      expect(ctrl.end.enabled).toBe(true);
    });

    it('AGENT_VTEAM_TRANSFERRED hides all except wrapup', () => {
      const ctrl = make(CC_EVENTS.AGENT_VTEAM_TRANSFERRED);
      ['hold','transfer','consult','consultTransfer','recording','end'].forEach(k =>
        expect((ctrl as any)[k].visible).toBe(false)
      );
      expect(ctrl.wrapup.visible).toBe(true);
      expect(ctrl.wrapup.enabled).toBe(true);
    });

    it('AGENT_CTQ_CANCEL_FAILED shows main and end enabled', () => {
      const ctrl = make(CC_EVENTS.AGENT_CTQ_CANCEL_FAILED);
      ['hold','transfer','consult','recording'].forEach(k =>
        expect((ctrl as any)[k].visible).toBe(true)
      );
      expect(ctrl.end.visible).toBe(true);
      expect(ctrl.end.enabled).toBe(true);
    });

    it('AGENT_CONSULT_CREATED when not consulted toggles correctly', () => {
      const ctrl = make(CC_EVENTS.AGENT_CONSULT_CREATED, { isConsulted: false });
      ['hold','consult','transfer','end'].forEach(k =>
        expect((ctrl as any)[k].visible).toBe(false)
      );
      expect(ctrl.consultTransfer.visible).toBe(true);
      expect(ctrl.consultTransfer.enabled).toBe(false);
      expect(ctrl.recording.visible).toBe(true);
      expect(ctrl.recording.enabled).toBe(false);
      expect(ctrl.endConsult.visible).toBe(true);
      expect(ctrl.endConsult.enabled).toBe(true);
    });

    it('AGENT_CONSULT_CREATED shows no UI on receiving agent end', () => {
      const before = make(CC_EVENTS.AGENT_CONTACT_ASSIGNED);
      const ctrl = make(CC_EVENTS.AGENT_CONSULT_CREATED, { isConsulted: true });
      expect(ctrl.hold.visible).toBe(false);
      expect(ctrl.transfer.visible).toBe(false);
      expect(ctrl.consult.visible).toBe(false);
      expect(ctrl.recording.visible).toBe(false);
      expect(ctrl.end.visible).toBe(false);
      expect(ctrl.endConsult.visible).toBe(false);
    });

    it('AGENT_OFFER_CONSULT respects endConsult flag', () => {
      const ctrl1 = make(CC_EVENTS.AGENT_OFFER_CONSULT, { endConsult: true });
      expect(ctrl1.endConsult.visible).toBe(true);
      expect(ctrl1.endConsult.enabled).toBe(true);
      const ctrl2 = make(CC_EVENTS.AGENT_OFFER_CONSULT, { endConsult: false });
      expect(ctrl2.endConsult.visible).toBe(false);
    });

    it('AGENT_CONSULTING when starting hides main and shows consultTransfer etc.', () => {
      const ctrl = make(CC_EVENTS.AGENT_CONSULTING, { isConsulted: false });
      ['hold','transfer','consult'].forEach(k =>
        expect((ctrl as any)[k].visible).toBe(false)
      );
      expect(ctrl.consultTransfer.visible).toBe(true);
      expect(ctrl.consultTransfer.enabled).toBe(true);
      expect(ctrl.recording.visible).toBe(true);
      expect(ctrl.recording.enabled).toBe(false);
      expect(ctrl.endConsult.visible).toBe(true);
      expect(ctrl.endConsult.enabled).toBe(true);
      expect(ctrl.end.visible).toBe(true);
      expect(ctrl.end.enabled).toBe(false);
    });

    it('AGENT_CONSULTING when consulted only shows endConsult if allowed', () => {
      const ctrl = make(CC_EVENTS.AGENT_CONSULTING, { isConsulted: true, endConsult: true });
      expect(ctrl.endConsult.visible).toBe(true);
      expect(ctrl.endConsult.enabled).toBe(true);
    });

    it('AGENT_CONSULT_FAILED resets to main and hides transfer/wrapup', () => {
      const ctrl = make(CC_EVENTS.AGENT_CONSULT_FAILED, { isConsulted: false });
      ['hold','transfer','consult','recording'].forEach(k =>
        expect((ctrl as any)[k].visible).toBe(true)
      );
      expect(ctrl.end.visible).toBe(true);
      expect(ctrl.consultTransfer.visible).toBe(false);
      expect(ctrl.wrapup.visible).toBe(false);
    });
  });

  describe('UI controls for AGENT_CONTACT', () => {
    const makeContact = (opts: {
      state: string;
      isConsulted?: boolean;
      isTerminated?: boolean;
      endCall?: boolean;
      endConsult?: boolean;
    }) => {
      const data: any = {
        ...baseData,
        type: CC_EVENTS.AGENT_CONTACT,
        interaction: {
          ...baseData.interaction,
          state: opts.state,
          isTerminated: opts.isTerminated || false,
        },
        isConsulted: opts.isConsulted || false,
      };
      const voice = new Voice(dummyContact, data, {
        isEndCallEnabled: opts.endCall ?? true,
        isEndConsultEnabled: opts.endConsult ?? true,
      });
      voice.updateTaskData(data);
      return voice.taskUiControls;
    };

    it('hides all and shows wrapup when terminated', () => {
      const ctrl = makeContact({ state: 'connected', isTerminated: true });
      ['hold','transfer','consult','consultTransfer','recording','end'].forEach(k =>
        expect((ctrl as any)[k].visible).toBe(false)
      );
      expect(ctrl.wrapup.visible).toBe(true);
      expect(ctrl.wrapup.enabled).toBe(true);
    });

    it('shows main and end enabled when connected (not consulted)', () => {
      const ctrl = makeContact({ state: 'connected', isConsulted: false });
      ['hold','transfer','consult','recording'].forEach(k =>
        expect((ctrl as any)[k].visible).toBe(true)
      );
      expect(ctrl.end.visible).toBe(true);
      expect(ctrl.end.enabled).toBe(true);
    });

    it('consulting (not consulted) hides main, shows consultTransfer/endConsult, end disabled', () => {
      const ctrl = makeContact({ state: 'consulting', isConsulted: false, endCall: true });
      ['hold','transfer','consult'].forEach(k =>
        expect((ctrl as any)[k].visible).toBe(false)
      );
      expect(ctrl.consultTransfer.visible).toBe(true);
      expect(ctrl.consultTransfer.enabled).toBe(true);
      expect(ctrl.endConsult.visible).toBe(true);
      expect(ctrl.endConsult.enabled).toBe(true);
      expect(ctrl.end.visible).toBe(true);
      expect(ctrl.end.enabled).toBe(false);
    });

    it('consulting (consulted) hides main and shows only endConsult when allowed', () => {
      const ctrl = makeContact({ state: 'consulting', isConsulted: true, endConsult: true });
      ['hold','transfer','consult','consultTransfer'].forEach(k =>
        expect((ctrl as any)[k].visible).toBe(false)
      );
      expect(ctrl.recording.visible).toBe(true);
      expect(ctrl.recording.enabled).toBe(false);
      expect(ctrl.endConsult.visible).toBe(true);
      expect(ctrl.endConsult.enabled).toBe(true);
      expect(ctrl.end.visible).toBe(false);
    });
  });
});

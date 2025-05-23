import Voice from '../../../../../../src/services/task/voice/Voice';
import { TaskData } from '../../../../../../src/services/task/types';

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

  it('does not override end and endConsult when enabled', () => {
    const voice = new Voice(dummyContact, baseData, {
      isEndCallEnabled: true,
      isEndConsultEnabled: true,
    });
    voice.updateTaskData(baseData);
    expect(voice.taskUiControls.end.visible).toBe(true);
    expect(voice.taskUiControls.endConsult.visible).toBe(false); // By default it is not visible
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
    expect(res).toBe('held');
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
    expect(res).toBe('resumed');
  });

  it('pauseRecording() calls contact.pauseRecording', async () => {
    const voice = new Voice(dummyContact, baseData, {
      isEndCallEnabled: true,
      isEndConsultEnabled: true,
    });
    const res = await voice.pauseRecording();
    expect(dummyContact.pauseRecording).toHaveBeenCalledWith({ interactionId: 'int1' });
    expect(res).toBe('paused');
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
    expect(res).toBe('resumedRecording');
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
    expect(res).toBe('consulted');
  });
});

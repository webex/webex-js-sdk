import Digital from '../../../../../../src/services/task/digital/Digital';
import { TaskData } from '../../../../../../src/services/task/types';
import { CC_EVENTS } from '../../../../../../src/services/config/types';

jest.mock('../../../../../../src/services/core/WebexRequest', () => ({
  __esModule: true,
  default: {
    getInstance: () => ({ uploadLogs: jest.fn() }),
  },
}));

describe('Digital Task', () => {
  const dummyData = { interactionId: 'dig1' } as TaskData;
  let dummyContact: { accept: jest.Mock<Promise<any>> };

  beforeEach(() => {
    dummyContact = { accept: jest.fn().mockResolvedValue({ status: 'ok' }) };
  });

  it('accept() calls contact.accept with interactionId', async () => {
    const task = new Digital(dummyContact as any, dummyData);
    const res = await task.accept();
    expect(dummyContact.accept).toHaveBeenCalledWith({ interactionId: 'dig1' });
    expect(res).toEqual({ status: 'ok' });
  });

  it('accept() throws when contact.accept rejects', async () => {
    const error = new Error('Error while performing accept');
    dummyContact.accept.mockRejectedValue(error);
    const task = new Digital(dummyContact as any, dummyData);
    await expect(task.accept()).rejects.toThrow('Error while performing accept');
  });

  it('constructor enables accept by default', () => {
    const task = new Digital(dummyContact as any, dummyData);
    // after constructor, accept visible & enabled
    expect(task.taskUiControls.accept.visible).toBe(true);
    expect(task.taskUiControls.accept.enabled).toBe(true);
  });

  describe('setUIControls for AGENT_CONTACT events', () => {
    function make(data: Partial<TaskData> & { type: string }) {
      const full = {
        interactionId: 'dig1',
        interaction: { isTerminated: false, state: 'new' },
        ...data,
      } as TaskData;
      const task = new Digital(dummyContact as any, full);
      task.updateTaskData(full);
      return task.taskUiControls;
    }

    it('new state shows accept only', () => {
      const ctrl = make({ type: CC_EVENTS.AGENT_CONTACT, interaction: { isTerminated: false, state: 'new' } as any });
      expect(ctrl.accept.visible).toBe(true);
      expect(ctrl.transfer.visible).toBe(false);
      expect(ctrl.end.visible).toBe(false);
      expect(ctrl.wrapup.visible).toBe(false);
    });

    it('connected state shows transfer and end', () => {
      const ctrl = make({ type: CC_EVENTS.AGENT_CONTACT, interaction: { isTerminated: false, state: 'connected' } as any });
      expect(ctrl.transfer.visible).toBe(true);
      expect(ctrl.end.visible).toBe(true);
      expect(ctrl.wrapup.visible).toBe(false);
    });

    it('terminated shows wrapup only', () => {
      const ctrl = make({ type: CC_EVENTS.AGENT_CONTACT, interaction: { isTerminated: true, state: 'connected' } as any });
      expect(ctrl.transfer.visible).toBe(false);
      expect(ctrl.end.visible).toBe(false);
      expect(ctrl.wrapup.visible).toBe(true);
      expect(ctrl.wrapup.enabled).toBe(true);
    });
  });

  describe('other CC_EVENTS paths', () => {
    function ctrlFor(type: string) {
      const data = {
        ...dummyData,
        type,
        interaction: { isTerminated: false, state: 'new' },
      } as TaskData;
      const task = new Digital(dummyContact as any, data);
      task.updateTaskData(data);
      return task.taskUiControls;
    }

    it('AGENT_OFFER_CONTACT enables accept', () => {
      const ctrl = ctrlFor(CC_EVENTS.AGENT_OFFER_CONTACT);
      expect(ctrl.accept.visible).toBe(true);
    });

    it('AGENT_CONTACT_ASSIGNED shows transfer and end, hides accept', () => {
      const ctrl = ctrlFor(CC_EVENTS.AGENT_CONTACT_ASSIGNED);
      expect(ctrl.accept.visible).toBe(false);
      expect(ctrl.transfer.visible).toBe(true);
      expect(ctrl.end.visible).toBe(true);
    });

    it('AGENT_VTEAM_TRANSFERRED enables wrapup only', () => {
      const ctrl = ctrlFor(CC_EVENTS.AGENT_VTEAM_TRANSFERRED);
      expect(ctrl.transfer.visible).toBe(false);
      expect(ctrl.end.visible).toBe(false);
      expect(ctrl.wrapup.visible).toBe(true);
    });

    it('AGENT_WRAPUP enables wrapup only', () => {
      const ctrl = ctrlFor(CC_EVENTS.AGENT_WRAPUP);
      expect(ctrl.wrapup.visible).toBe(true);
    });
  });
});

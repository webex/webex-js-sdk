import Digital from '../../../../../../src/services/task/digital/Digital';
import { TaskResponse } from '../../../../../../src/services/task/types';

describe('Digital Task', () => {
  const dummyData = { interactionId: 'dig1' } as any;
  let dummyContact: { accept: jest.Mock<Promise<TaskResponse>> };

  beforeEach(() => {
    dummyContact = { accept: jest.fn().mockResolvedValue({ status: 'ok' } as any) };
  });

  it('accept() calls contact.accept with interactionId', async () => {
    const task = new Digital(dummyContact as any, dummyData);
    const res = await task.accept();
    expect(dummyContact.accept).toHaveBeenCalledWith({ interactionId: 'dig1' });
    expect(res).toEqual({ status: 'ok' });
  });

  it('accept() throws when contact.accept rejects', async () => {
    const error = new Error('fail');
    dummyContact.accept.mockRejectedValue(error);
    const task = new Digital(dummyContact as any, dummyData);
    await expect(task.accept()).rejects.toThrow('fail');
  });

  it('default UI controls remain unchanged', () => {
    const task = new Digital(dummyContact as any, dummyData);
    expect(task.taskUiControls.accept.visible).toBe(true);
    expect(task.taskUiControls.decline.visible).toBe(true);
  });
});

import TaskBase from '../../../../../src/services/task/Task';
import {TaskData} from '../../../../../src/services/task/types';

class DummyTask extends TaskBase {
  public accept() { return Promise.resolve({} as any); }
}

describe('Task (base class)', () => {
  const dummyContact = {} as any;
  const initialData = {
    foo: 'bar',
    nested: {a: 1, b: 2},
  } as unknown as TaskData;

  let task: DummyTask;

  beforeEach(() => {
    task = new DummyTask(dummyContact, initialData);
  });

  it('merges updateTaskData when shouldOverwrite is false', () => {
    const updated = {foo: 'baz', nested: {b: 3}} as unknown as TaskData;
    task.updateTaskData(updated);
    expect(task.data.foo).toBe('baz');
    // nested.a remains, nested.b updated
    expect((task.data as any).nested).toEqual({a: 1, b: 3});
  });

  it('overwrites data when shouldOverwrite is true', () => {
    const updated = {x: 42} as unknown as TaskData;
    task.updateTaskData(updated, true);
    expect((task.data as any).x).toBe(42);
    expect((task.data as any).foo).toBeUndefined();
  });

  it('getUIControls returns default controls shape', () => {
    const controls = task.taskUiControls;
    // accept and decline should be visible/enabled
    expect(controls.accept.visible).toBe(true);
    expect(controls.decline.enabled).toBe(true);
    // hold should be hidden/disabled
    expect(controls.hold.visible).toBe(false);
    expect(controls.hold.enabled).toBe(false);
    // wrapup should be hidden/disabled
    expect(controls.wrapup.visible).toBe(false);
    expect(controls.wrapup.enabled).toBe(false);
  });
});

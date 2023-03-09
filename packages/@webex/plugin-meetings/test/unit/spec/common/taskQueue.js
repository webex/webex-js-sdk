import {assert} from '@webex/test-helper-chai';
import sinon from 'sinon';
import TaskQueue from '@webex/plugin-meetings/src/common/taskQueue';

describe('common/taskQueue', () => {
  let cancelScheduler;
  let scheduler;
  let queue;

  beforeEach(() => {
    cancelScheduler = sinon.stub().returns();
    scheduler = sinon.fake((task) => {
      task();
      return cancelScheduler;
    });
    queue = new TaskQueue({scheduler});
  });

  afterEach(() => {
    queue.clear();
    queue = null;
  });

  it('should execute the scheduler', async () => {
    const task = sinon.fake();

    await queue.addTask(task);

    assert.calledOnce(scheduler);
  });

  it("should wrap a task in a promise and resolve with the task's result", async () => {
    const task = () => 42;

    const taskResult = await queue.addTask(task);

    assert.equal(taskResult, 42);
  });

  it('should execute tasks', async () => {
    const task1 = sinon.fake();
    const task2 = sinon.fake();

    await queue.addTask(task1);
    await queue.addTask(task2);

    assert.calledOnce(task1);
    assert.calledOnce(task2);
  });

  it('should execute tasks in order', async () => {
    const task1 = () => 'a';
    const task2 = () => 'b';
    const task3 = () => 'c';

    const results = await Promise.all([
      queue.addTask(task1),
      queue.addTask(task2),
      queue.addTask(task3),
    ]);

    assert.deepEqual(results, ['a', 'b', 'c']);
  });

  it('cleans resources after cancelling and the currently running task fails', async () => {
    scheduler = sinon.stub().returns(cancelScheduler);
    queue = new TaskQueue({scheduler});

    const task = sinon.fake();
    const error = sinon.fake();

    const promise = queue.addTask(task).catch(error);

    queue.clear();

    await promise;
    assert.calledOnce(error);
    assert.calledOnce(cancelScheduler);
  });

  it('should restart execution when a new task is added after clear', async () => {
    const task1 = sinon.fake();
    const task2 = sinon.fake();

    await queue.addTask(task1);

    queue.clear();

    await queue.addTask(task2);

    assert.calledOnce(task1);
    assert.calledOnce(task2);
  });
});

import sinon from 'sinon';
import {assert} from '@webex/test-helper-chai';
import MediaRequestQueue from '@webex/plugin-meetings/src/reconnection-manager/mediaRequestQueue';
import LoggerProxy from '@webex/plugin-meetings/src/common/logs/logger-proxy';
import LoggerConfig from '@webex/plugin-meetings/src/common/logs/logger-config';

describe('plugin-meetings', () => {
  describe('MediaRequestQueue', () => {
    let queue;
    let infoSpy;
    let errorSpy;

    beforeEach(() => {
      LoggerConfig.set({enable: false});
      LoggerProxy.set();
      infoSpy = sinon.spy(LoggerProxy.logger, 'info');
      errorSpy = sinon.spy(LoggerProxy.logger, 'error');
      queue = new MediaRequestQueue();
    });

    afterEach(() => {
      sinon.restore();
    });

    it('runs the task immediately when not queueing', () => {
      const task = sinon.stub();

      queue.runOrEnqueue('task1', task);

      assert.calledOnceWithExactly(task);
      assert.notCalled(infoSpy);
    });

    it('enqueues the task while queueing', () => {
      const task = sinon.stub();

      queue.start();
      queue.runOrEnqueue('task1', task);

      assert.notCalled(task);
      assert.calledOnceWithExactly(
        infoSpy,
        'MediaRequestQueue#runOrEnqueue --> connection not-ready, enqueuing task1 task'
      );
    });

    it('flush runs queued tasks in order, logs them and stops queueing', () => {
      const task1 = sinon.stub();
      const task2 = sinon.stub();
      const task3 = sinon.stub();

      queue.start();
      queue.runOrEnqueue('task1', task1);
      queue.runOrEnqueue('task2', task2);
      infoSpy.resetHistory();

      queue.flush();

      assert.calledOnceWithExactly(task1);
      assert.calledOnceWithExactly(task2);
      sinon.assert.callOrder(task1, task2);
      assert.deepEqual(
        infoSpy.args.map(([message]) => message),
        [
          'MediaRequestQueue#flush --> flushing queue, tasks: 2',
          'MediaRequestQueue#flush --> running task1 task',
          'MediaRequestQueue#flush --> running task2 task',
        ]
      );

      queue.runOrEnqueue('task3', task3);
      assert.calledOnceWithExactly(task3);
    });

    it('flush runs the remaining tasks when one of them throws', () => {
      const error = new Error('fake error');
      const task1 = sinon.stub().throws(error);
      const task2 = sinon.stub();

      queue.start();
      queue.runOrEnqueue('task1', task1);
      queue.runOrEnqueue('task2', task2);
      queue.flush();

      assert.calledOnceWithExactly(task2);
      assert.calledOnceWithExactly(errorSpy, 'MediaRequestQueue#flush --> task1 task failed', error);
    });

    it('start clears previously queued tasks', () => {
      const staleTask = sinon.stub();
      const task = sinon.stub();

      queue.start();
      queue.runOrEnqueue('staleTask', staleTask);
      queue.start();
      queue.runOrEnqueue('task', task);
      queue.flush();

      assert.notCalled(staleTask);
      assert.calledOnceWithExactly(task);
    });

    it('clear discards queued tasks and stops queueing', () => {
      const discardedTask = sinon.stub();
      const task = sinon.stub();

      queue.start();
      queue.runOrEnqueue('discardedTask', discardedTask);
      queue.clear();
      queue.flush();
      queue.runOrEnqueue('task', task);

      assert.notCalled(discardedTask);
      assert.calledOnceWithExactly(task);
    });
  });
});

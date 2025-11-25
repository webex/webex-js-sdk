import {assert} from '@webex/test-helper-chai';

// mock testUsers
const testUsers = {
  create: () => Promise.resolve([
    {
      token: 'fake-token',
      webex: null
    }
  ])
};

// mock WebexCore
class MockTask {
  constructor() {
    this.tasks = [];
    this.id = 1;
  }
  createTask({title, notes}) {
    const task = {id: String(this.id++), title, notes};
    this.tasks.push(task);
    return Promise.resolve({body: task});
  }
  getTask(id) {
    const task = this.tasks.find(t => t.id === id);
    return Promise.resolve(task);
  }
  listMyTasks() {
    return Promise.resolve({body: {items: this.tasks}});
  }
  deleteTask(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    return Promise.resolve();
  }
}

class WebexCore {
  constructor() {
    this.internal = {
      device: {},
      encryption: {
        kms: {
          setDeviceInfo: () => {},
          createUnboundKeys: async () => [{uri: 'kms://mock-key', jwk: {}}]
        }
      },
      task: new MockTask()
    };
  }
}

describe('plugin-task', function () {
  // this.timeout(60000);
  describe('Task', () => {
    let createdTask, spock;

    beforeEach('create users', async () => {
      [spock] = await testUsers.create({count: 1});
      spock.webex = new WebexCore();
    });

    beforeEach('populate data', async () => {
      const t = await spock.webex.internal.task.createTask({
        title: 'Task Title',
        notes: 'Task Notes',
      });
      createdTask = t.body;
    });

    afterEach(async () => {
      const res = await spock.webex.internal.task.listMyTasks();
      await Promise.all(
        res.body.items.map((task) =>
          spock.webex.internal.task.deleteTask(task.id).catch((reason) => console.warn(reason))
        )
      );
    });

    describe('#getTask()', () => {
      it('fetch the task', async () => {
        const task = await spock.webex.internal.task.getTask(createdTask.id);
        assert.isObject(task);
        assert.equal(task.id, createdTask.id);
      });
    });
  });
});

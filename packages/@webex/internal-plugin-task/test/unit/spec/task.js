import Task from '@webex/internal-plugin-task';
import {
  TASK_REGISTERED,
  TASK_UNREGISTERED,
} from '../../../src/constants';

jest.useFakeTimers();

describe('internal-plugin-task', () => {
  let webex;

  beforeEach(() => {
    webex = {
      canAuthorize: true,
      internal: {
        device: {
          register: jest.fn().mockResolvedValue(),
          unregister: jest.fn().mockResolvedValue(),
        },
        mercury: {
          connect: jest.fn().mockResolvedValue(),
          disconnect: jest.fn().mockResolvedValue(),
          on: jest.fn(),
          off: jest.fn(),
        },
        encryption: {
          kms: {
            createUnboundKeys: jest.fn().mockResolvedValue([{
              uri: "kms://kms-us-int.wbx2.com/keys/xxxx-xxxx-xxxx-xxxx"
            }])
          },
          encryptText: jest.fn().mockResolvedValue("encryptedText"),
          decryptText: jest.fn().mockResolvedValue("decryptedText"),
        },
        task: null,
      },
      request: jest.fn()
    };
    webex.internal.task = new Task({}, {parent: webex});
  });

  describe('Public Api Contract', () => {
    describe('#register()', () => {
      it('on task register call mercury registration', async () => {
        await webex.internal.task.register();
        expect(webex.internal.device.register).toHaveBeenCalledTimes(1);
        expect(webex.internal.mercury.on).toHaveBeenCalledTimes(0);
        expect(webex.internal.task.registered).toBe(true);
      });

      it('should trigger `task:register` event', async () => {
        const spy = jest.fn();
        webex.internal.task.on(TASK_REGISTERED, spy);
        await webex.internal.task.register();
        expect(spy).toHaveBeenCalledTimes(1);
      });
    });

    describe('#unregister()', () => {
      it('should call `mercury.unregister` and `device.unregister`', async () => {
        await webex.internal.task.register();
        await webex.internal.task.unregister();
        expect(webex.internal.mercury.off).toHaveBeenCalledTimes(0);
      });

      it('should trigger `task:unregister` event', async () => {
        const spy = jest.fn();
        await webex.internal.task.register();
        webex.internal.task.on(TASK_UNREGISTERED, spy);
        await webex.internal.task.unregister();
        expect(spy).toHaveBeenCalledTimes(1);
      });
    });

    describe('#listMyTasks()', () => {
      it('should fetch my task list', async () => {
        webex.request.mockResolvedValue({
          body: {
            items: [
              {
                "id": "abcdabcd-abcd-abcd-abcd-00000000",
                "title": "Encrypted Task Title",
                "notes": "Encrypted Task Note",
                "encryptionKeyUrl": "/keys/e5d3f747-6adf-432d-999c-6578e33953e3",
              }
            ],
          },
        });
        const res = await webex.internal.task.listMyTasks();
        expect(res.body.items.length).toBe(1);
        expect(webex.request).toHaveBeenCalledWith({
          method: 'GET',
          service: 'raindrop',
          resource: 'tasks',
          qs: {},
        });
      });
    });

    describe("#getTask()", () => {
      it("should fetch task data", async () => {
        const id = "abcdabcd-abcd-abcd-abcd-00000000";
        const title = "Encrypted Task Title";
        webex.request.mockResolvedValue({
          body: {
            "id": id,
            "title": title,
            "notes": "Encrypted Task Note",
            "encryptionKeyUrl": "/keys/e5d3f747-6adf-432d-999c-6578e33953e3",
          }
        });

        const res = await webex.internal.task.getTask(id);

        expect(res.body.id).toBe(id);
        expect(res.body.title).toBe("decryptedText");
        expect(webex.request).toHaveBeenCalledWith({
          method: "GET",
          service: "raindrop",
          resource: `tasks/${id}`,
        });
      });
    });

    describe("#createTask()", () => {
      it("should create a task", async () => {
        const data = {
          title: "My Task 1",
        };

        webex.request.mockResolvedValue({
          body: {
            id: "abcdabcd-abcd-abcd-abcd-00000000",
            title: "My Task 1",
          }
        });

        const res = await webex.internal.task.createTask(data);

        expect(res.body.id).toBe("abcdabcd-abcd-abcd-abcd-00000000");
        expect(webex.request).toHaveBeenCalledWith({
          method: "POST",
          service: "raindrop",
          body: data,
          resource: "tasks",
        });
      });
    });

    describe("#updateTask()", () => {
      it("should update a task", async () => {
        const id = "abcdabcd-abcd-abcd-abcd-00000000";
        const data = {
          title: "My Task 1",
        };

        webex.request.mockResolvedValue({
          body: {
            id: "abcdabcd-abcd-abcd-abcd-00000000",
            title: "My Task 1",
          }
        });

        const res = await webex.internal.task.updateTask(id, data);

        expect(res.body.id).toBe("abcdabcd-abcd-abcd-abcd-00000000");
        expect(webex.request).toHaveBeenCalledWith({
          method: "PATCH",
          service: "raindrop",
          body: data,
          resource: `tasks/${id}`,
        });
      });
    });

    describe("#deleteTask()", () => {
      it("should delete a task event", async () => {
        const id = "abcdabcd-abcd-abcd-abcd-00000000";

        webex.request.mockResolvedValue({
          body: {}
        });

        await webex.internal.task.deleteTask(id);

        expect(webex.request).toHaveBeenCalledWith({
          method: "DELETE",
          service: "raindrop",
          resource: `tasks/${id}`,
        });
      });
    });
  });
});

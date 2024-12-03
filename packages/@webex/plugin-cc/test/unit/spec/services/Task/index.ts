import 'jsdom-global/register';
import {LocalMicrophoneStream} from '@webex/calling';
import {LoginOption} from '../../../../../src/types';
import { CC_FILE } from '../../../../../src/constants';
import Task from '../../../../../src/services/task';
import * as Utils from '../../../../../src/services/core/Utils';

jest.mock('@webex/calling');

describe('Task', () => {
  let task;
  let contactMock;
  let taskDataMock;
  let webCallingServiceMock;
  let getErrorDetailsSpy;
  const taskId = 'taskId123';

  beforeEach(() => {
    contactMock = {
      accept: jest.fn().mockResolvedValue({}),
      hold: jest.fn().mockResolvedValue({}),
      unHold: jest.fn().mockResolvedValue({}),
      end: jest.fn().mockResolvedValue({}),
      wrapup: jest.fn().mockResolvedValue({})
    };

    webCallingServiceMock = {
      loginOption: LoginOption.BROWSER,
      answerCall: jest.fn(),
      declineCall: jest.fn()
    };

      // Mock task data
      taskDataMock = {};

      // Create an instance of Task
      task = new Task(contactMock, webCallingServiceMock, taskDataMock);

      // Mock navigator.mediaDevices
      global.navigator.mediaDevices = {
        getUserMedia: jest.fn(() =>
          Promise.resolve({
            getAudioTracks: jest.fn().mockReturnValue([''])
          })
        ),
      };
      
      // Mock MediaStream (if needed)
      global.MediaStream = jest.fn().mockImplementation((tracks) => {
        return {
          getTracks: jest.fn(() => tracks),
        };
      });

      getErrorDetailsSpy = jest.spyOn(Utils, 'getErrorDetails')
  });


  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should accept a task and answer call when using BROWSER login option', async () => {
    await task.accept(taskId);

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(webCallingServiceMock.answerCall).toHaveBeenCalledWith(expect.any(LocalMicrophoneStream), taskId);
  });

  it('should call accept API for Extension login option', async () => {
    webCallingServiceMock.loginOption = LoginOption.EXTENSION
    await task.accept(taskId);

    expect(contactMock.accept).toHaveBeenCalledWith({ interactionId: taskId });
  });

  it('should handle errors in accept method', async () => {
    const error = {
      details: {
        trackingId: '1234',
        data: {
          reason: 'Accept Failed',
        },
      },
    };

    webCallingServiceMock.answerCall.mockImplementation(() => { throw error });

    await expect(task.accept(taskId)).rejects.toThrow(new Error(error.details.data.reason));
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'accept', CC_FILE);
  });

  it('should decline call using webCallingService', async () => {
    await task.decline(taskId);

    expect(webCallingServiceMock.declineCall).toHaveBeenCalledWith(taskId);
  });

  it('should handle errors in decline method', async () => {
    const error = {
      details: {
        trackingId: '1234',
        data: {
          reason: 'Decline Failed',
        },
      },
    };

    webCallingServiceMock.declineCall.mockImplementation(() => { throw error });
    await expect(task.decline(taskId)).rejects.toThrow(new Error(error.details.data.reason));
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'decline', CC_FILE);
  }); 

  it('should hold the task', async () => {
    await task.hold(taskId);

    expect(contactMock.hold).toHaveBeenCalledWith({ interactionId: taskId, data: { mediaResourceId: taskDataMock.mediaResourceId } });
  });

  it('should handle errors in hold method', async () => {
    const error = {
      details: {
        trackingId: '1234',
        data: {
          reason: 'Hold Failed',
        },
      },
    };
    contactMock.hold.mockImplementation(() => { throw error; });

    await expect(task.hold(taskId)).rejects.toThrow(error.details.data.reason);
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'hold', CC_FILE);
  });

  it('should resume the task', async () => {
    await task.resume(taskId);

    expect(contactMock.unHold).toHaveBeenCalledWith({ interactionId: taskId, data: { mediaResourceId: taskDataMock.mediaResourceId } });
  });

  it('should handle errors in resume method', async () => {
    const error = {
      details: {
        trackingId: '1234',
        data: {
          reason: 'Resume Failed',
        },
      },
    };
    contactMock.unHold.mockImplementation(() => { throw error; });

    await expect(task.resume(taskId)).rejects.toThrow(error.details.data.reason);
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'resume', CC_FILE);
  });

  it('should end the task', async () => {
    await task.end(taskId);

    expect(contactMock.end).toHaveBeenCalledWith({ interactionId: taskId });
  });

  it('should handle errors in end method', async () => {
    const error = {
      details: {
        trackingId: '1234',
        data: {
          reason: 'End Failed',
        },
      },
    };
    contactMock.end.mockImplementation(() => { throw error; });

    await expect(task.end(taskId)).rejects.toThrow(error.details.data.reason);
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'end', CC_FILE);
  });

  it('should wrap up the task', async () => {
    const wrapupPayload = {
      wrapUpReason: 'Customer request',
      auxCodeId: 'auxCodeId123'
    };

    await task.wrapup(taskId, wrapupPayload);

    expect(contactMock.wrapup).toHaveBeenCalledWith({ interactionId: taskId, data: wrapupPayload });
  });

  it('should handle errors in wrapup method', async () => {
    const error = {
      details: {
        trackingId: '1234',
        data: {
          reason: 'Wrapup Failed',
        },
      },
    };
    contactMock.wrapup.mockImplementation(() => { throw error; });

    const wrapupPayload = {
      wrapUpReason: 'Customer request',
      auxCodeId: 'auxCodeId123'
    };

    await expect(task.wrapup(taskId, wrapupPayload)).rejects.toThrow(error.details.data.reason);
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'wrapup', CC_FILE);
  });
});
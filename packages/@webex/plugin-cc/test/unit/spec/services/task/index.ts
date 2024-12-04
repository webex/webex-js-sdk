import 'jsdom-global/register';
import {CALL_EVENT_KEYS, CallingClientConfig, LocalMicrophoneStream} from '@webex/calling';
import {LoginOption, WebexSDK} from '../../../../../src/types';
import { CC_FILE } from '../../../../../src/constants';
import Task from '../../../../../src/services/task';
import * as Utils from '../../../../../src/services/core/Utils';
import { CC_EVENTS } from '../../../../../src/services/config/types';
import config from '../../../../../src/config';
import WebCallingService from '../../../../../src/services/WebCallingService';
import { TASK_EVENTS } from '../../../../../src/services/task/types';

jest.mock('@webex/calling');

describe('Task', () => {
  let onSpy;
  let task;
  let contactMock;
  let taskDataMock;
  let webCallingService;
  let getErrorDetailsSpy;
  let webex: WebexSDK

  const taskId = '0ae913a4-c857-4705-8d49-76dd3dde75e4';
  const mockTrack = {} as MediaStreamTrack;
  const mockStream = {
    outputStream: {
      getAudioTracks: jest.fn().mockReturnValue([mockTrack]),
    }
  };

  beforeEach(() => {
    webex = {
      logger: {
        log: jest.fn(),
        error: jest.fn(),
        info: jest.fn()
      },
    } as unknown as WebexSDK;
    
    contactMock = {
      accept: jest.fn().mockResolvedValue({}),
    };

    webCallingService = new WebCallingService(
      webex,
      config.cc.callingClientConfig as CallingClientConfig
    );

    webCallingService.loginOption = LoginOption.BROWSER;
    onSpy = jest.spyOn(webCallingService, 'on');

    // Mock task data
    taskDataMock = {
      type: CC_EVENTS.AGENT_CONTACT_RESERVED,
      agentId: "723a8ffb-a26e-496d-b14a-ff44fb83b64f",
      eventTime: 1733211616959,
      eventType: "RoutingMessage",
      interaction: {},
      interactionId: taskId,
      orgId: "6ecef209-9a34-4ed1-a07a-7ddd1dbe925a",
      trackingId: "575c0ec2-618c-42af-a61c-53aeb0a221ee",
      mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
      destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
      owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
      queueMgr: 'aqm',
    };

      // Create an instance of Task
      task = new Task(contactMock, webCallingService, taskDataMock);

      // Mock navigator.mediaDevices
      global.navigator.mediaDevices = {
        getUserMedia: jest.fn(() =>
          Promise.resolve({
            getAudioTracks: jest.fn().mockReturnValue([mockTrack])
          })
        ),
      };
      
      // Mock MediaStream (if needed)
      global.MediaStream = jest.fn().mockImplementation((tracks) => {
        return mockStream;
      });

      getErrorDetailsSpy = jest.spyOn(Utils, 'getErrorDetails')
  });


  afterEach(() => {
    jest.clearAllMocks();
  });

  it('test the on spy', async () => {
    const taskEmitSpy = jest.spyOn(task, 'emit');
    const remoteMediaCb = onSpy.mock.calls[0][1];
    
    expect(onSpy).toHaveBeenCalledWith(CALL_EVENT_KEYS.REMOTE_MEDIA, remoteMediaCb);

    remoteMediaCb(mockTrack)

    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_MEDIA, mockTrack);
  });

  it('test updating the task data', async () => {
    const newData = {
      type: CC_EVENTS.AGENT_CONTACT_ASSIGNED,
      agentId: "723a8ffb-a26e-496d-b14a-ff44fb83b64f",
      eventTime: 1733211616959,
      eventType: "RoutingMessage",
      interaction: {},
      interactionId: taskId,
      orgId: "6ecef209-9a34-4ed1-a07a-7ddd1dbe925a",
      trackingId: "575c0ec2-618c-42af-a61c-53aeb0a221ee",
      mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
      destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
      owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
      queueMgr: 'aqm',
    };

    expect(task.data).toEqual(taskDataMock);

    task.updateTaskData(newData);

    expect(task.data).toEqual(newData);
  });

  it('should accept a task and answer call when using BROWSER login option', async () => {
    const answerCallSpy = jest.spyOn(webCallingService, 'answerCall');
    
    await task.accept();

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(LocalMicrophoneStream).toHaveBeenCalledWith(mockStream);
    expect(answerCallSpy).toHaveBeenCalledWith(expect.any(LocalMicrophoneStream), taskId);
  });

  it('should call accept API for Extension login option', async () => {
    webCallingService.loginOption = LoginOption.EXTENSION
    
    await task.accept();

    expect(contactMock.accept).toHaveBeenCalledWith({interactionId: taskId});
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

    jest.spyOn(webCallingService, 'answerCall').mockImplementation(() => { throw error });

    await expect(task.accept()).rejects.toThrow(new Error(error.details.data.reason));
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'accept', CC_FILE);
  });

  it('should decline call using webCallingService', async () => {
    const declineCallSpy = jest.spyOn(webCallingService, 'declineCall');
    const offSpy = jest.spyOn(webCallingService, 'off');
    
    await task.decline();

    expect(declineCallSpy).toHaveBeenCalledWith(taskId);
    expect(offSpy).toHaveBeenCalledWith(CALL_EVENT_KEYS.REMOTE_MEDIA, offSpy.mock.calls[0][1]);
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

    jest.spyOn(webCallingService, 'declineCall').mockImplementation(() => { throw error });
    await expect(task.decline()).rejects.toThrow(new Error(error.details.data.reason));
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'decline', CC_FILE);
  }); 
});
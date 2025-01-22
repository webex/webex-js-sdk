import 'jsdom-global/register';
import {CALL_EVENT_KEYS, CallingClientConfig, LocalMicrophoneStream} from '@webex/calling';
import {LoginOption, WebexSDK} from '../../../../../src/types';
import {CC_FILE} from '../../../../../src/constants';
import Task from '../../../../../src/services/task';
import * as Utils from '../../../../../src/services/core/Utils';
import {CC_EVENTS} from '../../../../../src/services/config/types';
import config from '../../../../../src/config';
import WebCallingService from '../../../../../src/services/WebCallingService';
import {
  TASK_EVENTS,
  TaskResponse,
  AgentContact,
  ConsultEndPayload,
  TaskData,
  DESTINATION_TYPE,
  CONSULT_TRANSFER_DESTINATION_TYPE,
  ConsultTransferPayLoad,
  TransferPayLoad,
} from '../../../../../src/services/task/types';

jest.mock('@webex/calling');

describe('Task', () => {
  let onSpy;
  let task;
  let contactMock;
  let taskDataMock;
  let webCallingService;
  let getErrorDetailsSpy;
  let webex: WebexSDK;

  const taskId = '0ae913a4-c857-4705-8d49-76dd3dde75e4';
  const mockTrack = {} as MediaStreamTrack;
  const mockStream = {
    outputStream: {
      getAudioTracks: jest.fn().mockReturnValue([mockTrack]),
    },
  };

  beforeEach(() => {
    webex = {
      logger: {
        log: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
      },
    } as unknown as WebexSDK;

    contactMock = {
      accept: jest.fn().mockResolvedValue({}),
      hold: jest.fn().mockResolvedValue({}),
      unHold: jest.fn().mockResolvedValue({}),
      consult: jest.fn().mockResolvedValue({}),
      consultEnd: jest.fn().mockResolvedValue({}),
      blindTransfer: jest.fn().mockResolvedValue({}),
      vteamTransfer: jest.fn().mockResolvedValue({}),
      consultTransfer: jest.fn().mockResolvedValue({}),
      end: jest.fn().mockResolvedValue({}),
      wrapup: jest.fn().mockResolvedValue({}),
      pauseRecording: jest.fn().mockResolvedValue({}),
      resumeRecording: jest.fn().mockResolvedValue({}),
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
      agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
      eventTime: 1733211616959,
      eventType: 'RoutingMessage',
      interactionId: taskId,
      orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
      trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
      mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
      destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
      owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
      queueMgr: 'aqm',
      interaction: {
        mainInteractionId: taskId,
        media: {
          '58a45567-4e61-4f4b-a580-5bc86357bef0': {
            holdTimestamp: null,
            isHold: false,
            mType: 'consult',
            mediaMgr: 'callmm',
            mediaResourceId: '58a45567-4e61-4f4b-a580-5bc86357bef0',
            mediaType: 'telephony',
            participants: [
              'f520d6b5-28ad-4f2f-b83e-781bb64af617',
              '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
            ],
          },
          [taskId]: {
            holdTimestamp: 1734667567279,
            isHold: true,
            mType: 'mainCall',
            mediaMgr: 'callmm',
            mediaResourceId: taskId,
            mediaType: 'telephony',
            participants: ['+14696762938', '723a8ffb-a26e-496d-b14a-ff44fb83b64f'],
          },
        },
      },
    };

    // Create an instance of Task
    task = new Task(contactMock, webCallingService, taskDataMock);

    // Mock navigator.mediaDevices
    global.navigator.mediaDevices = {
      getUserMedia: jest.fn(() =>
        Promise.resolve({
          getAudioTracks: jest.fn().mockReturnValue([mockTrack]),
        })
      ),
    };

    // Mock MediaStream (if needed)
    global.MediaStream = jest.fn().mockImplementation((tracks) => {
      return mockStream;
    });

    getErrorDetailsSpy = jest.spyOn(Utils, 'getErrorDetails');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('test the on spy', async () => {
    const taskEmitSpy = jest.spyOn(task, 'emit');
    const remoteMediaCb = onSpy.mock.calls[0][1];

    expect(onSpy).toHaveBeenCalledWith(CALL_EVENT_KEYS.REMOTE_MEDIA, remoteMediaCb);

    remoteMediaCb(mockTrack);

    expect(taskEmitSpy).toHaveBeenCalledWith(TASK_EVENTS.TASK_MEDIA, mockTrack);
  });

  describe('updateTaskData cases', () => {
    it('test updating the task data by overwrite', async () => {
      const newData = {
        type: CC_EVENTS.AGENT_CONTACT_ASSIGNED,
        agentId: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        eventTime: 1733211616959,
        eventType: 'RoutingMessage',
        interactionId: taskId,
        orgId: '6ecef209-9a34-4ed1-a07a-7ddd1dbe925a',
        trackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        mediaResourceId: '0ae913a4-c857-4705-8d49-76dd3dde75e4',
        destAgentId: 'ebeb893b-ba67-4f36-8418-95c7492b28c2',
        owner: '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
        queueMgr: 'aqm',
        interaction: {
          mainInteractionId: taskId,
          media: {
            '58a45567-4e61-4f4b-a580-5bc86357bef0': {
              holdTimestamp: null,
              isHold: false,
              mType: 'consult',
              mediaMgr: 'callmm',
              mediaResourceId: '58a45567-4e61-4f4b-a580-5bc86357bef0',
              mediaType: 'telephony',
              participants: [
                'f520d6b5-28ad-4f2f-b83e-781bb64af617',
                '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
              ],
            },
            [taskId]: {
              holdTimestamp: 1734667567279,
              isHold: true,
              mType: 'mainCall',
              mediaMgr: 'callmm',
              mediaResourceId: taskId,
              mediaType: 'telephony',
              participants: ['+14696762938', '723a8ffb-a26e-496d-b14a-ff44fb83b64f'],
            },
          },
        },
      };

      expect(task.data).toEqual(taskDataMock);

      const shouldOverwrite = true;
      task.updateTaskData(newData, shouldOverwrite);

      expect(task.data).toEqual(newData);
    });

    it('test updating the task data by merging', async () => {
      const newData = {
        // ...taskDataMock, // Purposefully omit this to test scenario when other keys isn't present
        isConsulting: true, // Add a new custom key to test persistence
        interaction: {
          // ...taskDataMock.interaction, // Purposefully omit this to test scenario when a nested key isn't present
          media: {
            '58a45567-4e61-4f4b-a580-5bc86357bef0': {
              holdTimestamp: null,
              isHold: true,
              mType: 'consult',
              mediaMgr: 'callmm',
              mediaResourceId: '58a45567-4e61-4f4b-a580-5bc86357bef0',
              mediaType: 'telephony',
              participants: [
                'f520d6b5-28ad-4f2f-b83e-781bb64af617',
                '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
              ],
            },
            [taskId]: {
              holdTimestamp: 1734667567279,
              isHold: false,
              mType: 'mainCall',
              mediaMgr: 'callmm',
              mediaResourceId: taskId,
              mediaType: 'telephony',
              participants: ['+14696762938', '723a8ffb-a26e-496d-b14a-ff44fb83b64f'],
            },
          },
        },
      };

      const expectedData: TaskData = {
        ...taskDataMock,
        isConsulting: true,
        interaction: {
          ...taskDataMock.interaction,
          media: {
            '58a45567-4e61-4f4b-a580-5bc86357bef0': {
              holdTimestamp: null,
              isHold: true,
              mType: 'consult',
              mediaMgr: 'callmm',
              mediaResourceId: '58a45567-4e61-4f4b-a580-5bc86357bef0',
              mediaType: 'telephony',
              participants: [
                'f520d6b5-28ad-4f2f-b83e-781bb64af617',
                '723a8ffb-a26e-496d-b14a-ff44fb83b64f',
              ],
            },
            [taskId]: {
              holdTimestamp: 1734667567279,
              isHold: false,
              mType: 'mainCall',
              mediaMgr: 'callmm',
              mediaResourceId: taskId,
              mediaType: 'telephony',
              participants: ['+14696762938', '723a8ffb-a26e-496d-b14a-ff44fb83b64f'],
            },
          },
        },
      };

      expect(task.data).toEqual(taskDataMock);
      const shouldOverwrite = false;
      task.updateTaskData(newData, shouldOverwrite);

      expect(task.data).toEqual(expectedData);
    });
  });

  it('should accept a task and answer call when using BROWSER login option', async () => {
    const answerCallSpy = jest.spyOn(webCallingService, 'answerCall');

    await task.accept();

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({audio: true});
    expect(LocalMicrophoneStream).toHaveBeenCalledWith(mockStream);
    expect(answerCallSpy).toHaveBeenCalledWith(expect.any(LocalMicrophoneStream), taskId);
  });

  it('should call accept API for Extension login option', async () => {
    webCallingService.loginOption = LoginOption.EXTENSION;

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

    jest.spyOn(webCallingService, 'answerCall').mockImplementation(() => {
      throw error;
    });

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

    jest.spyOn(webCallingService, 'declineCall').mockImplementation(() => {
      throw error;
    });
    await expect(task.decline()).rejects.toThrow(new Error(error.details.data.reason));
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'decline', CC_FILE);
  });

  it('should hold the task and return the expected response', async () => {
    const expectedResponse: TaskResponse = {data: {interactionId: taskId}} as AgentContact;
    contactMock.hold.mockResolvedValue(expectedResponse);

    const response = await task.hold();

    expect(contactMock.hold).toHaveBeenCalledWith({
      interactionId: taskId,
      data: {mediaResourceId: taskDataMock.mediaResourceId},
    });
    expect(response).toEqual(expectedResponse);
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
    contactMock.hold.mockImplementation(() => {
      throw error;
    });

    await expect(task.hold()).rejects.toThrow(error.details.data.reason);
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'hold', CC_FILE);
  });

  it('should resume the task and return the expected response', async () => {
    const expectedResponse: TaskResponse = {data: {interactionId: taskId}} as AgentContact;
    contactMock.unHold.mockResolvedValue(expectedResponse);
    const response = await task.resume();
    expect(contactMock.unHold).toHaveBeenCalledWith({
      interactionId: taskId,
      data: {mediaResourceId: taskDataMock.mediaResourceId},
    });
    expect(response).toEqual(expectedResponse);
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
    contactMock.unHold.mockImplementation(() => {
      throw error;
    });

    await expect(task.resume()).rejects.toThrow(error.details.data.reason);
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'resume', CC_FILE);
  });

  it('should initiate a consult call and return the expected response', async () => {
    const consultPayload = {
      destination: '1234',
      destinationType: DESTINATION_TYPE.AGENT,
    };
    const expectedResponse: TaskResponse = {data: {interactionId: taskId}} as AgentContact;
    contactMock.consult.mockResolvedValue(expectedResponse);

    const response = await task.consult(consultPayload);

    expect(contactMock.consult).toHaveBeenCalledWith({interactionId: taskId, data: consultPayload});
    expect(response).toEqual(expectedResponse);
  });

  it('should handle errors in consult method', async () => {
    const error = {
      details: {
        trackingId: '1234',
        data: {
          reason: 'Consult Failed',
        },
      },
    };
    contactMock.consult.mockImplementation(() => {
      throw error;
    });

    const consultPayload = {
      destination: '1234',
      destinationType: DESTINATION_TYPE.AGENT,
    };

    await expect(task.consult(consultPayload)).rejects.toThrow(error.details.data.reason);
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'consult', CC_FILE);
  });

  it('should end the consult call and return the expected response', async () => {
    const expectedResponse: TaskResponse = {data: {interactionId: taskId}} as AgentContact;
    contactMock.consultEnd.mockResolvedValue(expectedResponse);

    const consultEndPayload: ConsultEndPayload = {
      isConsult: true,
      taskId: taskId,
    };
    const response = await task.endConsult(consultEndPayload);

    expect(contactMock.consultEnd).toHaveBeenCalledWith({
      interactionId: taskId,
      data: consultEndPayload,
    });
    expect(response).toEqual(expectedResponse);
  });

  it('should handle errors in endConsult method', async () => {
    const error = {
      details: {
        trackingId: '1234',
        data: {
          reason: 'End Consult Failed',
        },
      },
    };
    contactMock.consultEnd.mockImplementation(() => {
      throw error;
    });

    const consultEndPayload: ConsultEndPayload = {
      isConsult: true,
      taskId: taskId,
    };

    await expect(task.endConsult(consultEndPayload)).rejects.toThrow(error.details.data.reason);
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'endConsult', CC_FILE);
  });

  it('should do consult transfer the task to consulted agent and return the expected response', async () => {
    const consultPayload = {
      destination: '1234',
      destinationType: DESTINATION_TYPE.AGENT,
    };
    const expectedResponse: TaskResponse = {data: {interactionId: taskId}} as AgentContact;
    contactMock.consult.mockResolvedValue(expectedResponse);

    const response = await task.consult(consultPayload);

    expect(contactMock.consult).toHaveBeenCalledWith({interactionId: taskId, data: consultPayload});
    expect(response).toEqual(expectedResponse);

    const consultTransferPayload: ConsultTransferPayLoad = {
      to: '1234',
      destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.AGENT,
    };

    const consultTransferResponse = await task.consultTransfer(consultTransferPayload);
    expect(contactMock.consultTransfer).toHaveBeenCalledWith({interactionId: taskId, data: consultTransferPayload});
  });

  it('should handle errors in consult transfer', async () => {
    const consultPayload = {
      destination: '1234',
      destinationType: DESTINATION_TYPE.AGENT,
    };
    const expectedResponse: TaskResponse = {data: {interactionId: taskId}} as AgentContact;
    contactMock.consult.mockResolvedValue(expectedResponse);

    const response = await task.consult(consultPayload);

    expect(contactMock.consult).toHaveBeenCalledWith({interactionId: taskId, data: consultPayload});
    expect(response).toEqual(expectedResponse);

    const error = {
      details: {
        trackingId: '1234',
        data: {
          reason: 'Consult Transfer Failed',
        },
      },
    };
    contactMock.consultTransfer.mockImplementation(() => {
      throw error;
    });

    const consultTransferPayload: ConsultTransferPayLoad = {
      to: '1234',
      destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.AGENT,
    };

    await expect(task.consultTransfer(consultTransferPayload)).rejects.toThrow(error.details.data.reason);
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'consultTransfer', CC_FILE);
  });

  it('should do vteamTransfer if destinationType is queue and return the expected response', async () => {
    const transferPayload: TransferPayLoad = {
      to: '1234',
      destinationType: DESTINATION_TYPE.QUEUE,
    };

    const expectedResponse: TaskResponse = {data: {interactionId: taskId}} as AgentContact;
    contactMock.vteamTransfer.mockResolvedValue(expectedResponse);

    const response = await task.transfer(transferPayload);

    expect(contactMock.vteamTransfer).toHaveBeenCalledWith({interactionId: taskId, data: transferPayload});
    expect(response).toEqual(expectedResponse);
  });

  it('should do blindTransfer if destinationType is anything other than queue and return the expected response', async () => {
    const transferPayload: TransferPayLoad = {
      to: '1234',
      destinationType: DESTINATION_TYPE.AGENT,
    };

    const expectedResponse: TaskResponse = {data: {interactionId: taskId}} as AgentContact;
    contactMock.blindTransfer.mockResolvedValue(expectedResponse);

    const response = await task.transfer(transferPayload);

    expect(contactMock.blindTransfer).toHaveBeenCalledWith({interactionId: taskId, data: transferPayload});
    expect(response).toEqual(expectedResponse);
  });

  it('should handle errors in transfer method', async () => {
    const error = {
      details: {
        trackingId: '1234',
        data: {
          reason: 'Consult Transfer Failed',
        },
      },
    };
    contactMock.blindTransfer.mockImplementation(() => {
      throw error;
    });

    const blindTransferPayload: TransferPayLoad = {
      to: '1234',
      destinationType: DESTINATION_TYPE.AGENT,
    };

    await expect(task.transfer(blindTransferPayload)).rejects.toThrow(error.details.data.reason);
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'transfer', CC_FILE);
  });

  it('should end the task and return the expected response', async () => {
    const expectedResponse: TaskResponse = {data: {interactionId: taskId}} as AgentContact;
    contactMock.end.mockResolvedValue(expectedResponse);

    const response = await task.end();

    expect(contactMock.end).toHaveBeenCalledWith({interactionId: taskId});
    expect(response).toEqual(expectedResponse);
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
    contactMock.end.mockImplementation(() => {
      throw error;
    });

    await expect(task.end()).rejects.toThrow(error.details.data.reason);
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'end', CC_FILE);
  });

  it('should wrap up the task and return the expected response', async () => {
    const expectedResponse: TaskResponse = {data: {interactionId: taskId}} as AgentContact;
    const wrapupPayload = {
      wrapUpReason: 'Customer request',
      auxCodeId: 'auxCodeId123',
    };
    contactMock.wrapup.mockResolvedValue(expectedResponse);

    const response = await task.wrapup(wrapupPayload);

    expect(contactMock.wrapup).toHaveBeenCalledWith({interactionId: taskId, data: wrapupPayload});
    expect(response).toEqual(expectedResponse);
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
    contactMock.wrapup.mockImplementation(() => {
      throw error;
    });

    const wrapupPayload = {
      wrapUpReason: 'Customer request',
      auxCodeId: 'auxCodeId123',
    };

    await expect(task.wrapup(wrapupPayload)).rejects.toThrow(error.details.data.reason);
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'wrapup', CC_FILE);
  });

  it('should throw an error if auxCodeId is missing in wrapup method', async () => {
    const wrapupPayload = {
      wrapUpReason: 'Customer request',
      auxCodeId: '',
    };
    await expect(task.wrapup(wrapupPayload)).rejects.toThrow();
  });

  it('should throw an error if wrapUpReason is missing in wrapup method', async () => {
    const wrapupPayload = {
      wrapUpReason: '',
      auxCodeId: 'auxCodeId123',
    };
    await expect(task.wrapup(wrapupPayload)).rejects.toThrow();
  });

  it('should throw an error if this.data is missing when wrapup is invoked', async () => {
    const wrapupPayload = {
      wrapUpReason: 'Customer request',
      auxCodeId: 'auxCodeId123',
    };

    task.data = undefined;
    await expect(task.wrapup(wrapupPayload)).rejects.toThrow();
  });

  it('should pause the recording of the task', async () => {
    await task.pauseRecording();

    expect(contactMock.pauseRecording).toHaveBeenCalledWith({interactionId: taskId});
  });

  it('should handle errors in pauseRecording method', async () => {
    const error = {
      details: {
        trackingId: '1234',
        data: {
          reason: 'Pause Recording Failed',
        },
      },
    };
    contactMock.pauseRecording.mockImplementation(() => {
      throw error;
    });

    await expect(task.pauseRecording()).rejects.toThrow(error.details.data.reason);
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'pauseRecording', CC_FILE);
  });

  it('should resume the recording of the task', async () => {
    const resumePayload = {
      autoResumed: true,
    };

    await task.resumeRecording(resumePayload);

    expect(contactMock.resumeRecording).toHaveBeenCalledWith({
      interactionId: taskId,
      data: resumePayload,
    });
  });

  it('should handle errors in resumeRecording method', async () => {
    const error = {
      details: {
        trackingId: '1234',
        data: {
          reason: 'Resume Recording Failed',
        },
      },
    };
    contactMock.resumeRecording.mockImplementation(() => {
      throw error;
    });

    const resumePayload = {
      autoResumed: true,
    };

    await expect(task.resumeRecording(resumePayload)).rejects.toThrow(error.details.data.reason);
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'resumeRecording', CC_FILE);
  });
});

import 'jsdom-global/register';
import {CALL_EVENT_KEYS, CallingClientConfig, LocalMicrophoneStream} from '@webex/calling';
import {LoginOption, WebexSDK} from '../../../../../src/types';
import {TASK_FILE} from '../../../../../src/constants';
import Task from '../../../../../src/services/task';
import * as Utils from '../../../../../src/services/core/Utils';
import {CC_EVENTS} from '../../../../../src/services/config/types';
import config from '../../../../../src/config';
import WebCallingService from '../../../../../src/services/WebCallingService';
import IvrTranscriptService from '../../../../../src/services/task/IvrTranscriptService';
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
  MEDIA_CHANNEL,
} from '../../../../../src/services/task/types';
import WebexRequest from '../../../../../src/services/core/WebexRequest';
import MetricsManager from '../../../../../src/metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../../../../src/metrics/constants';
import * as METRICS_CONSTANTS from '../../../../../src/metrics/constants';
import LoggerProxy from '../../../../../src/logger-proxy';
import Services from '../../../../../src/services';
import ivrTranscriptFixture from '../../fixture/ivr-transcript';

jest.mock('@webex/calling');
jest.mock('../../../../../src/logger-proxy');

// Mock IvrTranscriptService
const MockIvrTranscriptService = {
  fetchIVRTranscript: jest.fn()
};

jest.mock('../../../../../src/services/task/IvrTranscriptService', () => ({
  default: jest.fn().mockImplementation(() => MockIvrTranscriptService)
}));

// Mock Services singleton - properly mock the default export class with static getInstance
const mockServicesInstance = {
  transcript: {
    fetchIVRTranscript: jest.fn()
  }
};

jest.mock('../../../../../src/services', () => {
  // Mock Services class with static getInstance method
  class MockServices {
    static getInstance() {
      return mockServicesInstance;
    }
  }
  
  return {
    default: MockServices
  };
});

describe('Task', () => {
  let onSpy;
  let task;
  let contactMock;
  let mockMetricsManager;
  let taskDataMock;
  let webCallingService;
  let mockIvrTranscriptService;
  let getErrorDetailsSpy;
  let mockWebexRequest;
  let webex: WebexSDK;
  let loggerInfoSpy;
  let loggerLogSpy;
  let loggerErrorSpy;

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

    loggerInfoSpy = jest.spyOn(LoggerProxy, 'info');
    loggerLogSpy = jest.spyOn(LoggerProxy, 'log');
    loggerErrorSpy = jest.spyOn(LoggerProxy, 'error');

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

    mockMetricsManager = {
      trackEvent: jest.fn(),
      timeEvent: jest.fn(),
    };

    jest.spyOn(MetricsManager, 'getInstance').mockReturnValue(mockMetricsManager);

    webCallingService = new WebCallingService(
      webex,
      config.cc.callingClientConfig as CallingClientConfig
    );

    mockWebexRequest = {
      request: jest.fn(),
      uploadLogs: jest.fn(),
      webex: webex, // Add webex property for IvrTranscriptService
    };

    jest.spyOn(WebexRequest, 'getInstance').mockReturnValue(mockWebexRequest);

    // Initialize mock IvrTranscriptService - consolidated mock object with all properties
    mockIvrTranscriptService = {
      webex: webex,
      fetchIVRTranscript: jest.fn(),
      getIvrTranscriptMetadata: jest.fn(),
      fetchIvrConversation: jest.fn(),
      getFlatParams: jest.fn(),
      parseConversations: jest.fn()
    };

    // Set the mock on the Services instance
    mockServicesInstance.transcript = mockIvrTranscriptService;

    // Also spy on getIvrTranscriptService to return our mock
    jest.spyOn(Task.prototype, 'getIvrTranscriptService' as any).mockReturnValue(mockIvrTranscriptService);

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
        mediaType: 'telephony',
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
    task = new Task(contactMock, webCallingService, taskDataMock, { wrapUpProps: null });

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
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Accepting task`, {
      module: TASK_FILE,
      method: 'accept',
      interactionId: task.data.interactionId,
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(
      `Task accepted successfully with webrtc calling`,
      {
        module: TASK_FILE,
        method: 'accept',
        interactionId: task.data.interactionId,
      }
    );
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_ACCEPT_SUCCESS,
      {
        taskId: task.data.interactionId,
        ...MetricsManager.getCommonTrackingFieldForAQMResponse(task),
        eventType: 'AgentContactReserved',
        notifTrackingId: '575c0ec2-618c-42af-a61c-53aeb0a221ee',
        trackingId: undefined,
      },
      ['operational', 'behavioral', 'business']
    );
  });

  it('should accept a task when mediaType chat', async () => {
    task.data.interaction.mediaType = 'chat';
    const answerCallSpy = jest.spyOn(webCallingService, 'answerCall');
    const response = {};
    contactMock.accept.mockResolvedValue(response);

    await task.accept();
    
    expect(contactMock.accept).toHaveBeenCalledWith({
      interactionId: taskId,
    });
    expect(answerCallSpy).not.toHaveBeenCalled();
    expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith([
      METRIC_EVENT_NAMES.TASK_ACCEPT_SUCCESS,
      METRIC_EVENT_NAMES.TASK_ACCEPT_FAILED,
    ]);
    const expectedMetrics = {
      taskId: task.data.interactionId,
      agentId: task.data.agentId,
      eventType: task.data.type,
      notifTrackingId: task.data.trackingId,
      orgId: task.data.orgId,
    };
    expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.TASK_ACCEPT_SUCCESS,
      expectedMetrics,
      ['operational', 'behavioral', 'business']
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Accepting task`, {
      module: TASK_FILE,
      method: 'accept',
      interactionId: task.data.interactionId,
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(`Task accepted successfully`, {
      module: TASK_FILE,
      method: 'accept',
      interactionId: task.data.interactionId,
    });
  });

  it('should accept a task when mediaType email', async () => {
    task.data.interaction.mediaType = 'email';
    const answerCallSpy = jest.spyOn(webCallingService, 'answerCall');
    const response = {};
    contactMock.accept.mockResolvedValue(response);

    await task.accept();
    
    expect(contactMock.accept).toHaveBeenCalledWith({
      interactionId: taskId,
    });
    expect(answerCallSpy).not.toHaveBeenCalled();
    expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith([
      METRIC_EVENT_NAMES.TASK_ACCEPT_SUCCESS,
      METRIC_EVENT_NAMES.TASK_ACCEPT_FAILED,
    ]);
    const expectedMetrics = {
      taskId: task.data.interactionId,
      agentId: task.data.agentId,
      eventType: task.data.type,
      notifTrackingId: task.data.trackingId,
      orgId: task.data.orgId,
    };
    expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.TASK_ACCEPT_SUCCESS,
      expectedMetrics,
      ['operational', 'behavioral', 'business']
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Accepting task`, {
      module: TASK_FILE,
      method: 'accept',
      interactionId: task.data.interactionId,
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(`Task accepted successfully`, {
      module: TASK_FILE,
      method: 'accept',
      interactionId: task.data.interactionId,
    });
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
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'accept', TASK_FILE);
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_ACCEPT_FAILED,
      {
        taskId: taskDataMock.interactionId,
        error: error.toString(),
        ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details),
      },
      ['operational', 'behavioral', 'business']
    );
  });

  it('should decline call using webCallingService', async () => {
    const declineCallSpy = jest.spyOn(webCallingService, 'declineCall');
    const offSpy = jest.spyOn(webCallingService, 'off');

    await task.decline();

    expect(declineCallSpy).toHaveBeenCalledWith(taskId);
    expect(offSpy).toHaveBeenCalledWith(CALL_EVENT_KEYS.REMOTE_MEDIA, offSpy.mock.calls[0][1]);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Declining task`, {
      module: TASK_FILE,
      method: 'decline',
      interactionId: task.data.interactionId,
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(`Task declined successfully`, {
      module: TASK_FILE,
      method: 'decline',
      interactionId: task.data.interactionId,
    });
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_DECLINE_SUCCESS,
      {
        taskId: taskDataMock.interactionId,
      },
      ['operational', 'behavioral']
    );
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
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'decline', TASK_FILE);
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_DECLINE_FAILED,
      {
        taskId: taskDataMock.interactionId,
        error: error.toString(),
        ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details),
      },
      ['operational', 'behavioral']
    );
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
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Holding task`, {
      module: TASK_FILE,
      method: 'hold',
      interactionId: task.data.interactionId,
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(`Task placed on hold successfully`, {
      module: TASK_FILE,
      method: 'hold',
      interactionId: task.data.interactionId,
    });
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_HOLD_SUCCESS,
      {
        ...MetricsManager.getCommonTrackingFieldForAQMResponse(expectedResponse),
        taskId: taskDataMock.interactionId,
        mediaResourceId: taskDataMock.mediaResourceId,
      },
      ['operational', 'behavioral']
    );
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
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'hold', TASK_FILE);
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_HOLD_FAILED,
      {
        taskId: taskDataMock.interactionId,
        mediaResourceId: taskDataMock.mediaResourceId,
        error: error.toString(),
        ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details),
      },
      ['operational', 'behavioral']
    );
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
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_RESUME_SUCCESS,
      {
        taskId: taskDataMock.interactionId,
        mainInteractionId: taskDataMock.interaction.mainInteractionId,
        mediaResourceId:
          taskDataMock.interaction.media[taskDataMock.interaction.mainInteractionId]
            .mediaResourceId,
        ...MetricsManager.getCommonTrackingFieldForAQMResponse(expectedResponse),
      },
      ['operational', 'behavioral']
    );
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
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'resume', TASK_FILE);
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_RESUME_FAILED,
      {
        taskId: taskDataMock.interactionId,
        mainInteractionId: taskDataMock.interaction.mainInteractionId,
        mediaResourceId:
          taskDataMock.interaction.media[taskDataMock.interaction.mainInteractionId]
            .mediaResourceId,
        ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details),
      },
      ['operational', 'behavioral']
    );
  });

  it('should initiate a consult call and return the expected response', async () => {
    const consultPayload = {
      to: '1234',
      destinationType: DESTINATION_TYPE.AGENT,
    };
    const expectedResponse: TaskResponse = {data: {interactionId: taskId}, trackingId: '1234'} as AgentContact;
    contactMock.consult.mockResolvedValue(expectedResponse);

    const response = await task.consult(consultPayload);

    expect(contactMock.consult).toHaveBeenCalledWith({interactionId: taskId, data: consultPayload});
    expect(response).toEqual(expectedResponse);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Starting consult`, {
      module: TASK_FILE,
      method: 'consult',
      interactionId: task.data.interactionId,
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(`Consult started successfully to ${consultPayload.to}`, {
      module: TASK_FILE,
      method: 'consult',
      trackingId: expectedResponse.trackingId,
      interactionId: task.data.interactionId,
    });
    expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.TASK_CONSULT_START_SUCCESS,
      {
        taskId: taskDataMock.interactionId,
        destination: consultPayload.to,
        destinationType: consultPayload.destinationType,
        ...MetricsManager.getCommonTrackingFieldForAQMResponse(expectedResponse),
      },
      ['operational', 'behavioral', 'business']
    );
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
      to: '1234',
      destinationType: DESTINATION_TYPE.AGENT,
    };

    await expect(task.consult(consultPayload)).rejects.toThrow(error.details.data.reason);
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'consult', TASK_FILE);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Starting consult`, {
      module: TASK_FILE,
      method: 'consult',
      interactionId: task.data.interactionId,
    });
    expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
      METRIC_EVENT_NAMES.TASK_CONSULT_START_FAILED,
      {
        taskId: taskDataMock.interactionId,
        destination: consultPayload.to,
        destinationType: consultPayload.destinationType,
        error: error.toString(),
        ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details),
      },
      ['operational', 'behavioral', 'business']
    );
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
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_CONSULT_END_SUCCESS,
      {
        taskId: taskDataMock.interactionId,
        ...MetricsManager.getCommonTrackingFieldForAQMResponse(expectedResponse),
      },
      ['operational', 'behavioral', 'business']
    );
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
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'endConsult', TASK_FILE);
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_CONSULT_END_FAILED,
      {
        taskId: taskDataMock.interactionId,
        error: error.toString(),
        ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details),
      },
      ['operational', 'behavioral', 'business']
    );
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

    const consultTransferResponse = await task.consultTransfer();
    expect(contactMock.consultTransfer).toHaveBeenCalledWith({
      interactionId: taskId,
      data: {
        to: taskDataMock.destAgentId,
        destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.AGENT,
      },
    });
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      2,
      METRIC_EVENT_NAMES.TASK_TRANSFER_SUCCESS,
      {
        taskId: taskDataMock.interactionId,
        destination: taskDataMock.destAgentId,
        destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.AGENT,
        isConsultTransfer: true,
      },
      ['operational', 'behavioral', 'business']
    );
  });

  it('should send DIALNUMBER when task destinationType is DN during consultTransfer', async () => {
    const expectedResponse: TaskResponse = {data: {interactionId: taskId}} as AgentContact;
    contactMock.consultTransfer.mockResolvedValue(expectedResponse);

    // Ensure task data indicates DN scenario
    task.data.destinationType = 'DN' as unknown as string;

    await task.consultTransfer();

    expect(contactMock.consultTransfer).toHaveBeenCalledWith({
      interactionId: taskId,
      data: {
        to: taskDataMock.destAgentId,
        destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.DIALNUMBER,
      },
    });
  });

  it('should send ENTRYPOINT when task destinationType is EPDN during consultTransfer', async () => {
    const expectedResponse: TaskResponse = {data: {interactionId: taskId}} as AgentContact;
    contactMock.consultTransfer.mockResolvedValue(expectedResponse);

    // Ensure task data indicates EP/EPDN scenario
    task.data.destinationType = 'EPDN' as unknown as string;

    await task.consultTransfer();

    expect(contactMock.consultTransfer).toHaveBeenCalledWith({
      interactionId: taskId,
      data: {
        to: taskDataMock.destAgentId,
        destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.ENTRYPOINT,
      },
    });
  });

  it('should keep AGENT when task destinationType is neither DN nor EPDN/ENTRYPOINT', async () => {
    const expectedResponse: TaskResponse = {data: {interactionId: taskId}} as AgentContact;
    contactMock.consultTransfer.mockResolvedValue(expectedResponse);

    // Ensure task data indicates non-DN and non-EP/EPDN scenario
    task.data.destinationType = 'SOMETHING_ELSE' as unknown as string;

    await task.consultTransfer();

    expect(contactMock.consultTransfer).toHaveBeenCalledWith({
      interactionId: taskId,
      data: {
        to: taskDataMock.destAgentId,
        destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.AGENT,
      },
    });
  });

  it('should do consult transfer to a queue by using the destAgentId from task data', async () => {
    const expectedResponse: TaskResponse = {data: {interactionId: taskId}} as AgentContact;
    contactMock.consultTransfer.mockResolvedValue(expectedResponse);

    const queueConsultTransferPayload: ConsultTransferPayLoad = {
      to: 'some-queue-id',
      destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.QUEUE,
    };

    const expectedPayload = {
      to: taskDataMock.destAgentId,
      destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.AGENT,
    };

    const response = await task.consultTransfer(queueConsultTransferPayload);

    expect(contactMock.consultTransfer).toHaveBeenCalledWith({
      interactionId: taskId,
      data: expectedPayload,
    });
    expect(response).toEqual(expectedResponse);
  });

  it('should throw error when attempting to transfer to queue with no destAgentId', async () => {
    const taskWithoutDestAgentId = new Task(contactMock, webCallingService, {
      ...taskDataMock,
      destAgentId: undefined,
    }, { wrapUpProps: null });

    const queueConsultTransferPayload: ConsultTransferPayLoad = {
      to: 'some-queue-id',
      destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.QUEUE,
    };

    await expect(
      taskWithoutDestAgentId.consultTransfer(queueConsultTransferPayload)
    ).rejects.toThrow('No agent has accepted this queue consult yet');
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

    await expect(task.consultTransfer(consultTransferPayload)).rejects.toThrow(
      error.details.data.reason
    );
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'consultTransfer', TASK_FILE);
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      2,
      METRIC_EVENT_NAMES.TASK_TRANSFER_FAILED,
      {
        taskId: taskDataMock.interactionId,
        destination: taskDataMock.destAgentId,
        destinationType: CONSULT_TRANSFER_DESTINATION_TYPE.AGENT,
        isConsultTransfer: true,
        error: error.toString(),
        ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details),
      },
      ['operational', 'behavioral', 'business']
    );
  });

  it('should do vteamTransfer if destinationType is queue and return the expected response', async () => {
    const transferPayload: TransferPayLoad = {
      to: '1234',
      destinationType: DESTINATION_TYPE.QUEUE,
    };

    const expectedResponse: TaskResponse = {data: {interactionId: taskId}} as AgentContact;
    contactMock.vteamTransfer.mockResolvedValue(expectedResponse);

    const response = await task.transfer(transferPayload);

    expect(contactMock.vteamTransfer).toHaveBeenCalledWith({
      interactionId: taskId,
      data: transferPayload,
    });
    expect(response).toEqual(expectedResponse);
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_TRANSFER_SUCCESS,
      {
        taskId: taskDataMock.interactionId,
        destination: transferPayload.to,
        destinationType: transferPayload.destinationType,
        isConsultTransfer: false,
        ...MetricsManager.getCommonTrackingFieldForAQMResponse(expectedResponse),
      },
      ['operational', 'behavioral', 'business']
    );
  });

  it('should do blindTransfer if destinationType is anything other than queue and return the expected response', async () => {
    const transferPayload: TransferPayLoad = {
      to: '1234',
      destinationType: DESTINATION_TYPE.AGENT,
    };

    const expectedResponse: TaskResponse = {data: {interactionId: taskId}} as AgentContact;
    contactMock.blindTransfer.mockResolvedValue(expectedResponse);

    const response = await task.transfer(transferPayload);

    expect(contactMock.blindTransfer).toHaveBeenCalledWith({
      interactionId: taskId,
      data: transferPayload,
    });
    expect(response).toEqual(expectedResponse);
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_TRANSFER_SUCCESS,
      {
        taskId: taskDataMock.interactionId,
        destination: transferPayload.to,
        destinationType: transferPayload.destinationType,
        isConsultTransfer: false,
        ...MetricsManager.getCommonTrackingFieldForAQMResponse(expectedResponse),
      },
      ['operational', 'behavioral', 'business']
    );
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
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'transfer', TASK_FILE);
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_TRANSFER_FAILED,
      {
        taskId: taskDataMock.interactionId,
        destination: blindTransferPayload.to,
        destinationType: blindTransferPayload.destinationType,
        isConsultTransfer: false,
        error: error.toString(),
        ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details),
      },
      ['operational', 'behavioral', 'business']
    );
  });

  it('should end the task and return the expected response', async () => {
    const expectedResponse: TaskResponse = {data: {interactionId: taskId}} as AgentContact;
    contactMock.end.mockResolvedValue(expectedResponse);

    const response = await task.end();

    expect(contactMock.end).toHaveBeenCalledWith({interactionId: taskId});
    expect(response).toEqual(expectedResponse);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Ending task`, {
      module: TASK_FILE,
      method: 'end',
      interactionId: expectedResponse.data.interactionId,
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(`Task ended successfully`, {
      module: TASK_FILE,
      method: 'end',
      interactionId: expectedResponse.data.interactionId,
    });
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_END_SUCCESS,
      {
        taskId: taskDataMock.interactionId,
        ...MetricsManager.getCommonTrackingFieldForAQMResponse(expectedResponse),
      },
      ['operational', 'behavioral', 'business']
    );
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
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'end', TASK_FILE);
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_END_FAILED,
      {
        taskId: taskDataMock.interactionId,
        ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details),
      },
      ['operational', 'behavioral', 'business']
    );
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
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_WRAPUP_SUCCESS,
      {
        taskId: taskDataMock.interactionId,
        wrapUpCode: wrapupPayload.auxCodeId,
        wrapUpReason: wrapupPayload.wrapUpReason,
        ...MetricsManager.getCommonTrackingFieldForAQMResponse(expectedResponse),
      },
      ['operational', 'behavioral', 'business']
    );
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
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'wrapup', TASK_FILE);
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_WRAPUP_FAILED,
      {
        taskId: taskDataMock.interactionId,
        wrapUpCode: wrapupPayload.auxCodeId,
        wrapUpReason: wrapupPayload.wrapUpReason,
        ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details),
      },
      ['operational', 'behavioral', 'business']
    );
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
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Pausing recording`, {
      module: TASK_FILE,
      method: 'pauseRecording',
      interactionId: task.data.interactionId,
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(`Recording paused successfully`, {
      module: TASK_FILE,
      method: 'pauseRecording',
      interactionId: task.data.interactionId,
    });
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_PAUSE_RECORDING_SUCCESS,
      {
        taskId: taskDataMock.interactionId,
      },
      ['operational', 'behavioral', 'business']
    );
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
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'pauseRecording', TASK_FILE);
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_PAUSE_RECORDING_FAILED,
      {
        taskId: taskDataMock.interactionId,
        error: error.toString(),
        ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details),
      },
      ['operational', 'behavioral', 'business']
    );
  });

  it('should resume the recording of the task', async () => {
    const resumePayload = {
      autoResumed: true,
      interactionId: taskId,
    };

    await task.resumeRecording(resumePayload);

    expect(contactMock.resumeRecording).toHaveBeenCalledWith({
      interactionId: resumePayload.interactionId,
      data: resumePayload,
    });
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Resuming recording`, {
      module: TASK_FILE,
      method: 'resumeRecording',
      interactionId: task.data.interactionId,
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(`Recording resumed successfully`, {
      module: TASK_FILE,
      method: 'resumeRecording',
      interactionId: task.data.interactionId,
    });
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_RESUME_RECORDING_SUCCESS,
      {
        taskId: taskDataMock.interactionId,
      },
      ['operational', 'behavioral', 'business']
    );
  });

  it('should resume the recording of the task if the payload is empty', async () => {
    const resumePayload = {
      autoResumed: false,
    };

    await task.resumeRecording();

    expect(contactMock.resumeRecording).toHaveBeenCalledWith({
      interactionId: taskId,
      data: resumePayload,
    });
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_RESUME_RECORDING_SUCCESS,
      {
        taskId: taskDataMock.interactionId,
      },
      ['operational', 'behavioral', 'business']
    );
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
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'resumeRecording', TASK_FILE);
    expect(mockMetricsManager.trackEvent).toHaveBeenNthCalledWith(
      1,
      METRIC_EVENT_NAMES.TASK_RESUME_RECORDING_FAILED,
      {
        taskId: taskDataMock.interactionId,
        error: error.toString(),
        ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(error.details),
      },
      ['operational', 'behavioral', 'business']
    );
  });

  it('should mute call for Desktop login mode', async () => {
    task.localAudioStream = mockStream;
    const muteCallSpy = jest.spyOn(webCallingService, 'muteUnmuteCall');

    await task.toggleMute();

    expect(muteCallSpy).toHaveBeenCalledWith(mockStream);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Toggling mute state`, {
      module: TASK_FILE,
      method: 'toggleMute',
      interactionId: task.data.interactionId,
    });
    expect(loggerLogSpy).toHaveBeenCalledWith(`Mute state toggled successfully isCallMuted: ${webCallingService.isCallMuted()}`, {
      module: TASK_FILE,
      method: 'toggleMute',
      interactionId: task.data.interactionId,
    });
  });

  it('should handle errors in mute method', async () => {
    const error = {
      details: {
        trackingId: '1234',
        data: {
          reason: 'Mute Failed',
        },
      },
    };

    jest.spyOn(webCallingService, 'muteUnmuteCall').mockImplementation(() => {
      throw error;
    });
    await expect(task.toggleMute()).rejects.toThrow(new Error(error.details.data.reason));
    expect(getErrorDetailsSpy).toHaveBeenCalledWith(error, 'toggleMute', TASK_FILE);
    expect(loggerInfoSpy).toHaveBeenCalledWith(`Toggling mute state`, {
      module: TASK_FILE,
      method: 'toggleMute',
      interactionId: task.data.interactionId,
    });
  });
  
  describe('AutoWrapup initialization tests', () => {    
    beforeEach(() => {
      jest.useFakeTimers();
    });
    
    afterEach(() => {
      jest.restoreAllMocks();
      jest.useRealTimers();
    });
    
    it('should not initialize AutoWrapup if wrapUpRequired is false', () => {
      const wrapupProps = {
        wrapUpProps: {
          autoWrapup: true,
          autoWrapupInterval: 5000,
          wrapUpReasonList: [{ isDefault: true, name: 'Default Reason', id: '123', isSystem: false }]
        }
      };
      
      const taskData = { ...taskDataMock, wrapUpRequired: false };
      const taskInstance = new Task(contactMock, webCallingService, taskData, wrapupProps);
      
      expect(taskInstance.autoWrapup).toBeUndefined();
    });
    
    it('should not initialize AutoWrapup if autoWrapup is set to false', () => {
      const wrapupProps = {
        wrapUpProps: {
          autoWrapup: false,
          autoWrapupInterval: 5000,
          wrapUpReasonList: [{ isDefault: true, name: 'Default Reason', id: '123', isSystem: false }]
        }
      };
      
      const taskData = { ...taskDataMock, wrapUpRequired: true };
      const taskInstance = new Task(contactMock, webCallingService, taskData, wrapupProps);
      
      expect(taskInstance.autoWrapup).toBeUndefined();
      expect(loggerInfoSpy).toHaveBeenCalledWith('Auto wrap-up is not required for this task', {
        module: TASK_FILE,
        method: 'setupAutoWrapupTimer',
        interactionId: taskData.interactionId,
      });
    });

    it('should initialize AutoWrapup with custom interval when specified', () => {
      const customInterval = 15000;
      const wrapupProps = {
        wrapUpProps: {
          autoWrapup: true,
          autoWrapupInterval: customInterval,
          wrapUpReasonList: [{ isDefault: true, name: 'Default Reason', id: '123', isSystem: false }]
        }
      };
      
      const taskData = { ...taskDataMock, wrapUpRequired: true };
      const taskInstance = new Task(contactMock, webCallingService, taskData, wrapupProps);
      
      expect(taskInstance.autoWrapup).toBeDefined();
    });
    
    it('should cancel AutoWrapup timer when wrapup is called', async () => {
      const wrapupProps = {
        wrapUpProps: {
          autoWrapup: true,
          autoWrapupInterval: 5000,
          wrapUpReasonList: [{ isDefault: true, name: 'Default Reason', id: '123', isSystem: false }]
        }
      };
      
      const taskData = { ...taskDataMock, wrapUpRequired: true };
      const taskInstance = new Task(contactMock, webCallingService, taskData, wrapupProps);
      
      // Mock the autoWrapup object and its clear method
      const clearSpy = jest.spyOn(taskInstance.autoWrapup, 'clear');
      
      // Call wrapup method which should cancel the timer
      await taskInstance.wrapup({ wrapUpReason: 'Test Reason', auxCodeId: '123' });
      
      // Verify that clear was called
      expect(clearSpy).toHaveBeenCalled();
      expect(loggerInfoSpy).toHaveBeenCalledWith('Auto wrap-up timer cancelled', {
        module: TASK_FILE,
        method: 'cancelAutoWrapupTimer',
        interactionId: taskData.interactionId,
      });
    });
    
    it('should directly call cancelAutoWrapUpTimer successfully', () => {
      const wrapupProps = {
        wrapUpProps: {
          autoWrapup: true,
          autoWrapupInterval: 5000,
          wrapUpReasonList: [{ isDefault: true, name: 'Default Reason', id: '123', isSystem: false }]
        }
      };
      
      const taskData = { ...taskDataMock, wrapUpRequired: true };
      const taskInstance = new Task(contactMock, webCallingService, taskData, wrapupProps);
      
      const clearSpy = jest.spyOn(taskInstance.autoWrapup, 'clear');
      taskInstance.cancelAutoWrapupTimer();
      
      expect(clearSpy).toHaveBeenCalled();
      expect(loggerInfoSpy).toHaveBeenCalledWith('Auto wrap-up timer cancelled', {
        module: TASK_FILE,
        method: 'cancelAutoWrapupTimer',
        interactionId: taskData.interactionId,
      });
    });

    it('should use default interval when autoWrapupInterval is not specified', () => {
      const wrapupProps = {
        wrapUpProps: {
          autoWrapup: true,
          wrapUpReasonList: [{ isDefault: true, name: 'Default Reason', id: '123', isSystem: false }]
        }
      };
      
      const taskData = { ...taskDataMock, wrapUpRequired: true };
      const taskInstance = new Task(contactMock, webCallingService, taskData, wrapupProps);
      
      expect(taskInstance.autoWrapup).toBeDefined();
    });

    it('should setup autoWrapup with a callback that executes wrapup', () => {
      // Create a task with AutoWrapup enabled and a default wrapup reason
      const defaultWrapUpReason = { isDefault: true, name: 'Default Reason', id: '123', isSystem: false };
      const wrapupProps = {
        wrapUpProps: {
          autoWrapup: true,
          autoWrapupInterval: 5000,
          wrapUpReasonList: [defaultWrapUpReason]
        }
      };
      
      const taskData = { ...taskDataMock, wrapUpRequired: true };
      
      let capturedCallback;
      jest.spyOn(global, 'setTimeout').mockImplementation((callback, timeout) => {
        capturedCallback = callback;
        return {} as any;
      });
      
      // Create our task instance 
      const taskInstance = new Task(contactMock, webCallingService, taskData, wrapupProps);
      
      // Mock the wrapup method to verify it gets called with correct parameters
      const wrapupMock = jest.fn().mockResolvedValue({});
      taskInstance.wrapup = wrapupMock;
      
      // Verify autoWrapup was initialized
      expect(taskInstance.autoWrapup).toBeDefined();
      
      if (capturedCallback) {
        capturedCallback();
      }
      
      // Verify wrapup was called with correct parameters
      expect(wrapupMock).toHaveBeenCalledWith({
        wrapUpReason: defaultWrapUpReason.name,
        auxCodeId: defaultWrapUpReason.id
      });
    });

    it('should handle case when no default wrapup reason is found', () => {
      // Create a task with AutoWrapup enabled but NO default wrapup reason
      const wrapupProps = {
        wrapUpProps: {
          autoWrapup: true,
          autoWrapupInterval: 5000,
          wrapUpReasonList: [
            { isDefault: false, name: 'Reason 1', id: '123', isSystem: false },
            { isDefault: false, name: 'Reason 2', id: '456', isSystem: false }
          ]
        }
      };
      
      const taskData = { ...taskDataMock, wrapUpRequired: true };
      
      // Create our task instance
      const taskInstance = new Task(contactMock, webCallingService, taskData, wrapupProps);
      
      // Mock the wrapup method to verify if it gets called
      const wrapupSpy = jest.fn().mockResolvedValue({});
      taskInstance.wrapup = wrapupSpy;
      
      jest.runOnlyPendingTimers();
      
      // Verify wrapup was called with the first reason (since no default exists)
      expect(wrapupSpy).toHaveBeenCalledWith({
        wrapUpReason: wrapupProps.wrapUpProps.wrapUpReasonList[0].name,
        auxCodeId: wrapupProps.wrapUpProps.wrapUpReasonList[0].id
      });
    });
  });

  describe('fetchIvrTranscript', () => {
    beforeEach(() => {
      // Mock global fetch
      global.fetch = jest.fn();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should fetch IVR transcript successfully for voice task', async () => {
      const mockVoiceTaskData = {
        ...taskDataMock,
        interaction: {
          ...taskDataMock.interaction,
          mediaType: MEDIA_CHANNEL.TELEPHONY
        },
        orgId: 'test-org-123',
        interactionId: 'test-interaction-456',
      };

      const task = new Task(contactMock, webCallingService, mockVoiceTaskData, { wrapUpProps: null });

      const mockConversationData = ivrTranscriptFixture.mockConversationData;

      // Mock the fetchIVRTranscript method to return our test data
      mockIvrTranscriptService.fetchIVRTranscript.mockResolvedValue(mockConversationData);

      const result = await task.fetchIvrTranscript('test-org-123', 'test-interaction-456', 5);

      expect(mockIvrTranscriptService.fetchIVRTranscript).toHaveBeenCalledWith(
        'test-org-123',
        'test-interaction-456',
        5
      );
      expect(result).toEqual(mockConversationData);

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.TASK_IVR_TRANSCRIPT_FETCH_SUCCESS,
        expect.objectContaining({
          taskId: 'test-interaction-456',
          orgId: 'test-org-123',
          conversationTurns: 2
        }),
        ['operational', 'behavioral', 'business']
      );
    });

    it('should throw error when orgId is missing', async () => {
      const taskDataMockNoOrg = {
        ...taskDataMock,
        mediaChannel: MEDIA_CHANNEL.TELEPHONY,
        taskId: 'test-task-456',
        // orgId missing
      };

      const task = new Task(contactMock, webCallingService, taskDataMockNoOrg, { wrapUpProps: null });

      await expect(task.fetchIvrTranscript('', 'test-interaction-456', 5)).rejects.toThrow('Organization ID or Interaction ID is missing');

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.TASK_IVR_TRANSCRIPT_FETCH_FAILED,
        expect.objectContaining({
          error: 'Organization ID or Interaction ID is missing'
        }),
        ['operational', 'behavioral', 'business']
      );
    });

    it('should handle API error when fetching transcript URL', async () => {
      const mockVoiceTaskData = {
        ...taskDataMock,
        mediaChannel: MEDIA_CHANNEL.TELEPHONY,
        orgId: 'test-org-123',
        taskId: 'test-task-456',
      };

      const task = new Task(contactMock, webCallingService, mockVoiceTaskData, { wrapUpProps: null });

      // The service will throw error when fetchIVRTranscript is called
      const apiError = new Error('Failed to fetch IVR transcript metadata');
      mockIvrTranscriptService.fetchIVRTranscript.mockRejectedValue(apiError);

      await expect(task.fetchIvrTranscript('test-org-123', 'test-interaction-456', 5)).rejects.toThrow('Failed to fetch IVR transcript metadata');

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.TASK_IVR_TRANSCRIPT_FETCH_FAILED,
        expect.objectContaining({
          error: 'Failed to fetch IVR transcript metadata'
        }),
        ['operational', 'behavioral', 'business']
      );
    });

    it('should handle when no transcript content is returned (S3 fetch returns empty)', async () => {
      const mockVoiceTaskData = {
        ...taskDataMock,
        mediaChannel: MEDIA_CHANNEL.TELEPHONY,
        orgId: 'test-org-123',
        taskId: 'test-task-456',
      };

      const task = new Task(contactMock, webCallingService, mockVoiceTaskData, { wrapUpProps: null });

      // Mock the fetchIVRTranscript method to return empty array (simulating no transcript content)
      mockIvrTranscriptService.fetchIVRTranscript.mockResolvedValue([]);

      const result = await task.fetchIvrTranscript('test-org-123', 'test-interaction-456', 5);

      // Should return empty array when no transcript content is available
      expect(result).toEqual([]);

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.TASK_IVR_TRANSCRIPT_FETCH_SUCCESS,
        expect.objectContaining({
          taskId: 'test-interaction-456',
          orgId: 'test-org-123',
          conversationTurns: 0
        }),
        ['operational', 'behavioral', 'business']
      );
    });

    it('should return empty array (and record success metric) when no transcripts are available', async () => {
      const mockVoiceTaskData = {
        ...taskDataMock,
        interaction: {
          ...taskDataMock.interaction,
          mediaType: MEDIA_CHANNEL.TELEPHONY
        },
        orgId: 'test-org-123',
        interactionId: 'test-interaction-456',
      };

      const task = new Task(contactMock, webCallingService, mockVoiceTaskData, { wrapUpProps: null });
      // Service returns no conversations when metadata has no transcripts
      mockIvrTranscriptService.fetchIVRTranscript.mockResolvedValue([]);

      const result = await task.fetchIvrTranscript('test-org-123', 'test-interaction-456', 5);
      expect(result).toEqual([]);
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.TASK_IVR_TRANSCRIPT_FETCH_SUCCESS,
        expect.objectContaining({
          taskId: 'test-interaction-456',
          orgId: 'test-org-123',
          conversationTurns: 0
        }),
        ['operational', 'behavioral', 'business']
      );
    });

    it('should handle single transcript with multiple conversation turns', async () => {
      const mockVoiceTaskData = {
        ...taskDataMock,
        mediaChannel: MEDIA_CHANNEL.TELEPHONY,
        orgId: 'test-org-123',
        taskId: 'test-task-456',
      };

      const task = new Task(contactMock, webCallingService, mockVoiceTaskData, { wrapUpProps: null });

      const mockMultipleTranscriptData = ivrTranscriptFixture.mockMultipleTranscriptData;

      // Mock the fetchIVRTranscript method to return multiple conversations
      mockIvrTranscriptService.fetchIVRTranscript.mockResolvedValue(mockMultipleTranscriptData);

      const result = await task.fetchIvrTranscript('test-org-123', 'test-interaction-456', 5);

      expect(mockIvrTranscriptService.fetchIVRTranscript).toHaveBeenCalledWith(
        'test-org-123',
        'test-interaction-456',
        5
      );

      expect(result).toHaveLength(4);
      expect(result[0].customer.query).toEqual('Hello');
      expect(result[1].bot.botName).toEqual('TestBot1');
      expect(result[2].customer.query).toEqual('Goodbye');
      expect(result[3].bot.botName).toEqual('TestBot2');

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.TASK_IVR_TRANSCRIPT_FETCH_SUCCESS,
        expect.objectContaining({
          taskId: 'test-interaction-456',
          orgId: 'test-org-123',
          conversationTurns: 4
        }),
        ['operational', 'behavioral', 'business']
      );
    });

    it('should handle partial failure when processing multiple transcripts (3 transcripts, 2nd fails)', async () => {
      const mockVoiceTaskData = {
        ...taskDataMock,
        mediaChannel: MEDIA_CHANNEL.TELEPHONY,
        orgId: 'test-org-123',
        taskId: 'test-task-456',
      };

      const task = new Task(contactMock, webCallingService, mockVoiceTaskData, { wrapUpProps: null });

      // Simulate scenario where IvrTranscriptService successfully fetches 2 out of 3 transcripts
      // (1st and 3rd succeed, 2nd fails during S3 fetch)
      // This is exactly what would be returned after Bot1 and Bot3 conversations are successfully processed
      const mockPartialTranscriptData = [
        // Bot1 transcript conversation turns
        {
          bot: {
            reply: 'Hello! I am your virtual assistant. I can help you with billing, account, and technical support. Please select: 1.Billing 2.Account 3.Technical Support',
            timestamp: 1757945269131,
            botName: 'Bot1'
          },
          customer: {}
        },
        {
          bot: {
            intentName: 'Billing Support',
            confidence: 0.95,
            reply: 'I can help you with your billing questions. Let me transfer you to our billing specialist.',
            parameters: { department: 'billing', priority: 'high' },
            timestamp: 1757945288413,
            botName: 'Bot1'
          },
          customer: {
            confidence: 0.8,
            query: 'I need help with billing',
            timestamp: 1757945288413
          }
        },
        // Bot3 transcript conversation turns 
        {
          bot: {
            reply: 'Technical support is available. I can help you with device setup, troubleshooting, and more.',
            timestamp: 1757945350000,
            botName: 'Bot3'
          },
          customer: {}
        },
        {
          bot: {
            intentName: 'Technical Support Transfer',
            confidence: 0.92,
            reply: 'I will transfer you to technical support now. Please hold while I connect you.',
            parameters: { department: 'tech-support', action: 'transfer' },
            timestamp: 1757945370000,
            botName: 'Bot3'
          },
          customer: {
            confidence: 0.7,
            query: 'Can you transfer me to technical support?',
            timestamp: 1757945370000
          }
        }
      ];

      mockIvrTranscriptService.fetchIVRTranscript.mockResolvedValue(mockPartialTranscriptData);

      const result = await task.fetchIvrTranscript('test-org-123', 'test-interaction-456', 5);

      expect(mockIvrTranscriptService.fetchIVRTranscript).toHaveBeenCalledWith(
        'test-org-123',
        'test-interaction-456',
        5
      );

      // Validate we get exactly the combination of Bot1 and Bot3 transcript data
      expect(result).toHaveLength(4);
      
      // Bot1 conversation turns
      expect(result[0].bot.reply).toEqual('Hello! I am your virtual assistant. I can help you with billing, account, and technical support. Please select: 1.Billing 2.Account 3.Technical Support');
      expect(result[0].bot.botName).toEqual('Bot1');
      expect(result[0].customer).toEqual({});
      
      expect(result[1].bot.reply).toEqual('I can help you with your billing questions. Let me transfer you to our billing specialist.');
      expect(result[1].bot.botName).toEqual('Bot1');
      expect(result[1].bot.confidence).toEqual(0.95);
      expect(result[1].bot.parameters.department).toEqual('billing');
      expect(result[1].bot.parameters.priority).toEqual('high');
      expect(result[1].customer.query).toEqual('I need help with billing');
      expect(result[1].customer.confidence).toEqual(0.8);

      // Bot3 conversation turns
      expect(result[2].bot.reply).toEqual('Technical support is available. I can help you with device setup, troubleshooting, and more.');
      expect(result[2].bot.botName).toEqual('Bot3');
      expect(result[2].customer).toEqual({});
      
      expect(result[3].bot.reply).toEqual('I will transfer you to technical support now. Please hold while I connect you.');
      expect(result[3].bot.botName).toEqual('Bot3');
      expect(result[3].bot.confidence).toEqual(0.92);
      expect(result[3].bot.parameters.department).toEqual('tech-support');
      expect(result[3].bot.parameters.action).toEqual('transfer');
      expect(result[3].customer.query).toEqual('Can you transfer me to technical support?');
      expect(result[3].customer.confidence).toEqual(0.7);

      // Verify we have only Bot1 and Bot3 data, NOT Bot2
      const allBotNames = result
        .filter(turn => turn.bot)
        .map(turn => turn.bot.botName);
      expect(allBotNames).toEqual(['Bot1', 'Bot1', 'Bot3', 'Bot3']);
      expect(allBotNames).not.toContain('Bot2');

      // Verify we don't have any Bot2 specific content (that would indicate failure in filtering)
      const allBotReplies = result
        .filter(turn => turn.bot)
        .map(turn => turn.bot.reply);
      expect(allBotReplies).not.toContain('I can help you with account-related queries. Please tell me what you need assistance with.');
      expect(allBotReplies).not.toContain('Let me check your account details and connect you with our account specialist.');

      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.TASK_IVR_TRANSCRIPT_FETCH_SUCCESS,
        expect.objectContaining({
          taskId: 'test-interaction-456',
          orgId: 'test-org-123',
          conversationTurns: 4
        }),
        ['operational', 'behavioral', 'business']
      );
    });
  });
});

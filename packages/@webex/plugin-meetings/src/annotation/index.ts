import uuid from 'uuid';
// eslint-disable-next-line import/no-extraneous-dependencies
import {WebexPlugin, config} from '@webex/webex-core';
import TriggerProxy from '../common/events/trigger-proxy';

import {
  EVENT_TRIGGERS,
  ANNOTATION_RELAY_TYPES,
  ANNOTATION,
  ANNOTATION_REQUEST_TYPE,
  ANNOTATION_ACTION_TYPE,
  ANNOTATION_RESOURCE_TYPE,
} from './constants';

import {StrokeData, RequestData, IAnnotationChannel, CommandRequestBody} from './annotation.types';
import {HTTP_VERBS} from '../constants';

/**
 * @description Annotation to handle LLM and Mercury message and locus API
 * @class
 */
class AnnotationChannel extends WebexPlugin implements IAnnotationChannel {
  namespace = ANNOTATION;

  private seqNum: number;

  hasSubscribedToEvents: boolean;

  approvalUrl: string;
  locusUrl: string;
  deviceUrl: string;

  /**
   * Initializes annotation module
   */
  constructor(...args) {
    super(...args);
    this.seqNum = 1;
  }

  /**
   * Process Stroke Data
   * @param {object}  data
   * @returns {void}
   */
  private processStrokeMessage(data) {
    const {request} = data;
    this.decryptContent(request.value.encryptionKeyUrl, request.value.content).then(
      (decryptedContent) => {
        request.value.content = decryptedContent;
        TriggerProxy.trigger(
          this,
          {
            file: 'annotation',
            function: 'processStrokeMessage',
          },
          EVENT_TRIGGERS.ANNOTATION_STROKE_DATA,
          {
            payload: data,
          }
        );
      }
    );
  }

  /** bind all events from mercury
   * @param {Object} e
   * @returns {undefined}
   */
  private eventCommandProcessor(e) {
    if (
      e?.data?.eventType === 'locus.approval_request' &&
      e?.data?.approval?.resourceType === ANNOTATION_RESOURCE_TYPE &&
      e?.data?.approval?.actionType
    ) {
      TriggerProxy.trigger(
        this,
        {
          file: 'annotation',
          function: 'approval_request',
        },
        EVENT_TRIGGERS.ANNOTATION_COMMAND,
        {
          type: e.data.approval.actionType,
          payload: e.data.approval,
        }
      );
    }
  }

  /** bind all events from llm
   * @param {Object} e
   * @returns {undefined}
   */
  private eventDataProcessor(e) {
    switch (e?.data?.relayType) {
      case ANNOTATION_RELAY_TYPES.ANNOTATION_CLIENT:
        this.processStrokeMessage(e.data);
        break;
      default:
        break;
    }
  }

  /**
   * Listen to websocket messages
   * @returns {undefined}
   */
  private listenToEvents() {
    if (!this.hasSubscribedToEvents) {
      // @ts-ignore
      this.webex.internal.mercury.on(
        'event:locus.approval_request',
        this.eventCommandProcessor,
        this
      );
      // @ts-ignore
      this.webex.internal.llm.on('event:relay.event', this.eventDataProcessor, this);
      this.hasSubscribedToEvents = true;
    }
  }

  /**
   * set locusUrl
   * @param {string} locusUrl
   * @returns {void}
   */
  public locusUrlUpdate(locusUrl: string) {
    this.locusUrl = locusUrl;
    this.listenToEvents();
  }

  /**
   * set approved url
   * @param {string} approvalUrl
   * @returns {void}
   */
  public approvalUrlUpdate(approvalUrl: string) {
    this.approvalUrl = approvalUrl;
  }

  /**
   * accept request
   * @param {object} approval
   * @returns {Promise}
   */
  public acceptRequest(approval) {
    // @ts-ignore
    return this.request({
      method: HTTP_VERBS.PUT,
      url: approval.url,
      body: {
        resourceType: ANNOTATION_RESOURCE_TYPE,
        actionType: ANNOTATION_ACTION_TYPE.ACCEPTED,
      },
    });
  }

  /**
   * presenter declined request annotation
   * @param {approval} approval
   * @returns {Promise}
   */
  public declineRequest(approval) {
    // @ts-ignore
    return this.request({
      method: HTTP_VERBS.PUT,
      url: approval.url,
      body: {
        resourceType: ANNOTATION_RESOURCE_TYPE,
        actionType: ANNOTATION_ACTION_TYPE.DECLINED,
      },
    });
  }

  /**
   * request approved annotation
   * @param {RequestData} requestData
   * @returns {Promise}
   */
  public approveAnnotation(requestData: RequestData) {
    return this.sendAnnotationAction(ANNOTATION_ACTION_TYPE.REQUESTED, requestData);
  }

  /**
   * cancel approved annotation
   * @param {object} requestData
   * @param {object} approval
   * @returns {Promise}
   */
  public cancelApproveAnnotation(requestData: RequestData, approval) {
    const body: CommandRequestBody = {
      actionType: ANNOTATION_ACTION_TYPE.CANCELED,
      resourceType: 'AnnotationOnShare',
      shareInstanceId: requestData.shareInstanceId,
    };

    // @ts-ignore
    return this.request({
      method: HTTP_VERBS.PUT,
      url: `${approval.url}`,
      body,
    });
  }

  /**
   * close annotation
   * @param {object} requestData
   * @returns {Promise}
   */
  public closeAnnotation(requestData: RequestData) {
    return this.sendAnnotationAction(ANNOTATION_ACTION_TYPE.CLOSED, requestData);
  }

  /**
   * send annotation command
   * @param {ANNOTATION_ACTION_TYPE} actionType
   * @param {RequestData} requestData
   * @returns {Promise}
   */
  private sendAnnotationAction = async (
    actionType: ANNOTATION_ACTION_TYPE,
    requestData: RequestData
  ): Promise<void> => {
    const body: CommandRequestBody = {
      actionType,
      resourceType: 'AnnotationOnShare',
      shareInstanceId: requestData.shareInstanceId,
    };
    if (requestData?.toUserId) {
      body.receivers = [{participantId: requestData.toUserId, deviceUrl: requestData.toDeviceUrl}];
    }

    // @ts-ignore
    return this.request({
      method: HTTP_VERBS.POST,
      url: `${this.approvalUrl}`,
      body,
    });
  };

  /**
   * decrypt data
   * @param {string} encryptionKeyUrl
   * @param {string} content encrypted content
   * @returns {string} decrypted content
   */
  private decryptContent = (encryptionKeyUrl: string, content: string): Promise<any> => {
    // @ts-ignore
    return this.webex.internal.encryption.decryptText(encryptionKeyUrl, content).then((res) => {
      return res;
    });
  };

  /**
   * encrypt data
   * @param {string} encryptionKeyUrl
   * @param {string} content original content
   * @returns {string} encrypted content
   */
  private encryptContent = (encryptionKeyUrl: string, content: string): Promise<any> => {
    // @ts-ignore
    return this.webex.internal.encryption.encryptText(encryptionKeyUrl, content).then((res) => {
      return res;
    });
  };

  /**
   * Sends stroke data to presenter
   * @param {StrokeData} strokeData
   * @returns {void}
   */
  public sendStrokeData = (strokeData: StrokeData): void => {
    // @ts-ignore
    if (!this.webex.internal.llm.isConnected()) return;
    this.encryptContent(strokeData.encryptionKeyUrl, strokeData.content).then(
      (encryptedContent) => {
        this.publishEncrypted(encryptedContent, strokeData);
      }
    );
  };

  /**
   * private encrypted the strokes data
   * @param {string} encryptedContent
   * @param {StrokeData} strokeData
   * @returns {void}
   */
  private publishEncrypted(encryptedContent: string, strokeData: StrokeData) {
    const data = {
      id: `${this.seqNum}`,
      type: 'publishRequest',
      recipients: {
        // @ts-ignore
        route: this.webex.internal.llm.getBinding(),
      },
      headers: {
        to: strokeData.toUserId,
      },
      data: {
        eventType: 'relay.event',
        relayType: ANNOTATION_RELAY_TYPES.ANNOTATION_CLIENT,
        request: {
          value: {
            type: ANNOTATION_REQUEST_TYPE.ANNOTATION_MESSAGE,
            content: encryptedContent,
            deviceId: strokeData.deviceId,
            seq: this.seqNum,
            requesterId: strokeData.requesterId,
            version: strokeData.version,
            shareInstanceId: strokeData.shareInstanceId,
            encryptionKeyUrl: strokeData.encryptionKeyUrl,
          },
        },
      },
      trackingId: `${config.trackingIdPrefix}_${uuid.v4().toString()}`,
      timestamp: new Date().getTime(),
      sequenceNumber: this.seqNum,
      filterMessage: false,
    };

    // @ts-ignore
    this.webex.internal.llm.socket.send(data);
    this.seqNum += 1;
  }
}

export default AnnotationChannel;

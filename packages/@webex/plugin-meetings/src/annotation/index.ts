import uuid from 'uuid';
// eslint-disable-next-line import/no-extraneous-dependencies
import {WebexPlugin, config} from '@webex/webex-core';
import type LLMChannel from '@webex/internal-plugin-llm';
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
import {HTTP_VERBS, LOCUSEVENT} from '../constants';

type ChannelType = 'default' | 'practice-session';

/**
 * @description Annotation to handle LLM and Mercury message and locus API
 * @class
 */
class AnnotationChannel extends WebexPlugin implements IAnnotationChannel {
  namespace = ANNOTATION;

  private seqNum: number;

  hasSubscribedToEvents!: boolean;

  approvalUrl!: string;
  locusUrl!: string;
  deviceUrl!: string;

  /** Registered LLM channels by type */
  private channels: Map<ChannelType, LLMChannel> = new Map();

  /** Event handlers bound to each channel, for cleanup */
  private channelHandlers: Map<ChannelType, (e: any) => void> = new Map();

  /**
   * Initializes annotation module
   */
  constructor(...args) {
    super(...args);
    this.seqNum = 1;
  }

  /**
   * Register an LLMChannel with annotation
   * @param {LLMChannel} channel - The LLM channel to register
   * @param {ChannelType} type - 'default' or 'practice-session'
   * @returns {void}
   */
  public registerChannel(channel: LLMChannel, type: ChannelType): void {
    // Unregister existing channel of this type first
    if (this.channels.has(type)) {
      this.unregisterChannel(type);
    }

    this.channels.set(type, channel);

    // Subscribe to relay events from this channel
    const handler = this.eventDataProcessor.bind(this);
    this.channelHandlers.set(type, handler);
    channel.on('event:relay.event', handler);
  }

  /**
   * Unregister an LLMChannel from annotation
   * @param {ChannelType} type - 'default' or 'practice-session'
   * @returns {void}
   */
  public unregisterChannel(type: ChannelType): void {
    const channel = this.channels.get(type);
    const handler = this.channelHandlers.get(type);

    if (channel && handler) {
      channel.off('event:relay.event', handler);
    }

    this.channels.delete(type);
    this.channelHandlers.delete(type);
  }

  /**
   * Get the active LLM channel (prefers practice session if connected)
   * @returns {LLMChannel | undefined}
   */
  private getActiveChannel(): LLMChannel | undefined {
    const practiceChannel = this.channels.get('practice-session');
    if (practiceChannel?.isConnected()) {
      return practiceChannel;
    }

    return this.channels.get('default');
  }

  /**
   * Indicates whether any registered LLM channel is connected.
   * @returns {boolean}
   */
  private isLLMConnected(): boolean {
    const defaultChannel = this.channels.get('default');
    const practiceChannel = this.channels.get('practice-session');

    return defaultChannel?.isConnected() || practiceChannel?.isConnected() || false;
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
      e?.data?.eventType === LOCUSEVENT.APPROVAL_REQUEST &&
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
   * @deprecated LLM event subscription is now handled by registerChannel()
   * @returns {undefined}
   */
  private listenToEvents() {
    if (!this.hasSubscribedToEvents) {
      // @ts-ignore
      this.webex.internal.mercury.on(
        `event:${LOCUSEVENT.APPROVAL_REQUEST}`,
        this.eventCommandProcessor,
        this
      );
      // LLM event subscription is now handled by registerChannel()
      this.hasSubscribedToEvents = true;
    }
  }

  /**
   * Remove event listeners
   * @returns {undefined}
   */
  public deregisterEvents() {
    if (this.hasSubscribedToEvents) {
      // @ts-ignore
      this.webex.internal.mercury.off(
        `event:${LOCUSEVENT.APPROVAL_REQUEST}`,
        this.eventCommandProcessor
      );

      // Unregister all LLM channels
      for (const type of this.channels.keys()) {
        this.unregisterChannel(type);
      }

      this.hasSubscribedToEvents = false;
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
    if (!this.isLLMConnected()) return;
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
    const channel = this.getActiveChannel();
    if (!channel) return;

    const socket = channel.getSocket();
    const binding = channel.getBinding();
    if (!socket || !binding) return;

    const data = {
      id: `${this.seqNum}`,
      type: 'publishRequest',
      recipients: {
        // @ts-ignore
        route: binding,
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
    socket.send(data);
    this.seqNum += 1;
  }
}

export default AnnotationChannel;

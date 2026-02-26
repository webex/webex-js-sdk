/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import {WebexPlugin} from '@webex/webex-core';
import {AI_ENABLE_REQUEST, HTTP_VERBS, LOCUSEVENT, MEETINGS} from '../constants';

/**
 * @class AIEnableRequest
 */
const AIEnableRequest = WebexPlugin.extend({
  namespace: MEETINGS,

  props: {
    approvalUrl: 'string',
    selfParticipantId: 'string',
    hasSubscribedToEvents: 'boolean',
  },

  /**
   * Update the approval url for handoff
   * @param {string} approvalUrl // approval url
   * @returns {void}
   */
  approvalUrlUpdate(approvalUrl) {
    this.set('approvalUrl', approvalUrl);
  },

  /**
   * Update the self participant id
   * @param {string} selfParticipantId
   * @returns {void}
   */
  selfParticipantIdUpdate(selfParticipantId) {
    this.set('selfParticipantId', selfParticipantId);

    if (!this.hasSubscribedToEvents) {
      this.listenToApprovalRequests();
      this.set('hasSubscribedToEvents', true);
    }
  },

  /**
   * Listen to locus approval request events and trigger a new event with necessary details when an AI enablement approval request is received
   * @returns {void}
   */
  listenToApprovalRequests() {
    this.listenTo(this.webex.internal.mercury, `event:${LOCUSEVENT.APPROVAL_REQUEST}`, (event) => {
      if (event?.data?.approval?.resourceType === AI_ENABLE_REQUEST.RESOURCE_TYPE) {
        const {receivers, initiator, actionType, url} = event.data.approval;
        const receiverId = receivers?.[0]?.participantId;
        const isReceiver = !!receiverId && receiverId === this.selfParticipantId;
        const senderId = initiator?.participantId;
        const isSender = !!senderId && senderId === this.selfParticipantId;
        if (!isReceiver && !isSender) {
          return;
        }
        this.trigger(AI_ENABLE_REQUEST.EVENTS.APPROVAL_REQUEST_ARRIVED, {
          actionType,
          isReceiver,
          isSender,
          senderId,
          receiverId,
          url,
        });
      }
    });
  },

  /**
   * Helper method to send AI assistant request
   * @param {string} url approval url
   * @param {string} actionType the type of action (REQUESTED, ACCEPTED, DECLINED, DECLINED_ALL)
   * @param {string} initiatorId
   * @param {string} approverId
   * @param {string} method HTTP method to use for the request
   * @returns {Promise}
   */
  sendApprovalRequest(url, actionType, initiatorId, approverId, method) {
    return this.request({
      method,
      uri: url,
      body: {
        actionType,
        resourceType: AI_ENABLE_REQUEST.RESOURCE_TYPE,
        initiator: {
          participantId: initiatorId,
        },
        approver: {
          participantId: approverId,
        },
      },
    });
  },

  /**
   * Sends a request to enable the AI assistant
   * @param {string} approverId
   * @returns {Promise}
   */
  requestEnableAIAssistant(approverId) {
    return this.sendApprovalRequest(
      this.approvalUrl,
      AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED,
      this.selfParticipantId,
      approverId,
      HTTP_VERBS.POST
    );
  },

  /**
   * Sends a request to accept the AI assistant enablement
   * @param {string} url approval url
   * @param {string} initiatorId
   * @returns {Promise}
   */
  acceptEnableAIAssistantRequest(url, initiatorId) {
    return this.sendApprovalRequest(
      url,
      AI_ENABLE_REQUEST.ACTION_TYPE.ACCEPTED,
      initiatorId,
      this.selfParticipantId,
      HTTP_VERBS.PUT
    );
  },

  /**
   * Sends a request to decline the AI assistant enablement
   * @param {string} url approval url
   * @param {string} initiatorId
   * @returns {Promise}
   */
  declineEnableAIAssistantRequest(url, initiatorId) {
    return this.sendApprovalRequest(
      url,
      AI_ENABLE_REQUEST.ACTION_TYPE.DECLINED,
      initiatorId,
      this.selfParticipantId,
      HTTP_VERBS.PUT
    );
  },

  /**
   * Sends a request to decline all AI assistant enablement requests
   * @param {string} url approval url
   * @param {string} initiatorId
   * @returns {Promise}
   */
  declineAllEnableAIAssistantRequests(url, initiatorId) {
    return this.sendApprovalRequest(
      url,
      AI_ENABLE_REQUEST.ACTION_TYPE.DECLINED_ALL,
      initiatorId,
      this.selfParticipantId,
      HTTP_VERBS.PUT
    );
  },
});

export default AIEnableRequest;

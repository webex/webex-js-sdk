/*!
 * Copyright (c) 2015-2026 Cisco Systems, Inc. See LICENSE file.
 */
import {WebexPlugin} from '@webex/webex-core';
import {AI_ENABLE_REQUEST, HTTP_VERBS, MEETINGS} from '../constants';

/**
 * @class AIEnableRequest
 */
const AIEnableRequest = WebexPlugin.extend({
  namespace: MEETINGS,

  props: {
    approvalUrl: 'string',
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
   * Helper method to send AI assistant request
   * @param {string} url approval url
   * @param {string} actionType the type of action (REQUESTED, ACCEPTED, DECLINED, DECLINED_ALL)
   * @param {string} initiatorId
   * @param {string} approverId
   * @returns {Promise}
   */
  sendApprovalRequest(url, actionType, initiatorId, approverId) {
    return this.request({
      method: HTTP_VERBS.POST,
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
   * @param {string} selfParticipantId
   * @param {string} approverId
   * @returns {Promise}
   */
  requestEnableAIAssistant(selfParticipantId, approverId) {
    return this.sendApprovalRequest(
      this.approvalUrl,
      AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED,
      selfParticipantId,
      approverId
    );
  },

  /**
   * Sends a request to accept the AI assistant enablement
   * @param {string} url approval url
   * @param {string} initiatorId
   * @param {string} approverId
   * @returns {Promise}
   */
  acceptEnableAIAssistantRequest(url, initiatorId, approverId) {
    return this.sendApprovalRequest(
      url,
      AI_ENABLE_REQUEST.ACTION_TYPE.ACCEPTED,
      initiatorId,
      approverId
    );
  },

  /**
   * Sends a request to decline the AI assistant enablement
   * @param {string} url approval url
   * @param {string} initiatorId
   * @param {string} approverId
   * @returns {Promise}
   */
  declineEnableAIAssistantRequest(url, initiatorId, approverId) {
    return this.sendApprovalRequest(
      url,
      AI_ENABLE_REQUEST.ACTION_TYPE.DECLINED,
      initiatorId,
      approverId
    );
  },

  /**
   * Sends a request to decline all AI assistant enablement requests
   * @param {string} url approval url
   * @param {string} initiatorId
   * @param {string} approverId
   * @returns {Promise}
   */
  declineAllEnableAIAssistantRequests(url, initiatorId, approverId) {
    return this.sendApprovalRequest(
      url,
      AI_ENABLE_REQUEST.ACTION_TYPE.DECLINED_ALL,
      initiatorId,
      approverId
    );
  },
});

export default AIEnableRequest;

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
   * @param {string} approvalUrl
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
        const approverId = receivers?.[0]?.participantId;
        const isApprover = !!approverId && approverId === this.selfParticipantId;
        const initiatorId = initiator?.participantId;
        const isInitiator = !!initiatorId && initiatorId === this.selfParticipantId;
        if (
          !isApprover &&
          !isInitiator &&
          // Not just the initiator needs to know about declined all because
          // all future requests will be rejected if the meeting is in the declined all state
          actionType !== AI_ENABLE_REQUEST.ACTION_TYPE.DECLINED_ALL
        ) {
          return;
        }
        this.trigger(AI_ENABLE_REQUEST.EVENTS.APPROVAL_REQUEST_ARRIVED, {
          actionType,
          isApprover,
          isInitiator,
          initiatorId,
          approverId,
          url,
        });
      }
    });
  },

  /**
   * Helper method to send AI assistant request
   * @param {Object} params
   * @param {string} params.url approval url
   * @param {string} params.actionType the type of action (REQUESTED, ACCEPTED, DECLINED, DECLINED_ALL)
   * @param {string} params.initiatorId
   * @param {string} params.approverId
   * @param {string} params.method HTTP method to use for the request
   * @returns {Promise}
   */
  sendApprovalRequest({url, actionType, initiatorId, approverId, method}) {
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
   * @param {Object} params
   * @param {string} params.approverId
   * @returns {Promise}
   */
  requestEnableAIAssistant({approverId}) {
    return this.sendApprovalRequest({
      url: this.approvalUrl,
      actionType: AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED,
      initiatorId: this.selfParticipantId,
      approverId,
      method: HTTP_VERBS.POST,
    });
  },

  /**
   * Sends a request to accept the AI assistant enablement
   * @param {Object} params
   * @param {string} params.url approval url
   * @param {string} params.initiatorId
   * @returns {Promise}
   */
  acceptEnableAIAssistantRequest({url, initiatorId}) {
    return this.sendApprovalRequest({
      url,
      actionType: AI_ENABLE_REQUEST.ACTION_TYPE.ACCEPTED,
      initiatorId,
      approverId: this.selfParticipantId,
      method: HTTP_VERBS.PUT,
    });
  },

  /**
   * Sends a request to decline the AI assistant enablement
   * @param {Object} params
   * @param {string} params.url approval url
   * @param {string} params.initiatorId
   * @returns {Promise}
   */
  declineEnableAIAssistantRequest({url, initiatorId}) {
    return this.sendApprovalRequest({
      url,
      actionType: AI_ENABLE_REQUEST.ACTION_TYPE.DECLINED,
      initiatorId,
      approverId: this.selfParticipantId,
      method: HTTP_VERBS.PUT,
    });
  },

  /**
   * Sends a request to decline all AI assistant enablement requests
   * @param {Object} params
   * @param {string} params.url approval url
   * @param {string} params.initiatorId
   * @returns {Promise}
   */
  declineAllEnableAIAssistantRequests({url, initiatorId}) {
    return this.sendApprovalRequest({
      url,
      actionType: AI_ENABLE_REQUEST.ACTION_TYPE.DECLINED_ALL,
      initiatorId,
      approverId: this.selfParticipantId,
      method: HTTP_VERBS.PUT,
    });
  },
});

export default AIEnableRequest;

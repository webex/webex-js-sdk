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
  //*

  /**
   * Sends a request to enable the AI assistant
   * @param {string} selfParticipantId
   * @param {string} approverId
   * @returns {Promise}
   */
  requestEnableAIAssistant(selfParticipantId, approverId) {
    return this.request({
      method: HTTP_VERBS.POST,
      uri: this.approvalUrl,
      body: {
        actionType: AI_ENABLE_REQUEST.ACTION_TYPE.REQUESTED,
        resourceType: AI_ENABLE_REQUEST.RESOURCE_TYPE,
        initiator: {
          participantId: selfParticipantId,
        },
        approver: {
          participantId: approverId,
        },
      },
    });
  },
});

export default AIEnableRequest;

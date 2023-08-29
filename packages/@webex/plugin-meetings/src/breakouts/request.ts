import {StatelessWebexPlugin} from '@webex/webex-core';
import LoggerProxy from '../common/logs/logger-proxy';
import {getBroadcastRoles} from './utils';
import {HTTP_VERBS} from '../constants';

/**
 * @class BreakoutRequest
 */
export default class BreakoutRequest extends StatelessWebexPlugin {
  /**
   * Broadcast message to all breakout session's participants
   * @param {String} url
   * @param {String} message
   * @param {Object} options
   * @param {string} groupId
   * @param {string} sessionId
   * @returns {Promise}
   */
  broadcast({
    url,
    message,
    options,
    groupId,
    sessionId,
  }: {
    url: string;
    message: string;
    options?: object;
    groupId: string;
    sessionId?: string;
  }) {
    const roles = getBroadcastRoles(options);
    const params = {
      id: groupId,
      recipientRoles: roles.length ? roles : undefined,
      sessions: sessionId ? [{id: sessionId}] : undefined,
    };

    // @ts-ignore
    return this.request({
      method: HTTP_VERBS.POST,
      uri: `${url}/message`,
      body: {
        message,
        groups: [params],
      },
    }).catch((error) => {
      if (error.body && error.body.errorCode === 201409036 && error.statusCode === 409) {
        LoggerProxy.logger.info(`Breakouts#broadcast --> no joined participants`);
      } else {
        throw error;
      }
    });
  }
}

import { REACTION_RELAY_TYPES } from './constants';
import { Reaction, Sender } from './reactions.type';
import Members from '../members/index';

/**
 * @description Meeting Reactions feature.
 * @exports
 * @class Reactions
 */

export default class Reactions {
  members: Members;
  llm: any;
  processEvent: any;

  /**
   * @param {Members} members
   * @param {any} llm
   * @constructor
   * @memberof Reactions
   */
  constructor(members: Members, llm: any) {
    this.members = members;
    this.llm = llm;
  }

  /**
   * Processes reaction and triggers event
   * @param {Reaction} reactionPayload
   * @param {Sender} senderPayload
   * @returns {Object}
   */
  private processReaction = (reactionPayload: Reaction, senderPayload: Sender): Object => {
    const name = this.members.membersCollection.get(senderPayload.participantId).name;
    const processedReaction: Object = {
      reaction: reactionPayload,
      sender: {
        id: senderPayload.participantId,
        name,
      }
    }
    return processedReaction;
  };

  /**
   * Subscribes to send reactions data to given callback as it arrives.
   *
   * @param {Function} callback
   * @returns {void}
   */
  subscribe(callback: Function) {
    this.processEvent = (e: any) => {
      if (e.data.relayType == REACTION_RELAY_TYPES.REACTION) {
        const processedReaction = this.processReaction(e.data.reaction, e.data.sender);
        callback(processedReaction);
      }
    };
    this.llm.on('event:relay.event', this.processEvent);
  }

  /**
   * Unsuscribes from event listener to stop sending reactions data as reaction arrives.
   *
   * @returns {void}
   */
  unsubscribe() {
    this.llm.off('event:relay.event', this.processEvent);
  }
}



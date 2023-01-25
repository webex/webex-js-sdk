/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import {isEmpty} from 'lodash';
// @ts-ignore
import {StatelessWebexPlugin} from '@webex/webex-core';

import {MEETINGS, EVENT_TRIGGERS, FLOOR_ACTION, CONTENT, WHITEBOARD} from '../constants';
import Trigger from '../common/events/trigger-proxy';
import Member from '../member';
import LoggerProxy from '../common/logs/logger-proxy';
import ParameterError from '../common/errors/parameter';

import MembersCollection from './collection';
import MembersRequest from './request';
import MembersUtil from './util';

/**
 * Members Update Event
 * Emitted when something in the roster list needs to be updated
 * @event members:update
 * @instance
 * @property {Object} delta the changes to the members list
 * @property {Array} delta.updated array only the updates, includes removals, as they will have updated status and member properties
 * @property {Array} delta.added array added members to the meeting
 * @property {Array} full array the full members collection
 * @memberof Members
 */

/**
 * Members Content Update Event
 * Emitted when who is sharing changes
 * @event members:content:update
 * @instance
 * @property {String} activeContentSharingId
 * @property {String} endedContentSharingId
 * @memberof Members
 */

/**
 * Members Host Update Event
 * Emitted when who is the host changes
 * @event members:host:update
 * @instance
 * @property {String} activeHostId
 * @property {String} endedHostId
 * @memberof Members
 */

/**
 * Members Self Update Event
 * Emitted when who is the self changes
 * @event members:self:update
 * @instance
 * @property {String} activeSelfId
 * @property {String} endedSelfId
 * @memberof Members
 */

/**
 * @class Members
 */
export default class Members extends StatelessWebexPlugin {
  hostId: any;
  locusUrl: any;
  mediaShareContentId: any;
  mediaShareWhiteboardId: any;
  membersCollection: any;
  membersRequest: any;
  recordingId: any;
  selfId: any;
  type: any;

  namespace = MEETINGS;

  /**
   *
   * @param {Object} attrs
   * @param {Object} options
   * @memberof Members
   */
  constructor(attrs: any, options: object) {
    super({}, options);
    /**
     * The Members Request object to interact with server
     * @instance
     * @type {MembersRequest}
     * @private
     * @memberof Members
     */
    // @ts-ignore
    this.membersRequest = new MembersRequest({}, options);
    /**
     * The Members Collection cache
     * @instance
     * @type {MembersCollection}
     * @private
     * @memberof Members
     */
    this.membersCollection = new MembersCollection();
    /**
     * The current locus url for the active meeting
     * @instance
     * @type {String}
     * @private
     * @memberof Members
     */
    this.locusUrl = attrs.locusUrl || null;
    /**
     * The current hostId for the meeting
     * @instance
     * @type {String}
     * @private
     * @memberof Members
     */
    this.hostId = null;
    /**
     * The current type for the meeting, could be MEETING or CALL
     * @instance
     * @type {String}
     * @private
     * @memberof Members
     */
    this.type = null;
    /**
     * Locus has a self object, sent individually to the client
     * i.e., each person in the call gets their own self object from locus.
     * We need to maintain that self object, because we also get information about all the participants
     * and differentiate those participants from self.
     * The self id shouldnt ever change, but it does have properties that will change
     * and we use values in locus-info, such as to determine if i am admitted to the meeting or not as guest.
     * The current selfId for the meeting
     * @instance
     * @type {String}
     * @private
     * @memberof Members
     */
    this.selfId = null;
    /**
     * The current mediaShareContentId for the meeting
     * @instance
     * @type {String}
     * @private
     * @memberof Members
     */
    this.mediaShareContentId = null;
    /**
     * The current mediaShareWhiteboardId for the meeting
     * @instance
     * @type {String}
     * @private
     * @memberof Members
     */
    this.mediaShareWhiteboardId = null;
    /**
     * The current recordingId for the meeting, if it exists
     * @instance
     * @type {String}
     * @private
     * @memberof Members
     */
    this.recordingId = null;
  }

  /**
   * Internal update the self Id value
   * @param {Object} payload
   * @param {Object} payload.newSelf
   * @param {Object} payload.oldSelf
   * @returns {undefined}
   * @private
   * @memberof Members
   */
  locusSelfUpdate(payload: {newSelf: any; oldSelf: any}) {
    let newSelfId = null;
    let oldSelfId = null;

    if (payload) {
      if (payload.newSelf) {
        newSelfId = payload.newSelf.id;
      }
      if (payload.oldSelf) {
        oldSelfId = payload.oldSelf.id;
      }
    }
    if (newSelfId) {
      const theSelf = this.membersCollection.get(newSelfId);

      if (theSelf) {
        theSelf.setIsSelf(true);
      }
    }
    if (oldSelfId) {
      const notSelf = this.membersCollection.get(oldSelfId);

      if (notSelf) {
        notSelf.setIsSelf(false);
      }
    }
    this.selfId = newSelfId;
    Trigger.trigger(
      this,
      {
        file: 'members',
        function: 'locusSelfUpdate',
      },
      EVENT_TRIGGERS.MEMBERS_SELF_UPDATE,
      {
        activeSelfId: newSelfId,
        endedSelfId: oldSelfId,
      }
    );
  }

  /**
   * Internal update the hostId value
   * @param {Object} payload
   * @param {Object} payload.newHost
   * @param {Object} payload.oldHost
   * @returns {undefined}
   * @private
   * @memberof Members
   */
  locusHostUpdate(payload: {newHost: any; oldHost: any}) {
    let newHostId = null;
    let oldHostId = null;

    if (payload) {
      if (payload.newHost) {
        newHostId = payload.newHost.id;
      }
      if (payload.oldHost) {
        oldHostId = payload.oldHost.id;
      }
    }
    if (newHostId) {
      const theHost = this.membersCollection.get(newHostId);

      if (theHost) {
        theHost.setIsHost(true);
      }
    }
    if (oldHostId) {
      const notHost = this.membersCollection.get(oldHostId);

      if (notHost) {
        notHost.setIsHost(false);
      }
    }
    this.hostId = newHostId;
    Trigger.trigger(
      this,
      {
        file: 'members',
        function: 'locusHostUpdate',
      },
      EVENT_TRIGGERS.MEMBERS_HOST_UPDATE,
      {
        activeHostId: newHostId,
        endedHostId: oldHostId,
      }
    );
  }

  /**
   * when new participant updates come in, both delta and full participants, update them in members collection
   * delta object in the event will have {updated, added} and full will be the full membersCollection
   * @param {Object} payload
   * @param {Object} payload.participants
   * @returns {undefined}
   * @private
   * @memberof Members
   */
  locusParticipantsUpdate(payload: {participants: object}) {
    if (payload) {
      const delta = this.handleLocusInfoUpdatedParticipants(payload);
      const full = this.handleMembersUpdate(delta); // SDK should propagate the full list for both delta and non delta updates

      Trigger.trigger(
        this,
        {
          file: 'members',
          function: 'locusParticipantsUpdate',
        },
        EVENT_TRIGGERS.MEMBERS_UPDATE,
        {
          delta,
          full,
        }
      );
    }
  }

  /**
   * Internal update the content id
   * @param {Object} payload
   * @param {Object} payload.current
   * @param {Object} payload.previous
   * @returns {undefined}
   * @private
   * @memberof Members
   */
  locusMediaSharesUpdate(payload: {current: any; previous: any}) {
    const currentContent = payload.current?.content;
    const previousContent = payload.previous?.content;
    const currentWhiteboard = payload.current?.whiteboard;
    const previousWhiteboard = payload.previous?.whiteboard;
    let whoSharing = null;
    let whoStopped = null;

    if (currentContent?.beneficiaryId) {
      if (currentContent.disposition === FLOOR_ACTION.GRANTED) {
        whoSharing = currentContent.beneficiaryId;
        this.mediaShareWhiteboardId = null;
        this.mediaShareContentId = whoSharing;
      }

      if (previousContent?.disposition === FLOOR_ACTION.GRANTED) {
        if (currentContent.disposition === FLOOR_ACTION.RELEASED) {
          whoStopped = currentContent.beneficiaryId;
          this.mediaShareContentId = null;
        } else if (
          currentContent.disposition === FLOOR_ACTION.GRANTED &&
          currentContent.beneficiaryId !== previousContent.beneficiaryId
        ) {
          whoStopped = previousContent.beneficiaryId;
        }
      }
    }

    if (currentWhiteboard?.beneficiaryId) {
      if (currentWhiteboard.disposition === FLOOR_ACTION.GRANTED) {
        whoSharing = currentWhiteboard.beneficiaryId;
        this.mediaShareContentId = null;
        this.mediaShareWhiteboardId = whoSharing;
      }

      if (previousWhiteboard?.disposition === FLOOR_ACTION.GRANTED) {
        if (currentWhiteboard.disposition === FLOOR_ACTION.RELEASED) {
          whoStopped = currentWhiteboard.beneficiaryId;
          this.mediaShareWhiteboardId = null;
        } else if (
          currentWhiteboard.disposition === FLOOR_ACTION.GRANTED &&
          currentWhiteboard.beneficiaryId !== previousWhiteboard.beneficiaryId
        ) {
          whoStopped = previousWhiteboard.beneficiaryId;
        }
      }
    }

    if (whoSharing) {
      const shareMember = this.membersCollection.get(whoSharing);

      if (shareMember) {
        shareMember.setIsContentSharing(true);
      }
    }
    if (whoStopped) {
      const stopMember = this.membersCollection.get(whoStopped);

      if (stopMember) {
        stopMember.setIsContentSharing(false);
      }
    }

    Trigger.trigger(
      this,
      {
        file: 'members',
        function: 'locusMediaSharesUpdate',
      },
      EVENT_TRIGGERS.MEMBERS_CONTENT_UPDATE,
      {
        activeSharingId: whoSharing,
        endedSharingId: whoStopped,
      }
    );
  }

  /**
   * Internal update the locus url value
   * @param {Object} payload
   * @param {String} payload.locusUrl
   * @returns {undefined}
   * @private
   * @memberof Members
   */
  locusUrlUpdate(payload: any) {
    if (payload) {
      this.setLocusUrl(null, payload);
    }
  }

  /**
   * Internal update the type of meeting
   * @param {Object} payload
   * @param {String} payload.type
   * @returns {undefined}
   * @private
   * @memberof Members
   */
  locusFullStateTypeUpdate(payload: {type: string}) {
    // TODO: at some point there could be a timing issue here, for updating each member
    // ie., if the type changes AND there is no locus update, then each member will not know the type of call
    // which means they cannot determine isMutable && isRemovable
    // for now this scenario is impossible to occur since we always get a locus update when the type changes
    // except for in delta locus meetings, but in that case, the type will always have been set differently
    // from the outset anyway
    if (payload) {
      this.setType(payload);
    }
  }

  /**
   * sets values in the members collection for updated and added properties from delta
   * @param {Object} membersUpdate {updated: [], added: []}
   * @returns {Object} membersCollection
   * @private
   * @memberof Members
   */
  private handleMembersUpdate(membersUpdate: any) {
    if (membersUpdate) {
      if (membersUpdate.updated) {
        this.constructMembers(membersUpdate.updated);
      }
      if (membersUpdate.added) {
        this.constructMembers(membersUpdate.added);
      }
    }

    return this.membersCollection.getAll();
  }

  /**
   * set members to the member collection from each updated/added lists as passed in
   * @param {Array} list
   * @returns {undefined}
   * @private
   * @memberof Members
   */
  private constructMembers(list: Array<any>) {
    list.forEach((member) => {
      this.membersCollection.set(member.id, member);
    });
  }

  /**
   * Internal update the participants value
   * @param {Object} payload
   * @returns {Object}
   * @private
   * @memberof Members
   */
  private handleLocusInfoUpdatedParticipants(payload: any) {
    this.hostId = payload.hostId || this.hostId;
    this.selfId = payload.selfId || this.selfId;
    this.recordingId = payload.recordingId;
    if (!payload.participants) {
      LoggerProxy.logger.warn(
        'Members:index#handleLocusInfoUpdatedParticipants --> participants payload is missing.'
      );
    }
    const memberUpdate = this.update(payload.participants);

    return memberUpdate;
  }

  /**
   * Update the locus Url
   * @param {Object} locus
   * @param {String} [locusUrl] optional, takes precedence
   * @throws {ParameterError}
   * @returns {undefined}
   * @public
   * @memberof Members
   */
  public setLocusUrl(locus: any, locusUrl: string = null) {
    if (locusUrl) {
      this.locusUrl = locusUrl;
    } else if (locus && (locus.locusUrl || locus.url)) {
      this.locusUrl = locus.locusUrl || locus.url;
    } else {
      throw new ParameterError(
        'Setting locusUrl for the Members module should be done with a locus object or locusUrl'
      );
    }
  }

  /**
   * Update the host id
   * @param {Object} locus
   * @param {String} [hostId] optional, takes precedence
   * @throws {ParameterError}
   * @returns {undefined}
   * @public
   * @memberof Members
   */
  public setHostId(locus: any, hostId: string = null) {
    if (hostId) {
      this.hostId = hostId;
    } else if (locus) {
      this.hostId = locus && locus.owner && locus.owner.info ? locus.owner.info : null;
    } else {
      throw new ParameterError(
        'Setting hostid for the Members module should be done with a locus object or hostId'
      );
    }
  }

  /**
   * Update the type
   * @param {Object} fullState
   * @param {String} [type] optional, takes precedence
   * @throws {ParameterError}
   * @returns {undefined}
   * @public
   * @memberof Members
   */
  public setType(fullState: any, type: string = null) {
    if (type) {
      this.type = type;
    } else if (fullState) {
      this.type = (fullState && fullState.type) || null;
    } else {
      throw new ParameterError(
        'Setting type for the Members module should be done with a fullstate object or type string'
      );
    }
  }

  /**
   * Update the self Id
   * @param {Object} locus
   * @param {String} [selfId] optional, takes precedence
   * @throws {Error}
   * @returns {undefined}
   * @memberof Members
   */
  setSelfId(locus: any, selfId: string = null) {
    if (selfId) {
      this.selfId = selfId;
    } else if (locus) {
      this.selfId =
        locus && locus.self && locus.self.person && locus.self.person.id
          ? locus.self.person.id
          : null;
    } else {
      throw new ParameterError(
        'Setting selfid for the Members module should be done with a locus object or selfId'
      );
    }
  }

  /**
   * Update the media share content id
   * @param {Object} locus
   * @param {String} [contentId] optional, takes precedence
   * @throws {Error}
   * @returns {undefined}
   * @memberof Members
   */
  setMediaShareContentId(locus: any, contentId?: string) {
    if (contentId) {
      this.mediaShareContentId = contentId;
    } else if (locus) {
      const contentMediaShare =
        locus.mediaShares &&
        locus.mediaShares.length &&
        locus.mediaShares.find((mediaShare) => mediaShare.name === CONTENT);

      this.mediaShareContentId =
        (contentMediaShare &&
          contentMediaShare.floor &&
          contentMediaShare.floor.beneficiary &&
          contentMediaShare.floor.beneficiary.id) ||
        null;
    } else {
      throw new ParameterError(
        'Setting hostid for the Members module should be done with a locus object or hostId'
      );
    }
  }

  /**
   * Update the media share whiteboard id
   * @param {Object} locus
   * @param {String} [whiteboardId] optional, takes precedence
   * @throws {Error}
   * @returns {undefined}
   * @memberof Members
   */
  setMediaShareWhiteboardId(locus: any, whiteboardId?: string) {
    if (whiteboardId) {
      this.mediaShareWhiteboardId = whiteboardId;
    } else if (locus) {
      const whiteboardMediaShare =
        locus.mediaShares &&
        locus.mediaShares.length &&
        locus.mediaShares.find((mediaShare) => mediaShare.name === WHITEBOARD);

      this.mediaShareWhiteboardId =
        (whiteboardMediaShare &&
          whiteboardMediaShare.floor &&
          whiteboardMediaShare.floor.beneficiary &&
          whiteboardMediaShare.floor.beneficiary.id) ||
        null;
    } else {
      throw new ParameterError(
        'Setting hostid for the Members module should be done with a locus object or hostId'
      );
    }
  }

  /**
   * Find all the updates, and added members
   * Removed/left members will end up in updates
   * Each array contains only members
   * @param {Array} participants the locus participants
   * @returns {Object} {added: {Array}, updated: {Array}}
   * @private
   * @memberof Members
   */
  private update(participants: Array<any>) {
    const membersUpdate = {added: [], updated: []};

    if (participants) {
      participants.forEach((participant) => {
        if (participant.hideInRoster) {
          return;
        }
        const existing = this.membersCollection.get(participant.id);

        if (existing) {
          // TODO: compare existing member to new participant coming in properties and determine if updated (this helps for non delta events)
          // on client re renders, but we will have to determine what values to compare to determine difference, premature optimization
          membersUpdate.updated.push(
            new Member(participant, {
              recordingId: this.recordingId,
              selfId: this.selfId,
              hostId: this.hostId,
              contentSharingId: this.mediaShareContentId,
              whiteboardSharingId: this.mediaShareWhiteboardId,
              type: this.type,
            })
          );
        } else {
          membersUpdate.added.push(
            new Member(participant, {
              recordingId: this.recordingId,
              selfId: this.selfId,
              hostId: this.hostId,
              contentSharingId: this.mediaShareContentId,
              whiteboardSharingId: this.mediaShareWhiteboardId,
              type: this.type,
            })
          );
        }
      });
    }

    return membersUpdate;
  }

  /**
   * Adds a guest Member to the associated meeting
   * @param {String} invitee
   * @param {Boolean} [alertIfActive]
   * @returns {Promise}
   * @memberof Members
   */
  addMember(invitee: any, alertIfActive?: boolean) {
    if (!this.locusUrl) {
      return Promise.reject(
        new ParameterError('The associated locus url for this meeting object must be defined.')
      );
    }
    if (MembersUtil.isInvalidInvitee(invitee)) {
      return Promise.reject(
        new ParameterError(
          'The invitee must be defined with either a valid email, emailAddress or phoneNumber property.'
        )
      );
    }
    const options = MembersUtil.generateAddMemberOptions(invitee, this.locusUrl, alertIfActive);

    return this.membersRequest.addMembers(options);
  }

  /**
   * Cancels an outgoing PSTN call to the associated meeting
   * @param {String} invitee
   * @returns {Promise}
   * @memberof Members
   */
  cancelPhoneInvite(invitee: any) {
    if (!this.locusUrl) {
      return Promise.reject(
        new ParameterError('The associated locus url for this meeting object must be defined.')
      );
    }
    if (MembersUtil.isInvalidInvitee(invitee)) {
      return Promise.reject(
        new ParameterError('The invitee must be defined with a valid phoneNumber property.')
      );
    }
    const options = MembersUtil.cancelPhoneInviteOptions(invitee, this.locusUrl);

    return this.membersRequest.cancelPhoneInvite(options);
  }

  /**
   * Admits waiting members (invited guests to meeting)
   * @param {Array} memberIds
   * @returns {Promise}
   * @public
   * @memberof Members
   */
  public admitMembers(memberIds: Array<any>) {
    if (isEmpty(memberIds)) {
      return Promise.reject(new ParameterError('No member ids provided to admit.'));
    }
    const options = MembersUtil.generateAdmitMemberOptions(memberIds, this.locusUrl);

    return this.membersRequest.admitMember(options);
  }

  /**
   * Removes a member from the meeting
   * @param {String} memberId
   * @returns {Promise}
   * @public
   * @memberof Members
   */
  public removeMember(memberId: string) {
    if (!this.locusUrl) {
      return Promise.reject(
        new ParameterError('The associated locus url for this meeting object must be defined.')
      );
    }
    if (!memberId) {
      return Promise.reject(
        new ParameterError('The member id must be defined to remove the member.')
      );
    }
    const options = MembersUtil.generateRemoveMemberOptions(memberId, this.locusUrl);

    return this.membersRequest.removeMember(options);
  }

  /**
   * Audio mutes another member in a meeting
   * @param {String} memberId
   * @param {boolean} [mute] default true
   * @returns {Promise}
   * @public
   * @memberof Members
   */
  public muteMember(memberId: string, mute = true) {
    if (!this.locusUrl) {
      return Promise.reject(
        new ParameterError(
          'The associated locus url for this meetings members object must be defined.'
        )
      );
    }
    if (!memberId) {
      return Promise.reject(
        new ParameterError('The member id must be defined to mute the member.')
      );
    }
    const options = MembersUtil.generateMuteMemberOptions(memberId, mute, this.locusUrl);

    return this.membersRequest.muteMember(options);
  }

  /**
   * Raise or lower the hand of a member in a meeting
   * @param {String} memberId
   * @param {boolean} [raise] - to raise hand (=true) or lower (=false), default: true
   * @returns {Promise}
   * @public
   * @memberof Members
   */
  public raiseOrLowerHand(memberId: string, raise = true) {
    if (!this.locusUrl) {
      return Promise.reject(
        new ParameterError(
          'The associated locus url for this meetings members object must be defined.'
        )
      );
    }
    if (!memberId) {
      return Promise.reject(
        new ParameterError('The member id must be defined to raise/lower the hand of the member.')
      );
    }
    const options = MembersUtil.generateRaiseHandMemberOptions(memberId, raise, this.locusUrl);

    return this.membersRequest.raiseOrLowerHandMember(options);
  }

  /**
   * Lower all hands of members in a meeting
   * @param {String} requestingMemberId - id of the participant which requested the lower all hands
   * @returns {Promise}
   * @public
   * @memberof Members
   */
  public lowerAllHands(requestingMemberId: string) {
    if (!this.locusUrl) {
      return Promise.reject(
        new ParameterError(
          'The associated locus url for this meetings members object must be defined.'
        )
      );
    }
    if (!requestingMemberId) {
      return Promise.reject(
        new ParameterError(
          'The requestingMemberId must be defined to lower all hands in a meeting.'
        )
      );
    }
    const options = MembersUtil.generateLowerAllHandsMemberOptions(
      requestingMemberId,
      this.locusUrl
    );

    return this.membersRequest.lowerAllHandsMember(options);
  }

  /**
   * Transfers the host to another member
   * @param {String} memberId
   * @param {boolean} [moderator] default true
   * @returns {Promise}
   * @public
   * @memberof Members
   */
  public transferHostToMember(memberId: string, moderator = true) {
    if (!this.locusUrl) {
      return Promise.reject(
        new ParameterError(
          'The associated locus url for this meetings members object must be defined.'
        )
      );
    }
    if (!memberId) {
      return Promise.reject(
        new ParameterError('The member id must be defined to transfer host to the member.')
      );
    }
    const options = MembersUtil.generateTransferHostMemberOptions(
      memberId,
      moderator,
      this.locusUrl
    );

    return this.membersRequest.transferHostToMember(options);
  }

  /**
   * Sends DTMF tones for the PSTN member of a meeting
   * @param {String} tones a string of one or more DTMF tones to send
   * @param {String} memberId member id
   * @returns {Promise}
   * @public
   * @memberof Members
   */
  public sendDialPadKey(tones = '', memberId = '') {
    // @ts-ignore
    if (!tones && tones !== 0) {
      return Promise.reject(new ParameterError('DMTF tones must be passed in'));
    }

    const member = this.membersCollection.get(memberId);

    if (!member) {
      return Promise.reject(new ParameterError('there is no member associated with that Id'));
    }

    const {locusUrl} = this;

    const deviceArray = member.participant.devices;
    const device = deviceArray.find(({deviceType}) => deviceType === 'SIP');
    const url = device?.url;

    if (locusUrl && url) {
      const options = MembersUtil.genderateSendDTMFOptions(url, tones, memberId, locusUrl);

      return this.membersRequest.sendDialPadKey(options);
    }

    return Promise.reject(
      new Error(
        'Members:index#sendDialPadKey --> cannot send DTMF, meeting does not have a connection to the "locus" call control service.'
      )
    );
  }
}

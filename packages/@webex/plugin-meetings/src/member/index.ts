/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import {MEETINGS, _IN_LOBBY_, _NOT_IN_MEETING_, _IN_MEETING_} from '../constants';
import {IMediaStatus} from './member.types';

import MemberUtil from './util';

/**
 * @class Member
 */
export default class Member {
  associatedUser: any;
  id: any;
  isAudioMuted: any;
  isContentSharing: any;
  isDevice: any;
  isGuest: any;
  isHandRaised: any;
  isHost: any;
  isInLobby: any;
  isInMeeting: any;
  isModerator: any;
  isModeratorAssignmentProhibited: any;
  isMutable: any;
  isNotAdmitted: any;
  isRecording: any;
  isRemovable: any;
  isSelf: any;
  isUser: any;
  isVideoMuted: any;
  mediaStatus: IMediaStatus;
  name: any;
  participant: any;
  status: any;
  type: any;
  namespace = MEETINGS;

  /**
   * @param {Object} participant - the locus participant
   * @param {Object} [options] - constructor params
   * @param {String} options.selfId
   * @param {String} options.hostId
   * @param {String} options.contentSharingId
   * @param {String} options.type
   * @returns {Member}
   * @memberof Member
   */
  constructor(
    participant: object,
    options:
      | {
          selfId: string;
          hostId: string;
          contentSharingId: string;
          type: string;
        }
      | any = {}
  ) {
    /**
     * The server participant object
     * @instance
     * @type {Object}
     * @private
     * @memberof Member
     */
    this.participant = null;
    /**
     * The member id
     * @instance
     * @type {String}
     * @public
     * @memberof Member
     */
    this.id = null;
    /**
     * The member name
     * @instance
     * @type {String}
     * @public
     * @memberof Member
     */
    this.name = null;
    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.isAudioMuted = null;
    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.isVideoMuted = null;
    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.isHandRaised = null;
    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.isSelf = null;
    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.isHost = null;
    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.isGuest = null;
    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.isInLobby = null;
    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.isInMeeting = null;
    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.isNotAdmitted = null;
    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.isContentSharing = null;
    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.status = null;
    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.isDevice = null;
    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.isUser = null;
    /**
     * Is this member associated to another user by way of pairing (typical of devices)
     * @instance
     * @type {String}
     * @public
     * @memberof Member
     */
    this.associatedUser = null;
    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.isRecording = null;
    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.isMutable = null;
    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.isRemovable = null;
    /**
     * @instance
     * @type {String}
     * @private
     * @memberof Member
     */
    this.type = null;
    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.isModerator = null;
    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.isModeratorAssignmentProhibited = null;
    /**
     * @instance
     * @type {IMediaStatus}
     * @public
     * @memberof Member
     * @example {audio: MediaStatus.RECVONLY, video: MediaStatus.SENDRECV}
     */
    this.mediaStatus = {
      audio: null,
      video: null,
    };
    // TODO: more participant types
    // such as native client, web client, is a device, what type of phone, etc
    this.processParticipant(participant);
    this.processParticipantOptions(participant, options);
    this.processMember();
  }

  /**
   * set all the participant values extracted directly from locus participant
   * @param {Object} participant the locus participant object
   * @returns {undefined}
   * @private
   * @memberof Member
   */
  private processParticipant(participant: object) {
    this.participant = participant;
    if (participant) {
      this.id = MemberUtil.extractId(participant);
      this.name = MemberUtil.extractName(participant);
      this.isAudioMuted = MemberUtil.isAudioMuted(participant);
      this.isVideoMuted = MemberUtil.isVideoMuted(participant);
      this.isHandRaised = MemberUtil.isHandRaised(participant);
      this.isGuest = MemberUtil.isGuest(participant);
      this.isUser = MemberUtil.isUser(participant);
      this.isDevice = MemberUtil.isDevice(participant);
      this.isModerator = MemberUtil.isModerator(participant);
      this.isModeratorAssignmentProhibited =
        MemberUtil.isModeratorAssignmentProhibited(participant);
      this.processStatus(participant);
      // must be done last
      this.isNotAdmitted = MemberUtil.isNotAdmitted(participant, this.isGuest, this.status);
    }
  }

  /**
   * Use the members options and participant values to set on the member
   * @param {Object} participant the locus participant object
   * @param {Object} options the passed in options, what was set on members
   * @returns {undefined}
   * @private
   * @memberof Member
   */
  private processParticipantOptions(participant: object, options: any) {
    if (participant && options) {
      this.processIsSelf(participant, options.selfId);
      this.processIsHost(participant, options.hostId);
      this.processIsContentSharing(participant, options.contentSharingId);
      this.processType(options.type);
      this.processIsRecording(participant, options.recordingId);
    }
  }

  /**
   * processes what already exists on the member to determine other info about the member
   * @returns {undefined}
   * @private
   * @memberof Member
   */
  private processMember() {
    // must occur after self, guest, meeting, and type properties are calculated
    this.isRemovable = MemberUtil.isRemovable(
      this.isSelf,
      this.isGuest,
      this.isInMeeting,
      this.type
    );
    // must occur after self, device, meeting, mute status, and type properties are calculated
    this.isMutable = MemberUtil.isMutable(
      this.isSelf,
      this.isDevice,
      this.isInMeeting,
      this.isAudioMuted,
      this.type
    );

    this.mediaStatus = MemberUtil.extractMediaStatus(this.participant);
  }

  /**
   * set the status on member object
   * @param {Object} participant the locus participant object
   * @returns {undefined}
   * @private
   * @memberof Member
   */
  private processStatus(participant: object) {
    this.status = MemberUtil.extractStatus(participant);
    switch (this.status) {
      case _IN_LOBBY_:
        this.isInLobby = true;
        this.isInMeeting = false;
        break;
      case _IN_MEETING_:
        this.isInLobby = false;
        this.isInMeeting = true;
        break;
      case _NOT_IN_MEETING_:
        this.isInLobby = false;
        this.isInMeeting = false;
        break;
      default:
        this.isInLobby = false;
        this.isInMeeting = false;
    }
  }

  /**
   * set the isContentSharing on member
   * @param {Boolean} flag
   * @returns {undefined}
   * @public
   * @memberof Member
   */
  public setIsContentSharing(flag: boolean) {
    this.isContentSharing = flag;
  }

  /**
   * set the isHost on member
   * @param {Boolean} flag
   * @returns {undefined}
   * @public
   * @memberof Member
   */
  public setIsHost(flag: boolean) {
    this.isHost = flag;
  }

  /**
   * set the isSelf on member
   * @param {Boolean} flag
   * @returns {undefined}
   * @public
   * @memberof Member
   */
  public setIsSelf(flag: boolean) {
    this.isSelf = flag;
  }

  /**
   * determine if this member is content sharing
   * @param {Object} participant
   * @param {String} sharingId
   * @returns {undefined}
   * @public
   * @memberof Member
   */
  public processIsContentSharing(participant: object, sharingId: string) {
    if (MemberUtil.isUser(participant)) {
      this.isContentSharing = MemberUtil.isSame(participant, sharingId);
    } else if (MemberUtil.isDevice(participant)) {
      this.isContentSharing = MemberUtil.isAssociatedSame(participant, sharingId);
    }
  }

  /**
   * Determine if this member is recording
   * @param {Object} participant
   * @param {String} recordingId
   * @returns {undefined}
   * @public
   * @memberof Member
   */
  public processIsRecording(participant: object, recordingId: string) {
    this.isRecording = MemberUtil.isSame(participant, recordingId);
  }

  /**
   * determine if this member is the self
   * @param {Object} participant
   * @param {String} selfId
   * @returns {undefined}
   * @private
   * @memberof Member
   */
  private processIsSelf(participant: object, selfId: string) {
    if (MemberUtil.isUser(participant)) {
      this.isSelf = MemberUtil.isSame(participant, selfId);
    } else if (MemberUtil.isDevice(participant)) {
      this.isSelf = MemberUtil.isAssociatedSame(participant, selfId);
      this.associatedUser = selfId;
    }
  }

  /**
   * determine if this member is the host
   * @param {Object} participant
   * @param {String} hostId
   * @returns {undefined}
   * @private
   * @memberof Member
   */
  private processIsHost(participant: object, hostId: string) {
    if (MemberUtil.isUser(participant)) {
      this.isHost = MemberUtil.isSame(participant, hostId);
    } else if (MemberUtil.isDevice(participant)) {
      this.isHost = MemberUtil.isAssociatedSame(participant, hostId);
    }
  }

  /**
   * set the type for the member, could be MEETING or CALL
   * @param {String} type
   * @returns {undefined}
   * @private
   * @memberof Member
   */
  private processType(type: string) {
    this.type = type;
  }
}

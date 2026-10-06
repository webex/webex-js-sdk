/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import {MEETINGS, _IN_LOBBY_, _NOT_IN_MEETING_, _IN_MEETING_, _OBSERVE_} from '../constants';
import {E2eeValidationResult} from '../e2ee/types';
import type {E2eeDeviceVerification, E2eeMemberVerificationState} from '../e2ee/types';
import {IExternalRoles, IMediaStatus, Participant, ParticipantUrl} from './types';

import MemberUtil from './util';

export type MemberId = string;
/**
 * @class Member
 */
export default class Member {
  associatedUser: MemberId | null; // deprecated, use associatedUsers instead
  associatedUsers: Set<MemberId>; // users associated with this device, empty if this member is not a device
  canApproveAIEnablement: boolean;
  canReclaimHost: boolean;
  id: MemberId;
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
  isPresenterAssignmentProhibited: any;
  isAttendeeAssignmentProhibited: any;
  isMutable: any;
  isNotAdmitted: any;
  isRecording: any;
  isRemovable: any;
  isSelf: any;
  isPairedWithSelf: boolean; // true for a device that we are paired with
  isBrb: boolean;
  isUser: any;
  isVideoMuted: any;
  roles: IExternalRoles;
  mediaStatus: IMediaStatus;
  name: any;
  participant: any;
  status: any;
  supportsBreakouts: boolean;
  supportsInterpretation: boolean;
  supportsSingleUserAutoEndMeeting: boolean;
  supportLiveAnnotation: boolean;
  type: any;
  namespace = MEETINGS;
  pairedWith: {
    participantUrl?: ParticipantUrl;
    memberId?: MemberId;
  };

  // Per-device E2EE verification, keyed by device URL, applied by the E2EE roster reconciler.
  e2eeDeviceVerifications: Map<string, E2eeDeviceVerification>;
  e2eeVerificationState: E2eeMemberVerificationState;

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
    participant: Participant,
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
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.canReclaimHost = false;
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
    this.supportsBreakouts = null;
    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.supportsSingleUserAutoEndMeeting = null;
    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.supportLiveAnnotation = null;
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
     * Deprecated: use associatedUsers instead
     * Is this member associated to another user by way of pairing (typical of devices)
     * @instance
     * @type {MemberId|null}
     * @deprecated
     * @public
     * @memberof Member
     */
    this.associatedUser = null;
    /**
     * Is this member associated to another user by way of pairing (typical of devices)
     * @instance
     * @type {String}
     * @public
     * @memberof Member
     */
    this.associatedUsers = new Set<MemberId>();
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
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.isBrb = false;
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
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.isPresenterAssignmentProhibited = null;

    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.isAttendeeAssignmentProhibited = null;

    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.canApproveAIEnablement = null;

    /**
     * @instance
     * @type {Boolean}
     * @public
     * @memberof Member
     */
    this.isPairedWithSelf = false;

    /**
     * @instance
     * @type {IExternalRoles}
     * @public
     * @memberof Member
     */
    this.roles = null;

    this.pairedWith = {
      participantUrl: undefined,
      memberId: undefined,
    };
    this.e2eeDeviceVerifications = new Map();
    this.e2eeVerificationState = 'unknown';
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
  private processParticipant(participant: Participant) {
    this.participant = participant;
    if (participant) {
      this.processPairedDevice(participant);
      this.canReclaimHost = MemberUtil.canReclaimHost(participant);
      this.id = MemberUtil.extractId(participant);
      this.name = MemberUtil.extractName(participant);
      this.isAudioMuted = MemberUtil.isAudioMuted(participant);
      this.isVideoMuted = MemberUtil.isVideoMuted(participant);
      this.isHandRaised = MemberUtil.isHandRaised(participant);
      this.supportsBreakouts = MemberUtil.isBreakoutsSupported(participant);
      this.supportsSingleUserAutoEndMeeting =
        MemberUtil.isSupportsSingleUserAutoEndMeeting(participant);
      this.supportsInterpretation = MemberUtil.isInterpretationSupported(participant);
      this.supportLiveAnnotation = MemberUtil.isLiveAnnotationSupported(participant);
      this.isGuest = MemberUtil.isGuest(participant);
      this.isBrb = MemberUtil.isBrb(participant);
      this.isUser = MemberUtil.isUser(participant);
      this.isDevice = MemberUtil.isDevice(participant);
      this.isModerator = MemberUtil.isModerator(participant);
      this.isModeratorAssignmentProhibited =
        MemberUtil.isModeratorAssignmentProhibited(participant);
      this.isPresenterAssignmentProhibited =
        MemberUtil.isPresenterAssignmentProhibited(participant);
      this.isAttendeeAssignmentProhibited = MemberUtil.isAttendeeAssignmentProhibited(participant);
      this.canApproveAIEnablement = MemberUtil.canApproveAIEnablement(participant);
      this.processStatus(participant);
      this.processRoles(participant);
      // must be done last
      this.isNotAdmitted = MemberUtil.isNotAdmitted(participant, this.isGuest, this.status);
    }
  }

  /**
   * Checks if the participant is paired with another device
   *
   * @param {any} participant the locus participant object
   * @returns {void}
   */
  processPairedDevice(participant: Participant) {
    // we can't populate this.pairedWith.memberId here because the member for that device might not yet exist
    // so only populating the participantUrl and memberId will be set later
    this.pairedWith.participantUrl = MemberUtil.extractPairedWithParticipantUrl(participant);
  }

  /**
   * Use the members options and participant values to set on the member
   * @param {Object} participant the locus participant object
   * @param {Object} options the passed in options, what was set on members
   * @returns {undefined}
   * @private
   * @memberof Member
   */
  private processParticipantOptions(participant: Participant, options: any) {
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
  private processStatus(participant: Participant) {
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
   * Replaces this member's per-device E2EE verifications and recomputes the aggregate state.
   * Called by the E2EE roster reconciler; a member with no matching MLS roster devices is reset.
   * @param {E2eeDeviceVerification[]} verifications
   * @returns {undefined}
   * @public
   * @memberof Member
   */
  public setE2eeDeviceVerifications(verifications: E2eeDeviceVerification[]) {
    this.e2eeDeviceVerifications = new Map(
      verifications.map((verification) => [verification.deviceUrl, verification])
    );
    this.recomputeE2eeVerificationState();
  }

  /**
   * Upserts the verification for a single device and recomputes the aggregate state.
   * @param {String} deviceUrl
   * @param {E2eeDeviceVerification} verification
   * @returns {boolean} whether the verification actually changed.
   * @public
   * @memberof Member
   */
  public setE2eeDeviceVerification(
    deviceUrl: string,
    verification: E2eeDeviceVerification
  ): boolean {
    const previous = this.e2eeDeviceVerifications.get(deviceUrl);

    if (previous && JSON.stringify(previous) === JSON.stringify(verification)) {
      return false;
    }

    this.e2eeDeviceVerifications.set(deviceUrl, verification);
    this.recomputeE2eeVerificationState();

    return true;
  }

  /**
   * Removes the verification for a single device and recomputes the aggregate state.
   * @param {String} deviceUrl
   * @returns {boolean} whether a verification was actually removed.
   * @public
   * @memberof Member
   */
  public removeE2eeDeviceVerification(deviceUrl: string): boolean {
    if (!this.e2eeDeviceVerifications.has(deviceUrl)) {
      return false;
    }

    this.e2eeDeviceVerifications.delete(deviceUrl);
    this.recomputeE2eeVerificationState();

    return true;
  }

  /**
   * @param {String} deviceUrl
   * @returns {E2eeDeviceVerification | undefined} the verification for a single device.
   * @public
   * @memberof Member
   */
  public getE2eeDeviceVerification(deviceUrl: string): E2eeDeviceVerification | undefined {
    return this.e2eeDeviceVerifications.get(deviceUrl);
  }

  /**
   * @returns {E2eeDeviceVerification[]} all per-device verifications for this member.
   * @public
   * @memberof Member
   */
  public getE2eeDeviceVerifications(): E2eeDeviceVerification[] {
    return Array.from(this.e2eeDeviceVerifications.values());
  }

  /**
   * Recomputes the aggregate E2EE verification state from the per-device verifications:
   * `verified` (all devices verified), `unverified` (none), `partiallyVerified` (some), or
   * `unknown` (no devices present in the MLS roster yet).
   * @returns {undefined}
   * @private
   * @memberof Member
   */
  private recomputeE2eeVerificationState() {
    const verifications = this.getE2eeDeviceVerifications();

    if (verifications.length === 0) {
      this.e2eeVerificationState = 'unknown';

      return;
    }

    const verifiedCount = verifications.filter(
      (verification) => verification.validationResult === E2eeValidationResult.Success
    ).length;

    if (verifiedCount === verifications.length) {
      this.e2eeVerificationState = 'verified';
    } else if (verifiedCount === 0) {
      this.e2eeVerificationState = 'unverified';
    } else {
      this.e2eeVerificationState = 'partiallyVerified';
    }
  }

  /**
   * determine if this member is content sharing
   * @param {Object} participant
   * @param {String} sharingId
   * @returns {undefined}
   * @public
   * @memberof Member
   */
  public processIsContentSharing(participant: Participant, sharingId: string) {
    if (MemberUtil.isUser(participant)) {
      this.isContentSharing = MemberUtil.isSame(participant, sharingId);
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
  public processIsRecording(participant: Participant, recordingId: string) {
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
  private processIsSelf(participant: Participant, selfId: string) {
    if (MemberUtil.isUser(participant)) {
      this.isSelf = MemberUtil.isSame(participant, selfId);
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
  private processIsHost(participant: Participant, hostId: string) {
    if (MemberUtil.isUser(participant)) {
      this.isHost = MemberUtil.isSame(participant, hostId);
    }
  }

  /**
   * process the roles that have been applied to this member
   * @param {Object} participant
   * @returns {undefined}
   * @private
   * @memberof Member
   */
  private processRoles(participant: Participant) {
    this.roles = MemberUtil.extractControlRoles(participant);
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

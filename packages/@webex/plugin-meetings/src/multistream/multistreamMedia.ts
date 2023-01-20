/* eslint-disable import/prefer-default-export */

import {AUDIO, VIDEO} from '../constants';
import createMuteState from '../meeting/muteState';
import Meeting from '../meeting';

/**
 * Class wrapping all the multistream specific APIs that need to be exposed at meeting level.
 *
 */
export class MultistreamMedia {
  private meeting: Meeting;

  /**
   * Constructor
   * @param {Meeting} meeting
   */
  constructor(meeting: Meeting) {
    this.meeting = meeting;
  }

  // eslint-disable-next-line valid-jsdoc
  /**
   * throws if we don't have a media connection created
   */
  private checkMediaConnection() {
    if (this.meeting?.mediaProperties?.webrtcMediaConnection) {
      return;
    }
    throw new Error('Webrtc media connection is missing');
  }

  /**
   * Publishes a local track in the meeting
   *
   * @param {MediaStreamTrack} track
   * @returns {Promise}
   */
  publishTrack(track: MediaStreamTrack): Promise<void> {
    this.checkMediaConnection();

    /* todo: for now we don't support screen share (waiting for server to support bundling, see SPARK-377812)
       for sharing:
          we have to call meeting.stopFloorRequest() before unpublishing a track
          we have to call meeting.share() after publishing a track
    */

    // todo: depending on how muting is done with Local tracks, this code here might need to change...

    if (track.kind === 'audio') {
      this.meeting.setLocalAudioTrack(track);
      this.meeting.mediaProperties.mediaDirection.sendAudio = true;

      // audio state could be undefined if you have not sent audio before
      this.meeting.audio =
        this.meeting.audio ||
        createMuteState(AUDIO, this.meeting, this.meeting.mediaProperties.mediaDirection);
    } else if (track.kind === 'video') {
      this.meeting.setLocalVideoTrack(track);
      this.meeting.mediaProperties.mediaDirection.sendVideo = true;

      // video state could be undefined if you have not sent video before
      this.meeting.video =
        this.meeting.video ||
        createMuteState(VIDEO, this.meeting, this.meeting.mediaProperties.mediaDirection);
    }

    return this.meeting.mediaProperties.webrtcMediaConnection.publishTrack(track);
  }

  /**
   * Unpublishes a local track in the meeting
   *
   * @param {MediaStreamTrack} track
   * @returns {Promise}
   */
  unpublishTrack(track: MediaStreamTrack): Promise<void> {
    // todo: see todos in publishTrack() - they all apply here too:
    // screen sharing - SPARK-377812
    // muting etc

    if (track.kind === 'audio') {
      this.meeting.setLocalVideoTrack(null);
      this.meeting.mediaProperties.mediaDirection.sendAudio = false;
    } else if (track.kind === 'video') {
      this.meeting.setLocalAudioTrack(null);
      this.meeting.mediaProperties.mediaDirection.sendVideo = false;
    }
    this.checkMediaConnection();

    return this.meeting.mediaProperties.webrtcMediaConnection.unpublishTrack(track);
  }
}

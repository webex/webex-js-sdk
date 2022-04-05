import {isEqual} from 'lodash';

const ControlsUtils = {};

/**
 * Controls
 * @typedef {Object} LocusControls
 * @property {Object} record
 * @property {Boolean} record.recording
 * @property {Object} record.meta
 * @property {String} record.meta.modifiedBy
 */

/**
 * parse the relevant host values that we care about: id
 * @param {LocusControls} controls
 * @returns {Object} parsedObject - parsed host or null if host was undefined
 * @returns {String} parsedObject.recordingId
 */
ControlsUtils.parse = (controls) => {
  const parsedControls = {...controls};

  if (controls && controls.record) {
    parsedControls.record = {
      modifiedBy: ControlsUtils.getId(controls),
      paused: controls.record.paused ? controls.record.paused : false,
      recording: controls.record.recording,
      lastModified: controls.record.meta.lastModified
    };
  }

  if (controls && controls.meetingContainer) {
    parsedControls.meetingContainer = {
      meetingContainerUrl: controls.meetingContainer.meetingContainerUrl
    };
  }

  if (controls && controls.transcribe) {
    parsedControls.transcribe = {
      transcribing: controls.transcribe.transcribing,
      caption: controls.transcribe.caption
    };
  }

  return parsedControls;
};

/**
 * parses and returns previous state vs current state and triggers the changes.
 * @param {LocusControl} oldControls previous state
 * @param {LocusControl} newControls current state
 * @returns {Object} combination of state plus the changes
 */
ControlsUtils.getControls = (oldControls, newControls) => {
  const previous = ControlsUtils.parse(oldControls);
  const current = ControlsUtils.parse(newControls);

  return {
    previous,
    current,
    updates: {
      hasRecordingPausedChanged: current?.record &&
      !isEqual(previous?.record?.paused, current.record.paused) &&
      (previous?.record?.recording || current?.record?.recording), // see comments directly below

      hasRecordingChanged: current?.record &&
      !isEqual(previous?.record?.recording, current?.record?.recording) && // upon first join, previous?.record?.recording = undefined; thus, never going to be equal and will always return true
      (previous?.record?.recording || current?.record?.recording), // therefore, condition added to prevent false firings of #meeting:recording:stopped upon first joining a meeting

      hasMeetingContainerChanged: current?.meetingContainer &&
        !isEqual(previous?.meetingContainer?.meetingContainerUrl,
          current?.meetingContainer?.meetingContainerUrl),

      hasTranscribeChanged: current?.transcribe &&
          !isEqual(previous?.transcribe?.transcribing, current?.transcribe?.transcribing) && // upon first join, previous?.record?.recording = undefined; thus, never going to be equal and will always return true
          (previous?.transcribe?.transcribing || current?.transcribe?.transcribing), // therefore, condition added to prevent false firings of #meeting:recording:stopped upon first joining a meeting
    }
  };
};

/**
 * Extract the id from the record controls object
 * @param {LocusControls} controls
 * @returns {String|null}
 */
ControlsUtils.getId = (controls) => {
  if (controls.record.meta) {
    return controls.record.meta.modifiedBy;
  }

  return null;
};

export default ControlsUtils;

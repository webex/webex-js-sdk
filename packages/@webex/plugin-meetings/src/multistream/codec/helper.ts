import {SupportedResolution} from '@webex/internal-media-core';
import {MAX_FS_VALUES} from '../remoteMedia';

/**
 * Returns the resolution for a given frame size
 * @param {number} frameSize - The frame size to get the resolution for
 * @returns {SupportedResolution} The resolution
 */
export default function getResolutionForFrameSize(frameSize: number): SupportedResolution {
  let resolution: SupportedResolution;

  if (frameSize <= MAX_FS_VALUES['90p']) {
    resolution = '90p';
  } else if (frameSize <= MAX_FS_VALUES['180p']) {
    resolution = '180p';
  } else if (frameSize <= MAX_FS_VALUES['360p']) {
    resolution = '360p';
  } else if (frameSize <= MAX_FS_VALUES['540p']) {
    resolution = '540p';
  } else if (frameSize <= MAX_FS_VALUES['720p']) {
    resolution = '720p';
  } else {
    resolution = '1080p';
  }

  return resolution;
}

import {VideoDeviceConstraints} from '@webex/internal-media-core';

export enum FacingMode {
  user = 'user',
  environment = 'environment',
}

// can be used later on when we add constraints in create display track
export enum DisplaySurface {
  browser = 'browser',
  monitor = 'monitor',
  window = 'window',
}

export const PresetCameraConstraints: {[key: string]: VideoDeviceConstraints} = {
  '1080p': {frameRate: 30, width: 1920, height: 1080},

  '720p': {frameRate: 30, width: 1280, height: 720},

  '480p': {frameRate: 30, width: 640, height: 480},

  '360p': {frameRate: 30, width: 640, height: 360},

  '240p': {frameRate: 30, width: 320, height: 240},

  '180p': {frameRate: 30, width: 320, height: 180},

  '120p': {frameRate: 30, width: 160, height: 120},
};

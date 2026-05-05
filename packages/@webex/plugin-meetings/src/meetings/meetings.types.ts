import type {
  NoiseReductionEffectOptions,
  VirtualBackgroundEffectOptions,
} from '@webex/media-helpers';
import {Enum} from '../constants';

type INoiseReductionEffect = Omit<
  NoiseReductionEffectOptions,
  'authToken' | 'workletProcessorUrl' | 'legacyProcessorUrl'
>;
type IVirtualBackgroundEffect = Omit<VirtualBackgroundEffectOptions, 'authToken'>;

export type {INoiseReductionEffect, IVirtualBackgroundEffect};

export const MEETING_KEY = {
  CONVERSATION_URL: 'conversationUrl',
  SIP_URI: 'sipUri',
  LOCUS_URL: 'locusUrl',
  MEETINGNUMBER: 'meetingNumber',
  CORRELATION_ID: 'correlationId',
} as const;

export type MEETING_KEY = Enum<typeof MEETING_KEY>;

// finer grained status for registration steps
export type MeetingRegistrationStatus = {
  fetchWebexSite: boolean;
  getGeoHint: boolean;
  startReachability: boolean;
  deviceRegister: boolean;
  mercuryConnect: boolean;
  checkH264Support: boolean;
};

export type SitePreferencesSelect = string[] | string;

export type GetSitePreferencesOptions = {
  siteUrl?: string;
  select?: SitePreferencesSelect;
  siteName?: string;
};

export type SitePreferencesResponse = {
  pmr?: Record<string, unknown>;
  audioVideo?: Record<string, unknown>;
  scheduling?: {
    supportScheduleWebinar?: boolean;
    webinarWebLink?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

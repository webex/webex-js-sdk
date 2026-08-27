import type {
  NoiseReductionEffectOptions,
  VirtualBackgroundEffectOptions,
} from '@webex/media-helpers';
import type MeetingInfoV2 from '../meeting-info/meeting-info-v2';
import {DESTINATION_TYPE, Enum} from '../constants';

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

export enum SitePreferenceSelectOption {
  SCHEDULING = 'scheduling',
}

export type FetchSitePreferencesMeViaSiteOptions = {
  siteUrl?: string;
  siteName?: string;
  selectOptions?: SitePreferenceSelectOption[];
};

export const DEFAULT_SITE_PREFERENCE_SELECT_OPTIONS = [SitePreferenceSelectOption.SCHEDULING];

export type SitePreferencesResponse = {
  scheduling?: {
    supportScheduleWebinar?: boolean;
    webinarWebLink?: string;
  };
};

type PreJoinCallState = {
  correlationId: string;
  sessionCorrelationId?: string;
};

export type PrefetchMeetingInfoParams = {
  destination: any;
  type?: DESTINATION_TYPE;
  extraParams?: Record<string, any>;
  callStateForMetrics: PreJoinCallState;
  classificationId?: string;
};

export type PrefetchedMeetingInfo = {
  request: Promise<any>;
  provider: MeetingInfoV2;
  extraParams: Record<string, any>;
  classificationId?: string;
  sendCAevents: boolean;
};

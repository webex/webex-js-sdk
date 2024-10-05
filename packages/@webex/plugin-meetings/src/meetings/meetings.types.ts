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

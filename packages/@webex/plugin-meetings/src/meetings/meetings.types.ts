import type {
  NoiseReductionEffectOptions,
  VirtualBackgroundEffectOptions,
} from '@webex/media-helpers';

type INoiseReductionEffect = Omit<NoiseReductionEffectOptions, 'authToken'>;
type IVirtualBackgroundEffect = Omit<VirtualBackgroundEffectOptions, 'authToken'>;

export type {INoiseReductionEffect, IVirtualBackgroundEffect};

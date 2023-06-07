import {Control} from './enums';

export interface ControlProperties {
  /**
   * A list of additional properties that apply to various specific settings.
   *
   * @remarks
   * The values stored here, per the service, are fully ambiguous, an can vary
   * depending on which control scope is being configured.
   */
  [key: string]: boolean;
}

export interface AudioProperties {
  muted?: boolean;
  disallowUnmute?: boolean;
  muteOnEntry?: boolean;
}

export interface RaiseHandProperties {
  enabled?: boolean;
}

export interface ReactionsProperties {
  enabled?: boolean;
  showDisplayNameWithReactions?: boolean;
}

export interface ShareControlProperties {
  control?: 'ANYONE' | 'MODERATOR_PRESENTER';
}

export interface VideoProperties {
  enabled?: boolean;
}

export interface ViewTheParticipantListProperties {
  enabled?: boolean;
}

export type Properties =
  | AudioProperties
  | RaiseHandProperties
  | ReactionsProperties
  | ShareControlProperties
  | VideoProperties
  | ViewTheParticipantListProperties;

export interface ControlConfig<Props = Properties> {
  /**
   * The scope of the control within this object.
   */
  scope: Control;

  /**
   * The properties to assign to this control.
   */
  properties: Props;
}

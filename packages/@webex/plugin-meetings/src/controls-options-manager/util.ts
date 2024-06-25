import {DISPLAY_HINTS} from '../constants';
import {Control} from './enums';
import {
  ControlConfig,
  AudioProperties,
  RaiseHandProperties,
  ReactionsProperties,
  ViewTheParticipantListProperties,
  VideoProperties,
} from './types';

/**
 * The Controls Options Manager utilities
 *
 * @internal
 */
class Utils {
  /**
   * Validate if enabling mute on entry can be set.
   *
   * @param {Array<string>} displayHints - Display Hints to use when validating.
   * @returns {boolean} - True if the action is allowed.
   */
  public static canSetMuteOnEntry(displayHints: Array<string>): boolean {
    return displayHints.includes(DISPLAY_HINTS.ENABLE_MUTE_ON_ENTRY);
  }

  /**
   * Validate if allowing unmuting can be set.
   *
   * @param {Array<string>} displayHints - Display Hints to use when validating.
   * @returns {boolean} - True if the action is allowed.
   */
  public static canSetDisallowUnmute(displayHints: Array<string>): boolean {
    return displayHints.includes(DISPLAY_HINTS.ENABLE_HARD_MUTE);
  }

  /**
   * Validate if disabling mute on entry can be set.
   *
   * @param {Array<string>} displayHints - Display Hints to use when validating.
   * @returns {boolean} - True if the action is allowed.
   */
  public static canUnsetMuteOnEntry(displayHints: Array<string>): boolean {
    return displayHints.includes(DISPLAY_HINTS.DISABLE_MUTE_ON_ENTRY);
  }

  /**
   * Validate if enabling muting can be set.
   *
   * @param {Array<string>} displayHints - Display Hints to use when validating.
   * @returns {boolean} - True if the action is allowed.
   */
  public static canUnsetDisallowUnmute(displayHints: Array<string>): boolean {
    return displayHints.includes(DISPLAY_HINTS.DISABLE_HARD_MUTE);
  }

  /**
   * Validate if muting all can be set.
   *
   * @param {Array<string>} displayHints - Display Hints to use when validating.
   * @returns {boolean} - True if the action is allowed.
   */
  public static canSetMuted(displayHints: Array<string>): boolean {
    return displayHints.includes(DISPLAY_HINTS.MUTE_ALL);
  }

  /**
   * Validate if unmuting all can be set.
   *
   * @param {Array<string>} displayHints - Display Hints to use when validating.
   * @returns {boolean} - True if the action is allowed.
   */
  public static canUnsetMuted(displayHints: Array<string>): boolean {
    return displayHints.includes(DISPLAY_HINTS.UNMUTE_ALL);
  }

  /**
   * Validate an array of hints are allowed based on a full collection of hints.
   *
   * @param {Object} config - Configuration Object.
   * @param {Array<string>} config.requiredHints - Hints required for validation.
   * @param {Array<string>} config.displayHints - All available hints.
   * @returns {boolean} - True if all of the actions are allowed.
   */
  public static hasHints(config: {requiredHints: Array<string>; displayHints: Array<string>}) {
    const {requiredHints, displayHints} = config;

    return requiredHints.every((hint) => displayHints.includes(hint));
  }

  /**
   * Validate that the self policy object contains the required policies.
   *
   * @param {Object} config - Configuration Object.
   * @param {Array<string>} config.requiredPolicies - Policies required for validation.
   * @param {Array<string>} config.policies - All available policies.
   * @returns {boolean} - True if all the actions are allowed.
   */
  public static hasPolicies(config: {
    requiredPolicies: Array<string>;
    policies: Record<string, unknown>[];
  }): boolean {
    const {requiredPolicies, policies = {} as Record<string, unknown>} = config;

    return requiredPolicies.every((hint) => policies[hint]);
  }

  /**
   * Validate if an audio-scoped control is allowed to be sent to the service.
   *
   * @param {ControlConfig<AudioProperties>} control - Audio control config to validate.
   * @param {Array<string>} displayHints - All available hints.
   * @returns {boolean} - True if all the actions are allowed.
   */
  public static canUpdateAudio(
    control: ControlConfig<AudioProperties>,
    displayHints: Array<string>
  ) {
    const requiredHints = [];

    if (control.properties.muted === true) {
      requiredHints.push(DISPLAY_HINTS.MUTE_ALL);
    }
    if (control.properties.muted === false) {
      requiredHints.push(DISPLAY_HINTS.UNMUTE_ALL);
    }
    if (control.properties.disallowUnmute === true) {
      requiredHints.push(DISPLAY_HINTS.ENABLE_HARD_MUTE);
    }
    if (control.properties.disallowUnmute === false) {
      requiredHints.push(DISPLAY_HINTS.DISABLE_HARD_MUTE);
    }
    if (control.properties.muteOnEntry === true) {
      requiredHints.push(DISPLAY_HINTS.ENABLE_MUTE_ON_ENTRY);
    }
    if (control.properties.muteOnEntry === false) {
      requiredHints.push(DISPLAY_HINTS.DISABLE_MUTE_ON_ENTRY);
    }

    return Utils.hasHints({requiredHints, displayHints});
  }

  public static canUpdateRaiseHand(
    control: ControlConfig<RaiseHandProperties>,
    displayHints: Array<string>
  ) {
    const requiredHints = [];

    if (control.properties.enabled === true) {
      requiredHints.push(DISPLAY_HINTS.ENABLE_RAISE_HAND);
    }
    if (control.properties.enabled === false) {
      requiredHints.push(DISPLAY_HINTS.DISABLE_RAISE_HAND);
    }

    return Utils.hasHints({requiredHints, displayHints});
  }

  /**
   * Validate if an reactions-scoped control is allowed to be sent to the service.
   *
   * @param {ControlConfig<ReactionsProperties>} control - Reaction control config to validate.
   * @param {Array<string>} displayHints - All available hints.
   * @returns {boolean} - True if all of the actions are allowed.
   */
  public static canUpdateReactions(
    control: ControlConfig<ReactionsProperties>,
    displayHints: Array<string>
  ) {
    const requiredHints = [];

    // This additional if statement avoids the display hint discrepency due to
    // the service blocking partial requests with this property only.
    if (control.properties.showDisplayNameWithReactions !== undefined) {
      if (control.properties.showDisplayNameWithReactions) {
        requiredHints.push(DISPLAY_HINTS.ENABLE_SHOW_DISPLAY_NAME);
      }
      if (!control.properties.showDisplayNameWithReactions) {
        requiredHints.push(DISPLAY_HINTS.DISABLE_SHOW_DISPLAY_NAME);
      }
    } else {
      if (control.properties.enabled === true) {
        requiredHints.push(DISPLAY_HINTS.ENABLE_REACTIONS);
      }
      if (control.properties.enabled === false) {
        requiredHints.push(DISPLAY_HINTS.DISABLE_REACTIONS);
      }
    }

    return Utils.hasHints({requiredHints, displayHints});
  }

  /**
   * Validate if an share-control-scoped control is allowed to be sent to the service.
   *
   * @param {Array<string>} displayHints - All available hints.
   * @returns {boolean} - True if all of the actions are allowed.
   */
  public static canUpdateShareControl(displayHints: Array<string>) {
    return Utils.hasHints({requiredHints: [DISPLAY_HINTS.SHARE_CONTROL], displayHints});
  }

  /**
   * Validate if an view-the-participants-list-scoped control is allowed to be sent to the service.
   *
   * @param {ControlConfig<ViewTheParticipantListProperties>} control - View Participants List control config to validate.
   * @param {Array<string>} displayHints - All available hints.
   * @returns {boolean} - True if all of the actions are allowed.
   */
  public static canUpdateViewTheParticipantsList(
    control: ControlConfig<ViewTheParticipantListProperties>,
    displayHints: Array<string>
  ) {
    const requiredHints = [];

    if (control.properties.enabled === true) {
      requiredHints.push(DISPLAY_HINTS.ENABLE_VIEW_THE_PARTICIPANT_LIST);
    }
    if (control.properties.enabled === false) {
      requiredHints.push(DISPLAY_HINTS.DISABLE_VIEW_THE_PARTICIPANT_LIST);
    }

    return Utils.hasHints({requiredHints, displayHints});
  }

  /**
   * Validate if a video-scoped control is allowed to be sent to the service.
   *
   * @param {ControlConfig<VideoProperties>} control - Video control config to validate.
   * @param {Array<string>} displayHints - All available hints.
   * @returns {boolean} - True if all of the actions are allowed.
   */
  public static canUpdateVideo(
    control: ControlConfig<VideoProperties>,
    displayHints: Array<string>
  ) {
    const requiredHints = [];

    if (control.properties.enabled === true) {
      requiredHints.push(DISPLAY_HINTS.ENABLE_VIDEO);
    }
    if (control.properties.enabled === false) {
      requiredHints.push(DISPLAY_HINTS.DISABLE_VIDEO);
    }

    return Utils.hasHints({requiredHints, displayHints});
  }

  /**
   * Validate that a control can be sent to the service based on the provided
   * display hints.
   *
   * @param {ControlConfig} control - Control to validate.
   * @param {Array<string>} displayHints - All available hints.
   * @returns {boolean} - True if all of the actions are allowed.
   */
  public static canUpdate(control: ControlConfig, displayHints: Array<string>) {
    let determinant: boolean;

    switch (control.scope) {
      case Control.audio:
        determinant = Utils.canUpdateAudio(control as ControlConfig<AudioProperties>, displayHints);
        break;

      case Control.raiseHand:
        determinant = Utils.canUpdateRaiseHand(
          control as ControlConfig<RaiseHandProperties>,
          displayHints
        );
        break;

      case Control.reactions:
        determinant = Utils.canUpdateReactions(
          control as ControlConfig<ReactionsProperties>,
          displayHints
        );
        break;

      case Control.shareControl:
        determinant = Utils.canUpdateShareControl(displayHints);
        break;

      case Control.video:
        determinant = Utils.canUpdateVideo(control as ControlConfig<VideoProperties>, displayHints);
        break;

      case Control.viewTheParticipantList:
        determinant = Utils.canUpdateViewTheParticipantsList(
          control as ControlConfig<ViewTheParticipantListProperties>,
          displayHints
        );
        break;

      default:
        determinant = false;
    }

    return determinant;
  }
}

export type UtilsMethodKeys = {
  [K in keyof typeof Utils]: (typeof Utils)[K] extends (arg: Array<string>) => boolean ? K : never;
}[keyof typeof Utils];

export default Utils;

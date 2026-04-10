import {CONTROLS, DISPLAY_HINTS, HTTP_VERBS} from '../constants';
import {Control} from './enums';
import {AUDIO_CONTROL_BODY_KEYS} from './constants';
import {
  ControlConfig,
  AudioProperties,
  RaiseHandProperties,
  ReactionsProperties,
  ViewTheParticipantListProperties,
  VideoProperties,
  type RemoteDesktopControlProperties,
  type AnnotationProperties,
  type PollingQAProperties,
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
   * @returns {boolean} - True if all of the actions are allowed.
   */
  public static hasPolicies(config: {requiredPolicies: Array<string>; policies: Array<string>}) {
    const {requiredPolicies, policies = {}} = config;

    return requiredPolicies.every((hint) => policies[hint]);
  }

  /**
   * Validate if an audio-scoped control is allowed to be sent to the service.
   *
   * @param {ControlConfig<AudioProperties>} control - Audio control config to validate.
   * @param {Array<string>} displayHints - All available hints.
   * @returns {boolean} - True if all of the actions are allowed.
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
      if (control.properties.showDisplayNameWithReactions === true) {
        requiredHints.push(DISPLAY_HINTS.ENABLE_SHOW_DISPLAY_NAME);
      }
      if (control.properties.showDisplayNameWithReactions === false) {
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
    if (control.properties.panelistEnabled === true) {
      requiredHints.push(DISPLAY_HINTS.ENABLE_VIEW_THE_PARTICIPANT_LIST_PANELIST);
    }
    if (control.properties.panelistEnabled === false) {
      requiredHints.push(DISPLAY_HINTS.DISABLE_VIEW_THE_PARTICIPANT_LIST_PANELIST);
    }
    if (control.properties.attendeeCount === true) {
      requiredHints.push(DISPLAY_HINTS.ENABLE_SHOW_ATTENDEE_COUNT);
    }
    if (control.properties.attendeeCount === false) {
      requiredHints.push(DISPLAY_HINTS.DISABLE_SHOW_ATTENDEE_COUNT);
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
   * Validate if a annotation-scoped control is allowed to be sent to the service.
   *
   * @param {ControlConfig<AnnotationProperties>} control - Annotation control config to validate
   * @param {Array<string>} displayHints - All available hints
   * @returns {boolean} - True if all of the actions are allowed.
   */
  public static canUpdateAnnotation(
    control: ControlConfig<AnnotationProperties>,
    displayHints: Array<string>
  ): boolean {
    const requiredHints = [];

    if (control.properties.enabled === true) {
      requiredHints.push(DISPLAY_HINTS.ENABLE_ANNOTATION_MEETING_OPTION);
    }
    if (control.properties.enabled === false) {
      requiredHints.push(DISPLAY_HINTS.DISABLE_ANNOTATION_MEETING_OPTION);
    }

    return Utils.hasHints({requiredHints, displayHints});
  }

  /**
   * Validate if a rdc-scoped control is allowed to be sent to the service.
   *
   * @param {ControlConfig<RemoteDesktopControlProperties>} control - Remote Desktop Control config to validate
   * @param {Array<string>} displayHints - All available hints
   * @returns {boolean} - True if all of the actions are allowed.
   */
  public static canUpdateRemoteDesktopControl(
    control: ControlConfig<RemoteDesktopControlProperties>,
    displayHints: Array<string>
  ): boolean {
    const requiredHints = [];

    if (control.properties.enabled === true) {
      requiredHints.push(DISPLAY_HINTS.ENABLE_RDC_MEETING_OPTION);
    }
    if (control.properties.enabled === false) {
      requiredHints.push(DISPLAY_HINTS.DISABLE_RDC_MEETING_OPTION);
    }

    return Utils.hasHints({requiredHints, displayHints});
  }

  /**
   * Validate if a pollingQA-scoped control is allowed to be sent to the service.
   *
   * @param {ControlConfig<PollingQAProperties>} control - Polling QA config to validate
   * @param {Array<string>} displayHints - All available hints
   * @returns {boolean} - True if all of the actions are allowed.
   */
  public static canUpdatePollingQA(
    control: ControlConfig<PollingQAProperties>,
    displayHints: Array<string>
  ): boolean {
    const requiredHints = [];

    if (control.properties.enabled === true) {
      requiredHints.push(DISPLAY_HINTS.ENABLE_ATTENDEE_START_POLLING_QA);
    }
    if (control.properties.enabled === false) {
      requiredHints.push(DISPLAY_HINTS.DISABLE_ATTENDEE_START_POLLING_QA);
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

      case Control.annotation:
        determinant = Utils.canUpdateAnnotation(
          control as ControlConfig<AnnotationProperties>,
          displayHints
        );
        break;

      case Control.rdc:
        determinant = Utils.canUpdateRemoteDesktopControl(
          control as ControlConfig<RemoteDesktopControlProperties>,
          displayHints
        );
        break;

      case Control.pollingQA:
        determinant = Utils.canUpdatePollingQA(
          control as ControlConfig<PollingQAProperties>,
          displayHints
        );
        break;

      default:
        determinant = false;
    }

    return determinant;
  }

  /**
   * Check if all body keys represent audio controls.
   *
   * @param {Record<string, any>} body - The request body to inspect.
   * @returns {boolean} - True if every key in the body is an audio control key.
   */
  public static isAudioControl(body: Record<string, any>): boolean {
    return Object.keys(body).every((key) => AUDIO_CONTROL_BODY_KEYS.has(key));
  }

  /**
   * Check if the current locus URL differs from the main locus URL,
   * indicating a breakout session.
   *
   * @param {string} locusUrl - The current locus URL.
   * @param {string} [mainLocusUrl] - The main locus URL.
   * @returns {boolean} - True if in a breakout session.
   */
  public static isBreakoutLocusUrl(locusUrl: string, mainLocusUrl?: string): boolean {
    return Boolean(mainLocusUrl) && mainLocusUrl !== locusUrl;
  }

  /**
   * Resolve the target URL and extra body fields for a controls request,
   * handling breakout session routing. Note: This is a pure computation function.
   * It does not validate that locusUrl is
   * defined. Callers must guard against falsy locusUrl before
   * invoking this function.
   * Mixed audio and non-audio keys in a single body (e.g., {audio: {...},
   * raiseHand: {...}}) are treated as non-audio and routed to mainLocusUrl with
   * authorizingLocusUrl. This means the audio portion would go through unsupported
   * cross-locus authorization. Callers must not produce mixed payloads — update()
   * sends each control scope as a separate request, and setControls() only handles
   * audio-related settings.
   *
   * The authorizingLocusUrl mechanism on PATCH /loci/{lid}/controls is not supported
   * for audio control updates (mute/unmute, muteOnEntry, disallowUnmute).
   * Audio controls are not wired into the cross-locus GraphQL authorization path that
   * other control types (raiseHand, viewParticipantList, admit, reactions, etc.) use.
   * Specifically, the GraphQL authorization layer does not recognize audio as a control
   * type eligible for remote locus authorization.
   * This means authorizingLocusUrl is effectively ignored for audio controls and the
   * server evaluates the request against the target locus only, where the host may not
   * be currently joined.
   * Audio control updates must be sent directly to the locus the user is currently in.
   * If the host is in a breakout and wants to mute participants in that breakout, the
   * request should target the breakout locus URL directly, not the main session locus
   * with authorizingLocusUrl.
   * Meeting-wide audio control actions (e.g., muting panelists across all breakouts
   * from a single request) are not currently supported through this mechanism.
   *
   * @param {object} options
   * @param {Record<string, any>} options.body - The request body.
   * @param {string} options.locusUrl - The current locus URL. Must be defined (callers must validate).
   * @param {string} [options.mainLocusUrl] - The main locus URL.
   * @returns {{ uri: string, body: Record<string, any>, method: string }}
   */
  public static getControlsRequestParams(options: {
    body: Record<string, any>;
    locusUrl: string;
    mainLocusUrl?: string;
  }): {
    uri: string;
    body: Record<string, any>;
    method: string;
  } {
    const {body, locusUrl, mainLocusUrl} = options;

    const isAudio = Utils.isAudioControl(body);
    const inBreakout = Utils.isBreakoutLocusUrl(locusUrl, mainLocusUrl);
    const targetUrl = inBreakout && !isAudio ? mainLocusUrl : locusUrl;

    return {
      uri: `${targetUrl}/${CONTROLS}`,
      body: inBreakout && !isAudio ? {...body, authorizingLocusUrl: locusUrl} : body,
      method: HTTP_VERBS.PATCH,
    };
  }
}

export default Utils;

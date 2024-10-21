/**
 * Represents the response from getUserUsingCI method.
 *
 * @public
 */

export interface UserResponse {
  /**
   * Identifier for a Desktop Profile.
   */
  agentProfileId: string;

  /**
   * This Specify the teams id which got assigned to the user.
   */
  teamIds: string[];

  /**
   * Identifier for an user profile which a Contact Center administrator has configured.
   */
  userProfileId: string;
}

/**
 * Represents the response from getDesktopProfileById method.
 *
 * @public
 */
export interface DesktopProfileResponse {
  /**
   * Represents the voice options of an agent.
   */

  loginVoiceOptions: string[];

  /**
   * Specify the wrap-up codes that the agents can select when they wrap up a contact.
   */

  accessWrapUpCode: string;

  /**
   * Specify the Idle codes that the agents can select in Agent Desktop.
   */

  accessIdleCode: string;

  /**
   * Specify the wrap-up codes list that the agents can select when they wrap up a contact.
   */

  wrapUpCodes: string[];

  /**
   * Specify the Idle codes list that the agents can select in Agent Desktop.
   */

  idleCodes: string[];
}

/**
 * Represents the response from getListOfTeams method.
 *
 * @public
 */
export interface ListTeamsResponse {
  /**
   * ID of the team.
   */
  id: string;

  /**
   *  Name of the Team.
   */
  name: string;
}

/**
 * Represents AuxCode.
 * @public
 */

export interface AuxCode {
  /**
   * ID of the Auxiliary Code.
   */
  id: string;

  /**
   * Indicates whether the auxiliary code is active or not active.
   */
  active: boolean;

  /**
   * Indicates whether this is the default code (true) or not (false).
   */
  defaultCode: boolean;

  /**
   * Indicates whether this is the system default code (true) or not (false).
   */
  isSystemCode: boolean;

  /**
   * A short description indicating the context of the code.
   */
  description: string;

  /**
   * Name for the Auxiliary Code.
   */
  name: string;

  /**
   * Indicates the work type associated with this code..
   */

  workTypeCode: string;
}

/**
 * Represents the response from getListOfAuxCodes method.
 *
 * @public
 */

export interface ListAuxCodesResponse {
  data: AuxCode[];
}

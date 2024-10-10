/**
 * Represents the request to UserRequest.
 *
 * @public
 */

export interface UserRequest {
  /**
   * Org id of the User
   */
  orgId: string;

  /**
   * CI user id of the User
   */
  ciUserId: string;
}

/**
 * Represents the response from UserResponse.
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
 * Represents the request to DesktopProfileRequest.
 *
 * @public
 */

export interface DesktopProfileRequest {
  /**
   * ID of the Organization containing the Desktop Profile to be retrieved.
   */
  orgId: string;

  /**
   * ID of the Desktop Profile to be retrieved.
   */
  desktopProfileId: string;
}

/**
 * Represents the response from DesktopProfileResponse.
 *
 * @public
 */
export interface DesktopProfileResponse {
  /**
   * Specify the teams list that the agents can select from the Agent drop-down list on the Agent Desktop.
   */
  buddyTeams: string[];

  /**
   * Specify the Idle codes list that the agents can select in Agent Desktop.
   */
  idleCodes: string[];

  /**
   * Specify the queues list that the agents can select from the Queue drop-down list on the Agent Desktop.
   */
  queues: string[];

  /**
   * Specify the wrap-up codes list that the agents can select when they wrap up a contact.
   */
  wrapUpCodes: string[];

  /**
   * Represents the teams that an agent is part of.
   */
  teams: string[];

  /**
   * Represents the voice options of an agent.
   */
  loginVoiceOptions: string[];
}

/**
 * Represents the request to ListTeamsRequest.
 *
 * @public
 */

export interface ListTeamsRequest {
  /**
   * Represents Organization ID to be used for this operation..
   */
  orgId: string;

  /**
   * Represents Index of the page of results to be fetched.
   */
  page?: number;

  /**
   * Represents Number of items to be displayed on a page.
   */
  pageSize?: number;

  /**
   * Represents filter which can be applied to the elements to be fetched.
   */
  filter: string[];

  /**
   * Specify the attributes to be returned. Supported attributes are id, name, active and workTypeCode.
   */
  attributes: string[];
}

/**
 * Represents the response from ListTeamsResponse.
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

  /**
   * Indicates whether the Team is active or not active.
   */
  active: boolean;

  /**
   * Status indicating whether the team is available to handle customer contacts.
   */
  teamStatus: string;

  /**
   * Represent type of the team, it can be of type AGENT or CAPACITY.
   */
  teamType: string;
}

/**
 * Represents the request to ListAuxCodesRequest.
 *
 * @public
 */

export interface ListAuxCodesRequest {
  /**
   * Represents Organization ID to be used for this operation.
   */

  ordId: string;

  /**
   * Represents Index of the page of results to be fetched.
   */
  page?: number;

  /**
   * Represents Number of items to be displayed on a page.
   */
  pageSize?: number;

  /**
   * Represents filter which can be applied to the elements to be fetched.
   */
  filter: string[];

  /**
   * Specify the attributes to be returned. Supported attributes are id, name, active and workTypeCode.
   */
  attributes: string[];
}

/**
 * Represents the response from ListAuxCodesResponse.
 *
 * @public
 */

export interface ListAuxCodesResponse {
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
   * Indicates the work type associated with this code.
   */
  workTypeCode: string;

  /**
   * Indicates the work type associated with this code.
   */
  workTypeId: string;

  /**
   * Creation time (in epoch millis) of this resource.
   */
  createdTime: number;

  /**
   * Time (in epoch millis) when this resource was last updated.
   */
  lastUpdatedTime: number;

  /**
   * The version number (revision count) for the resource.
   */
  version: number;
}

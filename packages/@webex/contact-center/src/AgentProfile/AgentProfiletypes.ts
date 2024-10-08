/**
 * Represents the request to a AgentProfile.
 *
 * @public
 */
export interface AgentProfileRequest {
  /**
   * CI ID of the User
   */
  ciUserId: string;
}

/**
 * Represents the response from a AgentProfile.
 *
 * @public
 */
export interface AgentProfileResponse {
  /**
   * Represents teams of an Logged in Agent.
   */
  teams: string[];
  /**
   * Represent loginOptions of an Logged in Agent.
   */
  loginOptions: string[];
  /**
   * Represent idleCodes of an Logged in Agent.
   */
  idleCodes: string[];
  /**
   * Represent wrapUpCodes of an Logged in Agent.
   */
  wrapUpCodes: string[];
}

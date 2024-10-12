import {
  DesktopProfileResponse,
  ListAuxCodesResponse,
  ListTeamsResponse,
  UserResponse,
} from '../AgentProfileService/AgentProfileService.types';

/**
 * Represents the request to a AgentProfile.
 *
 * @public
 */
export interface AgentProfileRequest {
  /**
   * CI user id of the User
   */
  ciUserId: string;

  /**
   * Org id of the User
   */
  orgId: string;
}

/**
 * Represents the response from a AgentProfile.
 *
 * @public
 */
export interface AgentProfileResponse {
  /**
   * Represents details of a user.
   */
  userDetails: UserResponse;
  /**
   * Represents desktop profile of an agent.
   */
  agentDesktopProfile: DesktopProfileResponse;
  /**
   * Represents list of teams of an agent.
   */
  teamsList: ListTeamsResponse;
  /**
   * Represents list of Aux codes of an agent.
   */
  auxCodesList: ListAuxCodesResponse;
}

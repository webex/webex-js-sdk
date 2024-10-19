import {AuxCode, ListTeamsResponse} from '../AgentConfigService/types';
import {WebexSDK} from '../types';

/**
 * Represents the request to a AgentConfig
 *
 * @public
 */
export interface AgentConfigRequest {
  /**
   * CI user id of the User.
   */
  ciUserId: string;

  /**
   * Represents object of WebexSDK.
   */

  webex: WebexSDK;

  /**
   * Org id of the User.
   */
  orgId: string;
}

/**
 * Represents the response from AgentConfig.
 *
 * @public
 */
export interface IAgentConfig {
  /**
   * Represents list of teams of an agent.
   */
  teams: ListTeamsResponse[];

  /**
   * Represents the voice options of an agent.
   */

  loginVoiceOptions: string[];

  /**
   * Represents the Idle codes list that the agents can select in Agent Desktop.t.
   */

  idleCodes: AuxCode[];

  /**
   * Represents the wrap-up codes list that the agents can select when they wrap up a contact.
   */
  wrapUpCodes: AuxCode[];
}

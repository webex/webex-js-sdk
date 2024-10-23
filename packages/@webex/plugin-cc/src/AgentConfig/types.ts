import {AuxCode, ListTeamsResponse} from '../AgentConfigService/types';
import {WebexSDK} from '../types';

type Enum<T extends Record<string, unknown>> = T[keyof T];

// Define the  object
export const WORK_TYPE_CODE = {
  WRAP_UP_CODE: 'WRAP_UP_CODE',
  IDLE_CODE: 'IDLE_CODE',
} as const;

// Derive the type using the utility type
type WORK_TYPE_CODE = Enum<typeof WORK_TYPE_CODE>;

/**
 * Represents the request to a AgentConfig
 *
 * @public
 */
export interface AgentConfigRequest {
  /**
   * CI user id of the User.
   */
  agentId: string;

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
   * The id of the agent.
   */

  agentId: string;

  /**
   * The first name of the agent.
   */
  agentFirstName: string;

  /**
   * The last name of the agent.
   */
  agentLastName: string;

  /**
   * Identifier for a Desktop Profile.
   */
  agentProfileId: string;

  /**
   * The email address of the agent.
   */

  agentMailId: string;

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

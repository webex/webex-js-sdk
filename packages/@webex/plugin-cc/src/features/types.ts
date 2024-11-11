import {WebexSDK} from '../types';
import * as Agent from '../services/agent/types';

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
export type AgentConfigRequest = {
  /**
   * Represents id of agent.
   */
  agentId: string;

  /**
   * Represents object of WebexSDK.
   */

  webex: WebexSDK;

  /**
   * Org id of the agent.
   */
  orgId: string;
};

/**
 * Represents the response from setAgentStatus.
 *
 * @public
 */
export type SetStateResponse = {
  data?: Agent.StateChangeSuccess;
  error?: string;
};

export type StationLoginResponse = Agent.StationLoginSuccess | Error;

import {AuxCode, WelcomeEvent} from '../../types';
import * as Agent from '../agent/types';

type Enum<T extends Record<string, unknown>> = T[keyof T];

// Define the CC_EVENTS object
export const CC_EVENTS = {
  WELCOME: 'Welcome',
  AGENT_RELOGIN_SUCCESS: 'AgentReloginSuccess',
  AGENT_RELOGIN_FAILED: 'AgentReloginFailed',
  AGENT_LOGOUT: 'Logout',
  AGENT_LOGOUT_SUCCESS: 'AgentLogoutSuccess',
  AGENT_LOGOUT_FAILED: 'AgentLogoutFailed',
  AGENT_STATION_LOGIN: 'StationLogin',
  AGENT_STATION_LOGIN_SUCCESS: 'AgentStationLoginSuccess',
  AGENT_STATION_LOGIN_FAILED: 'AgentStationLoginFailed',
  AGENT_STATE_CHANGE: 'AgentStateChange',
  AGENT_STATE_CHANGE_SUCCESS: 'AgentStateChangeSuccess',
  AGENT_STATE_CHANGE_FAILED: 'AgentStateChangeFailed',
  AGENT_BUDDY_AGENTS: 'BuddyAgents',
  AGENT_BUDDY_AGENTS_SUCCESS: 'BuddyAgents',
  AGENT_BUDDY_AGENTS_RETRIEVE_FAILED: 'BuddyAgentsRetrieveFailed',
} as const;

// Derive the type using the utility type
export type CC_EVENTS = Enum<typeof CC_EVENTS>;

export type WebSocketEvent = {
  type: CC_EVENTS;
  data:
    | WelcomeEvent
    | Agent.StationLoginSuccess
    | Agent.LogoutSuccess
    | Agent.ReloginSuccess
    | Agent.StateChangeSuccess
    | Agent.BuddyAgentsSuccess;
};

/**
 * Represents the response from getUserUsingCI method.
 *
 * @public
 */

export type AgentResponse = {
  /**
   * The first name of the agent.
   */
  firstName: string;

  /**
   * The last name of the agent.
   */
  lastName: string;

  /**
   * Identifier for a Desktop Profile.
   */
  agentProfileId: string;

  /**
   * The email address of the agent.
   */

  email: string;

  /**
   * This Specify the teams id which got assigned to the agent.
   */
  teamIds: string[];
};

/**
 * Represents the response from getDesktopProfileById method.
 *
 * @public
 */
export type DesktopProfileResponse = {
  /**
   * Represents the voice options of an agent.
   */

  loginVoiceOptions: string[];

  /**
   * Specify the wrap-up codes that the agents can select when they wrap up a contact. It can take one of these values: ALL - To make all wrap-up codes available. SPECIFIC - To make specific codes available.
   */

  accessWrapUpCode: string;

  /**
   * Specify the Idle codes that the agents can select in Agent Desktop. It can take one of these values: ALL - To make all wrap-up codes available. SPECIFIC - To make specific codes available.
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
};

export type SubscribeResponse = {
  statusCode: number;
  body: {
    webSocketUrl?: string;
    subscriptionId?: string;
  };
  message: string | null;
};

/**
 * Represents the response from getListOfAuxCodes method.
 *
 * @public
 */

export type ListAuxCodesResponse = {
  data: AuxCode[];
};

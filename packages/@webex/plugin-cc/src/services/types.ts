type Enum<T extends Record<string, unknown>> = T[keyof T];

export type Msg<T = any> = {
  type: string;
  orgId: string;
  trackingId: string;
  data: T;
};

// Define the CC_EVENTS object
export const CC_EVENTS = {
  WELCOME: 'Welcome',
} as const;

// Derive the type using the utility type
export type CC_EVENTS = Enum<typeof CC_EVENTS>;

export interface WebSocketEvent {
  type: CC_EVENTS;
  data: {
    agentId: string;
  };
}

/**
 * Represents the response from getUserUsingCI method.
 *
 * @public
 */

export interface AgentResponse {
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
}

/**
 * Represents the request to a AgentLogin
 *
 * @public
 */
export interface AgentLoginRequest {
  /**
   * A dialNumber field contains the number to dial such as a route point or extension.
   */

  dialNumber: string;

  /**
   * The unique ID representing a team of users.
   */

  teamId?: string;

  /**
   * It indicates if the dialNumber field is full number or extension. It is set to false by default.
   */

  isExtension?: boolean;

  /**
   * It represents the current role of the user. The user can either be an agent or a supervisor.
   */

  roles: string[];

  /**
   * It represents the way to differentiate type of login request it can either be (AGENT_DN, EXTENSION, BROWSER).
   */

  deviceType?: string;

  /**
   * It is equal to dialNumber for AGENT_DN & EXTENSION deviceType and for BROWSER it is populated as webrtc-AgentUUID.
   */

  deviceId?: string;
}

export interface StationLoginSuccess {
  eventType: 'AgentDesktopMessage';
  agentId: string;
  trackingId: string;
  auxCodeId: string;
  teamId: string;
  agentSessionId: string;
  orgId: string;
  interactionIds: string[];
  status: string;
  subStatus: 'Available' | 'Idle';
  siteId: string;
  lastIdleCodeChangeTimestamp: number;
  lastStateChangeTimestamp: number;
  profileType: string;
  channelsMap: Record<string, string[]>;
  dialNumber?: string;
  roles?: string[];
  supervisorSessionId?: string;
  type: 'AgentStationLoginSuccess';
}

export type SubscribeResponse = {
  statusCode: number;
  body: {
    webSocketUrl?: string;
    subscriptionId?: string;
  };
  message: string | null;
};

/**
 * Represents the response from getListOfTeams method.
 *
 * @public
 */
export interface Team {
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

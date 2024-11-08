import {LoginOption} from '../../types';

type Enum<T extends Record<string, unknown>> = T[keyof T];

// Define the CC_EVENTS object
export const CC_EVENTS = {
  WELCOME: 'Welcome',
} as const;

// Derive the type using the utility type
export type CC_EVENTS = Enum<typeof CC_EVENTS>;

export type WebSocketEvent = {
  type: CC_EVENTS;
  data: {
    agentId: string;
  };
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

/**
 * Represents the request to a AgentLogin
 *
 * @public
 */
export type AgentLogin = {
  /**
   * A dialNumber field contains the number to dial such as a route point or extension.
   */

  dialNumber?: string;

  /**
   * The unique ID representing a team of users.
   */

  teamId: string;

  /**
   * The loginOption field contains the type of login.
   */

  loginOption: LoginOption;
};

export type UserStationLogin = {
  dialNumber?: string | null;
  dn?: string | null;
  teamId: string | null;
  teamName?: string | null;
  roles?: Array<string>;
  siteId?: string;
  usesOtherDN?: boolean;
  skillProfileId?: string;
  auxCodeId?: string;
  isExtension?: boolean;
  deviceType?: LoginOption;
  deviceId: string | null;
  isEmergencyModalAlreadyDisplayed?: boolean;
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
 * Represents the response from getListOfTeams method.
 *
 * @public
 */
export type Team = {
  /**
   * ID of the team.
   */
  id: string;

  /**
   *  Name of the Team.
   */
  name: string;
};

/**
 * Represents AuxCode.
 * @public
 */

export type AuxCode = {
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
};

/**
 * Represents the response from getListOfAuxCodes method.
 *
 * @public
 */

export type ListAuxCodesResponse = {
  data: AuxCode[];
};

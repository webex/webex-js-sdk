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

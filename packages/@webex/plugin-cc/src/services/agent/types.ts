import {Msg} from '../core/GlobalTypes';

export type LogoutSuccess = Msg<{
  eventType: string;
  agentId: string;
  trackingId: string;
  agentSessionId: string;
  orgId: string;
  status: string;
  subStatus: string;
  loggedOutBy?: string;
  roles?: string[];
  type: string;
}>;

export type ReloginSuccess = Msg<{
  eventType: string;
  agentId: string;
  trackingId: string;
  auxCodeId: string;
  teamId: string;
  agentSessionId: string;
  dn: string;
  orgId: string;
  interactionIds: string[];
  isExtension: boolean;
  status: 'LoggedIn';
  subStatus: 'Idle';
  siteId: string;
  lastIdleCodeChangeTimestamp: number;
  lastStateChangeTimestamp: number;
  lastStateChangeReason?: string;
  profileType: string;
  channelsMap: Record<string, string[]>;
  dialNumber?: string;
  roles?: string[];
  deviceType?: DeviceType;
  deviceId?: string | null;
  isEmergencyModalAlreadyDisplayed?: boolean;
  type: string;
}>;

export type StateChangeSuccess = Msg<{
  eventType: string;
  agentId: string;
  trackingId: string;
  auxCodeId: string;
  agentSessionId: string;
  orgId: string;
  status: string;
  subStatus: 'Available' | 'Idle';
  lastIdleCodeChangeTimestamp: number;
  lastStateChangeTimestamp: number;
  type: string;
  changedBy: string | null;
  changedById: string | null;
  changedByName: string | null;
  lastStateChangeReason: string;
}>;

export type StationLoginSuccess = Msg<{
  eventType: string;
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
  type: string;
}>;

export type DNRegistered = Msg<{
  eventType: string;
  agentId: string;
  trackingId: string;
  dn: string;
  orgId: string;
  type: string;
}>;

export type Logout = {logoutReason?: 'User requested logout' | 'Inactivity Logout'};

export type AgentState = 'Available' | 'Idle' | 'RONA' | string;

export type StateChange = {
  state: AgentState;
  auxCodeId: string;
  lastStateChangeReason?: string;
  agentId?: string;
};

export type UserStationLogin = {
  dialNumber?: string | null;
  dn?: string | null;
  teamId: string | null;
  teamName: string | null;
  roles?: Array<string>;
  siteId: string;
  usesOtherDN: boolean;
  skillProfileId?: string;
  auxCodeId: string;
  isExtension?: boolean;
  deviceType?: DeviceType;
  deviceId?: string | null;
  isEmergencyModalAlreadyDisplayed?: boolean;
};

export type LoginOption = 'AGENT_DN' | 'EXTENSION' | 'BROWSER';

export type DeviceType = LoginOption | string;

export type BuddyAgents = {
  agentProfileId: string;
  mediaType: string;
  /** Filter for agent state eg : Available | Idle  */
  state?: string;
};

export type BuddyDetails = {
  agentId: string;
  state: string;
  teamId: string;
  dn: string;
  agentName: string;
  siteId: string;
};

export type BuddyAgentsSuccess = Msg<{
  eventType: string;
  agentId: string;
  trackingId: string;
  agentSessionId: string;
  orgId: string;
  type: string;
  agentList: Array<BuddyDetails>;
}>;
